"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UISpec } from "@/lib/types";

export function KpiDeleteButton({ kpiId, nome }: { kpiId: number; nome: string }) {
  const router = useRouter();
  async function remove() {
    if (!window.confirm(`Excluir o KPI “${nome}”?`)) return;
    const res = await fetch(`/api/kpis/${kpiId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Erro ao excluir.");
      return;
    }
    router.refresh();
  }
  return (
    <button onClick={remove} className="text-[12px] text-red-500 hover:underline">excluir</button>
  );
}

export function KpiToDashboard({ nome, valor, blocks }: { nome: string; valor: string; blocks: UISpec[] }) {
  const [saved, setSaved] = useState(false);
  async function save() {
    const spec: UISpec[] = [{ type: "kpi", items: [{ label: nome, value: valor }] }, ...blocks];
    const res = await fetch("/api/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: `KPI: ${nome}`, descricao: "Gerado a partir do modelo analítico.", spec_json: spec }),
    });
    if (res.ok) setSaved(true);
  }
  return saved ? (
    <span className="text-[12px] text-emerald-700">✓ salvo em Dashboards</span>
  ) : (
    <button onClick={save} className="text-[12px] text-[var(--ink-muted)] border border-black/10 rounded-md px-2 py-0.5 hover:bg-black/4">
      salvar como dashboard
    </button>
  );
}
