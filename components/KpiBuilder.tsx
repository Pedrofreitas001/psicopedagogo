"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnProfile } from "@/lib/semantic";

const AGREGACOES = [
  { id: "sum", label: "Soma (sum)" },
  { id: "avg", label: "Média (avg)" },
  { id: "count", label: "Contagem de linhas (count)" },
  { id: "count_distinct", label: "Contagem distinta" },
  { id: "min", label: "Mínimo" },
  { id: "max", label: "Máximo" },
];

export default function KpiBuilder({ assets }: { assets: { id: number; nome: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState<number | "">("");
  const [columns, setColumns] = useState<ColumnProfile[]>([]);
  const [nome, setNome] = useState("");
  const [agregacao, setAgregacao] = useState("sum");
  const [medida, setMedida] = useState("");
  const [dataCol, setDataCol] = useState("");
  const [dimensao, setDimensao] = useState("");
  const [formato, setFormato] = useState("numero");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function selectAsset(id: string) {
    const num = Number(id);
    setAssetId(num || "");
    setColumns([]);
    setMedida(""); setDataCol(""); setDimensao("");
    if (!num) return;
    setLoading(true);
    const res = await fetch(`/api/catalog/${num}/profile`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setColumns(data.columns);
  }

  async function criar() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/kpis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome, asset_id: assetId, agregacao,
        coluna_medida: medida || null, coluna_data: dataCol || null, coluna_dimensao: dimensao || null, formato,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setMsg(data.error ?? "Erro ao criar KPI."); return; }
    setOpen(false);
    setNome(""); setAssetId(""); setColumns([]);
    router.refresh();
  }

  const medidas = columns.filter((c) => c.papel === "medida");
  const datas = columns.filter((c) => c.papel === "data");
  const dims = columns.filter((c) => c.papel === "dimensao");
  const select = "w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-sm";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm font-medium">
        + Novo KPI
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--brand)]/30 bg-white p-5 space-y-4 w-full">
      <h3 className="text-sm font-semibold">Novo KPI (Layer 3 — modelo analítico)</h3>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="text-[var(--ink-2)]">Ativo (modelo semântico)</span>
          <select className={`${select} mt-1`} value={assetId} onChange={(e) => selectAsset(e.target.value)}>
            <option value="">selecione…</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[var(--ink-2)]">Nome do KPI</span>
          <input className={`${select} mt-1`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Receita ERP" />
        </label>
      </div>
      {loading && <p className="text-[13px] text-[var(--ink-muted)] animate-pulse">Perfilando colunas do ativo…</p>}
      {columns.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="text-[var(--ink-2)]">Agregação</span>
            <select className={`${select} mt-1`} value={agregacao} onChange={(e) => setAgregacao(e.target.value)}>
              {AGREGACOES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[var(--ink-2)]">Medida {agregacao === "count" && "(opcional para count)"}</span>
            <select className={`${select} mt-1`} value={medida} onChange={(e) => { setMedida(e.target.value); const c = medidas.find((m) => m.coluna === e.target.value); if (c?.tipo_dado === "moeda") setFormato("moeda"); }}>
              <option value="">—</option>
              {medidas.map((c) => <option key={c.coluna} value={c.coluna}>{c.nome_semantico || c.coluna}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[var(--ink-2)]">Eixo temporal (gera linha)</span>
            <select className={`${select} mt-1`} value={dataCol} onChange={(e) => setDataCol(e.target.value)}>
              <option value="">—</option>
              {datas.map((c) => <option key={c.coluna} value={c.coluna}>{c.nome_semantico || c.coluna}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[var(--ink-2)]">Quebra por dimensão (gera barras)</span>
            <select className={`${select} mt-1`} value={dimensao} onChange={(e) => setDimensao(e.target.value)}>
              <option value="">—</option>
              {dims.map((c) => <option key={c.coluna} value={c.coluna}>{c.nome_semantico || c.coluna}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[var(--ink-2)]">Formato</span>
            <select className={`${select} mt-1`} value={formato} onChange={(e) => setFormato(e.target.value)}>
              <option value="numero">número</option>
              <option value="moeda">moeda (R$)</option>
              <option value="percentual">percentual</option>
            </select>
          </label>
        </div>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <div className="flex gap-3">
        <button onClick={criar} disabled={loading || !nome.trim() || !assetId} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
          Criar KPI
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-black/12 px-4 py-2 text-sm">Cancelar</button>
      </div>
    </div>
  );
}
