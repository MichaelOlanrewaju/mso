import React from "react"

/**
 * Visual safe-area debug tool — was used during development to check
 * env(safe-area-inset-*) values across devices (the tappable dot + panel
 * showing sat/sab/sal). Confirmed no longer needed — this now renders
 * nothing rather than removing the <SafeAreaDebug /> tag from all 31
 * pages that still reference it, since either approach produces the
 * same result and this one is far less risky.
 *
 * Usage: <SafeAreaDebug /> anywhere in a page's JSX — now a no-op.
 */
export default function SafeAreaDebug() {
  return null
}
