/* Printing that works on a phone.

   WHY: window.print() does nothing when the app is installed on an iPhone's
   home screen (an iOS limitation for installed web apps) — the printer icon
   on the Daily Summary just did not respond. On a computer, or in a normal
   Safari/Chrome tab, window.print() works and is still used.

   On an installed iPhone app we instead open the printable report as its own
   page (same styles, same station logo and colours). That page offers a Print
   button and opens the print dialog; on iPhone the Share button there also
   gives "Print" and "Save to Files" (PDF). */

function isInstalledIOSApp() {
  try {
    const ua = navigator.userAgent || ""
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    return ios && standalone
  } catch { return false }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
}

export function printReport(selectors = [".print-header", ".print-document"], title = "Report") {
  if (!isInstalledIOSApp()) { window.print(); return }

  const parts = selectors.map(sel => document.querySelector(sel)).filter(Boolean)
  if (!parts.length) { window.print(); return }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(n => n.outerHTML).join("\n")
  const body = parts.map(p => p.outerHTML).join("\n")
  const root = document.documentElement
  const vars = ["--brand-primary", "--brand-accent", "--brand-primary-dark", "--brand-accent-dark", "--brand-accent-light", "--brand-primary-light"]
    .map(v => `${v}:${root.style.getPropertyValue(v) || getComputedStyle(root).getPropertyValue(v)}`).join(";")

  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${escapeHtml(location.origin)}/">
<title>${escapeHtml(title)}</title>
${styles}
<style>
  :root{${vars}}
  body{margin:0;background:#fff}
  /* The report is hidden on screen in the app (it only exists for printing);
     show it here, and give the page its own Print button. */
  @media screen{
    .print-header{display:flex !important}
    .print-document{display:block !important}
    .pr-bar{position:sticky;top:0;z-index:10;display:flex;gap:10px;justify-content:flex-end;padding:10px 14px;background:#f1f5f9;border-bottom:1px solid #e2e8f0}
    .pr-wrap{max-width:820px;margin:0 auto;padding:14px}
  }
  @media print{ .pr-bar{display:none !important} .pr-wrap{padding:0} }
  .pr-bar button{font:700 14px system-ui,sans-serif;padding:10px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#fff}
  .pr-bar button.pri{background:#0f172a;color:#fff;border-color:#0f172a}
</style></head><body>
<div class="pr-bar"><button class="pri" onclick="window.print()">Print</button></div>
<div class="pr-wrap print-release">${body}</div>
<script>window.addEventListener('load',function(){setTimeout(function(){try{window.print()}catch(e){}},600)})<\/script>
</body></html>`

  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
  const w = window.open(url, "_blank")
  if (!w) { window.location.href = url }   // pop-up blocked: open in this window instead
  setTimeout(() => URL.revokeObjectURL(url), 120000)
}
