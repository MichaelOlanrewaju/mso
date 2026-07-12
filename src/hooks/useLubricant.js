import { useCallback, useEffect, useRef, useState } from "react"
import { getToken } from "../utils/session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

/**
 * Oil: catalogue, stock, deliveries.
 *
 * The pricing split is the important thing here and it's enforced on the server,
 * not by hiding buttons:
 *   - SELLING price  → supervisor (saveLubricantProduct)
 *   - COST price     → GM/owner only (setLubricantCost)
 *   - costPrice is stripped from the API response entirely for anyone else, so
 *     a supervisor cannot see what the station pays its supplier even by reading
 *     the raw JSON.
 *
 * Stock = units received (deliveries) − units sold (cash-up). There's no stored
 * "stock" column to drift out of sync with reality, which is the usual way an
 * inventory system starts quietly lying.
 */
export function useLubricant({ username } = {}) {
  const [status, setStatus] = useState("loading")
  const [products, setProducts] = useState([])
  const [seesCost, setSeesCost] = useState(false)
  const [saving, setSaving] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const load = useCallback(() => {
    if (!SCRIPT_URL) { setStatus("error"); return }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getLubricantProducts")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (!alive.current) return
        if (d.ok) {
          setProducts(d.products || [])
          setSeesCost(Boolean(d.seesCost))
          setStatus("ready")
        } else setStatus("error")
      })
      .catch(() => { if (alive.current) setStatus("error") })
  }, [])

  useEffect(() => { load() }, [load])

  const post = useCallback(body =>
    fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ ...body, station: STATION_KEY, username, token: getToken() }),
      redirect: "follow",
    }).then(r => r.json()),
  [username])

  const wrap = useCallback(action => (...args) => {
    setSaving(true)
    return action(...args)
      .then(d => { if (d.ok) load(); return d })
      .finally(() => { if (alive.current) setSaving(false) })
  }, [load])

  /* Supervisor: what oil sells for. Never touches cost. */
  const setSellPrice = wrap(({ product, sellPrice }) =>
    post({ action: "saveLubricantProduct", product, sellPrice }))

  /* GM/owner: what the station paid. Rejected server-side for anyone else. */
  const setCostPrice = wrap(({ product, costPrice }) =>
    post({ action: "setLubricantCost", product, costPrice }))

  const removeProduct = wrap(product =>
    post({ action: "deleteLubricantProduct", product }))

  /* One invoice, many lines. A Scarlet & Snow drop is seven products on one
     piece of paper — entering it as seven separate deliveries means retyping the
     supplier and invoice number each time, and one typo splits it into two
     records that never reconcile.
     Units-per-carton lives on the LINE, not the product, because it varies by
     supplier: a carton of 5L is 4 bottles, a carton of 1L is 12. */
  const recordDelivery = wrap(({ supplier, invoiceNo, date, invoiceTotal, lines }) =>
    post({ action: "saveLubricantDelivery", supplier, invoiceNo, date, invoiceTotal, lines }))

  /* GM/owner only. A delivery is a financial record — voiding keeps the original
     row as an honest account of what was entered, while stopping it counting
     toward stock. Editing in place would make the audit trail lie. */
  const voidDelivery = wrap(({ invoiceNo, supplier, date, reason }) =>
    post({ action: "voidLubricantDelivery", invoiceNo, supplier, date, reason }))

  const priceOf = useCallback(
    name => products.find(p => p.product === name)?.sellPrice ?? null,
    [products]
  )
  const stockOf = useCallback(
    name => products.find(p => p.product === name)?.stock ?? null,
    [products]
  )

  return {
    status, products, seesCost, saving,
    setSellPrice, setCostPrice, removeProduct, recordDelivery, voidDelivery,
    priceOf, stockOf, refresh: load,
  }
}

/** Deliveries log — what came in the door. */
export function useLubricantDeliveries() {
  const [status, setStatus] = useState("loading")
  const [deliveries, setDeliveries] = useState([])

  const load = useCallback(() => {
    if (!SCRIPT_URL) { setStatus("error"); return }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getLubricantDeliveries")
    url.searchParams.set("station", STATION_KEY)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setDeliveries(d.deliveries || []); setStatus("ready") }
        else setStatus("error")
      })
      .catch(() => setStatus("error"))
  }, [])

  useEffect(() => { load() }, [load])
  return { status, deliveries, refresh: load }
}

/** The CEO's oil view: revenue, cost of goods, margin, stock value, flags. */
export function useLubricantSummary({ from = "", to = "" } = {}) {
  const [status, setStatus] = useState("loading")
  const [summary, setSummary] = useState(null)

  const load = useCallback(() => {
    if (!SCRIPT_URL) { setStatus("error"); return }
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getLubricantSummary")
    url.searchParams.set("station", STATION_KEY)
    if (from) url.searchParams.set("from", from)
    if (to) url.searchParams.set("to", to)
    url.searchParams.set("token", getToken())
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setSummary(d); setStatus("ready") }
        else setStatus("error")
      })
      .catch(() => setStatus("error"))
  }, [from, to])

  useEffect(() => { load() }, [load])
  return { status, summary, refresh: load }
}

export default useLubricant
