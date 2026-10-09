/* Calendar dates as "YYYY-MM-DD" in the user's OWN timezone.

   WHY THIS EXISTS: `date.toISOString().split("T")[0]` looks like it gives today's date, but toISOString() always
   works in UTC. For anyone AHEAD of UTC (Nigeria is UTC+1) a date built at local midnight — "1 September" —
   is 23:00 on 31 August in UTC, so it came out as "2026-08-31". The P&L page used that to build its week and
   month ranges, so a month labelled "September" actually asked the server for 31 Aug to 29 Sep: one day early
   at BOTH ends, which quietly changed every figure on the page (litres, revenue, stock cost, expenses, profit).
   The fix is simply to read the year / month / day the person would read off a calendar. */

const pad = n => String(n).padStart(2, "0")

/* The calendar date of `d` where the user is — never shifted by UTC. */
export function toLocalISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* Move a "YYYY-MM-DD" date by whole calendar days. Done on the calendar (year, month, day), not by adding
   24 hours of milliseconds, so it is correct in every timezone and across month ends, year ends and clock
   changes. Returns "YYYY-MM-DD". */
export function addDaysISO(iso, days) {
  const [y, m, d] = String(iso).split("-").map(Number)
  return toLocalISO(new Date(y, m - 1, d + days))
}
