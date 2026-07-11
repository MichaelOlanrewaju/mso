// Reads the session token issued by the backend at login, straight from
// the persisted session in localStorage — so any hook or page can attach
// it to a request without threading it through props. Kept in one place
// so the storage shape only has to be known here.
const SESSION_KEY = "mso_session"

export function getToken() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return ""
    const record = JSON.parse(raw)
    return record?.user?.token || ""
  } catch {
    return ""
  }
}
