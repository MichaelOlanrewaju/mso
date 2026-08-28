import React, { useEffect, useState } from "react"
import { litres } from "../utils/format"
import { useNavigate, useSearchParams } from "react-router-dom"
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
import PriceCutoverModal from "../components/sales/PriceCutoverModal"
import ConfirmSubmitModal from "../components/ui/ConfirmSubmitModal"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePrices } from "../hooks/usePrices"
import { usePriceCutover } from "../hooks/usePriceCutover"
import { useSalesEntry } from "../hooks/useSalesEntry"
import { useAttendants } from "../hooks/useAttendants"
import { useSettings } from "../hooks/useSettings"
import { usePageTitle } from "../hooks/usePageTitle"
/* Tanks and pumps are per-station now — M&M has no TK3, and its pumps map
   to different tanks. Reading a shared config that assumed MSO's layout would
   have collected dips for a tank that does not exist. */
import { tanksFor, pumpsFor, getStation } from "../config/stations"
import { activeStation } from "../utils/station"

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

function SalesInner() {
  const auth = useAuth({ requireAuth: true })
  /* Was computed once at module load time, before this component even
     mounted — meaning STEPS permanently reflected whichever station
     happened to be active the first time this file was ever loaded, and
     never updated again for the rest of the session. Confirmed directly:
     this worked fine for MSO (loaded first) but silently kept showing
     MSO's pump list even after switching to M&M, since a plain
     module-level const like this only ever runs that one time. Moved
     inside the component so it re-reads the current station on every
     render instead. */
  const STEPS = pumpsFor(activeStation()).map(p => ({ pump: p }))
  const [date, setDate] = useState(todayISO())

  /* A price change sends the supervisor here with ?cutover=pms (or ago). That
     opens the cutover sheet for exactly those pumps — the ones whose price
     actually moved. */
  const [searchParams, setSearchParams] = useSearchParams()
  const cutoverProduct = (searchParams.get("cutover") || "").toUpperCase()
  const { runCutover, reopenPump, saving: cuttingOver } = usePriceCutover(auth.username)

  const {
    status, readings, hasOpening, hasClosing, existingPhotos,
    updateReading, submit, savePhoto, saving: submitting, refresh,
    saveStep, savingStep, pumpLocks, requestEditPump, requestingEdit,
    attendantId, setAttendantId, attendantName, setAttendantName,
  } = useSalesEntry(auth.username, auth.name, date)
  const { prices } = usePrices()
  const { settings } = useSettings()
  const photoUploadEnabled = settings.photoUploadEnabled !== "false"
  const { attendants } = useAttendants(auth.username)

  /* Run the cutover: one reading per pump closes the old-price session and
     opens the new-price one. On success we clear the ?cutover flag and reload,
     so the page reflects the freshly-opened session. */
  const handleCutover = async readings => {
    const res = await runCutover({
      date,
      product: cutoverProduct,
      newPrice: cutoverProduct === "AGO" ? prices.ago : prices.pms,
      readings,
    })
    if (res.ok) {
      toast.showToast("Pumps reopened", res.message || "Cutover complete", "ok")
      searchParams.delete("cutover")
      setSearchParams(searchParams, { replace: true })
      refresh()
    } else {
      toast.showToast("Cutover failed", res.error || "Try again", "err")
    }
  }

  const navigate = useNavigate()
  const toast = useToast()
  usePageTitle(`Pump Metres — ${getStation(activeStation()).name}`)

  const [mode, setMode] = useState("open")
  const [current, setCurrent] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notes] = useState("")
  const [photos, setPhotos] = useState({})
  const [uploadProgress, setUploadProgress] = useState({})
  const [editRequested, setEditRequested] = useState({}) // { [pumpKey]: true }
  /* Different from the normal edit-request flow above — that one is for
     correcting a mistake in an already-approved reading. This is for a
     genuinely new situation: the pump is correctly closed, but the price
     has changed again since, and there's more fuel to record at the new
     price. No approval needed here since nothing already-recorded gets
     touched — this only ever adds a new session on top. */
  const [reopenPromptOpen, setReopenPromptOpen] = useState(false)
  const [reopenNewPrice, setReopenNewPrice] = useState("")
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

  const handleReopenForNewPrice = async () => {
    const price = Number(reopenNewPrice)
    if (!price) {
      toast.showToast("Enter the new price", "Price is required", "err")
      return
    }
    const result = await reopenPump({ date, pumpId: step.pump.id, newPrice: price })
    if (!result.ok) {
      toast.showToast("Couldn't reopen", result.error || "Please try again", "err")
      return
    }
    toast.showToast("Reopened", result.message || `${step.pump.pumpId || step.pump.id} ready for the new price`, "ok")
    setReopenPromptOpen(false)
    setReopenNewPrice("")
    refresh()
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
    if (result.warning) {
      // Meter readings are safe, but a sales record didn't save — surface it
      // rather than a plain "Saved" that hides the gap.
      toast.showToast("Saved with a warning", result.warning, "err")
    } else {
      toast.showToast("Saved", mode === "open" ? "Opening metres saved — return at shift end for closing" : "All pump readings saved", "ok")
    }
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
      ? [{ label: "Opening Reading", value: openVal > 0 ? `${litres(openVal)}` : "Not entered", warn: openVal === 0 }]
      : [
          { label: "Opening Reading", value: `${litres(openVal)}` },
          { label: "Closing Reading", value: closeVal > 0 ? `${litres(closeVal)}` : "Not entered", warn: closeVal === 0 },
          { label: "Litres Dispensed", value: `${litres(diff)}${diff === 0 ? " (no sales today)" : ""}` },
        ]),
  ]
  const reviewWarnings = []
  if (mode === "close" && closeVal > 0 && closeVal < openVal) {
    reviewWarnings.push("Closing is lower than Opening — pump meters only count up. Please check this reading.")
  }
  if (mode === "close" && closeVal > 0 && diff > 0 && openVal > 0 && diff > openVal * 3) {
    reviewWarnings.push(`This shows ${litres(diff)} dispensed — unusually large. Double-check the closing reading isn't mistyped.`)
  }
  if ((mode === "open" && openVal === 0) || (mode === "close" && closeVal === 0)) {
    reviewWarnings.push(`No ${mode === "open" ? "opening" : "closing"} reading entered for this pump.`)
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F5F3FF 0%, #F1F5FB 220px)" }}>
      <PriceCutoverModal
        open={cutoverProduct === "PMS" || cutoverProduct === "AGO"}
        product={cutoverProduct}
        newPrice={cutoverProduct === "AGO" ? prices.ago : prices.pms}
        oldPrice={0}
        saving={cuttingOver}
        onClose={() => { searchParams.delete("cutover"); setSearchParams(searchParams, { replace: true }) }}
        onConfirm={handleCutover}
      />
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

          {/* Which real attendant worked this session — replaces the old
              silent behaviour where every sale was tagged with the
              supervisor's own name. Shown prominently since it applies to
              every pump saved in this session, not per-pump. */}
          <div className="mb-3 rounded-card border border-border bg-white p-3.5 shadow-card">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-ink-4">
              <i className="bi bi-person-check mr-1" /> Attendant working this session
            </div>
            <select
              value={attendantId}
              onChange={e => {
                const id = e.target.value
                setAttendantId(id)
                const found = attendants.find(a => a.attendantId === id)
                setAttendantName(found ? found.name : "")
              }}
              className="w-full rounded-[9px] border border-border bg-surface px-3 py-2.5 text-[13.5px] font-semibold text-ink outline-none focus:border-cyan"
            >
              <option value="">Not selected — will use your own name instead</option>
              {attendants.map(a => (
                <option key={a.attendantId} value={a.attendantId}>{a.name}</option>
              ))}
            </select>
          </div>

          <ModeToggle mode={mode} onChange={setMode} hasOpening={hasOpening} hasClosing={hasClosing} />
          <StatusStrip hasOpening={hasOpening} hasClosing={hasClosing} hasCash={false} />

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

                  {/* A genuinely different situation from a mistake needing
                      correction: the reading is correct, but the price has
                      changed again since it was saved, and there's more
                      fuel to record. No approval needed — nothing already
                      saved gets touched, this only adds a new session. */}
                  {mode === "close" && !reopenPromptOpen && (
                    <button
                      type="button"
                      onClick={() => setReopenPromptOpen(true)}
                      className="mt-1 flex items-center gap-2 rounded-[11px] border-2 border-cyan/30 bg-cyan-light px-5 py-2.5 text-[13px] font-bold text-cyan-dark"
                    >
                      <i className="bi bi-arrow-repeat" />
                      Price changed again — reopen for new price
                    </button>
                  )}
                  {mode === "close" && reopenPromptOpen && (
                    <div className="mt-1 w-full rounded-[12px] border border-cyan/25 bg-cyan-light p-3.5">
                      <div className="mb-2 text-[12px] font-semibold text-ink-2">
                        Starts a new session for {step.pump.pumpId || step.pump.id} from its saved closing reading — the already-saved session stays exactly as it is.
                      </div>
                      <input
                        type="number" inputMode="decimal" placeholder="New price per litre" value={reopenNewPrice}
                        onChange={e => setReopenNewPrice(e.target.value)}
                        className="mono mb-2 w-full rounded-[8px] border border-border bg-white px-2.5 py-2 text-[13px] font-bold text-ink outline-none"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setReopenPromptOpen(false); setReopenNewPrice("") }}
                          className="flex-1 rounded-[9px] border border-border py-2 text-[12.5px] font-semibold text-ink-3">
                          Cancel
                        </button>
                        <button type="button" onClick={handleReopenForNewPrice} disabled={cuttingOver}
                          className="flex-1 rounded-[9px] bg-cyan-dark py-2 text-[12.5px] font-bold text-white disabled:opacity-60">
                          {cuttingOver ? "Reopening…" : "Reopen"}
                        </button>
                      </div>
                    </div>
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

              {status !== "loading" && !isLocked && photoUploadEnabled && (
                <PhotoCapture
                  photo={photos[stepKey]}
                  onCapture={handlePhoto}
                  label={`Add Pump ${step.pump.pumpId || step.pump.id} photo`}
                  sub="Optional evidence photo"
                  progress={uploadProgress[stepKey]}
                />
              )}
              {status !== "loading" && !isLocked && !photoUploadEnabled && (
                <div className="flex items-center gap-2 rounded-[14px] border border-dashed border-border bg-surface px-4 py-3 text-[12px] text-ink-4">
                  <i className="bi bi-camera-video-off" /> Photo upload is currently switched off
                </div>
              )}
            </div>
          </div>

          <div
            className="mt-3 flex items-center justify-between rounded-[14px] px-4 py-3 text-white shadow-card"
            style={{ background: "var(--brand-gradient-btn)" }}
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
