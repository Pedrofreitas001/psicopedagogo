"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Valores = { nome: string; email: string; objetivo: string; observacoes: string };

/** Cria (sem `clienteId`) ou edita (com `clienteId`) um cliente. */
export default function ClienteForm({ clienteId, valores }: { clienteId?: number; valores?: Valores }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState<Valores>(valores ?? { nome: "", email: "", objetivo: "", observacoes: "" });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch(clienteId ? `/api/clientes/${clienteId}` : "/api/clientes", {
      method: clienteId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErro(data.error ?? "Erro ao salvar.");
      return;
    }
    setAberto(false);
    router.refresh();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className={
          clienteId
            ? "text-[13px] text-[var(--brand-deep)] hover:underline"
            : "rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium"
        }
      >
        {clienteId ? "Editar" : "+ Novo cliente"}
      </button>
    );
  }

  const input = "mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm";
  return (
    <form onSubmit={salvar} className="rounded-2xl border border-black/8 bg-[var(--surface-1)] p-5 space-y-3 max-w-lg w-full">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm block">
          <span className="text-[var(--ink-2)]">Nome</span>
          <input className={input} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required />
        </label>
        <label className="text-sm block">
          <span className="text-[var(--ink-2)]">Email (para o acesso do cliente)</span>
          <input type="email" className={input} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </label>
      </div>
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">Objetivo do acompanhamento</span>
        <textarea rows={2} className={input} value={v.objetivo} onChange={(e) => setV({ ...v, objetivo: e.target.value })} />
      </label>
      <label className="text-sm block">
        <span className="text-[var(--ink-2)]">Observações</span>
        <textarea rows={3} className={input} value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} />
      </label>
      {erro && <p className="text-[13px] text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !v.nome.trim()} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm disabled:opacity-50">
          {loading ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-black/10 px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
