"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnProfile, KpiSuggestion } from "@/lib/semantic";

const PAPEIS = ["dimensao", "medida", "data", "chave", "ignorar"];
const TIPOS = ["texto", "numero", "moeda", "data", "booleano", "id", "email"];
const PAPEL_COR: Record<string, string> = {
  medida: "bg-blue-50 text-blue-700",
  dimensao: "bg-violet-50 text-violet-700",
  data: "bg-amber-50 text-amber-800",
  chave: "bg-gray-100 text-gray-600",
  ignorar: "bg-gray-50 text-gray-400",
};

export default function SemanticColumns({
  assetId,
  initialColumns,
}: {
  assetId: number;
  initialColumns: ColumnProfile[];
}) {
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnProfile[]>(initialColumns);
  const [sugestoes, setSugestoes] = useState<KpiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [criados, setCriados] = useState<Set<string>>(new Set());

  async function profile() {
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/catalog/${assetId}/profile`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setMsg(data.error ?? "Erro ao perfilar."); return; }
    setColumns(data.columns);
    setSugestoes(data.sugestoes);
  }

  function updateCol(i: number, patch: Partial<ColumnProfile>) {
    setColumns((cols) => cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function salvar() {
    setLoading(true);
    const res = await fetch(`/api/catalog/${assetId}/columns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setMsg(res.ok ? "✓ Modelo semântico confirmado — registrado na auditoria." : data.error ?? "Erro.");
    if (res.ok) router.refresh();
  }

  async function criarKpi(s: KpiSuggestion) {
    const res = await fetch("/api/kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, asset_id: assetId, descricao: s.motivo }),
    });
    if (res.ok) {
      setCriados((c) => new Set(c).add(s.nome));
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? "Erro ao criar KPI.");
    }
  }

  const select = "rounded-md border border-black/12 bg-white px-1.5 py-1 text-[12px]";

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Modelo semântico das colunas (Layer 2)</h3>
          <p className="text-[12.5px] text-[var(--ink-muted)]">
            O profiler analisa a amostra e sugere o papel de cada coluna; você confirma. Medidas e datas viram matéria-prima dos KPIs.
          </p>
        </div>
        <button onClick={profile} disabled={loading} className="shrink-0 rounded-lg bg-[var(--brand)] text-white px-3.5 py-2 text-[13px] font-medium disabled:opacity-50">
          {loading ? "Analisando…" : columns.length ? "Re-perfilar" : "🔍 Perfilar colunas"}
        </button>
      </div>

      {columns.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[var(--ink-muted)] border-b border-black/5">
                  <th className="py-1.5 pr-3 font-medium">Coluna</th>
                  <th className="py-1.5 pr-3 font-medium">Nome de negócio</th>
                  <th className="py-1.5 pr-3 font-medium">Tipo</th>
                  <th className="py-1.5 pr-3 font-medium">Papel</th>
                  <th className="py-1.5 pr-3 font-medium">Distintos</th>
                  <th className="py-1.5 font-medium">Exemplo</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((c, i) => (
                  <tr key={c.coluna} className="border-b border-black/4 last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-[11.5px]">
                      {c.coluna}
                      {!!c.confirmado && <span className="ml-1 text-emerald-600" title="confirmado pelo steward">✓</span>}
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        className="rounded-md border border-black/10 px-1.5 py-1 text-[12px] w-32"
                        value={c.nome_semantico ?? ""}
                        placeholder={c.coluna}
                        onChange={(e) => updateCol(i, { nome_semantico: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <select className={select} value={c.tipo_dado} onChange={(e) => updateCol(i, { tipo_dado: e.target.value as ColumnProfile["tipo_dado"] })}>
                        {TIPOS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-3">
                      <select
                        className={`${select} ${PAPEL_COR[c.papel] ?? ""}`}
                        value={c.papel}
                        onChange={(e) => updateCol(i, { papel: e.target.value as ColumnProfile["papel"] })}
                      >
                        {PAPEIS.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">{c.cardinalidade ?? "—"}</td>
                    <td className="py-1.5 text-[var(--ink-muted)] max-w-40 truncate">{c.exemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={salvar} disabled={loading} className="rounded-lg border border-[var(--brand)]/40 text-[var(--brand)] px-3.5 py-1.5 text-[13px] font-medium hover:bg-[var(--brand)]/5 disabled:opacity-50">
            Confirmar modelo semântico
          </button>
        </>
      )}

      {sugestoes.length > 0 && (
        <div className="rounded-lg bg-[var(--brand)]/4 border border-[var(--brand)]/20 p-3.5 space-y-2">
          <p className="text-[13px] font-medium text-[var(--brand)]">KPIs sugeridos a partir do modelo (Layer 3)</p>
          {sugestoes.map((s) => (
            <div key={s.nome} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span>
                <span className="font-medium">{s.nome}</span>
                <span className="text-[var(--ink-muted)]"> — {s.motivo}</span>
              </span>
              {criados.has(s.nome) ? (
                <a href="/kpis" className="shrink-0 text-emerald-700 hover:underline">✓ criado — ver KPIs</a>
              ) : (
                <button onClick={() => criarKpi(s)} className="shrink-0 rounded-md bg-[var(--brand)] text-white px-2.5 py-1 text-[12px]">
                  Criar KPI
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {msg && <p className="text-[13px] text-[var(--ink-2)]">{msg}</p>}
      {columns.length === 0 && !loading && (
        <p className="text-[13px] text-[var(--ink-muted)]">Nenhuma coluna perfilada ainda — clique em “Perfilar colunas”.</p>
      )}
    </div>
  );
}
