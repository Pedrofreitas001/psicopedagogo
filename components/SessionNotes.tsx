"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Nota = { id: number; dataSessao: string; conteudo: string; criadoPor: string };

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function dataBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Prontuário: notas de sessão datadas — o registro clínico do acompanhamento. */
export default function SessionNotes({ clienteId, notas }: { clienteId: number; notas: Nota[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje());
  const [conteudo, setConteudo] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch(`/api/clientes/${clienteId}/notas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataSessao: data, conteudo }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErro(body.error ?? "Não foi possível salvar a nota.");
      return;
    }
    setConteudo("");
    setData(hoje());
    setAberto(false);
    router.refresh();
  }

  async function excluir(id: number) {
    await fetch(`/api/notas/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">🗒️ Prontuário — Sessões</h2>
        {!aberto && (
          <button onClick={() => setAberto(true)} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium">
            + Nova nota de sessão
          </button>
        )}
      </div>

      {aberto && (
        <form onSubmit={salvar} className="mt-3 rounded-xl border border-black/8 bg-white p-4 space-y-3">
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Data da sessão</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="mt-1 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Registro da sessão</span>
            <textarea rows={4} value={conteudo} onChange={(e) => setConteudo(e.target.value)} required className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" placeholder="O que foi trabalhado, como o cliente respondeu, combinados para a próxima sessão…" />
          </label>
          {erro && <p className="text-[13px] text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading || !conteudo.trim()} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm disabled:opacity-50">
              {loading ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-black/10 px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {notas.map((n) => (
          <div key={n.id} className="rounded-xl border border-black/6 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-medium text-[var(--brand-deep)]">{dataBr(n.dataSessao)}</div>
              <button onClick={() => excluir(n.id)} className="text-[11.5px] text-[var(--ink-muted)] hover:text-red-600">
                Excluir
              </button>
            </div>
            <p className="mt-1.5 text-[13px] text-[var(--ink-2)] leading-relaxed whitespace-pre-wrap">{n.conteudo}</p>
            <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">registrado por {n.criadoPor}</p>
          </div>
        ))}
        {notas.length === 0 && <p className="mt-2 text-sm text-[var(--ink-muted)]">Nenhuma sessão registrada ainda.</p>}
      </div>
    </div>
  );
}
