import React, { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import SafeAreaDebug from "../components/ui/SafeAreaDebug"
import { ToastProvider, useToast } from "../components/layout/ToastProvider"
import { useAuth, dashboardPathFor } from "../hooks/useAuth"
import { usePageTitle } from "../hooks/usePageTitle"
import { useConversations, useChat, dmConversationId } from "../hooks/useChat"
import { useStaff } from "../hooks/usePayroll"
import { useDriveImage } from "../hooks/useDriveImage"
import { compressImage } from "../utils/compressImage"

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL
const STATION_KEY = import.meta.env.VITE_STATION_KEY || "mso"

// The app's signature navy→violet gradient, reused here from Dip/Sales/
// Payroll so Chat reads as part of the same product instead of a bolted-on
// generic messenger.
const BRAND_GRADIENT = "linear-gradient(135deg,#130656 0%,#1a0875 55%,#179DD0 130%)"

function timeLabel(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true })
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })
}

const AVATAR_COLORS = ["#179DD0","#130656","#16A34A","#D97706","#DC2626","#7C3AED"]
function avatarColor(name) { return AVATAR_COLORS[(name||" ").charCodeAt(0) % AVATAR_COLORS.length] }
function initials(name) { return (name||"?").trim().split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase() }

function Avatar({ name, size = 38, ring = false }) {
  return (
    <div className="flex flex-shrink-0 items-center justify-center rounded-full text-white"
      style={{
        width:size, height:size, background:avatarColor(name), fontSize:size*0.36, fontWeight:700,
        boxShadow: ring ? `0 0 0 2.5px #fff, 0 0 0 4px ${avatarColor(name)}33` : "none",
      }}>
      {initials(name)}
    </div>
  )
}

/* Image bubble — fetches bytes via useDriveImage */
function ImageBubble({ fileId, isMine }) {
  const { dataUri, status } = useDriveImage(fileId)
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <div
        className={`overflow-hidden rounded-[16px] border ${isMine ? "border-white/25" : "border-border"}`}
        style={{ width:204, height:204, background:"#eef1f6", cursor:"pointer" }}
        onClick={() => dataUri && setLightbox(true)}
      >
        {dataUri
          ? <img src={dataUri} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center">
              {status === "error"
                ? <i className="bi bi-image text-2xl text-ink-4" />
                : <span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
              }
            </div>
        }
      </div>
      {lightbox && dataUri && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}>
          <img src={dataUri} alt="" className="max-h-[85vh] max-w-full rounded-[16px] object-contain" />
        </div>
      )}
    </>
  )
}

