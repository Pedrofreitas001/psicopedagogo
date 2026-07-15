"use client";

import type { UISpec } from "@/lib/types";
import { BarChart, LineChart } from "./charts";

const KANBAN_BADGE: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  normal: "bg-blue-100 text-blue-700",
  baixa: "bg-gray-100 text-gray-600",
};

/** Renderiza um bloco do Dynamic UI Engine (Módulo 9): mesmo JSON do chat e dos dashboards salvos. */
export default function SpecRenderer({ spec }: { spec: UISpec }) {
  switch (spec.type) {
    case "kpi":
      return (
        <div className="grid grid-cols-3 gap-3">
          {spec.items.map((k) => (
            <div key={k.label} className="rounded-xl border border-black/10 bg-[var(--surface-1)] px-4 py-3">
              <div className="text-xs text-[var(--ink-muted)]">{k.label}</div>
              <div className="text-xl font-semibold mt-0.5 truncate" title={k.value}>{k.value}</div>
              {k.hint && <div className="text-[11px] text-[var(--ink-muted)] mt-0.5">{k.hint}</div>}
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <div className="rounded-xl border border-black/10 bg-[var(--surface-1)] overflow-hidden">
          {spec.title && <div className="px-4 pt-3 pb-1 text-sm font-medium">{spec.title}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[var(--ink-muted)] border-b border-black/5">
                  {spec.columns.map((c) => (
                    <th key={c.key} className={`px-4 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {spec.rows.map((row, i) => (
                  <tr key={i} className="border-b border-black/4 last:border-0 hover:bg-black/2">
                    {spec.columns.map((c) => (
                      <td key={c.key} className={`px-4 py-2 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                        {row[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                {spec.rows.length === 0 && (
                  <tr>
                    <td colSpan={spec.columns.length} className="px-4 py-4 text-[var(--ink-muted)]">
                      Sem resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "chart":
      return (
        <div className="rounded-xl border border-black/10 bg-[var(--surface-1)] px-4 py-3">
          {spec.title && <div className="text-sm font-medium mb-2">{spec.title}</div>}
          {spec.chartType === "bar" ? <BarChart data={spec.data} unit={spec.unit} /> : <LineChart data={spec.data} unit={spec.unit} />}
        </div>
      );

    case "kanban":
      return (
        <div className="rounded-xl border border-black/10 bg-[var(--surface-1)] px-4 py-3">
          {spec.title && <div className="text-sm font-medium mb-3">{spec.title}</div>}
          <div className="grid grid-cols-3 gap-3">
            {spec.columns.map((col) => (
              <div key={col.title} className="rounded-lg bg-black/3 p-2">
                <div className="text-xs font-semibold text-[var(--ink-2)] px-1 pb-2">
                  {col.title} <span className="text-[var(--ink-muted)] font-normal">({col.cards.length})</span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {col.cards.map((card, i) => (
                    <div key={i} className="rounded-md bg-white border border-black/8 px-2.5 py-2">
                      <div className="text-[12.5px] leading-snug">{card.title}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        {card.subtitle && <span className="text-[11px] text-[var(--ink-muted)]">{card.subtitle}</span>}
                        {card.badge && (
                          <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full ${KANBAN_BADGE[card.badge] ?? "bg-gray-100 text-gray-600"}`}>
                            {card.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}
