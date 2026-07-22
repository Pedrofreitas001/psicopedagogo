"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Nota = { id?: number; titulo: string; conteudo: string };

export default function MetodologiaForm({ nota, onCancelLabel = "Cancelar" }: { nota?: Nota; onCancelLabel?: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState<Nota>(nota ?? { titulo: "", conteudo: "" });
  const [loading, setLoading] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/conhecimento", {
      method: nota?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nota?.id, ...v }),
    });
    setLoading(false);
    setAberto(false);
    if (!nota?.id) setV({ titulo: "", conteudo: "" });
    router.refresh();
  }

  async function excluir() {
    if (!nota?.id) return;
    await fetch("/api/conhecimento", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nota.id }),
    });
    router.refresh();
  }

  if (!aberto) {
    return nota?.id ? (
      <span className="flex gap-3 text-[12.5px]">
        <button onClick={() => setAberto(true)} className="text-[var(--brand-deep)] hover:underline">Editar</button>
        <button onClick={excluir} className="text-[var(--ink-muted)] hover:text-red-600">Excluir</button>
      </span>
    ) : (
      <button onClick={() => setAberto(true)} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium">
        + Nova nota de metodologia
      </button>
    );
  }

  return (
    <form onSubmit={salvar} className="card rounded-2xl p-5 space-y-3 w-full">
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">Título</span>
        <input className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} required />
      </label>
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">Conteúdo</span>
        <textarea rows={5} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" value={v.conteudo} onChange={(e) => setV({ ...v, conteudo: e.target.value })} required />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-black/10 px-4 py-2 text-sm">
          {onCancelLabel}
        </button>
      </div>
    </form>
  );
}
