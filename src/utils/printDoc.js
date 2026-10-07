/* Printing the Daily Summary so it works on every device.

   On a computer or in a normal Safari/Chrome tab, window.print() works and is
   used exactly as before.

   An app installed on an iPhone's home screen blocks window.print() — the
   button simply does nothing. There, we turn the same printable report (same
   station logo and colours) into a PDF on the phone, then hand it to the
   iPhone share sheet, which has "Print" and "Save to Files". If the share
   sheet isn't available the PDF opens in its own page instead. */

function installedOnPhone() {
  try {
    const ua = navigator.userAgent || ""
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    return ios && standalone
  } catch { return false }
}

/* Build a PDF (A4, as many pages as needed) from the report elements.
   Exported separately so it can be tested without a phone. */
export async function buildReportPdf(selectors = [".print-header", ".print-document"]) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")])

  const sources = selectors.map(s => document.querySelector(s)).filter(Boolean)
  if (!sources.length) throw new Error("Nothing to print yet — wait for the report to load.")

  /* The report is hidden on screen (it only exists for paper), so copy it into
     an off-screen, A4-width box with those hiding rules overridden. */
  const PAGE_W = 794   // A4 width at 96 dpi
  const box = document.createElement("div")
  box.className = "print-release"
  box.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;background:#fff;padding:24px;box-sizing:border-box;z-index:-1`
  sources.forEach(src => {
    const c = src.cloneNode(true)
    c.style.display = src.classList.contains("print-header") ? "flex" : "block"
    box.appendChild(c)
  })
  document.body.appendChild(box)

  try {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready } catch { /* fine */ } }
    const canvas = await html2canvas(box, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: PAGE_W })
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" })
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight()
    const imgW = pw, imgH = canvas.height * pw / canvas.width
    /* Slice the tall picture into A4 pages. */
    const pageCanvasH = Math.floor(canvas.width * ph / pw)
    let y = 0, first = true
    while (y < canvas.height) {
      const h = Math.min(pageCanvasH, canvas.height - y)
      const slice = document.createElement("canvas")
      slice.width = canvas.width; slice.height = h
      slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
      if (!first) pdf.addPage()
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, h * pw / canvas.width)
      first = false; y += h
    }
    return pdf.output("blob")
  } finally {
    box.remove()
  }
}

export async function printReport(selectors, filename = "Daily-Summary.pdf") {
  if (!installedOnPhone()) { window.print(); return { ok: true, via: "print" } }
  try {
    const blob = await buildReportPdf(selectors)
    const file = new File([blob], filename, { type: "application/pdf" })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return { ok: true, via: "share" } }
      catch (e) { if (e && e.name === "AbortError") return { ok: true, via: "cancelled" } /* else fall through to opening it */ }
    }
    const url = URL.createObjectURL(blob)
    const w = window.open(url, "_blank")
    if (!w) window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 120000)
    return { ok: true, via: "open" }
  } catch (e) {
    return { ok: false, error: (e && e.message) || "Could not prepare the PDF." }
  }
}
