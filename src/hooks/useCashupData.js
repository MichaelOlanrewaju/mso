import { useCallback, useEffect, useState } from "react"
import { getCurrentCoords } from "../utils/geolocation"
import { compressImage } from "../utils/compressImage"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
/* The station now comes from the signed-in user's session, not from a
   build-time env var — one deployment serves both MSO and M&M. */
import { activeStation } from "../utils/station"
const MP_RATE = 0.003
const ZM_RATE = 0.003

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

export function useCashupData(username, name, initialDate) {
  const [date, setDate] = useState(initialDate || todayISO())
  const [expected, setExpected] = useState({
    grandTotal: 0, pmsLitres: 0, agoLitres: 0,
    /* 0, not a made-up price. A fabricated default here doesn't just show a
       wrong number — it gets SUBMITTED into DailySales at cash-up and becomes
       stored "real" data that the Summary and Records pages then report. */
    pmsPrice: 0, agoPrice: 0, pmsRevenue: 0, agoRevenue: 0,
    lpgKg: 0, lpgPrice: 0, lpgRevenue: 0,
    hasData: false, closingDipDone: false,
  })
  const [loadingExpected, setLoadingExpected] = useState(true)
  // Proof photos — a photo of the Moniepoint settlement screen and, separately,
  // of the bank deposit slip/alert. These don't auto-verify the typed figures,
  // but they mean a supervisor/owner can glance at the real evidence instead of
  // trusting a number blind — the whole point of adding them.
  const [posProofFileId, setPosProofFileId] = useState("")
  const [posProofUploading, setPosProofUploading] = useState(false)
  const [posMP, setPosMP] = useState("")
  const [posZM, setPosZM] = useState("")
  const [cashAmt, setCashAmt] = useState("")
  // Bank transfers — separate from POS card payments, no processing fee
  const [trfMP, setTrfMP] = useState("")
  const [trfZBAmelia, setTrfZBAmelia] = useState("")
  const [trfFCMBTruck, setTrfFCMBTruck] = useState("")
  const [trfFCMBMD, setTrfFCMBMD] = useState("")
  // EMTL — Electronic Money Transfer Levy, a flat regulatory charge per
  // qualifying bank transfer
  const [emtlCount, setEmtlCount] = useState("")
  const [expenses, setExpenses] = useState([{ desc: "", amt: "" }])
  // Lubricant/oil — itemized product sales, same pattern as expenses
  /* No unitPrice here on purpose. The price is not the cashier's to hold —
     it comes from the LubricantProducts catalogue, is displayed read-only in
     the UI, and is stamped server-side by saveLubricant when the sale saves. */
  const [lubricantItems, setLubricantItems] = useState([{ product: "", qty: "" }])
  /* Catalogue prices, keyed by product, so lubricantTotal can be computed for
     the on-screen reconciliation without ever trusting a client-held price. */
  const [lubPrices, setLubPrices] = useState({})
  // LPG kg/price are no longer entered here — Sales page now owns them
  // (real pump-metered figures), same as PMS/AGO. Cash-up only handles
  // how much was actually remitted, for reconciliation.
  const [lpgRemitted, setLpgRemitted] = useState("")
  const [remarks, setRemarks] = useState("")
  const [saving, setSaving] = useState(false)
  const [cashupStatus, setCashupStatus] = useState("")
  const [cashupLocked, setCashupLocked] = useState(false)
  const [requestingEdit, setRequestingEdit] = useState(false)

  const loadExpected = useCallback(() => {
    if (!SCRIPT_URL) {
      setLoadingExpected(false)
      return
    }
    setLoadingExpected(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getDailyReport")
    url.searchParams.set("station", activeStation())
    url.searchParams.set("date", date)

    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        const r = d.ok ? d.report : null
        const closingDipDone = !!r?.hasClosing
        if (!r || !r.grand_total) {
          setExpected(prev => ({ ...prev, hasData: false, closingDipDone }))
          setLoadingExpected(false)
          return
        }
        /* Same fix as Records/Summary: r.pms_revenue/ago_revenue are stored
           fields that only get written at specific save moments and can sit
           stale at 0 even when real pump readings exist (confirmed directly
           on 23 July — full pump sessions existed while these fields read
           zero). Derive litres LIVE from the real pump sessions when they
           exist; only fall back to the stored fields for older records with
           no PumpMetres rows at all. */
        const map = r.pumpMetres || {}
        let pmsLitresLive = 0, agoLitresLive = 0, hasLive = false
        Object.keys(map).forEach(pump => {
          const sessions = map[pump].sessions || []
          const diff = sessions.length
            ? sessions.reduce((sum, s) => sum + Number(s.diff || 0), 0)
            : Number(map[pump].litres || 0)
          if (sessions.some(s => Number(s.open) > 0 || Number(s.close) > 0) || diff > 0) hasLive = true
          const isAgo = pump.toUpperCase().includes("AGO") || map[pump].product === "AGO"
          if (isAgo) agoLitresLive += diff
          else pmsLitresLive += diff
        })
        const pmsLitres = hasLive ? pmsLitresLive : (Number(r.pms_litres) || 0)
        const agoLitres = hasLive ? agoLitresLive : (Number(r.ago_litres) || 0)
        const pmsPrice = Number(r.pms_price) || 0
        const agoPrice = Number(r.ago_price) || 0
        const pmsRevenue = Math.round(pmsLitres * pmsPrice * 100) / 100
        const agoRevenue = Math.round(agoLitres * agoPrice * 100) / 100

        setExpected({
          grandTotal: hasLive ? Math.round((pmsRevenue + agoRevenue) * 100) / 100 : (Number(r.grand_total) || 0),
          pmsLitres, agoLitres, pmsPrice, agoPrice, pmsRevenue, agoRevenue,
          lpgKg: Number(r.lpg_kg) || 0,
          lpgPrice: Number(r.lpg_price) || 0,
          lpgRevenue: Number(r.lpg_revenue) || 0,
          hasData: true,
          closingDipDone,
        })
        setLoadingExpected(false)
      })
      .catch(() => setLoadingExpected(false))

    const lockUrl = new URL(SCRIPT_URL)
    lockUrl.searchParams.set("action", "getEditLockStatus")
    lockUrl.searchParams.set("station", activeStation())
    lockUrl.searchParams.set("date", date)
    fetch(lockUrl.toString(), { method: "GET", redirect: "follow" })
      .then(res => res.json())
      .then(d => {
        if (!d.ok) return
        setCashupStatus(d.cashupStatus || "")
        setCashupLocked(!!d.cashupLocked)
      })
      .catch(() => {})
  }, [date])

  useEffect(() => {
    loadExpected()
  }, [loadExpected])

  const addExpense = useCallback(() => {
    setExpenses(prev => [...prev, { desc: "", amt: "" }])
  }, [])

  const updateExpense = useCallback((i, field, value) => {
    setExpenses(prev => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))
  }, [])

  const removeExpense = useCallback(i => {
    setExpenses(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      return next.length ? next : [{ desc: "", amt: "" }]
    })
  }, [])

  /* The page owns the catalogue fetch (useLubricantProducts); it hands the
     prices down here so the running total stays correct. */
  const setLubricantPrices = useCallback(map => setLubPrices(map || {}), [])

  const addLubricant = useCallback(() => {
    setLubricantItems(prev => [...prev, { product: "", qty: "" }])
  }, [])

  const updateLubricant = useCallback((i, field, value) => {
    setLubricantItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)))
  }, [])

  const removeLubricant = useCallback(i => {
    setLubricantItems(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      return next.length ? next : [{ product: "", qty: "" }]
    })
  }, [])

  const mp = Number(posMP) || 0
  const zm = Number(posZM) || 0
  const cash = Number(cashAmt) || 0
  const trfMPNum = Number(trfMP) || 0
  const trfZBNum = Number(trfZBAmelia) || 0
  const trfTruckNum = Number(trfFCMBTruck) || 0
  const trfMDNum = Number(trfFCMBMD) || 0
  const trfTotal = trfMPNum + trfZBNum + trfTruckNum + trfMDNum

  const emtlCountNum = Number(emtlCount) || 0
  const EMTL_RATE = 50 // Nigeria's standard flat EMTL charge per qualifying transfer
  const emtlAmount = emtlCountNum * EMTL_RATE

  /* An amount only counts if it has a description. Previously this summed
     EVERY entered amount regardless — so an expense typed with a figure but
     no description still reduced Cash to Bank, while silently vanishing from
     the itemized record (the save step below has always required a
     description, so that amount was never written anywhere). Money was
     leaving the total with no trace of what it was for. */
  const totalExpenses = expenses.reduce((s, e) => s + (e.desc && Number(e.amt) > 0 ? Number(e.amt) : 0), 0)
  // An amount WITHOUT a description — money about to silently vanish from the
  // record. Surfaced so the cashier fixes it before submitting, not after.
  const expensesMissingDescription = expenses.some(e => Number(e.amt) > 0 && !e.desc)
  const mpCharge = Math.round(mp * MP_RATE)
  const zmCharge = Math.round(zm * ZM_RATE)
  // TRF (M.P) carries the same 0.3% charge as the MP terminal itself —
  // both are M.P-linked, so this rolls into the same "POS charges (MP)"
  // total rather than being tracked as a separate transfer fee.
  const trfMPCharge = Math.round(trfMPNum * MP_RATE)
  const mpNet = mp - mpCharge
  const zmNet = zm - zmCharge
  const trfMPNet = trfMPNum - trfMPCharge
  const totalCharges = mpCharge + zmCharge + trfMPCharge

  // All payment channels together — POS, bank transfers, and cash
  const grossTotal = mp + zm + trfTotal + cash
  const collected = mpNet + zmNet + trfMPNet + trfZBNum + trfTruckNum + trfMDNum + cash - totalExpenses

  // To Bank is purely the physical cash collected, minus expenses paid out
  // of that cash — POS/TRF charges never touch physical cash, so they
  // don't reduce this figure.
  const cashToBank = Math.max(0, cash - totalExpenses)
  const variance = expected.hasData ? collected - expected.grandTotal : null

  /* Priced from the catalogue, not from the row. This figure feeds the day's
     cash reconciliation, so it has to match what the server will actually
     record — anything else and the cashier balances against a number that
     doesn't exist. */
  const lubricantTotal = lubricantItems.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(lubPrices[it.product]) || 0),
    0
  )

  // LPG kg/price/revenue now come from real Sales pump readings (via
  // `expected`, loaded from getDailyReport) instead of being typed here
  // a second time — this section previously sent its own guessed
  // lpg_kg/lpg_price/lpg_revenue on every save, silently overwriting
  // whatever Sales had just correctly computed from actual pump data.
  const lpgSales = expected.lpgRevenue || 0
  const lpgRemittedNum = Number(lpgRemitted) || 0
  const lpgVariance = lpgSales > 0 ? lpgRemittedNum - lpgSales : null

  // Sales Cash Summary — PMS / AGO / OIL / GAS split, matching the station's
  // paper daily report. Cash to Bank is one lump figure (payments aren't
  // tagged by product at the point of sale — a customer just pays), so an
  // exact split isn't possible. It's split proportionally by each product's
  // share of the day's fuel REVENUE, which we do know from dip/pump readings.
  // Previously the whole fuel total was labelled "PMS" even when a real
  // chunk of it was AGO — this splits it out honestly instead of hiding it.
  const fuelRevenue = (expected.pmsRevenue || 0) + (expected.agoRevenue || 0)
  const pmsShare = fuelRevenue > 0 ? (expected.pmsRevenue || 0) / fuelRevenue : 1
  const agoShare = fuelRevenue > 0 ? (expected.agoRevenue || 0) / fuelRevenue : 0
  const cashSummary = {
    pms: Math.round(cashToBank * pmsShare * 100) / 100,
    ago: Math.round(cashToBank * agoShare * 100) / 100,
    oil: Math.round(lubricantTotal * 100) / 100,
    gas: Math.round(lpgRemittedNum * 100) / 100,
  }
  cashSummary.total = Math.round((cashSummary.pms + cashSummary.ago + cashSummary.oil + cashSummary.gas) * 100) / 100

  let reconStatus = "pending"
  if (variance !== null && expected.grandTotal > 0) {
    if (Math.abs(variance) <= 500) reconStatus = "balanced"
    else if (variance < 0) reconStatus = "short"
    else reconStatus = "over"
  }

  const requestEdit = useCallback(
    message => {
      setRequestingEdit(true)
      return fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "saveEditRequest", station: activeStation(), username, name,
          date, type: "cashup",
          message: message || "Requesting permission to correct the cash reconciliation",
        }),
      })
        .then(res => res.json())
        .then(d => {
          setRequestingEdit(false)
          return d
        })
        .catch(() => {
          setRequestingEdit(false)
          return { ok: false, error: "Network error — check connection" }
        })
    },
    [username, name, date]
  )

  const uploadProof = useCallback(async (file, subject, setUploading, setFileId) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result)
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const compressed = await compressImage(dataUrl)
      const base64 = compressed.split(",")[1]
      const resp = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "savePhoto", token: getToken(), station: activeStation(), date, session: "Cashup", subject, mimeType: "image/jpeg", base64 }),
      })
      const d = await resp.json()
      if (d.ok && d.fileId) setFileId(d.fileId)
      else setFileId("")
      return d
    } catch {
      setFileId("")
      return { ok: false }
    } finally {
      setUploading(false)
    }
  }, [date])

  const uploadPosProof = file => uploadProof(file, "moniepoint-settlement", setPosProofUploading, setPosProofFileId)

  const submit = useCallback(() => {
    if (mp === 0 && zm === 0 && cash === 0 && trfTotal === 0) {
      return Promise.resolve({ ok: false, error: "Enter at least one payment amount" })
    }
    if (expensesMissingDescription) {
      return Promise.resolve({ ok: false, error: "One of your expenses has an amount but no description — add what it was for before saving." })
    }
    /* Unlocked for both stations. The real bug was the expected-revenue
       calculation trusting a stale stored field — fixed by deriving it live
       from actual pump sessions. With that fixed, there's no remaining
       reason to hold up the save for either station; the comparison
       completes itself once dip data lands. */
    if (cashupLocked) {
      return Promise.resolve({ ok: false, error: `Cash Reconciliation for ${date} has already been approved. Request an edit and wait for GM/Owner approval before resubmitting.`, locked: true })
    }
    const data = {
      pos_mp: mp, pos_zm: zm, cash: cash,
      pos_proof_file_id: posProofFileId,
      trf_mp: trfMPNum, trf_zb_amelia: trfZBNum, trf_fcmb_truck: trfTruckNum, trf_fcmb_md: trfMDNum,
      total_expenses: totalExpenses, to_bank: Math.round(cashToBank),
      pos_mp_charge: mpCharge + trfMPCharge, pos_zm_charge: zmCharge,
      emtl_counts: emtlAmount,
      grand_total: expected.grandTotal || 0,
      pms_litres: expected.pmsLitres || 0, pms_price: expected.pmsPrice || 0, pms_revenue: expected.pmsRevenue || 0,
      ago_litres: expected.agoLitres || 0, ago_price: expected.agoPrice || 0, ago_revenue: expected.agoRevenue || 0,
      lpg_remitted: lpgRemittedNum,
      lubricant_rev: Math.round(lubricantTotal),
      pms_cash_summary: cashSummary.pms, ago_cash_summary: cashSummary.ago, oil_cash_summary: cashSummary.oil,
      gas_cash_summary: cashSummary.gas, total_cash_summary: cashSummary.total,
      remarks: remarks || "",
    }

    setSaving(true)
    /* Attach GPS coordinates — cash-up must happen on-site per CEO policy,
       and the backend verifies this before accepting the save. */
    return getCurrentCoords().then(coords => fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "saveDailyReport", station: activeStation(), username, date, data, lat: coords?.lat, lng: coords?.lng }),
      redirect: "follow",
    }))
      .then(res => res.json())
      .then(d => {
        if (!d.ok) {
          setSaving(false)
          return d
        }
        const expSaves = expenses
          .filter(e => Number(e.amt) > 0 && e.desc)
          .map(e =>
            fetch(SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: JSON.stringify({ action: "saveExpense", station: activeStation(), username, date, description: e.desc, amount: Number(e.amt) }),
              redirect: "follow",
            })
          )
        const lubSaves = lubricantItems
          .filter(it => Number(it.qty) > 0 && it.product)
          .map(it =>
            fetch(SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              // unitPrice is deliberately NOT sent. The server looks it up.
              body: JSON.stringify({ action: "saveLubricant", station: activeStation(), username, date, product: it.product, qty: Number(it.qty) }),
              redirect: "follow",
            })
          )
        return Promise.all([...expSaves, ...lubSaves]).then(() => {
          setSaving(false)
          return d
        })
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [mp, zm, cash, trfTotal, trfMPNum, trfZBNum, trfTruckNum, trfMDNum, totalExpenses, cashToBank, mpCharge, zmCharge, trfMPCharge, emtlAmount, expected, expenses, lubricantItems, lubricantTotal, username, lpgRemittedNum, cashSummary, date, cashupLocked, remarks])

  return {
    date, setDate,
    posProofFileId, posProofUploading, uploadPosProof,
    expected, loadingExpected, refreshExpected: loadExpected,
    posMP, setPosMP, posZM, setPosZM, cashAmt, setCashAmt,
    trfMP, setTrfMP, trfZBAmelia, setTrfZBAmelia, trfFCMBTruck, setTrfFCMBTruck, trfFCMBMD, setTrfFCMBMD, trfTotal,
    emtlCount, setEmtlCount, emtlAmount,
    expenses, addExpense, updateExpense, removeExpense, expensesMissingDescription,
    lubricantItems, addLubricant, updateLubricant, removeLubricant, lubricantTotal, setLubricantPrices,
    mpCharge, zmCharge, trfMPCharge, mpNet, zmNet, trfMPNet, totalCharges, totalExpenses,
    grossTotal, collected, cashToBank, variance, reconStatus, cashSummary,
    lpgRemitted, setLpgRemitted, lpgSales, lpgVariance,
    remarks, setRemarks,
    cashupStatus, cashupLocked, requestEdit, requestingEdit,
    submit, saving,
  }
}
