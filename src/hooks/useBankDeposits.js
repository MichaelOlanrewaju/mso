import { useState, useEffect, useCallback } from "react"
import { getToken } from "../utils/session"
import { compressImage } from "../utils/compressImage"
import { readJsonReply } from "../utils/readReply"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/* Only these two people actually do the bank run, so only they can log a
   deposit — this is a username allowlist, not a role check, because the
   people who do this may not share a single role. Everyone with dashboard
   access can still see the running Cash At Hand figure. */
export const BANK_DEPOSIT_ALLOWED = ["joseph@msolimpid.com", "lanre@msolimpid.com"]

/* GM (any GM, by role) can access this — plus Joseph and Lanre specifically,
   even if their account role isn't "gm", since they're the two who actually
   do the bank run regardless of title. */
export function canLogBankDeposit(username, role) {
  const byRole = String(role || "").toLowerCase() === "gm"
  const byName = BANK_DEPOSIT_ALLOWED.includes(String(username || "").toLowerCase())
  return byRole || byName
}

/* Wider than canLogBankDeposit: CEO and owner can SEE the full deposit
   history — every amount, who submitted it, and the proof photo — even
   though they can't submit a new one. Without this, the CEO only ever saw a
   single running number with no way to check the actual evidence behind it,
   which defeats the point of asking for proof photos in the first place. */
export function canViewBankDeposits(username, role) {
  const r = String(role || "").toLowerCase()
  return canLogBankDeposit(username, role) || r === "ceo" || r === "owner"
}

const wait = ms => new Promise(r => setTimeout(r, ms))

/* One POST to the script, returning the parsed reply. It NEVER throws: a dropped connection or an
   unreadable (non-JSON) reply comes back as { ok:false, notJson:true, error } so callers can treat
   "the server said no" and "I don't know what happened" differently. */
async function postOnce(payload) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ ...payload, token: getToken() }),
    })
    return await readJsonReply(res)
  } catch (e) {
    return { ok: false, notJson: true, error: "Couldn't reach the server — check your connection." }
  }
}

/* Same idea for reading data: never throws, returns { ok:false, notJson:true, error } when the reply is not
   JSON (a Google busy/timeout/sign-in page), so a screen can show a real reason instead of a browser error. */
async function getJson(url, init) {
  try { return await readJsonReply(await fetch(url, init)) }
  catch (e) { return { ok: false, notJson: true, error: "Couldn't reach the server — check your connection." } }
}

/* For a change that may or may not have gone through when the reply was unreadable. */
const MAYBE_APPLIED = " It may or may not have gone through — refresh the list to check before trying again."

/* After an unreadable reply to a SAVE we can't know whether it saved. Resubmitting blindly would risk
   logging the same money twice, so look instead: every deposit is stored with the unique Drive id of
   its slip photo, so if that id is in the list, the deposit IS saved.
   true = saved, false = definitely not saved, null = couldn't check. */
