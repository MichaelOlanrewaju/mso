import React, { useState } from "react"
import { useNavigate } from "react-router-dom"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("idle") // idle | loading | sent | error
  const [error, setError] = useState("")

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email.trim()) { setError("Please enter your email address."); return }
    setStatus("loading"); setError("")
    try {
      const url = new URL(SCRIPT_URL)
      url.searchParams.set("action", "requestPasswordReset")
      url.searchParams.set("email", email.trim().toLowerCase())
      const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
      const d = await res.json()
      if (d.ok) setStatus("sent")
      else { setError(d.error || "Something went wrong. Please try again."); setStatus("idle") }
    } catch {
      setError("Network error — please check your connection and try again.")
      setStatus("idle")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pagebg px-5">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-navy shadow-lift">
            <span className="text-[16px] font-extrabold text-white">MSO</span>
          </div>
          <div className="text-[13px] text-ink-4">Limpid Co. Ltd</div>
        </div>

        {status === "sent" ? (
          <div className="rounded-card border border-border bg-white p-6 shadow-card text-center">
            <div className="mb-3 text-4xl">📬</div>
            <div className="mb-1.5 text-[16px] font-extrabold text-ink">Check your email</div>
            <div className="mb-5 text-[13px] text-ink-4">
              If <strong>{email}</strong> is registered, we've sent a link to reset your password. Check your inbox — it may take a minute.
            </div>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex h-11 w-full items-center justify-center rounded-[10px] border border-border bg-surface text-[13.5px] font-bold text-ink-2"
            >
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-card border border-border bg-white p-6 shadow-card">
            <div className="mb-1 text-[18px] font-extrabold text-ink">Forgot password?</div>
            <div className="mb-5 text-[13px] text-ink-4">Enter your email and we'll send you a reset link.</div>

            <label className="mb-4 block">
              <span className="mb-1 block text-[11px] font-semibold text-ink-3">Email address</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
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
              ) : "Send reset link"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-3 flex w-full items-center justify-center text-[12.5px] font-semibold text-ink-4"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
