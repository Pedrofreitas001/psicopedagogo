"use client";

import { useState } from "react";
import type { CreativeVariant } from "@/lib/creative";

const CANAIS = [
  { id: "meta", label: "Meta Ads" },
  { id: "google", label: "Google Ads" },
  { id: "tiktok", label: "TikTok" },
  { id: "email", label: "Email" },
];
const OBJETIVOS = ["conversão", "alcance", "retenção"];
const TONS = ["profissional", "amigável", "urgente"];

export default function CreativeStudio({ produtos }: { produtos: { id: number; nome: string; preco: number }[] }) {
  const [produtoId, setProdutoId] = useState(produtos[0]?.id ?? 0);
  const [canal, setCanal] = useState("meta");
  const [objetivo, setObjetivo] = useState("conversão");
  const [tom, setTom] = useState("profissional");
  const [variantes, setVariantes] = useState<CreativeVariant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  async function gerar() {
    setLoading(true);
    const res = await fetch("/api/marketing/criativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produtoId, canal, objetivo, tom }),
    });
    const data = await res.json();
    setVariantes(data.variantes ?? null);
    setLoading(false);
  }

  async function copiar(v: CreativeVariant, i: number) {
    await navigator.clipboard.writeText(`${v.headline}\n\n${v.corpo}\n\nCTA: ${v.cta}`);
    setCopied(i);
    setTimeout(() => setCopied(null), 1500);
  }

  const select = "rounded-lg border border-black/12 bg-white px-3 py-2 text-sm";

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Estúdio de criativos</h2>
        <p className="text-[12.5px] text-[var(--ink-muted)]">
          Gera variações de copy usando preço e categoria reais do catálogo, respeitando os limites de cada canal.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-[var(--ink-2)] block mb-1">Produto</span>
          <select className={select} value={produtoId} onChange={(e) => setProdutoId(Number(e.target.value))}>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[var(--ink-2)] block mb-1">Canal</span>
          <select className={select} value={canal} onChange={(e) => setCanal(e.target.value)}>
            {CANAIS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[var(--ink-2)] block mb-1">Objetivo</span>
          <select className={select} value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>
            {OBJETIVOS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-[var(--ink-2)] block mb-1">Tom</span>
          <select className={select} value={tom} onChange={(e) => setTom(e.target.value)}>
            {TONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button onClick={gerar} disabled={loading || !produtoId} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm font-medium disabled:opacity-40">
          {loading ? "Gerando…" : "✨ Gerar criativos"}
        </button>
      </div>

      {variantes && (
        <div className="grid grid-cols-3 gap-3">
          {variantes.map((v, i) => (
            <div key={i} className="rounded-lg border border-black/10 bg-[var(--surface-1)] p-4 flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wide text-[var(--brand)] font-semibold">{v.angulo}</span>
              <h3 className="text-[14px] font-semibold leading-snug">{v.headline}</h3>
              <p className="text-[13px] text-[var(--ink-2)] leading-relaxed flex-1">{v.corpo}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="rounded-full bg-[var(--brand)]/8 text-[var(--brand)] text-[12px] px-2.5 py-1 font-medium">{v.cta}</span>
                <button onClick={() => copiar(v, i)} className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--brand)]">
                  {copied === i ? "✓ copiado" : "copiar"}
                </button>
              </div>
              <p className="text-[10.5px] text-[var(--ink-muted)] border-t border-black/5 pt-2">{v.obs}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
