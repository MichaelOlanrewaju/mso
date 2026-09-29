import { getToken } from "./session"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL

/* Notes are independent of the active station (a person's notes are theirs,
   not a station's), so unlike the other API helpers there is no `station`
   parameter here. The session token alone identifies the owner on the
   server — the client never says whose notes it wants. */

export async function getNotes() {
  if (!SCRIPT_URL) return { ok: false, error: "The app is not configured." }
  const url = new URL(SCRIPT_URL)
  url.searchParams.set("action", "getNotes")
  url.searchParams.set("token", getToken())
  const res = await fetch(url.toString(), { method: "GET", redirect: "follow" })
  return res.json()
}

async function post(payload) {
  if (!SCRIPT_URL) return { ok: false, error: "The app is not configured." }
  const body = JSON.stringify(payload)
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    body,
    // keepalive lets a save finish even as the page closes, but browsers cap
    // it at 64 KB — only ask for it when the payload is comfortably small.
    keepalive: body.length < 30000,
  })
  return res.json()
}

export const saveNoteRemote = n =>
  post({ action: "saveNote", token: getToken(), id: n.id, body: n.body, pinned: n.pinned, created: n.created })

export const deleteNoteRemote = id => post({ action: "deleteNote", token: getToken(), id })
