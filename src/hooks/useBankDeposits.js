import { useState, useEffect, useCallback } from "react"
import { getToken } from "../utils/session"
import { compressImage } from "../utils/compressImage"

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
      fetch(`${SCRIPT_URL}?action=getCashAtHand&station=${station}&_=${bust}`, { cache: "no-store" }).then(r => r.json()),
      fetch(`${SCRIPT_URL}?action=getBankDeposits&station=${station}&_=${bust}`, { cache: "no-store" }).then(r => r.json()),
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

  const submitStartPoint = useCallback(async ({ startDate, startingBalance }) => {
    if (!SCRIPT_URL || !station) return { ok: false }
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "saveCashTrackingStart", token: getToken(), station, startDate, startingBalance }),
      })
      const d = await res.json()
      if (d.ok) load()
      return d
    } catch (e) {
      console.error("Cash tracking setup failed:", e)
      return { ok: false, error: "Could not save: " + (e?.message || "check connection and try again") }
    }
  }, [load, station])

  const submitDeposit = useCallback(async ({ amount, photoFile, notes }) => {
    if (!station) return { ok: false, error: "No station selected." }
    if (!SCRIPT_URL) return { ok: false }
    if (!photoFile) return { ok: false, error: "A photo of the deposit slip is required." }
    setSubmitting(true)
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result)
        r.onerror = rej
        r.readAsDataURL(photoFile)
      })
      const { dataUrl: compressedDataUrl } = await compressImage(dataUrl)
      const base64 = compressedDataUrl.split(",")[1]

      const photoRes = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "savePhoto", token: getToken(), station, session: "BankDeposit", subject: "deposit-slip", mimeType: "image/jpeg", base64 }),
      }).then(r => r.json())

      if (!photoRes.ok || !photoRes.fileId) return { ok: false, error: "Couldn't upload the deposit slip photo." }

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "saveBankDeposit", token: getToken(), station, amount, proofFileId: photoRes.fileId, notes }),
      })
      const d = await res.json()
      if (d.ok) load()
      return d
    } catch (e) {
      /* A bare catch here is exactly what turned a real code bug (calling
         .split() on an object instead of a string, from compressImage)
         into a misleading "Network error" — not actually a network
         problem, just impossible to tell from the message alone. */
      console.error("Bank deposit save failed:", e)
      return { ok: false, error: "Could not save: " + (e?.message || "check connection and try again") }
    } finally {
      setSubmitting(false)
    }
  }, [load, station])

  return { needsSetup, cashAtHand, totalContributed, totalDeposited, lastDepositDate, deposits, loading, submitting, submitDeposit, submitStartPoint, refresh: load }
}
