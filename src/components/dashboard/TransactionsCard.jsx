import React from "react"
import { Link } from "react-router-dom"
import { naira, numberNG } from "../../utils/format"

const METHOD_PILL = {
  pos: "border-cyan/20 bg-cyan-light text-cyan-dark",
  cash: "border-[#BBF7D0] bg-green-light text-green",
  trf: "border-navy/10 bg-[#EEF0FB] text-navy",
}

function methodClass(method) {
  return METHOD_PILL[String(method || "").toLowerCase()] || "border-border bg-surface text-ink-3"
}

const HEAD = ["Time", "Tank · Pump · Nozzle", "Product", "Litres", "Amount", "Method", "Staff"]

export default function TransactionsCard({ status, transactions }) {
  const loading = status === "loading" || status === "idle"
  const hasData = transactions && transactions.length > 0

  return (
    <div className="h-full overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex items-start justify-between gap-2.5 border-b border-surface px-[18px] py-3.5">
        <div>
          <div className="text-[13.5px] font-extrabold tracking-[-0.02em] text-ink">Recent Transactions</div>
          <div className="mt-0.5 text-[10.5px] text-ink-4">Tank · pump · nozzle · staff</div>
        </div>
        <Link
          to="/records-mso"
          className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold text-cyan transition-[gap] duration-150 hover:gap-2"
        >
          All records <i className="bi bi-arrow-right" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {HEAD.map(h => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-border bg-surface px-3.5 py-[9px] text-left text-[9.5px] font-bold uppercase tracking-[1px] text-ink-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3.5 py-7 text-center">
                  <span className="skel mx-auto block h-3.5 w-[220px]" />
                </td>
              </tr>
            ) : !hasData ? (
              <tr>
                <td colSpan={7} className="px-3.5 py-7 text-center text-[12.5px] text-ink-4">
                  <i className="bi bi-receipt mb-2 block text-2xl opacity-35" />
                  No sales recorded today. Once staff log pump sales, they appear here.
                </td>
              </tr>
            ) : (
              transactions.map((t, i) => {
                const tankLabel = [t.tank, t.pump, t.nozzle].filter(Boolean).join("·")
                return (
                  <tr
                    key={i}
                    className={`border-b border-surface last:border-none hover:bg-[#FAFBFE] ${
                      t.handover ? "bg-[#FFFBEB]" : ""
                    }`}
                  >
                    <td className="mono px-3.5 py-2.5 text-[11.5px] text-ink-4">
                      {t.time || "—"}
                      {t.handover && (
                        <span className="ml-1.5 inline-flex items-center rounded-full border border-[#FDE68A] bg-amber-light px-1.5 py-px text-[8.5px] font-bold text-amber">
                          Handover
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex items-center rounded-full border border-cyan/20 bg-cyan-light px-2.5 py-px text-[10px] font-bold text-cyan-dark">
                        {tankLabel || "—"}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-px text-[10.5px] font-bold ${
                          (t.product || "").toUpperCase() === "AGO"
                            ? "border border-[#FDE68A] bg-amber-light text-amber"
                            : "border border-cyan/20 bg-cyan-light text-cyan-dark"
                        }`}
                      >
                        {t.product || "—"}
                      </span>
                    </td>
                    <td className="mono px-3.5 py-2.5 font-semibold">{numberNG(t.litres || 0)}L</td>
                    <td className="mono px-3.5 py-2.5 font-bold text-ink">{naira(t.amount || 0)}</td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-px text-[10.5px] font-bold ${methodClass(
                          t.payMethod
                        )}`}
                      >
                        {t.payMethod || "—"}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-[11.5px] text-ink-3">{t.attendant || "—"}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
