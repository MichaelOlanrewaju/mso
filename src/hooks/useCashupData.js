import { useCallback, useEffect, useState } from "react"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"
const MP_RATE = 0.003
const ZM_RATE = 0.003

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

export function useCashupData(username, name, initialDate) {
  const [date, setDate] = useState(initialDate || todayISO())
  const [expected, setExpected] = useState({
    grandTotal: 0, pmsLitres: 0, agoLitres: 0,
    pmsPrice: 1269, agoPrice: 1799, pmsRevenue: 0, agoRevenue: 0,
    lpgKg: 0, lpgPrice: 0, lpgRevenue: 0,
    hasData: false, closingDipDone: false,
  })
  const [loadingExpected, setLoadingExpected] = useState(true)
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
  const [lubricantItems, setLubricantItems] = useState([{ product: "", qty: "", unitPrice: "" }])
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
    url.searchParams.set("station", STATION_KEY)
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
        setExpected({
          grandTotal: Number(r.grand_total) || 0,
          pmsLitres: Number(r.pms_litres) || 0,
          agoLitres: Number(r.ago_litres) || 0,
          pmsPrice: Number(r.pms_price) || 1269,
          agoPrice: Number(r.ago_price) || 1799,
          pmsRevenue: Number(r.pms_revenue) || 0,
          agoRevenue: Number(r.ago_revenue) || 0,
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
    lockUrl.searchParams.set("station", STATION_KEY)
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

  const addLubricant = useCallback(() => {
    setLubricantItems(prev => [...prev, { product: "", qty: "", unitPrice: "" }])
  }, [])

  const updateLubricant = useCallback((i, field, value) => {
    setLubricantItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)))
  }, [])

  const removeLubricant = useCallback(i => {
    setLubricantItems(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      return next.length ? next : [{ product: "", qty: "", unitPrice: "" }]
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

  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amt) || 0), 0)
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

  const lubricantTotal = lubricantItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0)

  // LPG kg/price/revenue now come from real Sales pump readings (via
  // `expected`, loaded from getDailyReport) instead of being typed here
  // a second time — this section previously sent its own guessed
  // lpg_kg/lpg_price/lpg_revenue on every save, silently overwriting
  // whatever Sales had just correctly computed from actual pump data.
  const lpgSales = expected.lpgRevenue || 0
  const lpgRemittedNum = Number(lpgRemitted) || 0
  const lpgVariance = lpgSales > 0 ? lpgRemittedNum - lpgSales : null

  // Sales Cash Summary — PMS / OIL / GAS split, matching the station's
  // paper daily report exactly (verified against real figures)
  const cashSummary = {
    pms: Math.round(cashToBank * 100) / 100,
    oil: Math.round(lubricantTotal * 100) / 100,
    gas: Math.round(lpgRemittedNum * 100) / 100,
  }
  cashSummary.total = Math.round((cashSummary.pms + cashSummary.oil + cashSummary.gas) * 100) / 100

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
          action: "saveEditRequest", station: STATION_KEY, username, name,
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

  const submit = useCallback(() => {
    if (mp === 0 && zm === 0 && cash === 0 && trfTotal === 0) {
      return Promise.resolve({ ok: false, error: "Enter at least one payment amount" })
    }
    if (!expected.closingDipDone) {
      return Promise.resolve({ ok: false, error: `Closing Dip hasn't been submitted yet for ${date}. Please complete Closing Dip before Cash Reconciliation.` })
    }
    if (cashupLocked) {
      return Promise.resolve({ ok: false, error: `Cash Reconciliation for ${date} has already been approved. Request an edit and wait for GM/Owner approval before resubmitting.`, locked: true })
    }
    const data = {
      pos_mp: mp, pos_zm: zm, cash: cash,
      trf_mp: trfMPNum, trf_zb_amelia: trfZBNum, trf_fcmb_truck: trfTruckNum, trf_fcmb_md: trfMDNum,
      total_expenses: totalExpenses, to_bank: Math.round(cashToBank),
      pos_mp_charge: mpCharge + trfMPCharge, pos_zm_charge: zmCharge,
      emtl_counts: emtlAmount,
      grand_total: expected.grandTotal || 0,
      pms_litres: expected.pmsLitres || 0, pms_price: expected.pmsPrice || 1269, pms_revenue: expected.pmsRevenue || 0,
      ago_litres: expected.agoLitres || 0, ago_price: expected.agoPrice || 1799, ago_revenue: expected.agoRevenue || 0,
      lpg_remitted: lpgRemittedNum,
      lubricant_rev: Math.round(lubricantTotal),
      pms_cash_summary: cashSummary.pms, oil_cash_summary: cashSummary.oil,
      gas_cash_summary: cashSummary.gas, total_cash_summary: cashSummary.total,
      remarks: remarks || "",
    }

    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "saveDailyReport", station: STATION_KEY, username, date, data }),
      redirect: "follow",
    })
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
              body: JSON.stringify({ action: "saveExpense", station: STATION_KEY, username, date, description: e.desc, amount: Number(e.amt) }),
              redirect: "follow",
            })
          )
        const lubSaves = lubricantItems
          .filter(it => Number(it.qty) > 0 && it.product)
          .map(it =>
            fetch(SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: JSON.stringify({ action: "saveLubricant", station: STATION_KEY, username, date, product: it.product, qty: Number(it.qty), unitPrice: Number(it.unitPrice) || 0 }),
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
    expected, loadingExpected, refreshExpected: loadExpected,
    posMP, setPosMP, posZM, setPosZM, cashAmt, setCashAmt,
    trfMP, setTrfMP, trfZBAmelia, setTrfZBAmelia, trfFCMBTruck, setTrfFCMBTruck, trfFCMBMD, setTrfFCMBMD, trfTotal,
    emtlCount, setEmtlCount, emtlAmount,
    expenses, addExpense, updateExpense, removeExpense,
    lubricantItems, addLubricant, updateLubricant, removeLubricant, lubricantTotal,
    mpCharge, zmCharge, trfMPCharge, mpNet, zmNet, trfMPNet, totalCharges, totalExpenses,
    grossTotal, collected, cashToBank, variance, reconStatus, cashSummary,
    lpgRemitted, setLpgRemitted, lpgSales, lpgVariance,
    remarks, setRemarks,
    cashupStatus, cashupLocked, requestEdit, requestingEdit,
    submit, saving,
  }
}
