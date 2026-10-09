/* Reading a reply from the Apps Script server without ever throwing a cryptic error.

   WHY THIS EXISTS: the app asks the server for JSON and calls res.json(). When Google itself
   answers instead of our script — a busy/quota page, a timeout page, a sign-in page — the body is
   HTML, and Safari's res.json() then fails with the useless message "The string did not match the
   expected pattern." Staff saw exactly that on a bank deposit and had no idea what to do.

   readJsonReply() reads the body as text first. A real JSON answer (including a genuine
   {ok:false, error} from our own script) is returned untouched. Anything else comes back as
   { ok:false, notJson:true, error:<plain English> } so the caller can tell "the server said no"
   apart from "the reply was unreadable — I don't know what happened". That distinction matters for
   money: an unreadable reply to a SAVE must be checked, never blindly retried. */

export function describeBadReply(status, text) {
  const t = String(text || "")
  if (status === 429 || /service invoked too many times|too many simultaneous|quota exceeded|rate limit exceeded/i.test(t))
    return "Google is busy right now (too many requests at once). Wait a minute and try again."
  if (status === 401 || status === 403 || /accounts\.google\.com|ServiceLogin|authorization is required|you need access|request access/i.test(t))
    return "The server is asking for a Google sign-in, so the app's web address isn't open to staff. Tell the admin."
  if (status === 408 || status === 504 || /exceeded maximum execution time/i.test(t))
    return "The server took too long to answer. Try again."
  if (status === 413) return "The photo was too large to upload. Retake it a bit closer, or try again."
  if (!t.trim()) return "The server sent an empty reply. Try again."
  return "The server sent an error page instead of an answer. Try again in a moment; if it keeps happening, tell the admin."
}

export async function readJsonReply(res) {
  let text = ""
  try { text = await res.text() } catch (_) { text = "" }
  try { return JSON.parse(text) } catch (_) { /* not JSON — fall through */ }
  const raw = String(text).slice(0, 300)
  console.error("Unreadable server reply", { status: res.status, raw })   // visible in the browser console for whoever is debugging
  return { ok: false, notJson: true, status: res.status, error: describeBadReply(res.status, text), raw }
}
