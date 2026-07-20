import React, { useEffect, useState } from "react"
import { litres, litresValue } from "../utils/format"
import { useNavigate } from "react-router-dom"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import DateRow from "../components/dip/DateRow"
import StatusStrip from "../components/dip/StatusStrip"
import ModeToggle from "../components/dip/ModeToggle"
import StepProgress from "../components/dip/StepProgress"
import WizardNav from "../components/dip/WizardNav"
import StepsDrawer from "../components/dip/StepsDrawer"
import PhotoCapture from "../components/dip/PhotoCapture"
import { TankStepPanel } from "../components/dip/StepPanels"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { useDipData } from "../hooks/useDipData"
/* Tanks come from the station config now — M&M has no TK3, so a shared list
   would render a dip field for a tank that isn't there. */
import { tanksFor, getStation } from "../config/stations"
import { activeStation } from "../utils/station"
import { usePrices } from "../hooks/usePrices"
import { usePageTitle } from "../hooks/usePageTitle"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

const STEPS = tanksFor(activeStation()).map(cfg => ({ type: "tank", cfg }))

function DipInner() {
  const auth = useAuth({ requireAuth: true })
  const [date, setDate] = useState(todayISO())

  const {
    status, tankState, hasOpening, hasClosing, hasCash, existingPhotos,
    dipOpeningLocked, dipClosingLocked, requestEdit, requestingEdit,
    updateTank, saveOpening, saveClosing, savePhoto, refresh,
  } = useDipData(auth.username, date)
  const { prices } = usePrices()

  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(`Dip Entry — ${getStation(activeStation()).name}`)

  const [mode, setMode] = useState("open")
  const [current, setCurrent] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [photos, setPhotos] = useState({})
  const [uploadProgress, setUploadProgress] = useState({})
  const [editRequested, setEditRequested] = useState(false)

  // When data finishes loading for a date, jump mode to whichever stage
  // already has data — matches original setMode('close', true) on load.
  useEffect(() => {
    if (status === "ready") {
      if (hasOpening || hasClosing) setMode("close")
      else setMode("open")
      if (hasOpening || hasClosing) {
        toast.showToast("Data loaded", `Existing readings found for ${date}`, "ok")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Seed photo indicators from what's already saved on the backend —
  // previously this always started empty, so an already-captured photo
  // looked "missing" after any navigation or reload even though the
  // file itself was safely sitting in Drive the whole time. Re-runs when
  // mode flips between Opening/Closing since those are separate sessions.
  useEffect(() => {
    if (status !== "ready") return
    const sessionLabel = mode === "open" ? "Morning" : "Evening"
    const seeded = {}
    STEPS.forEach(s => {
      const key = `${s.cfg.id}__${sessionLabel}`
      if (existingPhotos[key]) seeded[s.cfg.id] = { saved: true, fileId: existingPhotos[key].fileId }
    })
    setPhotos(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mode, existingPhotos])

  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById("mainInp")
      if (el) el.focus()
    }, 100)
  }, [current])

  if (auth.loading || !auth.user) {
    return <div className="min-h-screen bg-pagebg" />
  }

  const step = STEPS[current]
  const isLast = current === STEPS.length - 1
  const stepKey = step.cfg.id
  const isLocked = mode === "open" ? dipOpeningLocked : dipClosingLocked

  const handleRequestEdit = async () => {
    const result = await requestEdit(date, mode === "open" ? "dip_opening" : "dip_closing", auth.name || auth.username)
    if (!result.ok) {
      toast.showToast("Could not send request", result.error || "Please try again", "err")
      return
    }
    setEditRequested(true)
    toast.showToast("Edit requested", "Waiting for GM or Owner to approve", "ok")
  }

  const handleDateChange = newDate => {
    setDate(newDate)
    setCurrent(0)
    setPhotos({})
    setEditRequested(false)
  }

  const handlePhoto = (dataUrl, mimeType) => {
    // Shows the just-captured image immediately using the local data URI
    // — instant, no network dependency. This stays the source of truth
    // for "what I just took" even after upload; only a future page
    // visit (when only fileId is known) needs to fetch from Drive.
    setPhotos(prev => ({ ...prev, [stepKey]: { saved: false, localUrl: dataUrl } }))
    setUploadProgress(prev => ({ ...prev, [stepKey]: 0 }))
    savePhoto(date, mode === "open" ? "Morning" : "Evening", stepKey, dataUrl, mimeType, pct => {
      setUploadProgress(prev => ({ ...prev, [stepKey]: pct }))
    }).then(d => {
      setPhotos(prev => ({ ...prev, [stepKey]: { saved: true, localUrl: dataUrl } }))
      setUploadProgress(prev => {
        const next = { ...prev }
        delete next[stepKey]
        return next
      })
      toast.showToast(d.ok ? "Photo saved" : "Photo captured", d.ok ? "Uploaded to Drive" : "Will retry on next sync", d.ok ? "ok" : "warn")
    })
  }

  const doSubmit = async () => {
    setSaving(true)
    const result = mode === "open" ? await saveOpening(date) : await saveClosing(date)
    setSaving(false)
    setConfirmOpen(false)

    if (!result.ok) {
      toast.showToast("Could not save", result.error || "Please try again", "err")
      return
    }
    if (navigator.vibrate) navigator.vibrate([50, 30, 80])
    toast.showToast("Saved", mode === "open" ? "Opening saved — return tonight for closing" : "All readings saved", "ok")
    refresh()
    setTimeout(() => navigate(dashboardPathFor({ role: auth.role, station: auth.station })), 1200)
  }

  const handleSubmit = () => {
    if (isLocked) {
      toast.showToast("This step is locked", "Use Request Edit above, then wait for approval", "warn")
      return
    }
    setConfirmOpen(true)
  }

  // What the review popup shows — every tank's value for whichever mode
  // (Opening/Closing) is being submitted right now, plus flags for
  // anything that looks like it might be a mistake rather than a hard
  // block, since a genuinely unusual reading can still be correct.
  /* A tank measured at 0 is a real reading — an empty tank. Only a BLANK box
     means nothing was entered. Treating 0 as "not entered" made an empty tank
     impossible to record and warned about a perfectly good measurement. */
  const entered = v => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v))

  const reviewRows = tanksFor(activeStation()).map(t => {
    const st = tankState[t.id] || {}
    const val = mode === "open" ? st.open : st.close
    const openVal = st.open
    const isSuspicious = mode === "close" && entered(val) && Number(val) > 0
      && Number(openVal) > 0 && Number(val) < Number(openVal) * 0.3
    return {
      label: `${t.id} — ${t.product} ${mode === "open" ? "Opening" : "Closing"}`,
      value: entered(val) ? litres(Number(val)) : "Not entered",
      warn: !entered(val) || isSuspicious,
    }
  })
  const reviewWarnings = []
  tanksFor(activeStation()).forEach(t => {
    const st = tankState[t.id] || {}
    const val = mode === "open" ? st.open : st.close
    const openVal = st.open
    if (!entered(val)) {
      reviewWarnings.push(`${t.id} has no ${mode === "open" ? "opening" : "closing"} reading entered.`)
    } else if (Number(val) === 0) {
      reviewWarnings.push(`${t.id} is recorded as empty (0${t.unit || "L"}) — confirm the tank is genuinely dry.`)
    }
    if (mode === "close" && entered(val) && Number(val) > 0 && Number(openVal) > 0 && Number(val) < Number(openVal) * 0.3) {
      reviewWarnings.push(`${t.id} closing (${litres(Number(val))}) is unusually far below opening (${litres(Number(openVal))}) — double-check this reading.`)
    }
  })

  const goNext = () => {
    if (navigator.vibrate) navigator.vibrate(30)
    if (current < STEPS.length - 1) {
      setCurrent(c => c + 1)
      window.scrollTo(0, 0)
    } else {
      handleSubmit()
    }
  }

  const goPrev = () => {
    if (current > 0) {
      setCurrent(c => c - 1)
      window.scrollTo(0, 0)
    } else if (window.confirm("Leave without saving?")) {
      navigate(dashboardPathFor({ role: auth.role, station: auth.station }))
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #F1F5FB 220px)" }}>
      <SafeAreaDebug />
      <div
        className="sticky top-0 z-[200] px-4 pb-4 text-white shadow-lg"
        style={{ paddingTop: "max(var(--sat), 52px)", background: "var(--brand-gradient-btn)" }}
      >
        <div className="mx-auto max-w-[640px]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[1.4px] text-cyan">
                Step {current + 1} of {STEPS.length}
              </div>
              <div className="text-[16px] font-extrabold text-white">
                {step.cfg.id} — {mode === "open" ? "Opening Stock" : "Closing Stock"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <i className="bi bi-list-ul" />
            </button>
          </div>
          <StepProgress total={STEPS.length} current={current} />
        </div>
      </div>

      <div className="px-4 py-4 pb-[100px]">
        <div className="mx-auto max-w-[640px]">
          <DateRow date={date} onChange={handleDateChange} supName={auth.name || auth.username} />
          <ModeToggle mode={mode} onChange={m => { setMode(m); setEditRequested(false) }} hasOpening={hasOpening} hasClosing={hasClosing} />
          <StatusStrip hasOpening={hasOpening} hasClosing={hasClosing} hasCash={hasCash} />

          <div className="overflow-hidden rounded-card border border-cyan/15 bg-white shadow-card">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, var(--brand-primary), var(--brand-accent))" }} />
            <div className="p-5">
              {status === "loading" ? (
                <div className="flex items-center justify-center py-10 text-[13px] text-ink-4">
                  <span className="mr-2 h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
                  Loading readings for {date}…
                </div>
              ) : isLocked ? (
                <div className="flex flex-col items-center gap-3 rounded-[14px] border border-red/25 bg-red-light px-5 py-8 text-center">
                  <i className="bi bi-lock-fill text-2xl text-red" />
                  <div>
                    <div className="text-[14px] font-bold text-ink">
                      {mode === "open" ? "Opening" : "Closing"} Stock already submitted
                    </div>
                    <div className="mt-1 text-[12.5px] text-ink-3">
                      This has already been saved for {date}. To change it, request an edit — GM or Owner needs to approve before you can resubmit.
                    </div>
                  </div>
                  {editRequested ? (
                    <div className="flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan-light px-4 py-2 text-[12.5px] font-bold text-cyan-dark">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-dark" />
                      Waiting for approval
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestEdit}
                      disabled={requestingEdit}
                      className="flex items-center gap-2 rounded-[11px] bg-red px-5 py-2.5 text-[13px] font-bold text-white shadow-lift disabled:opacity-60"
                    >
                      {requestingEdit ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" /> : <i className="bi bi-pencil-square" />}
                      Request Edit
                    </button>
                  )}
                </div>
              ) : (
                <TankStepPanel
                  cfg={step.cfg}
                  tankState={tankState}
                  mode={mode}
                  onTankChange={updateTank}
                  price={step.cfg.product === "AGO" ? prices.ago : step.cfg.product === "LPG" ? prices.lpg : prices.pms}
                />
              )}

              {status !== "loading" && !isLocked && (
                <PhotoCapture
                  photo={photos[stepKey]}
                  onCapture={handlePhoto}
                  label={`Add ${step.cfg.id} photo`}
                  sub="Optional evidence photo"
                  progress={uploadProgress[stepKey]}
                />
              )}
            </div>
          </div>

          <div
            className="mt-3 overflow-hidden rounded-[16px] px-4 py-4 text-white shadow-card"
            style={{ background: "var(--brand-gradient-btn)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.8px] text-white/85">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green" style={{ boxShadow: "0 0 6px rgba(34,197,94,.7)" }} />
                Live Price
              </div>
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.5px] text-white/45">per litre</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "PMS", value: prices.pms },
                { label: "AGO", value: prices.ago },
                { label: "LPG", value: prices.lpg },
              ].map(p => (
                <div key={p.label} className="flex flex-col items-center justify-center rounded-[12px] bg-white/10 px-1.5 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-white/55">{p.label}</div>
                  <div className="mt-1 flex items-baseline gap-0.5">
                    <span className="text-[10px] font-semibold text-white/60">₦</span>
                    <span className="font-mono text-[15px] font-extrabold leading-none tracking-tight text-white">
                      {litresValue(p.value || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <WizardNav onBack={goPrev} onNext={goNext} isLast={isLast} saving={saving} />

      <StepsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        steps={STEPS}
        current={current}
        mode={mode}
        tankState={tankState}
        onJump={setCurrent}
      />

      <ConfirmSubmitModal
        open={confirmOpen}
        title={`Confirm ${mode === "open" ? "Opening" : "Closing"} Stock`}
        subtitle={`Review before saving — ${date}`}
        rows={reviewRows}
        warnings={reviewWarnings}
        confirming={saving}
        onConfirm={doSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default function DipPage() {
  return (
    <ToastProvider>
      <DipInner />
    </ToastProvider>
  )
}
