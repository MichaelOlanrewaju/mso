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
      const { dataUrl: compressedDataUrl } = await compressImage(dataUrl)
      const base64 = compressedDataUrl.split(",")[1]
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
    } catch (e) {
      /* A bare catch here is exactly what turned a real code bug (calling
         .split() on an object instead of a string) into a misleading
         "check connection" message — genuinely not a network problem, but
         impossible to tell from the message alone. Logging the real error
         means the next failure like this is diagnosable in seconds, not
         another full investigation. */
      console.error("Receipt upload failed:", e)
      setReceiptFileId("")
      return { ok: false, error: "Upload failed: " + (e?.message || "check connection and try again") }
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
