import React from "react"
import { useSettings } from "../../hooks/useSettings"
import { useToast } from "../layout/ToastProvider"

/* CEO/Owner-only security switch: whether supervisors can attach a photo
   to dip/pump readings at all. Off by exception, not by default — this is
   for a specific situation where the CEO wants no photo evidence path
   available, not a general preference. */
export default function PhotoUploadToggleCard({ role, username }) {
  const { settings, saving, saveSetting } = useSettings()
  const toast = useToast()

  if (!["ceo", "owner"].includes(role)) return null

  const enabled = settings.photoUploadEnabled !== "false"

  const handleToggle = async () => {
    const next = enabled ? "false" : "true"
    const res = await saveSetting("photoUploadEnabled", next, username)
    if (res.ok) {
      toast.showToast(
        next === "true" ? "Photo upload enabled" : "Photo upload disabled",
        next === "true" ? "Supervisors can attach photos to dip/pump readings again." : "Dip and pump entry photo upload is now switched off for everyone.",
        next === "true" ? "ok" : "warn"
      )
    } else {
      toast.showToast("Couldn't save", res.error || "Please try again", "err")
    }
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card">
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: enabled ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)" }}
      >
        <i className={`bi ${enabled ? "bi-camera-fill" : "bi-camera-video-off-fill"}`} style={{ color: enabled ? "#16A34A" : "#DC2626" }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-ink">Dip / Pump Photo Upload</div>
        <div className="text-[11px] text-ink-4">
          {enabled ? "Supervisors can attach photos to readings" : "Photo upload is switched off for everyone"}
        </div>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        role="switch"
        aria-checked={enabled}
        className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-green" : "bg-border"}`}
      >
        <span
          className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-[22px]" : "translate-x-[3px]"}`}
        />
      </button>
    </div>
  )
}
