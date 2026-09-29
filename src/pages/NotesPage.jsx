import React, { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import Sidebar from "../components/layout/Sidebar"
import Topbar from "../components/layout/Topbar"
import BottomNav from "../components/layout/BottomNav"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { useNotes } from "../hooks/useNotes"
import { roleLabel, initials } from "../utils/format"

/* Apple-Notes-style private notes for the CEO and GM.
   Mobile: a grouped list (Pinned / Today / Yesterday / Previous 7 Days …)
   with search; tapping a note opens a full-screen editor. Desktop: list on
   the left, editor on the right. Notes save by themselves as you type. */

const ACCENT = "#D99A00"      // the warm Notes yellow, darkened enough to read on white
const MAX_CHARS = 40000       // matches the server's limit

/* ── text helpers: the first line is the title, like Apple Notes ── */
function splitNote(body) {
  const nl = body.indexOf("\n")
  return nl < 0 ? { title: body, rest: "" } : { title: body.slice(0, nl), rest: body.slice(nl + 1) }
}
function joinNote(title, rest) {
  return rest === "" ? title : title + "\n" + rest
}
const noteTitle = body => splitNote(body).title.trim() || "New Note"
const notePreview = body =>
  splitNote(body).rest.split("\n").map(s => s.trim()).find(Boolean) || "No additional text"

/* ── date helpers ── */
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
function dayDiff(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return 9999
  return Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000)
}
function listDate(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ""
  const diff = dayDiff(iso)
  if (diff <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  if (diff === 1) return "Yesterday"
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" })
  return d.toLocaleDateString("en-GB")
}
function fullDate(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ""
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
}
function groupLabel(iso) {
  const diff = dayDiff(iso)
  if (diff <= 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return "Previous 7 Days"
  if (diff < 30) return "Previous 30 Days"
  const d = new Date(iso)
  return d.getFullYear() === new Date().getFullYear()
    ? d.toLocaleDateString("en-GB", { month: "long" })
    : String(d.getFullYear())
}

function SectionHeader({ children, pinned }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-bold text-ink">
      {pinned && <i className="bi bi-pin-angle-fill text-[12px]" style={{ color: ACCENT }} />}
      {children}
    </div>
  )
}

function NoteRow({ note, selected, last, onOpen }) {
  return (
    <button type="button" onClick={onOpen}
      className={`block w-full text-left transition-colors ${selected ? "bg-[#FFF4D6]" : "bg-white active:bg-[#F2F2F7]"}`}>
      <div className={`ml-4 py-2.5 pr-4 ${last ? "" : "border-b border-[#E5E5EA]"}`}>
        <div className="truncate text-[15.5px] font-semibold text-ink">{noteTitle(note.body)}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-4">
          <span className="flex-shrink-0">{listDate(note.updated)}</span>
          <span className="truncate">{notePreview(note.body)}</span>
        </div>
      </div>
    </button>
  )
}

function NotesList({ notes, allCount, query, onQuery, selectedId, onOpen, onCreate, loading }) {
  const pinned = notes.filter(n => n.pinned)
  const groups = []
  notes.filter(n => !n.pinned).forEach(n => {
    const label = groupLabel(n.updated)
    const g = groups.find(x => x.label === label)
    if (g) g.items.push(n); else groups.push({ label, items: [n] })
  })

  const renderCard = items => (
    <div className="overflow-hidden rounded-[12px] shadow-sm">
      {items.map((n, i) => (
        <NoteRow key={n.id} note={n} selected={n.id === selectedId} last={i === items.length - 1} onOpen={() => onOpen(n.id)} />
      ))}
    </div>
  )

  return (
    <div className="px-3.5 pb-[110px] pt-3 lg:pb-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-[10px] bg-[#E3E3E8] px-3 py-2">
          <i className="bi bi-search text-[14px] text-ink-4" />
          <input value={query} onChange={e => onQuery(e.target.value)} placeholder="Search"
            className="w-full min-w-0 border-none bg-transparent p-0 text-[16px] text-ink outline-none placeholder:text-ink-4" />
          {query && (
            <button type="button" onClick={() => onQuery("")} className="text-ink-4"><i className="bi bi-x-circle-fill text-[14px]" /></button>
          )}
        </div>
        <button type="button" onClick={onCreate} aria-label="New note"
          className="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-white shadow-sm lg:flex">
          <i className="bi bi-pencil-square text-[16px]" style={{ color: ACCENT }} />
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
            <i className={`bi ${loading ? "bi-arrow-repeat" : query ? "bi-search" : "bi-journal-text"} text-[24px]`} style={{ color: ACCENT }} />
          </div>
          <div className="text-[15px] font-bold text-ink">
            {loading ? "Loading your notes…" : query ? "No results" : "No notes yet"}
          </div>
          {!loading && (
            <div className="mx-auto mt-1 max-w-[240px] text-[12.5px] leading-relaxed text-ink-4">
              {query ? "Try a different word." : "Tap the pencil button to write your first note."}
            </div>
          )}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="mb-5"><SectionHeader pinned>Pinned</SectionHeader>{renderCard(pinned)}</div>
          )}
          {groups.map(g => (
            <div key={g.label} className="mb-5">
              <SectionHeader>{g.label}</SectionHeader>
              {renderCard(g.items)}
            </div>
          ))}
          <div className="text-center text-[12.5px] text-ink-4">
            {allCount} {allCount === 1 ? "Note" : "Notes"}
          </div>
        </>
      )}
    </div>
  )
}