/* Message bubble with long-press actions */
function Bubble({ msg, isMine, onEdit, onDelete }) {
  const [showActions, setShowActions] = useState(false)
  const pressTimer = useRef(null)

  const startPress = () => {
    pressTimer.current = setTimeout(() => setShowActions(true), 500)
  }
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  return (
    <>
      <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
        onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
        onTouchStart={startPress} onTouchEnd={endPress}>
        {!isMine && <Avatar name={msg.senderName} size={30} />}
        <div style={{ maxWidth:"80%", background: isMine ? BRAND_GRADIENT : "#fff", boxShadow: isMine ? "0 3px 10px rgba(19,6,86,.22)" : "0 1px 3px rgba(15,23,42,.06)" }}
          className={`rounded-[20px] ${isMine ? "rounded-br-[6px] text-white" : "rounded-bl-[6px] border border-border text-ink"}`}>
          {/* Image */}
          {msg.imageFileId && (
            <div className="overflow-hidden rounded-[18px] p-1">
              <ImageBubble fileId={msg.imageFileId} isMine={isMine} />
            </div>
          )}
          {/* Text */}
          {msg.text && (
            <div className="px-4 py-3">
              {!isMine && (
                <div className="mb-1 text-[11px] font-extrabold" style={{ color: avatarColor(msg.senderName) }}>
                  {msg.senderName}
                </div>
              )}
              <div className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{msg.text}</div>
            </div>
          )}
          {/* Footer */}
          <div className={`flex items-center justify-end gap-1.5 px-4 pb-2.5 text-[10px] ${isMine ? "text-white/60" : "text-ink-4"}`}>
            {msg.editedAt && <span className="italic">edited</span>}
            {timeLabel(msg.timestamp)}
            {isMine && (msg.pending
              ? <i className="bi bi-clock" />
              : msg.failed ? <i className="bi bi-exclamation-circle" style={{ color:"#fca5a5" }} />
              : <i className="bi bi-check2" />
            )}
          </div>
        </div>
      </div>

      {/* Action sheet on long-press */}
      {showActions && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/30 p-4"
          onClick={() => setShowActions(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-[20px] bg-white shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="border-b border-surface px-4 py-3 text-center text-[11.5px] text-ink-4 truncate">
              {msg.text || "Image"}
            </div>
            {isMine && (
              <button type="button" className="flex w-full items-center gap-3 px-5 py-4 text-[14.5px] font-medium text-ink active:bg-surface"
                onClick={() => { setShowActions(false); onEdit(msg) }}>
                <i className="bi bi-pencil text-ink-4 w-5" /> Edit Message
              </button>
            )}
            <button type="button"
              className="flex w-full items-center gap-3 border-t border-surface px-5 py-4 text-[14.5px] font-medium text-red active:bg-red-light"
              onClick={() => { setShowActions(false); onDelete(msg.messageId) }}>
              <i className="bi bi-trash text-red w-5" />
              Delete for me
            </button>
            <button type="button"
              className="flex w-full items-center justify-center border-t border-surface py-4 text-[14.5px] font-semibold text-ink-4"
              onClick={() => setShowActions(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function DateSep({ iso }) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  const label = diff === 0 ? "Today" : diff === 1 ? "Yesterday"
    : d.toLocaleDateString("en-NG", { weekday:"long", day:"numeric", month:"long" })
  return (
    <div className="my-4 flex items-center justify-center">
      <span className="rounded-full border border-border bg-white px-3.5 py-1 text-[10.5px] font-bold text-ink-3 shadow-sm">{label}</span>
    </div>
  )
}

/* ── Edit modal ─────────────────────────────────────────── */
function EditModal({ message, onSave, onClose }) {
  const [text, setText] = useState(message.text)
  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/40 p-4"
      onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-[20px] bg-white shadow-xl"
        onClick={e => e.stopPropagation()}>
        <div className="border-b border-surface px-4 py-3.5 text-[13.5px] font-bold text-ink">Edit message</div>
        <div className="p-4">
          <textarea
            autoFocus rows={3}
            value={text} onChange={e => setText(e.target.value)}
            className="w-full resize-none rounded-[12px] border border-border px-3.5 py-3 text-[14px] text-ink outline-none focus:border-cyan"
          />
        </div>
        <div className="flex gap-2.5 border-t border-surface px-4 pb-4">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-[11px] border border-border py-3 text-[13.5px] font-semibold text-ink-4">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(text.trim())} disabled={!text.trim()}
            className="flex-1 rounded-[11px] py-3 text-[13.5px] font-bold text-white disabled:opacity-50" style={{ background: BRAND_GRADIENT }}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Conversation window ────────────────────────────────── */
function ConversationView({ auth, conversationId, conversationName, isGeneral, onBack, onConversationDeleted }) {
  const toast = useToast()
  const { status, messages, sending, sendMessage, editMessage, deleteMessage, hideConversation } = useChat({
    username: auth.username, name: auth.name, conversationId,
  })
  const [draft, setDraft] = useState("")
  const [editingMsg, setEditingMsg] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showDeleteConv, setShowDeleteConv] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const imageInputRef = useRef(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (messages.length !== prevLenRef.current) {
      prevLenRef.current = messages.length
      bottomRef.current?.scrollIntoView({ behavior: messages.length <= 10 ? "auto" : "smooth" })
    }
  }, [messages])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft("")
    await sendMessage({ text })
    inputRef.current?.focus()
  }

  const handleKey = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleImageChange = async e => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async ev => {
        try {
          const rawDataUrl = ev.target.result
          // compressImage takes (dataUrl, { maxDimension, quality }) and
          // resolves to { dataUrl, mimeType } — a previous version of this
          // called it with the wrong argument shape and sent the wrong
          // field name to the backend, so every image send silently failed.
          const { dataUrl: compressedDataUrl, mimeType } = await compressImage(rawDataUrl, { quality: 0.7, maxDimension: 1200 })
          const base64 = compressedDataUrl.split(",")[1]
          const now = new Date().toISOString().split("T")[0]
          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({
              action: "savePhoto", station: STATION_KEY,
              date: now, session: "Chat", subject: `chat__${Date.now()}`,
              base64, mimeType,
              username: auth.username,
            }),
          })
          const d = await res.json()
          if (d.ok && d.fileId) {
            await sendMessage({ imageFileId: d.fileId })
          } else {
            toast.showToast("Couldn't send image", d.error || "Please try again", "err")
          }
        } catch {
          toast.showToast("Couldn't send image", "Please try again", "err")
        } finally {
          setUploading(false)
        }
      }
      reader.readAsDataURL(file)
    } catch {
      setUploading(false)
      toast.showToast("Couldn't send image", "Please try again", "err")
    }
    e.target.value = ""
  }

  const handleEdit = msg => setEditingMsg(msg)
  const handleSaveEdit = async newText => {
    if (editingMsg) await editMessage(editingMsg.messageId, newText)
    setEditingMsg(null)
  }
  const handleDeleteMsg = async msgId => { await deleteMessage(msgId) }
  const handleDeleteConv = async () => {
    await hideConversation()
    onConversationDeleted()
  }

  const grouped = []
  let lastDay = ""
  messages.forEach(m => {
    const day = m.timestamp ? m.timestamp.slice(0,10) : ""
    if (day && day !== lastDay) { grouped.push({ type:"sep", day }); lastDay = day }
    grouped.push({ type:"msg", msg:m })
  })

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-t-[22px] md:rounded-[22px]" style={{ boxShadow: "0 8px 30px rgba(15,23,42,.10)" }}>
      {/* Header — brand gradient, not flat white, so Chat reads as part of
          the same product as the rest of the console */}
      <div className="flex flex-shrink-0 items-center gap-3 px-4 pb-4" style={{ paddingTop: "max(var(--sat), 52px)", background: BRAND_GRADIENT }}>
        <button type="button" onClick={onBack}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white active:bg-white/20">
          <i className="bi bi-arrow-left text-[15px]" />
        </button>
        {isGeneral
          ? <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
              <i className="bi bi-people-fill text-[17px]" />
            </div>
          : <Avatar name={conversationName} size={44} ring />
        }
        <div className="flex-1 min-w-0">
          <div className="truncate text-[16.5px] font-extrabold text-white">{conversationName}</div>
          <div className="text-[11.5px] text-white/55">{isGeneral ? "Everyone at MSO Station" : "Direct message"}</div>
        </div>
        {!isGeneral && (
          <button type="button" onClick={() => setShowDeleteConv(true)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 active:bg-white/20">
            <i className="bi bi-trash text-[13px]" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5" style={{ background:"#EEF2F8" }}>
        {status === "loading" && (
          <div className="flex justify-center py-10">
            <span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
          </div>
        )}
        {status === "ready" && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-[280px] rounded-[20px] bg-white p-6 text-center shadow-sm">
            <div className="mb-2.5 text-3xl">{isGeneral ? "👋" : "💬"}</div>
            <div className="text-[14px] font-bold text-ink">
              {isGeneral ? "Welcome to General" : `Chat with ${conversationName}`}
            </div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-4">
              {isGeneral ? "Station-wide group — everyone can see messages here." : "This is a private conversation."}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {grouped.map((item, i) => item.type === "sep"
            ? <DateSep key={`sep-${item.day}`} iso={item.day} />
            : <Bubble key={item.msg.messageId || i} msg={item.msg}
                isMine={item.msg.senderUsername === auth.username}
                onEdit={handleEdit} onDelete={handleDeleteMsg} />
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Composer — floating pill, elevated off the message background */}
      <div className="flex-shrink-0 px-3.5 pt-3" style={{ background:"#EEF2F8", paddingBottom:"max(14px, env(safe-area-inset-bottom))" }}>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        <div className="flex items-end gap-2.5 rounded-[26px] bg-white p-2 pl-2.5" style={{ boxShadow: "0 4px 18px rgba(15,23,42,.10)" }}>
          {/* Image button */}
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}
            className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-ink-4 disabled:opacity-50 active:bg-surface" style={{ background: "#F0F4F8" }}>
            {uploading
              ? <span className="h-4 w-4 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
              : <i className="bi bi-image text-[16px]" />
            }
          </button>
          {/* Text input */}
          <textarea ref={inputRef} rows={1} value={draft}
            onChange={e => setDraft(e.target.value)} onKeyDown={handleKey}
            placeholder="Type a message…"
            className="max-h-32 flex-1 resize-none bg-transparent px-1 py-2.5 text-[14.5px] text-ink outline-none placeholder:text-ink-4"
            style={{ lineHeight:"1.5" }} />
          {/* Send button */}
          <button type="button" onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="mb-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-30"
            style={{ background: BRAND_GRADIENT }}>
            <i className="bi bi-send-fill text-[14px]" />
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editingMsg && (
        <EditModal message={editingMsg} onSave={handleSaveEdit} onClose={() => setEditingMsg(null)} />
      )}

      {/* Delete conversation confirm */}
      {showDeleteConv && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center bg-black/30 p-4"
          onClick={() => setShowDeleteConv(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-[20px] bg-white shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-5">
              <div className="mb-1 text-[15.5px] font-bold text-ink">Delete this chat?</div>
              <div className="text-[13px] leading-relaxed text-ink-4">This will clear the conversation from your view only. {conversationName} will still have the messages.</div>
            </div>
            <div className="flex gap-2.5 border-t border-surface px-4 pb-5">
              <button type="button" onClick={() => setShowDeleteConv(false)}
                className="flex-1 rounded-[11px] border border-border py-3 text-[13.5px] font-semibold text-ink-4">
                Cancel
              </button>
              <button type="button" onClick={() => { setShowDeleteConv(false); handleDeleteConv() }}
                className="flex-1 rounded-[11px] bg-red py-3 text-[13.5px] font-bold text-white">
                Delete for me
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Inbox panel ─────────────────────────────────────────── */
function InboxPanel({ auth, conversations, convStatus, staff, activeConvId, onSelect, navigate }) {
  const existingDMPartners = new Set(
    conversations.filter(c => c.type === "dm").map(c => c.otherUsername)
  )
  const freshStaff = staff.filter(s => s.username !== auth.username && !existingDMPartners.has(s.username))

  const startDM = s => onSelect({ conversationId: dmConversationId(auth.username, s.username), name: s.name, isGeneral: false })

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-t-[22px] bg-white md:rounded-[22px]" style={{ boxShadow: "0 8px 30px rgba(15,23,42,.10)" }}>
      {/* Header — same brand gradient as the conversation header, so the
          two halves of Chat feel like one designed surface. */}
      <div className="flex-shrink-0 px-4 pb-5" style={{ paddingTop:"max(var(--sat), 52px)", background: BRAND_GRADIENT }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-white/15 bg-white/10">
              <span className="text-[12.5px] font-extrabold text-white">MSO</span>
            </div>
            <div>
              <div className="text-[17.5px] font-extrabold text-white">Staff Chat</div>
              <div className="text-[11.5px] text-white/55">{auth.name}</div>
            </div>
          </div>
          <button type="button"
            onClick={() => navigate(dashboardPathFor({ role: auth.role, station: auth.station }))}
            className="flex h-9 items-center gap-1.5 rounded-[10px] border border-white/15 bg-white/10 px-3 text-[12px] font-semibold text-white active:bg-white/20">
            <i className="bi bi-grid text-[11px]" /> Dashboard
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white px-2.5 pt-2.5">
        {/* General */}
        {(() => {
          const general = conversations.find(c => c.conversationId === "general")
          const active = activeConvId === "general"
          return (
            <button type="button"
              onClick={() => onSelect({ conversationId:"general", name:"General", isGeneral:true })}
              className={`mb-1.5 flex w-full items-center gap-3.5 rounded-[16px] px-3 py-3.5 text-left transition-colors ${active ? "" : "active:bg-surface"}`}
              style={active ? { background: "linear-gradient(135deg,#EAF6FC,#F5F0FF)" } : undefined}>
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: BRAND_GRADIENT }}>
                <i className="bi bi-people-fill text-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[14.5px] font-bold text-ink">General</span>
                  {general?.lastTimestamp && <span className="text-[10.5px] text-ink-4">{timeLabel(general.lastTimestamp)}</span>}
                </div>
                <div className="truncate text-[12.5px] text-ink-4">{general?.lastText || "Station-wide group · Everyone"}</div>
              </div>
            </button>
          )
        })()}

        {/* Existing DMs */}
        {conversations.filter(c => c.type === "dm").map(conv => {
          const active = activeConvId === conv.conversationId
          return (
            <button key={conv.conversationId} type="button"
              onClick={() => onSelect({ conversationId:conv.conversationId, name:conv.name, isGeneral:false })}
              className={`mb-1.5 flex w-full items-center gap-3.5 rounded-[16px] px-3 py-3 text-left transition-colors ${active ? "" : "active:bg-surface"}`}
              style={active ? { background: "linear-gradient(135deg,#EAF6FC,#F5F0FF)" } : undefined}>
              <Avatar name={conv.name} size={46} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[14.5px] font-bold text-ink">{conv.name}</span>
                  {conv.lastTimestamp && <span className="text-[10.5px] text-ink-4">{timeLabel(conv.lastTimestamp)}</span>}
                </div>
                <div className="truncate text-[12.5px] text-ink-4">{conv.lastText || "Tap to chat"}</div>
              </div>
            </button>
          )
        })}

        {/* People to message */}
        {freshStaff.length > 0 && (
          <>
            <div className="px-3 pb-2 pt-4 text-[10.5px] font-bold uppercase tracking-[1px] text-ink-4">People</div>
            {freshStaff.map(s => (
              <button key={s.username} type="button" onClick={() => startDM(s)}
                className="mb-1.5 flex w-full items-center gap-3.5 rounded-[16px] px-3 py-3 text-left active:bg-surface">
                <Avatar name={s.name} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-bold text-ink">{s.name}</div>
                  <div className="text-[11.5px] text-ink-4 capitalize">{s.role}</div>
                </div>
                <span className="rounded-full bg-cyan-light px-3 py-1.5 text-[11px] font-bold text-cyan-dark">Message</span>
              </button>
            ))}
          </>
        )}

        {convStatus === "loading" && (
          <div className="flex justify-center py-8">
            <span className="h-5 w-5 animate-spin-fast rounded-full border-2 border-cyan/20 border-t-cyan" />
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────── */
function ChatInner() {
  const auth = useAuth({ requireAuth: true })
  const navigate = useNavigate()
  const { status: convStatus, conversations, refresh } = useConversations({ username: auth.username })
  const { staff } = useStaff(auth.username)
  const [activeConv, setActiveConv] = useState(null)
  usePageTitle("Chat — MSO Limpid")

  useEffect(() => {
    if (convStatus === "ready" && !activeConv && window.innerWidth >= 768) {
      setActiveConv({ conversationId:"general", name:"General", isGeneral:true })
    }
  }, [convStatus, activeConv])

  if (auth.loading || !auth.user) return <div className="min-h-screen bg-pagebg" />

  const handleSelect = conv => { setActiveConv(conv); refresh() }
  const handleConversationDeleted = () => { setActiveConv(null); refresh() }
  const mobileShowChat = Boolean(activeConv)

  return (
    // A real top margin instead of the interface running edge-to-edge —
    // the whole panel floats with rounded corners and a shadow, like a
    // card sitting on the app's background, rather than flat full-bleed
    // chrome. Bottom stays flush since the composer needs to sit right
    // above the OS home-indicator area, same as every other page.
    <div className="flex overflow-hidden bg-pagebg" style={{ height:"100dvh", paddingTop: "10px" }}>
      <SafeAreaDebug />
      {/* Inbox */}
      <div className={`flex-shrink-0 md:w-[320px] md:pl-3 ${mobileShowChat ? "hidden md:flex md:flex-col" : "flex w-full flex-col px-2.5"}`}
        style={{ height:"100%" }}>
        <InboxPanel auth={auth} conversations={conversations} convStatus={convStatus}
          staff={staff} activeConvId={activeConv?.conversationId}
          onSelect={handleSelect} navigate={navigate} />
      </div>
      {/* Chat window */}
      <div className={`flex-1 flex-col md:pr-3 ${mobileShowChat ? "flex px-2.5" : "hidden md:flex"}`} style={{ height:"100%" }}>
        {activeConv
          ? <ConversationView auth={auth} conversationId={activeConv.conversationId}
              conversationName={activeConv.name} isGeneral={activeConv.isGeneral}
              onBack={() => setActiveConv(null)} onConversationDeleted={handleConversationDeleted} />
          : <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-white text-center" style={{ boxShadow: "0 8px 30px rgba(15,23,42,.10)" }}>
              <div className="flex h-16 w-16 items-center justify-center rounded-[18px] text-white" style={{ background: BRAND_GRADIENT }}>
                <span className="text-[18px] font-extrabold">MSO</span>
              </div>
              <div className="text-[15px] font-bold text-ink">Staff Chat</div>
              <div className="text-[12.5px] text-ink-4">Select a conversation or tap a person to message</div>
            </div>
        }
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <ToastProvider>
      <ChatInner />
    </ToastProvider>
  )
}
