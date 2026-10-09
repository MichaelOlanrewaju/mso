import React, { useMemo, useState } from "react"
import { EmptyState, StatusBadge } from "./Ui"

export function DataTable({
  columns = [], rows = [], rowKey, search = "", pageSize = 10,
  emptyTitle = "No records found", emptyDescription = "Try changing your filters or search.",
  loading = false, onRowClick, selectable = false,
}) {
  const [sort, setSort] = useState({ key: null, direction: "asc" })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row => columns.some(col => String(col.value ? col.value(row) : row[col.key] ?? "").toLowerCase().includes(q)))
  }, [rows, columns, search])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const col = columns.find(c => c.key === sort.key)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : col.value ? col.value(a) : a[col.key]
      const bv = col.sortValue ? col.sortValue(b) : col.value ? col.value(b) : b[col.key]
      const an = Number(av), bn = Number(bv)
      const result = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : String(av ?? "").localeCompare(String(bv ?? ""))
      return sort.direction === "asc" ? result : -result
    })
  }, [filtered, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = key => {
    setPage(1)
    setSort(s => s.key === key ? { key, direction: s.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" })
  }
  const toggleAll = () => setSelected(selected.length === visible.length ? [] : visible.map((r, i) => rowKey ? rowKey(r) : i))

  if (loading) return <div className="mso-table-skeleton" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="mso-skeleton-row"><span /><span /><span /><span /></div>)}</div>
  if (!visible.length) return <EmptyState icon="bi-table" title={emptyTitle} description={emptyDescription} />

  return <div className="mso-data-table">
    <div className="mso-table-wrap">
      <table>
        <thead><tr>
          {selectable && <th className="w-10"><input type="checkbox" checked={selected.length === visible.length && visible.length > 0} onChange={toggleAll} aria-label="Select all" /></th>}
          {columns.map(col => <th key={col.key} className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}>
            {col.sortable === false ? col.label : <button type="button" className="mso-th-button" onClick={() => toggleSort(col.key)}>{col.label}<i className={`bi ${sort.key === col.key ? (sort.direction === "asc" ? "bi-chevron-up" : "bi-chevron-down") : "bi-arrow-down-up"}`} /></button>}
          </th>)}
        </tr></thead>
        <tbody>{visible.map((row, index) => {
          const id = rowKey ? rowKey(row) : index
          return <tr key={id} onClick={() => onRowClick?.(row)} className={onRowClick ? "cursor-pointer" : ""}>
            {selectable && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(id)} onChange={() => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])} aria-label="Select row" /></td>}
            {columns.map(col => <td key={col.key} className={col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}>{col.render ? col.render(row) : col.value ? col.value(row) : row[col.key]}</td>)}
          </tr>
        })}</tbody>
      </table>
    </div>
    <div className="mso-table-footer">
      <span>Showing <b>{(safePage - 1) * pageSize + 1}</b>–<b>{Math.min(safePage * pageSize, sorted.length)}</b> of <b>{sorted.length}</b></span>
      <div className="mso-pagination">
        <button type="button" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Previous page"><i className="bi bi-chevron-left" /></button>
        <span>{safePage} / {totalPages}</span>
        <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-label="Next page"><i className="bi bi-chevron-right" /></button>
      </div>
    </div>
  </div>
}

export function WorkflowActionBar({ status = "Ready", primary, secondary, danger, children }) {
  return <div className="mso-workflow-bar">
    <div className="flex min-w-0 items-center gap-2"><span className="mso-workflow-dot" /> <span className="truncate">{status}</span></div>
    <div className="mso-workflow-actions">{children}{secondary}{danger}{primary}</div>
  </div>
}

export function WorkflowStep({ number, title, description, active = false, complete = false, children }) {
  return <div className={`mso-workflow-step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}>
    <div className="mso-workflow-step-number">{complete ? <i className="bi bi-check2" /> : number}</div>
    <div className="min-w-0 flex-1"><div className="mso-workflow-step-title">{title}</div>{description && <div className="mso-workflow-step-description">{description}</div>}{children}</div>
  </div>
}
