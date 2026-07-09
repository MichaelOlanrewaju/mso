import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

export default function LoginPage() {
  usePageTitle("Sign In — MSO Digital")
  const auth = useAuth({ requireAuth: false })
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!auth.loading && auth.user) {
      if (auth.canPickStation || !auth.station) navigate("/select", { replace: true })
      else navigate(dashboardPathFor({ role: auth.role, station: auth.station }), { replace: true })
    }
  }, [auth.loading, auth.user, auth.canPickStation, auth.station, auth.role, navigate])

  const clearErrors = () => setError(null)

  async function handleSubmit(e) {
    e?.preventDefault()
    clearErrors()
    const u = username.trim().toLowerCase()
    const p = password
    if (!u) { setError("Please enter your email address."); return }
    if (!p) { setError("Please enter your password."); return }
    if (!SCRIPT_URL) { setError("Script URL not configured."); return }
    setSubmitting(true)
    try {
      // POST, not GET — a login previously went out as ?password=... in the
      // URL, which lands in browser history, network/proxy logs, and Apps
      // Script's own execution logs. Sending it in the body avoids that.
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        redirect: "follow",
        body: JSON.stringify({ action: "login", username: u, password: p }),
      })
      const raw = await res.text()
      let data
      try { data = JSON.parse(raw) } catch { throw new Error("Bad response from server.") }
      if (!data.ok || !data.user) {
        setError(data.error || "Incorrect username or password.")
        setSubmitting(false)
        return
      }
      setSuccess(data.user.pick ? "Authenticated — select your station…" : `Loading ${(data.user.station || "").toUpperCase()} dashboard…`)
      auth.login(data.user)
    } catch (err) {
      setError(navigator.onLine ? "Could not reach server. Try again." : "No internet — check your connection.")
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#06091A", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px calc(20px + env(safe-area-inset-bottom))", overflowY:"auto", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>

      {/* Animated blobs — navy (MSO) + cyan (live ops) + amber (M&M), matching the
          station color-coding used everywhere else in the app rather than an
          arbitrary third color */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", width:700, height:700, top:"-20%", left:"-15%", borderRadius:"50%", background:"radial-gradient(circle,rgba(23,157,208,0.22) 0%,transparent 65%)", filter:"blur(80px)", animation:"drift1 18s ease-in-out infinite alternate" }} />
        <div style={{ position:"absolute", width:600, height:600, bottom:"-10%", right:"-10%", borderRadius:"50%", background:"radial-gradient(circle,rgba(19,6,86,0.70) 0%,transparent 65%)", filter:"blur(80px)", animation:"drift2 22s ease-in-out infinite alternate" }} />
        <div style={{ position:"absolute", width:400, height:400, top:"40%", left:"55%", borderRadius:"50%", background:"radial-gradient(circle,rgba(245,184,74,0.08) 0%,transparent 65%)", filter:"blur(80px)", animation:"drift3 15s ease-in-out infinite alternate" }} />
      </div>
      {/* Dot grid */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", backgroundImage:"radial-gradient(rgba(255,255,255,0.045) 1px,transparent 1px)", backgroundSize:"26px 26px" }} />

      {/* Card */}
      <div style={{ position:"relative", zIndex:5, width:"100%", maxWidth:400, display:"flex", flexDirection:"column", alignItems:"center" }}>

        {/* Logo above card */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, marginBottom:28, animation:"riseIn 0.65s 0.05s both cubic-bezier(0.22,1,0.36,1)" }}>
          <img src="/images/msolimpid.png" alt="MSO Limpid"
            style={{ height:48, width:"auto", display:"block", filter:"brightness(0) invert(1)" }}
            onError={e => { e.target.style.display="none" }} />
          <div style={{ fontSize:16, fontWeight:800, color:"#fff", letterSpacing:"-0.03em" }}>Digital Platform</div>
        </div>

        {/* White card */}
        <div style={{ width:"100%", background:"#fff", borderRadius:22, padding:"38px 36px 32px", boxShadow:"0 0 0 0.5px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08), 0 24px 64px rgba(0,0,0,0.28)", animation:"riseIn 0.65s 0.14s both cubic-bezier(0.22,1,0.36,1)" }}>

          <div style={{ marginBottom:26 }}>
            <h1 style={{ fontSize:26, fontWeight:900, color:"#0F172A", letterSpacing:"-0.055em", lineHeight:0.97, marginBottom:7 }}>Sign in</h1>
            <p style={{ fontSize:14, color:"#64748B", lineHeight:1.6 }}>Enter your email and password to access your dashboard.</p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ display:"flex", alignItems:"flex-start", gap:9, padding:"11px 13px", borderRadius:11, fontSize:13, fontWeight:500, lineHeight:1.45, marginBottom:16, background:"#FEF2F2", border:"1px solid #FECACA", color:"#B91C1C" }}>
              <i className="bi bi-exclamation-circle-fill" style={{ fontSize:14, marginTop:1, flexShrink:0 }} />
              {error}
            </div>
          )}

          {/* Email / Username */}
          <form onSubmit={handleSubmit} autoComplete="on">
          <div style={{ marginBottom:13 }}>
            <div style={{ fontSize:11.5, fontWeight:700, color:"#334155", letterSpacing:"0.6px", textTransform:"uppercase", marginBottom:7 }}>Email Address</div>
            <div style={{ position:"relative" }}>
              <i className="bi bi-envelope" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, color: username ? "#179DD0" : "#94A3B8", pointerEvents:"none" }} />
              <input type="email" value={username}
                onChange={e => { setUsername(e.target.value); clearErrors() }}
                autoComplete="username" autoCapitalize="off" spellCheck={false}
                placeholder="your@email.com"
                style={{ width:"100%", height:50, borderRadius:12, padding:"0 46px", fontSize:15, fontWeight:500, color:"#0F172A", background: error ? "#FFF5F5" : "#F8FAFC", border: `1.5px solid ${error ? "#FCA5A5" : "#E2E8F0"}`, outline:"none", transition:"border-color 0.18s, box-shadow 0.18s, background 0.18s", WebkitAppearance:"none" }}
                onFocus={e => { e.target.style.background="#fff"; e.target.style.borderColor="#179DD0"; e.target.style.boxShadow="0 0 0 4px rgba(23,157,208,0.12)" }}
                onBlur={e => { e.target.style.background="#F8FAFC"; e.target.style.borderColor=error?"#FCA5A5":"#E2E8F0"; e.target.style.boxShadow="none" }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11.5, fontWeight:700, color:"#334155", letterSpacing:"0.6px", textTransform:"uppercase", marginBottom:7 }}>
              <span>Password</span>
              <button type="button" onClick={() => navigate("/forgot-password")}
                style={{ fontSize:12, fontWeight:500, textTransform:"none", letterSpacing:0, color:"#179DD0", background:"none", border:"none", cursor:"pointer" }}>
                Forgot?
              </button>
            </div>
            <div style={{ position:"relative" }}>
              <i className="bi bi-lock" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, color: password ? "#179DD0" : "#94A3B8", pointerEvents:"none" }} />
              <input type={showPass ? "text" : "password"} value={password}
                onChange={e => { setPassword(e.target.value); clearErrors() }}
                autoComplete="current-password"
                placeholder="Your password"
                style={{ width:"100%", height:50, borderRadius:12, padding:"0 46px", fontSize:15, fontWeight:500, color:"#0F172A", background: error ? "#FFF5F5" : "#F8FAFC", border: `1.5px solid ${error ? "#FCA5A5" : "#E2E8F0"}`, outline:"none", WebkitAppearance:"none" }}
                onFocus={e => { e.target.style.background="#fff"; e.target.style.borderColor="#179DD0"; e.target.style.boxShadow="0 0 0 4px rgba(23,157,208,0.12)" }}
                onBlur={e => { e.target.style.background="#F8FAFC"; e.target.style.borderColor=error?"#FCA5A5":"#E2E8F0"; e.target.style.boxShadow="none" }}
              />
              <button type="button" onClick={() => setShowPass(s => !s)} tabIndex={-1}
                style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", fontSize:17, color:"#94A3B8", cursor:"pointer", padding:3, lineHeight:1 }}>
                <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting}
            style={{ width:"100%", height:52, marginTop:16, border:"none", borderRadius:13, fontSize:15.5, fontWeight:800, color:"#fff", background:"#179DD0", display:"flex", alignItems:"center", justifyContent:"center", gap:12, boxShadow:"0 2px 6px rgba(0,0,0,0.08), 0 8px 28px rgba(23,157,208,0.38)", cursor:submitting?"not-allowed":"pointer", opacity:submitting?0.6:1, position:"relative", overflow:"hidden", transition:"background 0.18s, transform 0.2s, box-shadow 0.2s" }}>
            <span style={{ position:"absolute", inset:0, background:"linear-gradient(150deg,rgba(255,255,255,0.14) 0%,transparent 52%)", pointerEvents:"none" }} />
            {submitting
              ? <span style={{ width:21, height:21, border:"2.5px solid rgba(255,255,255,0.25)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.65s linear infinite", display:"inline-block" }} />
              : <>
                  <span>Continue</span>
                  <div style={{ width:31, height:31, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
                    <i className="bi bi-arrow-right" />
                  </div>
                </>
            }
          </button>
          </form>

          {/* Success */}
          {success && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 13px", borderRadius:11, marginTop:12, background:"#F0FDF4", border:"1px solid #BBF7D0", fontSize:13, fontWeight:600, color:"#059669" }}>
              <i className="bi bi-check-circle-fill" style={{ fontSize:16 }} />
              {success}
            </div>
          )}
        </div>

        {/* Below card */}
        <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:14, marginTop:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.28)" }}>
            <i className="bi bi-shield-lock" />
            <span>Verified via Google Apps Script · Activity logged</span>
          </div>
          <button type="button" onClick={() => navigate("/")}
            style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.28)", background:"none", border:"none", cursor:"pointer" }}>
            <i className="bi bi-arrow-left" /> Back to home
          </button>
        </div>
      </div>

      <style>{`
        @keyframes riseIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes drift1 { to { transform:translate(40px,30px); } }
        @keyframes drift2 { to { transform:translate(-35px,-25px); } }
        @keyframes drift3 { to { transform:translate(-20px,40px); } }
      `}</style>
    </div>
  )
}
