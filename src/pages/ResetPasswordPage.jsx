import React, { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [status, setStatus] = useState("idle") // idle | loading | done | error
  const [error, setError] = useState("")

  const handleSubmit = async e => {
    e.preventDefault()
    if (!password || password.length < 6) { setError("Password must be at least 6 characters."); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    if (!token) { setError("Reset token is missing. Please use the link from your email."); return }

    setStatus("loading"); setError("")
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "resetPassword", token, password }),
      })
      const d = await res.json()
      if (d.ok) setStatus("done")
      else { setError(d.error || "Something went wrong. The link may have expired."); setStatus("idle") }
    } catch {
      setError("Network error — please check your connection and try again.")
      setStatus("idle")
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-pagebg px-5 text-center">
        <div className="text-4xl mb-3">🔗</div>
        <div className="text-[15px] font-bold text-ink mb-1">Invalid reset link</div>
        <div className="text-[12.5px] text-ink-4 mb-5">This link is missing a token. Use the link from your email.</div>
        <button type="button" onClick={() => navigate("/forgot-password")}
          className="rounded-[10px] bg-navy px-5 py-2.5 text-[13px] font-bold text-white">
          Request a new link
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pagebg px-5">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-navy shadow-lift">
            <span className="text-[16px] font-extrabold text-white">MSO</span>
          </div>
          <div className="text-[13px] text-ink-4">Limpid Co. Ltd</div>
        </div>

        {status === "done" ? (
          <div className="rounded-card border border-border bg-white p-6 shadow-card text-center">
            <div className="mb-3 text-4xl">✅</div>
            <div className="mb-1.5 text-[16px] font-extrabold text-ink">Password updated</div>
            <div className="mb-5 text-[13px] text-ink-4">Your password has been changed. You can now log in with your new password.</div>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex h-12 w-full items-center justify-center rounded-[10px] bg-navy text-[14px] font-bold text-white shadow-lift"
            >
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-card border border-border bg-white p-6 shadow-card">
            <div className="mb-1 text-[18px] font-extrabold text-ink">Set new password</div>
            <div className="mb-5 text-[13px] text-ink-4">Choose a strong password you'll remember.</div>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-semibold text-ink-3">New password</span>
              <div className="flex items-center rounded-[10px] border border-border focus-within:border-cyan">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoFocus
                  className="flex-1 bg-transparent px-3.5 py-3 text-[14px] text-ink outline-none"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="px-3.5 text-ink-4">
                  <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
              </div>
            </label>

            <label className="mb-4 block">
              <span className="mb-1 block text-[11px] font-semibold text-ink-3">Confirm password</span>
              <input
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Same password again"
                className="w-full rounded-[10px] border border-border px-3.5 py-3 text-[14px] text-ink outline-none focus:border-cyan"
              />
            </label>

            {error && (
              <div className="mb-3 rounded-[9px] bg-red-light px-3 py-2 text-[12px] font-semibold text-red">{error}</div>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="flex h-12 w-full items-center justify-center rounded-[10px] bg-navy text-[14px] font-bold text-white shadow-lift disabled:opacity-60"
            >
              {status === "loading" ? (
                <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />
              ) : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
