import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import DateRow from "../components/dip/DateRow"
import StatusStrip from "../components/dip/StatusStrip"
import ModeToggle from "../components/dip/ModeToggle"
import StepProgress from "../components/dip/StepProgress"
import WizardNav from "../components/dip/WizardNav"
import { PumpStepPanel } from "../components/sales/PumpStepPanel"
import PumpStepsDrawer from "../components/sales/PumpStepsDrawer"
import PhotoCapture from "../components/dip/PhotoCapture"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePrices } from "../hooks/usePrices"
import { useSalesEntry } from "../hooks/useSalesEntry"
import { usePageTitle } from "../hooks/usePageTitle"
import { PUMPS } from "../config/pumps"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

// Each pump keeps its true unique id (config/pumps.js guarantees this,
// even where two physical pumps share the same signage label like "P1"
// on different tanks). Display components read pump.pumpId for the
// human-facing label; never overwrite pump.id with it.
const STEPS = PUMPS.map(p => ({ pump: p }))

function SalesInner() {
  const auth = useAuth({ requireAuth: true })
  const [date, setDate] = useState(todayISO())

  const {
    status, readings, hasOpening, hasClosing, existingPhotos,
    updateReading, submit, savePhoto, saving: submitting, refresh,
    saveStep, savingStep, pumpLocks, requestEditPump, requestingEdit,
  } = useSalesEntry(auth.username, auth.name, date)
  const { prices } = usePrices()

  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle("Pump Metres — MSO Limpid")

  const [mode, setMode] = useState("open")
  const [current, setCurrent] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notes] = useState("")
  const [photos, setPhotos] = useState({})
  const [uploadProgress, setUploadProgress] = useState({})
  const [editRequested, setEditRequested] = useState({}) // { [pumpKey]: true }
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (status === "ready") {
      if (hasOpening || hasClosing) setMode("close")
      else setMode("open")
      if (hasOpening || hasClosing) {
        toast.showToast("Data loaded", `Existing pump readings found for ${date}`, "ok")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Seed photo indicators (with viewable thumbnails) from what's already
  // saved on the backend — previously this page had no photo-loading
  // logic at all, so an already-captured pump photo always looked
  // missing after navigating away and back, even though it was safely
  // uploaded. Mirrors the same fix already applied to Dip Entry.
  useEffect(() => {
    if (status !== "ready") return
    const sessionLabel = mode === "open" ? "Morning" : "Evening"
    const seeded = {}
    STEPS.forEach(s => {
      const key = `${s.pump.id}__${sessionLabel}`
      if (existingPhotos[key]) seeded[s.pump.id] = { saved: true, fileId: existingPhotos[key].fileId }
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
  const stepKey = step.pump.id
  const pumpLockState = pumpLocks[step.pump.id]
  const isLocked = mode === "open" ? !!pumpLockState?.openLocked : !!pumpLockState?.closeLocked

  const handleRequestEdit = async () => {
    const result = await requestEditPump(date, step.pump.pumpId || step.pump.id, step.pump.id, mode)
    if (!result.ok) {
      toast.showToast("Could not send request", result.error || "Please try again", "err")
      return
    }
    setEditRequested(prev => ({ ...prev, [`${step.pump.id}_${mode}`]: true }))
    toast.showToast("Edit requested", "Waiting for GM or Owner to approve", "ok")
  }

  const handleDateChange = newDate => {
    setDate(newDate)
    setCurrent(0)
    setPhotos({})
    setEditRequested({})
  }

  const handlePhoto = (dataUrl, mimeType) => {
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

  const handleSubmit = async () => {
    const result = await submit(date, prices, notes)
    if (!result.ok) {
      toast.showToast("Could not save", result.error || "Please try again", "err")
      return
    }
    if (navigator.vibrate) navigator.vibrate([50, 30, 80])
    toast.showToast("Saved", mode === "open" ? "Opening metres saved — return at shift end for closing" : "All pump readings saved", "ok")
    refresh()
    setTimeout(() => navigate(dashboardPathFor({ role: auth.role, station: auth.station })), 1200)
  }

  const doGoNext = async () => {
    setConfirmOpen(false)
    if (navigator.vibrate) navigator.vibrate(30)
    // Save this pump's reading now, before moving on — so progress
    // survives even if the person closes the app mid-way through the
    // 7-pump wizard instead of losing everything back to the last full
    // submit. Skip entirely if this pump is locked — nothing to save,
    // and attempting it would just be rejected by the backend anyway.
    if (!isLocked) {
      const result = await saveStep(step.pump, date, prices, notes)
      if (!result.ok && !result.skipped) {
        if (result.locked) {
          // The lock check caught this — our own pumpLocks state just
          // hadn't refreshed yet (e.g. it was approved/consumed
          // elsewhere, or this load happened before a lock kicked in).
          // Refresh so the UI catches up and shows the real locked state
          // instead of leaving the person stuck on a misleading error.
          toast.showToast("Already submitted", result.error || "This pump is locked. Refreshing…", "warn")
          refresh()
          return
        }
        toast.showToast("Couldn't save this pump", result.error || "Check your connection and try again", "err")
        return
      }
    }
    if (current < STEPS.length - 1) {
      setCurrent(c => c + 1)
      window.scrollTo(0, 0)
    } else {
      handleSubmit()
    }
  }

  const goNext = () => {
    // Nothing entered for this pump and it's not locked — no point
    // reviewing a blank step, just move on.
    const r = readings[step.pump.id] || {}
    const hasReading = Number(r.open) > 0 || Number(r.close) > 0
    if (!hasReading || isLocked) {
      doGoNext()
      return
    }
    setConfirmOpen(true)
  }

  const goPrev = () => {
    if (current > 0) {
      setCurrent(c => c - 1)
      window.scrollTo(0, 0)
    } else if (window.confirm("Leave without saving?")) {
      navigate(dashboardPathFor({ role: auth.role, station: auth.station }))
    }
  }

  // What the review popup shows for this one pump before it's saved.
  const currentReading = readings[step.pump.id] || {}
  const openVal = Number(currentReading.open) || 0
  const closeVal = Number(currentReading.close) || 0
  const diff = closeVal >= openVal ? closeVal - openVal : 0
  const reviewRows = [
    { label: "Product", value: step.pump.product },
    { label: "Tank", value: step.pump.tank },
    ...(mode === "open"
      ? [{ label: "Opening Reading", value: openVal > 0 ? `${openVal.toLocaleString("en-NG")}L` : "Not entered", warn: openVal === 0 }]
      : [
          { label: "Opening Reading", value: `${openVal.toLocaleString("en-NG")}L` },
          { label: "Closing Reading", value: closeVal > 0 ? `${closeVal.toLocaleString("en-NG")}L` : "Not entered", warn: closeVal === 0 },
          { label: "Litres Dispensed", value: `${diff.toLocaleString("en-NG")}L${diff === 0 ? " (no sales today)" : ""}` },
        ]),
  ]
  const reviewWarnings = []
  if (mode === "close" && closeVal > 0 && closeVal < openVal) {
    reviewWarnings.push("Closing is lower than Opening — pump meters only count up. Please check this reading.")
  }
  if (mode === "close" && closeVal > 0 && diff > 0 && openVal > 0 && diff > openVal * 3) {
    reviewWarnings.push(`This shows ${diff.toLocaleString("en-NG")}L dispensed — unusually large. Double-check the closing reading isn't mistyped.`)
  }
  if ((mode === "open" && openVal === 0) || (mode === "close" && closeVal === 0)) {
    reviewWarnings.push(`No ${mode === "open" ? "opening" : "closing"} reading entered for this pump.`)
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #F1F5FB 220px)" }}>
      <SafeAreaDebug />
      <div
        className="sticky top-0 z-[200] px-4 pb-4 text-white shadow-lg"
        style={{ paddingTop: "max(var(--sat), 52px)", background: "linear-gradient(135deg, #130656 0%, #1a0875 100%)" }}
      >
        <div className="mx-auto max-w-[640px]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[1.4px] text-cyan">
                Step {current + 1} of {STEPS.length}
              </div>
              <div className="text-[16px] font-extrabold text-white">
                Pump {step.pump.pumpId || step.pump.id} — {mode === "open" ? "Opening Metre" : "Closing Metre"}
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
          <ModeToggle mode={mode} onChange={setMode} hasOpening={hasOpening} hasClosing={hasClosing} />
          <StatusStrip hasOpening={hasOpening} hasClosing={hasClosing} hasCash={false} />

          <div className="overflow-hidden rounded-card border border-cyan/15 bg-white shadow-card">
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #130656, #179DD0)" }} />
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
                      Pump {step.pump.pumpId || step.pump.id} — {mode === "open" ? "Opening" : "Closing"} already submitted
                    </div>
                    <div className="mt-1 text-[12.5px] text-ink-3">
                      This {mode === "open" ? "opening" : "closing"} reading has already been saved for {date}. To change it, request an edit — GM or Owner needs to approve before you can resubmit.
                    </div>
                  </div>
                  {editRequested[`${step.pump.id}_${mode}`] ? (
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
                <PumpStepPanel
                  pump={step.pump}
                  readings={readings}
                  mode={mode}
                  onChange={updateReading}
                  price={step.pump.product === "AGO" ? prices.ago : step.pump.product === "LPG" ? (prices.lpg || 0) : prices.pms}
                />
              )}

              {status !== "loading" && !isLocked && (
                <PhotoCapture
                  photo={photos[stepKey]}
                  onCapture={handlePhoto}
                  label={`Add Pump ${step.pump.pumpId || step.pump.id} photo`}
                  sub="Optional evidence photo"
                  progress={uploadProgress[stepKey]}
                />
              )}
            </div>
          </div>

          <div
            className="mt-3 flex items-center justify-between rounded-[14px] px-4 py-3 text-white shadow-card"
            style={{ background: "linear-gradient(135deg, #130656 0%, #179DD0 140%)" }}
          >
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-white/85">
              <span className="h-2 w-2 rounded-full bg-green" style={{ boxShadow: "0 0 6px rgba(34,197,94,.7)" }} />
              Live price
            </div>
            <div className="font-mono text-[13px] font-bold text-white">
              PMS ₦{prices.pms.toLocaleString("en-NG")} · AGO ₦{prices.ago.toLocaleString("en-NG")} · LPG ₦{(prices.lpg || 0).toLocaleString("en-NG")}
            </div>
          </div>
        </div>
      </div>

      <WizardNav onBack={goPrev} onNext={goNext} isLast={isLast} saving={submitting || savingStep} />

      <PumpStepsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        steps={STEPS}
        current={current}
        mode={mode}
        readings={readings}
        onJump={setCurrent}
      />

      <ConfirmSubmitModal
        open={confirmOpen}
        title={`Confirm Pump ${step.pump.pumpId || step.pump.id}`}
        subtitle={`${mode === "open" ? "Opening" : "Closing"} reading — ${date}`}
        rows={reviewRows}
        warnings={reviewWarnings}
        confirming={savingStep}
        onConfirm={doGoNext}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

export default function SalesPage() {
  return (
    <ToastProvider>
      <SalesInner />
    </ToastProvider>
  )
}
