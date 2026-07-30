import { useCallback, useState } from "react"
import { getToken } from "../utils/session"
import { activeStation } from "../utils/station"
import { compressImage } from "../utils/compressImage"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

export function useShortageClearance(username) {
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiptFileId, setReceiptFileId] = useState("")

  const uploadReceipt = useCallback(async (file) => {
    if (!file) return { ok: false }
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
        body: JSON.stringify({
          action: "savePhoto", token: getToken(), station: activeStation(),
          date: todayISO(), session: "ShortageClearance", subject: "receipt",
          mimeType: "image/jpeg", base64,
        }),
      })
      const d = await resp.json()
      if (d.ok && d.fileId) setReceiptFileId(d.fileId)
      else setReceiptFileId("")
      return d
    } catch {
      setReceiptFileId("")
      return { ok: false, error: "Upload failed — check connection" }
    } finally {
      setUploading(false)
    }
  }, [])

  const clearShortage = useCallback(({ date, attendantId, amountPaid, notes }) => {
    if (!SCRIPT_URL) return Promise.resolve({ ok: false, error: "Not connected." })
    if (!attendantId) return Promise.resolve({ ok: false, error: "Select the attendant." })
    if (!amountPaid || Number(amountPaid) <= 0) return Promise.resolve({ ok: false, error: "Enter the amount paid." })
    if (!receiptFileId) return Promise.resolve({ ok: false, error: "Upload the receipt photo first — no clearance without proof." })

    setSaving(true)
    return fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "saveShortageClearance",
        station: activeStation(),
        token: getToken(),
        username,
        date: date || todayISO(),
        attendantId,
        amountPaid: Number(amountPaid),
        receiptFileId,
        notes: notes || "",
      }),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(false)
        if (d.ok) setReceiptFileId("")
        return d
      })
      .catch(() => {
        setSaving(false)
        return { ok: false, error: "Network error — check connection" }
      })
  }, [username, receiptFileId])

  return { uploading, uploadReceipt, receiptFileId, setReceiptFileId, saving, clearShortage }
}