async function depositWasSaved(station, fileId) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getBankDeposits&station=${station}&_=${Date.now()}`, { cache: "no-store" })
      const d = await readJsonReply(res)
      if (d.ok) return (d.deposits || []).some(x => x.proofFileId === fileId)
    } catch (_) { /* try once more */ }
    await wait(1200)
  }
  return null
}

/* Takes an explicit station rather than reading activeStation() internally,
   so the Bank Deposits page can let Joseph/Lanre/a GM switch between MSO and
   M&M locally — without touching their global session station, which would
   otherwise also change every other page (Dip Entry, Sales, etc.) they use
   day to day for their OWN assigned station. */
export function useBankDeposits(station) {
  const [needsSetup, setNeedsSetup] = useState(false)
  const [cashAtHand, setCashAtHand] = useState(null)
  const [totalContributed, setTotalContributed] = useState(0)
  const [totalDeposited, setTotalDeposited] = useState(0)
  const [lastDepositDate, setLastDepositDate] = useState("")
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    if (!SCRIPT_URL || !station) { setLoading(false); return }
    setLoading(true)
    const bust = Date.now()   // cache-buster: guarantees a unique URL per call
    Promise.all([
      getJson(`${SCRIPT_URL}?action=getCashAtHand&station=${station}&_=${bust}`, { cache: "no-store" }),
      getJson(`${SCRIPT_URL}?action=getBankDeposits&station=${station}&_=${bust}`, { cache: "no-store" }),
    ]).then(([cash, dep]) => {
      if (cash?.ok) {
        setNeedsSetup(!!cash.needsSetup)
        setCashAtHand(cash.cashAtHand)
        setTotalContributed(cash.totalContributed)
        setTotalDeposited(cash.totalDeposited)
        setLastDepositDate(cash.lastDepositDate)
      }
      if (dep?.ok) setDeposits(dep.deposits || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [station])

  useEffect(() => { load() }, [load])

  /* The amount for a SPECIFIC date being deposited — different from the
     running cashAtHand total above. Someone depositing today's takings
     needs to know what TODAY brought in, not the whole undeposited
     balance across every day since tracking started. */
  const [cashForDate, setCashForDate] = useState(null)
  const [existingDepositForDate, setExistingDepositForDate] = useState(null)
  const [loadingDateCash, setLoadingDateCash] = useState(false)

  const loadCashForDate = useCallback((date) => {
    if (!SCRIPT_URL || !station || !date) return
    setLoadingDateCash(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getCashAtHandForDate")
    url.searchParams.set("station", station)
    url.searchParams.set("date", date)
    getJson(url.toString(), { method: "GET", redirect: "follow" })
      .then(d => {
        if (d.ok) {
          setCashForDate(d.cashForDate)
          setExistingDepositForDate(d.existingDeposit)
        } else {
          setCashForDate(null)
          setExistingDepositForDate(null)
        }
      })
      .catch(() => { setCashForDate(null); setExistingDepositForDate(null) })
      .finally(() => setLoadingDateCash(false))
  }, [station])

  const submitStartPoint = useCallback(async ({ startDate, startingBalance }) => {
    if (!SCRIPT_URL || !station) return { ok: false }
    const d = await postOnce({ action: "saveCashTrackingStart", station, startDate, startingBalance })
    if (d.ok) load()
    return d   // an unreadable reply comes back as { ok:false, error:<plain English> }
  }, [load, station])

  const submitDeposit = useCallback(async ({ date, amount, photoFile, notes }) => {
    if (!station) return { ok: false, error: "No station selected." }
    if (!SCRIPT_URL) return { ok: false }
    if (!date) return { ok: false, error: "Select which day's cash this deposit is for." }
    if (!photoFile) return { ok: false, error: "A photo of the deposit slip is required." }
    setSubmitting(true)
    try {
      /* Reading and shrinking the photo happens entirely on the phone, before anything is sent — if
         it fails, nothing has been saved, and the message says so instead of a browser error. */
      let base64
      try {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(r.result)
          r.onerror = () => rej(new Error("the phone couldn't open the file"))
          r.readAsDataURL(photoFile)
        })
        const { dataUrl: compressedDataUrl } = await compressImage(dataUrl)
        base64 = String(compressedDataUrl).split(",")[1]
        if (!base64) throw new Error("the photo came out empty")
      } catch (e) {
        console.error("Deposit slip photo could not be prepared:", e)
        return { ok: false, error: `Couldn't read that photo (${e?.message || "unsupported image"}). Nothing was saved — retake it and try again.` }
      }

      /* Step 1 — upload the slip. If the reply is unreadable it is retried ONCE: that's safe, the
         worst case is a spare copy of the photo in Drive. A real answer from the server, good or
         bad, is never retried. */
      const photoBody = { action: "savePhoto", station, date, session: "BankDeposit", subject: "deposit-slip", mimeType: "image/jpeg", base64 }
      let photoRes = await postOnce(photoBody)
      if (photoRes.notJson) { await wait(900); photoRes = await postOnce(photoBody) }
      if (photoRes.notJson) return { ok: false, error: `The deposit slip photo didn't upload. ${photoRes.error}` }
      if (!photoRes.ok || !photoRes.fileId) return { ok: false, error: "Couldn't upload the deposit slip photo." }

      /* Step 2 — save the deposit. NEVER auto-retried (a repeat could log the money twice). If the
         reply is unreadable we check whether it actually saved and tell the truth either way. */
      const d = await postOnce({ action: "saveBankDeposit", station, date, amount, proofFileId: photoRes.fileId, notes })
      if (d.notJson) {
        const saved = await depositWasSaved(station, photoRes.fileId)
        if (saved === true) { load(); loadCashForDate(date); return { ok: true, status: "PENDING", recovered: true } }
        if (saved === false) return { ok: false, error: `Nothing was saved. ${d.error}` }
        return { ok: false, error: `Couldn't confirm whether it saved. ${d.error} Check the deposit list before trying again — don't submit twice.` }
      }
      if (d.ok) {
        /* The deposit IS saved. Refreshing the screen is a courtesy — if it hiccups it must never turn a
           saved deposit into an error message, or the person would log the same money again. */
        try { load(); loadCashForDate(date) } catch (_) { /* the next refresh will show it */ }
      }
      return d
    } catch (e) {
      /* A bare catch here is exactly what turned a real code bug (calling
         .split() on an object instead of a string, from compressImage)
         into a misleading "Network error" — not actually a network
         problem, just impossible to tell from the message alone. */
      console.error("Bank deposit save failed:", e)
      /* Unexpected, and we can't tell how far it got — so don't claim "nothing saved" and don't invite a retry. */
      return { ok: false, error: "Something went wrong and the app can't tell whether the deposit saved. Check the deposit list before trying again — don't submit twice." }
    } finally {
      setSubmitting(false)
    }
  }, [load, station, loadCashForDate])

  /* Same edit-request/approval gate as everything else — the submitter
     asks, GM/CEO approves, then a one-time edit window opens. Reuses the
     generic EditRequests mechanism with type "bank_deposit". */
  const requestEditForDeposit = useCallback((date, username, message) => {
    return postOnce({ action: "saveEditRequest", station, username, date, type: "bank_deposit", message: message || `Correct a bank deposit on ${date}` })
  }, [station])

  const editDeposit = useCallback(async (rowIndex, amount, notes, username) => {
    const d = await postOnce({ action: "updateBankDeposit", station, username, rowIndex, amount, notes })
    if (d.ok) load()
    else if (d.notJson) return { ...d, error: d.error + MAYBE_APPLIED }
    return d
  }, [station, load])

  return {
    needsSetup, cashAtHand, totalContributed, totalDeposited, lastDepositDate, deposits, loading, submitting,
    submitDeposit, submitStartPoint, refresh: load,
    cashForDate, existingDepositForDate, loadingDateCash, loadCashForDate,
    requestEditForDeposit, editDeposit,
  }
}

