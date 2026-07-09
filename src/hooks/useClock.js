import { useEffect, useState } from "react"

export function useClock() {
  const [now, setNow] = useState(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const time = now
    ? now.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--"
  const date = now
    ? now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "—"

  return { time, date }
}
