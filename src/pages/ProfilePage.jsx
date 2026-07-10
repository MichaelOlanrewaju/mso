import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { useDriveImage } from "../hooks/useDriveImage"
import { compressImage } from "../utils/compressImage"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

const AVATAR_COLORS = ["#179DD0","#06091A","#16A34A","#D97706","#DC2626","#7C3AED"]
function avatarColor(name) {
  return AVATAR_COLORS[(name || " ").charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

function Section({ title, children }) {
  return (
    <div className="mb-4 rounded-card border border-border bg-white shadow-card">
      <div className="border-b border-surface px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.7px] text-ink-4">{title}</div>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

export default function ProfilePage() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  usePageTitle("Profile — MSO Limpid")

  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // Name / email form
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoFeedback, setInfoFeedback] = useState(null)

  // Password change form
  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [passFeedback, setPassFeedback] = useState(null)

  // Photo upload
  const photoInputRef = useRef(null)
  const [photoId, setPhotoId] = useState("")
  const [localPhotoUrl, setLocalPhotoUrl] = useState("")
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoFeedback, setPhotoFeedback] = useState(null)
  const { dataUri: fetchedPhotoUrl } = useDriveImage(!localPhotoUrl ? photoId : null)

  const displayPhoto = localPhotoUrl || fetchedPhotoUrl

  useEffect(() => {
    if (!auth.username || !SCRIPT_URL) return
    setLoadingProfile(true)
    const url = new URL(SCRIPT_URL)
    url.searchParams.set("action", "getProfile")
    url.searchParams.set("username", auth.username)
    fetch(url.toString(), { method: "GET", redirect: "follow" })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setProfile(d.profile)
          setName(d.profile.name || "")
          setEmail(d.profile.email || "")
          setPhotoId(d.profile.profilePhotoId || "")
        }
        setLoadingProfile(false)
      })
      .catch(() => setLoadingProfile(false))
  }, [auth.username])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const saveInfo = async () => {
    if (!name.trim()) { setInfoFeedback({ type: "error", text: "Name can't be empty." }); return }
    setSavingInfo(true); setInfoFeedback(null)
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "updateProfile", username: auth.username, name: name.trim(), email: email.trim() }),
      })
      const d = await res.json()
      setInfoFeedback({ type: d.ok ? "success" : "error", text: d.ok ? "Profile updated." : d.error })
    } catch { setInfoFeedback({ type: "error", text: "Network error. Try again." }) }
    finally { setSavingInfo(false) }
  }

  const savePassword = async () => {
    if (!currentPass) { setPassFeedback({ type: "error", text: "Enter your current password." }); return }
    if (!newPass || newPass.length < 6) { setPassFeedback({ type: "error", text: "New password must be at least 6 characters." }); return }
    if (newPass !== confirmPass) { setPassFeedback({ type: "error", text: "Passwords don't match." }); return }

    // Verify current password by attempting a login check
    setSavingPass(true); setPassFeedback(null)
    try {
      // Use the resetPassword-style direct update — verify by re-checking login first
      const checkUrl = new URL(SCRIPT_URL)
      checkUrl.searchParams.set("action", "login")
      checkUrl.searchParams.set("username", auth.username)
      checkUrl.searchParams.set("password", currentPass)
      const checkRes = await fetch(checkUrl.toString(), { method: "GET", redirect: "follow" })
      const checkD = await checkRes.json()
      if (!checkD.ok) { setPassFeedback({ type: "error", text: "Current password is incorrect." }); setSavingPass(false); return }

      const res = await fetch(SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "updateProfile", username: auth.username, password: newPass }),
      })
      const d = await res.json()
      if (d.ok) {
        setPassFeedback({ type: "success", text: "Password changed successfully." })
        setCurrentPass(""); setNewPass(""); setConfirmPass("")
      } else {
        setPassFeedback({ type: "error", text: d.error || "Couldn't update password." })
      }
    } catch { setPassFeedback({ type: "error", text: "Network error. Try again." }) }
    finally { setSavingPass(false) }
  }

  const handlePhotoChange = async e => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setUploadingPhoto(true); setPhotoFeedback(null)
    try {
      const reader = new FileReader()
      reader.onload = async ev => {
        const dataUrl = ev.target.result
        setLocalPhotoUrl(dataUrl) // instant preview

        // Compress then upload
        const compressed = await compressImage(dataUrl, file.type, 0.7, 600)
        const res = await fetch(SCRIPT_URL, {
          method: "POST", headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "savePhoto", station: STATION_KEY,
            date: new Date().toISOString().split("T")[0],
            session: "Profile", subject: `profile__${auth.username}`,
            dataUrl: compressed, mimeType: file.type,
            username: auth.username,
          }),
        })
        const d = await res.json()
        if (d.ok && d.fileId) {
          // Save fileId to profile
          const upRes = await fetch(SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ action: "updateProfile", username: auth.username, profilePhotoId: d.fileId }),
          })
          const upD = await upRes.json()
          if (upD.ok) { setPhotoId(d.fileId); setPhotoFeedback({ type: "success", text: "Photo saved." }) }
          else setPhotoFeedback({ type: "error", text: "Photo uploaded but couldn't save to profile." })
        } else {
          setLocalPhotoUrl("")
          setPhotoFeedback({ type: "error", text: d.error || "Photo upload failed." })
        }
        setUploadingPhoto(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setLocalPhotoUrl("")
      setPhotoFeedback({ type: "error", text: "Upload failed. Try again." })
      setUploadingPhoto(false)
    }
  }

  const roleLabel = { owner: "Owner", gm: "General Manager", supervisor: "Supervisor", cashier: "Cashier" }

  return (
    <div className="min-h-screen bg-pagebg pb-10">
      <SafeAreaDebug />
      <div
        className="sticky top-0 z-[200] flex items-center gap-3 border-b border-border bg-white px-4 pb-2.5 shadow-[0_1px_4px_rgba(0,0,0,.04)]"
        style={{ paddingTop: "max(var(--sat), 52px)" }}
      >
        <button type="button"
          onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface text-ink-2">
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-1">
          <div className="text-[16px] font-extrabold text-ink">My Profile</div>
          <div className="text-[10px] text-ink-4">MSO Limpid Co. Ltd</div>
        </div>
      </div>

      <div className="mx-auto max-w-[520px] px-4 py-5">

        {/* Avatar hero */}
        <div className="mb-5 flex flex-col items-center gap-3">
          <div className="relative">
            {displayPhoto ? (
              <img src={displayPhoto} alt="Profile" className="h-24 w-24 rounded-full object-cover shadow-lift" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full shadow-lift text-white text-[28px] font-extrabold"
                style={{ background: avatarColor(name || auth.name) }}>
                {initials(name || auth.name)}
              </div>
            )}
            <button type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-navy text-white shadow-lift disabled:opacity-60">
              {uploadingPhoto
                ? <span className="h-3 w-3 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />
                : <i className="bi bi-camera-fill text-[11px]" />
              }
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="text-center">
            <div className="text-[17px] font-extrabold text-ink">{name || auth.name}</div>
            <div className="text-[12px] text-ink-4">{roleLabel[auth.role] || auth.role} · @{auth.username}</div>
          </div>
          {photoFeedback && (
            <div className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${photoFeedback.type === "success" ? "bg-green-light text-green" : "bg-red-light text-red"}`}>
              {photoFeedback.text}
            </div>
          )}
        </div>

        {loadingProfile ? (
          <div className="flex justify-center py-8">
            <span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
          </div>
        ) : (
          <>
            <Section title="Personal Info">
              <label className="mb-3 block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">Display Name</span>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-cyan" />
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">Email address</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-cyan" />
                <div className="mt-1 text-[10.5px] text-ink-4">Used for password reset emails.</div>
              </label>
              {infoFeedback && (
                <div className={`mb-3 rounded-[9px] px-3 py-2 text-[12px] font-semibold ${infoFeedback.type === "success" ? "bg-green-light text-green" : "bg-red-light text-red"}`}>
                  {infoFeedback.text}
                </div>
              )}
              <button type="button" onClick={saveInfo} disabled={savingInfo}
                className="flex h-10 w-full items-center justify-center rounded-[9px] bg-navy text-[13px] font-bold text-white disabled:opacity-60">
                {savingInfo ? "Saving…" : "Save changes"}
              </button>
            </Section>

            <Section title="Change Password">
              <label className="mb-3 block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">Current password</span>
                <input type={showPass ? "text" : "password"} value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  placeholder="Your current password"
                  className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-cyan" />
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">New password</span>
                <div className="flex items-center rounded-[9px] border border-border focus-within:border-cyan">
                  <input type={showPass ? "text" : "password"} value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    placeholder="At least 6 characters"
                    className="flex-1 bg-transparent px-3 py-2.5 text-[13.5px] text-ink outline-none" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="px-3 text-ink-4">
                    <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-[11px] font-semibold text-ink-3">Confirm new password</span>
                <input type={showPass ? "text" : "password"} value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder="Same password again"
                  className="w-full rounded-[9px] border border-border px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-cyan" />
              </label>
              {passFeedback && (
                <div className={`mb-3 rounded-[9px] px-3 py-2 text-[12px] font-semibold ${passFeedback.type === "success" ? "bg-green-light text-green" : "bg-red-light text-red"}`}>
                  {passFeedback.text}
                </div>
              )}
              <button type="button" onClick={savePassword} disabled={savingPass}
                className="flex h-10 w-full items-center justify-center rounded-[9px] bg-navy text-[13px] font-bold text-white disabled:opacity-60">
                {savingPass ? "Saving…" : "Change password"}
              </button>
            </Section>

            <div className="mt-1 rounded-card border border-border bg-white p-4 shadow-card">
              <div className="text-[11px] font-bold uppercase tracking-[0.7px] text-ink-4 mb-3">Account</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-ink">@{auth.username}</div>
                  <div className="text-[11px] text-ink-4">{roleLabel[auth.role] || auth.role}</div>
                </div>
                <button type="button"
                  onClick={() => { auth.logout(); navigate("/login") }}
                  className="flex h-8 items-center gap-1.5 rounded-[8px] border border-red/20 bg-red-light px-3 text-[12px] font-bold text-red">
                  <i className="bi bi-box-arrow-right" /> Log out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
