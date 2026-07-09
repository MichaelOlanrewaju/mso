import React from "react"
import { Link } from "react-router-dom"
import { usePageTitle } from "../hooks/usePageTitle"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"

export default function NotFoundPage() {
  usePageTitle("Page not found — MSO Limpid")
  const auth = useAuth({ requireAuth: false })

  const backTo = auth.user ? dashboardPathFor({ role: auth.role, station: auth.station }) : "/"
  const backLabel = auth.user ? "Back to Dashboard" : "Back to Sign In"

  return (
    <main className="dot-grid relative flex min-h-screen flex-col items-center justify-center bg-navy px-4 text-center">
      <div className="enter relative z-[1]">
        <div className="mono text-5xl font-black text-cyan">404</div>
        <p className="mt-3 text-sm text-white/50">
          This page hasn't been built yet — it's one of the modules planned for later.
        </p>
        <Link
          to={backTo}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-dark to-cyan px-5 py-2.5 text-sm font-bold text-white"
        >
          <i className="bi bi-arrow-left" /> {backLabel}
        </Link>
      </div>
    </main>
  )
}