function IconButton({ icon, label, onClick, active }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full active:bg-[#F2F2F7]">
      <i className={`bi ${icon} text-[18px]`} style={{ color: active ? ACCENT : "#8E8E93" }} />
    </button>
  )
}

function NoteEditor({ note, status, onChange, onPin, onDelete, onBack }) {
  const titleRef = useRef(null)
  const bodyRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const { title, rest } = splitNote(note.body)

  // A brand-new note opens ready to type; an existing one must not pop the keyboard.
  useEffect(() => {
    if (note.body === "" && titleRef.current) titleRef.current.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  const onTitlePaste = e => {
    const text = (e.clipboardData && e.clipboardData.getData("text")) || ""
    if (!/[\r\n]/.test(text)) return
    // A multi-line paste into the title: let the extra lines flow into the body.
    e.preventDefault()
    const el = e.target
    const clean = text.replace(/\r\n?/g, "\n")
    onChange(title.slice(0, el.selectionStart) + clean + title.slice(el.selectionEnd) + (rest !== "" ? "\n" + rest : ""))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[#E5E5EA] px-2 pb-1.5 pt-[max(var(--sat),10px)] lg:pt-2">
        <button type="button" onClick={onBack} className="flex items-center gap-0.5 px-1 py-1 text-[17px] lg:invisible" style={{ color: ACCENT }}>
          <i className="bi bi-chevron-left text-[19px]" />Notes
        </button>
        <div className="flex items-center">
          {focused && (
            <button type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur() }}
              className="mr-1 px-2 text-[16px] font-semibold" style={{ color: ACCENT }}>Done</button>
          )}
          <IconButton icon={note.pinned ? "bi-pin-angle-fill" : "bi-pin-angle"} label={note.pinned ? "Unpin" : "Pin"} active={note.pinned} onClick={onPin} />
          <IconButton icon="bi-trash3" label="Delete note" onClick={onDelete} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pt-3 pb-[max(var(--sab),14px)]">
        <div className="flex items-center justify-center gap-1.5 text-[11.5px] text-ink-4">
          <span>{fullDate(note.updated)}</span>
          {status && <span className={status.tone}>· {status.text}</span>}
        </div>
        <input ref={titleRef} value={title} placeholder="Title"
          onChange={e => onChange(joinNote(e.target.value, rest))}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (bodyRef.current) bodyRef.current.focus() } }}
          onPaste={onTitlePaste}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="mt-3 w-full border-none bg-transparent p-0 text-[25px] font-bold leading-tight text-ink outline-none placeholder:text-[#C7C7CC]" />
        <textarea ref={bodyRef} value={rest} placeholder="Start writing…"
          onChange={e => onChange(joinNote(title, e.target.value))}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="mt-2 min-h-0 w-full flex-1 resize-none border-none bg-transparent p-0 text-[17px] leading-[1.5] text-ink outline-none placeholder:text-[#C7C7CC]" />
      </div>
    </div>
  )
}