/* GM/CEO/Owner's review queue — pending deposits awaiting approval. Cash At
   Hand only actually reflects a deposit once one of these gets approved. */
export function useBankDepositApprovals(station, username) {
  const [pending, setPending] = useState([])
  const [cashAtHandNow, setCashAtHandNow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState(false)

  const load = useCallback(() => {
    if (!SCRIPT_URL || !station || !username) { setLoading(false); return }
    setLoading(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getPendingBankDeposits")
    url.searchParams.set("station", station)
    url.searchParams.set("username", username)
    url.searchParams.set("token", getToken())
    getJson(url.toString(), { method: "GET", redirect: "follow" })
      .then(d => {
        setPending(d.ok ? (d.pending || []) : [])
        setCashAtHandNow(d.ok ? d.cashAtHandNow : null)
      })
      .catch(() => setPending([]))
      .finally(() => setLoading(false))
  }, [station, username])

  useEffect(() => { load() }, [load])

  /* Approve / reject / delete change money records, so an unreadable reply is reported as "may or may
     not have gone through" rather than guessed at, and is never retried automatically. */
  const decide = useCallback(async (rowIndex, approve) => {
    setDeciding(true)
    const d = await postOnce({ action: approve ? "approveBankDeposit" : "rejectBankDeposit", station, username, rowIndex })
    setDeciding(false)
    if (d.ok) load()
    else if (d.notJson) return { ...d, error: d.error + MAYBE_APPLIED }
    return d
  }, [station, username, load])

  const remove = useCallback(async (rowIndex) => {
    setDeciding(true)
    const d = await postOnce({ action: "deleteBankDeposit", station, username, rowIndex })
    setDeciding(false)
    if (d.ok) load()
    else if (d.notJson) return { ...d, error: d.error + MAYBE_APPLIED }
    return d
  }, [station, username, load])

  return { pending, cashAtHandNow, loading, deciding, decide, remove, refresh: load }
}
