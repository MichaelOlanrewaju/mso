import React, { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { activeStation } from "../utils/station"
import { getStation } from "../config/stations"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePhotosForDate } from "../hooks/usePhotosForDate"
import { usePageTitle } from "../hooks/usePageTitle"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

// Both tank dip and pump reading photos are saved with the same session
// value ("Morning"/"Evening") — the only way to tell them apart is the
// subject field, which holds the tank or pump id itself.
function categoryFor(photo) {
  const subject = String(photo.subject || "").toUpperCase()
  if (subject.startsWith("TK")) return "Tank Dip"
  if (/^P\d|_AGO|^LPG/.test(subject)) return "Pump Reading"
  return null // Cashup, BankDeposit, Chat, Profile, ShortageClearance — not shown here
}

export default function PhotoDownloadPage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle(`Download Photos — ${getStation(activeStation()).name}`)

  const [date, setDate] = useState(todayISO())
  const { status, photos } = usePhotosForDate(date)
  const [selected, setSelected] = useState(new Set())
  const [downloading, setDownloading] = useState(false)

  // Only tank dip / pump reading photos belong here — everything else
  // (cashup proof, bank deposit slips, chat images) is a different concern.
  const relevant = useMemo(() => {
    return photos
      .map(p => ({ ...p, category: categoryFor(p) }))
      .filter(p => p.category)
  }, [photos])

  const groups = useMemo(() => {
    const g = { "Tank Dip": { Morning: [], Evening: [] }, "Pump Reading": { Morning: [], Evening: [] } }
    relevant.forEach(p => {
      const session = p.session === "Evening" ? "Evening" : "Morning"
      g[p.category][session].push(p)
    })
    return g
  }, [relevant])

  const toggleOne = (fileId) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(fileId) ? next.delete(fileId) : next.add(fileId)
      return next
    })
  }

  const toggleGroup = (list) => {
    const ids = list.map(p => p.fileId).filter(Boolean)
    const allSelected = ids.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const selectAll = () => setSelected(new Set(relevant.map(p => p.fileId).filter(Boolean)))
  const selectNone = () => setSelected(new Set())

  // Google Drive doesn't allow bundling into a zip client-side without a
  // real backend proxy (cross-origin blob fetches from Drive are
  // unreliable). Triggering each file's direct-download link in sequence,
  // spaced out, is what actually works reliably in a browser without
  // adding a new dependency or backend endpoint.
  const downloadSelected = async () => {
    const toDownload = relevant.filter(p => selected.has(p.fileId))
    if (toDownload.length === 0) return
    setDownloading(true)
    for (let i = 0; i < toDownload.length; i++) {
      const p = toDownload[i]
      const a = document.createElement("a")
      a.href = `https://drive.google.com/uc?export=download&id=${p.fileId}`
      a.target = "_blank"
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Small gap between triggers — firing many downloads in the same
      // tick makes browsers silently block most of them as a popup flood.
      await new Promise(res => setTimeout(res, 400))
    }
    setDownloading(false)
  }

  const totalCount = relevant.length
  const selectedCount = selected.size

  const renderGroup = (label, list) => {
    if (list.length === 0) return null
    const ids = list.map(p => p.fileId).filter(Boolean)
    const allSelected = ids.length > 0 && ids.every(id => selected.has(id))
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => toggleGroup(list)}
          className="mb-1.5 flex w-full items-center justify-between rounded-[9px] bg-surface px-3 py-2"
        >
          <span className="text-[11.5px] font-bold text-ink-2">{label} ({list.length})</span>
          <span className="text-[11px] font-semibold text-cyan-dark">{allSelected ? "Deselect all" : "Select all"}</span>
        </button>
        <div className="grid grid-cols-3 gap-2">
          {list.map(p => (
            <button
              key={p.fileId}
              type="button"
              onClick={() => toggleOne(p.fileId)}
              className={`relative overflow-hidden rounded-[10px] border-2 ${selected.has(p.fileId) ? "border-cyan" : "border-border"}`}
            >
              <img src={p.viewUrl} alt={p.subject} className="h-20 w-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-left text-[9.5px] font-bold text-white">{p.subject}</div>
              {selected.has(p.fileId) && (
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan text-white">
                  <i className="bi bi-check-lg text-[11px]" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pagebg pb-28">
      <SafeAreaDebug />
      <div className="sticky top-0 z-[100] border-b border-border bg-white/95 px-4 py-3 backdrop-blur" style={{ paddingTop: "max(var(--sat), 12px)" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-3">
            <i className="bi bi-arrow-left" />
          </button>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">Download Photos</div>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              max={todayISO()}
              className="border-none bg-transparent p-0 text-[10px] text-ink-4 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-4">
        {status === "loading" && (
          <div className="py-16 text-center text-[13px] text-ink-4">Loading photos…</div>
        )}

        {status === "ready" && totalCount === 0 && (
          <div className="rounded-card border border-dashed border-border bg-white px-4 py-10 text-center">
            <i className="bi bi-images mb-2 block text-[28px] text-ink-4" />
            <div className="text-[13px] font-semibold text-ink-3">No tank dip or pump reading photos for this date</div>
          </div>
        )}

        {status === "ready" && totalCount > 0 && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12px] text-ink-4">{selectedCount} of {totalCount} selected</div>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-[11.5px] font-semibold text-cyan-dark">Select all</button>
                <span className="text-ink-4">·</span>
                <button type="button" onClick={selectNone} className="text-[11.5px] font-semibold text-ink-3">Clear</button>
              </div>
            </div>

            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Tank Dip</div>
            {renderGroup("Morning", groups["Tank Dip"].Morning)}
            {renderGroup("Evening", groups["Tank Dip"].Evening)}

            <div className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-[1.1px] text-ink-4">Pump Reading</div>
            {renderGroup("Morning", groups["Pump Reading"].Morning)}
            {renderGroup("Evening", groups["Pump Reading"].Evening)}
          </>
        )}
      </div>

      {status === "ready" && totalCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-white px-4 py-3" style={{ paddingBottom: "max(var(--sab), 12px)" }}>
          <div className="mx-auto max-w-[640px]">
            <button
              type="button" onClick={downloadSelected} disabled={selectedCount === 0 || downloading}
              className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-cyan text-[14.5px] font-extrabold text-white disabled:opacity-50"
            >
              <i className="bi bi-download" />
              {downloading ? "Downloading…" : `Download ${selectedCount > 0 ? selectedCount : ""}`.trim()}
            </button>
            {selectedCount > 3 && (
              <div className="mt-2 text-center text-[10.5px] text-ink-4">
                Your browser may ask to allow multiple downloads — tap "Allow" if prompted.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