function NotesInner({ auth }) {
  usePageTitle("Notes")
  const navigate = useNavigate()
  const { noteId } = useParams()
  const store = useNotes(auth.username)
  const { notes, loading, loadError, authExpired, saveState } = store

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState("")
  const overlayRef = useRef(null)

  const selected = noteId ? notes.find(n => n.id === noteId) : null

  // A link to a note that no longer exists goes back to the list.
  useEffect(() => {
    if (noteId && !loading && !selected) navigate("/notes", { replace: true })
  }, [noteId, loading, selected, navigate])

  // Leaving a note that was never written in discards it (Apple Notes does the same).
  const prevId = useRef(null)
  useEffect(() => {
    if (prevId.current && prevId.current !== noteId) store.discardIfEmpty(prevId.current)
    prevId.current = noteId || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])
  useEffect(() => () => { if (prevId.current) store.discardIfEmpty(prevId.current) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [])

  // On a phone the on-screen keyboard shrinks the *visual* viewport but not the
  // layout one; without this the editor's bottom sits behind the keyboard.
  useEffect(() => {
    const vv = window.visualViewport
    const el = overlayRef.current
    if (!vv || !el || !selected) return undefined
    const apply = () => {
      el.style.setProperty("--vvh", vv.height + "px")
      el.style.setProperty("--vvt", vv.offsetTop + "px")
    }
    apply()
    vv.addEventListener("resize", apply)
    vv.addEventListener("scroll", apply)
    return () => { vv.removeEventListener("resize", apply); vv.removeEventListener("scroll", apply) }
  }, [noteId, !!selected])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter(n => !(n.body === "" && !n.saved && n.id !== noteId))       // hide untouched new notes
      .filter(n => !q || n.body.toLowerCase().includes(q))
      .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))
  }, [notes, query, noteId])
  const totalCount = notes.filter(n => !(n.body === "" && !n.saved)).length

  const open = id => navigate(`/notes/${id}`)
  const create = () => { const id = store.createNote(); open(id) }
  const back = () => navigate("/notes")
  const remove = () => {
    if (!selected) return
    if (!window.confirm("Delete this note? This can't be undone.")) return
    store.removeNote(selected.id)
    navigate("/notes", { replace: true })
  }
  const change = body => { if (selected) store.updateBody(selected.id, body.length > MAX_CHARS ? body.slice(0, MAX_CHARS) : body) }

  const status =
    authExpired ? { text: "Log in again to save", tone: "text-red font-semibold" }
    : saveState === "error" ? { text: "Not saved — retrying", tone: "text-red font-semibold" }
    : saveState === "saving" ? { text: "Saving…", tone: "" }
    : { text: "Saved", tone: "" }

  return (
    <div className="flex min-h-screen">
      <SafeAreaDebug />
      <style>{`@media (max-width: 1023px){ .notes-overlay{ height: var(--vvh, 100dvh); top: var(--vvt, 0px); } }`}</style>

      <Sidebar
        isOwner={auth.isOwner}
        isGM={auth.isGM}
        name={auth.name || auth.username}
        role={roleLabel(auth.role)}
        avatarInitials={initials(auth.name || auth.username)}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={auth.logout}
        homePath={dashboardPathFor({ role: auth.role, station: auth.station })}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-sidebar">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          loading={loading}
          onRefresh={store.refresh}
          title="Notes"
        />

        {(authExpired || loadError) && (
          <div className={`mx-3.5 mt-3 rounded-[10px] px-3.5 py-2.5 text-[12.5px] font-semibold ${authExpired ? "bg-red-light text-red" : "bg-amber-light text-amber"}`}>
            {authExpired
              ? "Your session has expired. Your latest edits are kept on this device — log in again and they will save."
              : loadError}
          </div>
        )}

        <div className="flex min-h-0 flex-1" style={{ background: "#F2F2F7" }}>
          {/* ── list ── */}
          <div className="w-full lg:sticky lg:top-[120px] lg:h-[calc(100vh-120px)] lg:w-[340px] lg:flex-shrink-0 lg:overflow-y-auto lg:border-r lg:border-[#E5E5EA]">
            <NotesList notes={visible} allCount={totalCount} query={query} onQuery={setQuery}
              selectedId={noteId} onOpen={open} onCreate={create} loading={loading} />
          </div>

          {/* ── editor: a full-screen sheet on phones, the right-hand pane on desktop ── */}
          <div ref={overlayRef}
            className={`${selected ? "notes-overlay fixed inset-x-0 top-0 z-[950] flex flex-col bg-white" : "hidden"} lg:sticky lg:top-[120px] lg:z-auto lg:flex lg:h-[calc(100vh-120px)] lg:min-w-0 lg:flex-1 lg:flex-col lg:bg-white`}>
            {selected ? (
              <NoteEditor key={selected.id} note={selected} status={status}
                onChange={change} onPin={() => store.togglePin(selected.id)} onDelete={remove} onBack={back} />
            ) : (
              <div className="hidden h-full flex-col items-center justify-center text-center lg:flex">
                <i className="bi bi-journal-text text-[40px]" style={{ color: "#D1D1D6" }} />
                <div className="mt-2 text-[14px] font-semibold text-ink-4">Select a note, or write a new one</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phones: the compose button. The editor sheet covers it while writing. */}
      <button type="button" onClick={create} aria-label="New note"
        className="fixed right-4 z-[450] flex h-[54px] w-[54px] items-center justify-center rounded-full shadow-lg lg:hidden"
        style={{ background: ACCENT, bottom: "calc(84px + var(--sab))" }}>
        <i className="bi bi-pencil-square text-[22px] text-white" />
      </button>

      <BottomNav homePath={dashboardPathFor({ role: auth.role, station: auth.station })} />
    </div>
  )
}

export default function NotesPage() {
  const auth = useAuth({ requireAuth: true })
  if (auth.loading || !auth.user) return <div className="min-h-screen bg-surface" />
  if (!auth.isOwner && !auth.isGM) {
    return <Navigate to={dashboardPathFor({ role: auth.role, station: auth.station })} replace />
  }
  return <NotesInner auth={auth} />
}
