"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Valores = {
  nome: string;
  email: string;
  idade: number | null;
  escolaSerie: string;
  queixaPrincipal: string;
  diagnosticoPreliminar: string;
  responsavelNome: string;
  responsavelContato: string;
  objetivo: string;
  observacoes: string;
};

const VAZIO: Valores = {
  nome: "",
  email: "",
  idade: null,
  escolaSerie: "",
  queixaPrincipal: "",
  diagnosticoPreliminar: "",
  responsavelNome: "",
  responsavelContato: "",
  objetivo: "",
  observacoes: "",
};

/** Cria (sem `clienteId`) ou edita (com `clienteId`) um cliente — ficha de acolhimento. */
export default function ClienteForm({ clienteId, valores }: { clienteId?: number; valores?: Valores }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState<Valores>(valores ?? VAZIO);
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
  const label = "text-[var(--ink-2)]";

  return (
    <form onSubmit={salvar} className="card rounded-2xl p-5 space-y-4 max-w-lg w-full">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">Identificação</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm block col-span-2">
            <span className={label}>Nome</span>
            <input className={input} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required />
          </label>
          <label className="text-sm block">
            <span className={label}>Email (para o acesso do cliente)</span>
            <input type="email" className={input} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </label>
          <label className="text-sm block">
            <span className={label}>Idade</span>
            <input
              type="number"
              min={0}
              max={120}
              className={input}
              value={v.idade ?? ""}
              onChange={(e) => setV({ ...v, idade: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </label>
          <label className="text-sm block col-span-2">
            <span className={label}>Escola / série</span>
            <input className={input} value={v.escolaSerie} onChange={(e) => setV({ ...v, escolaSerie: e.target.value })} />
          </label>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">Responsável</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm block">
            <span className={label}>Nome do responsável</span>
            <input className={input} value={v.responsavelNome} onChange={(e) => setV({ ...v, responsavelNome: e.target.value })} />
          </label>
          <label className="text-sm block">
            <span className={label}>Contato</span>
            <input className={input} value={v.responsavelContato} onChange={(e) => setV({ ...v, responsavelContato: e.target.value })} />
          </label>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">Avaliação inicial</p>
        <label className="text-sm block mb-3">
          <span className={label}>Queixa principal</span>
          <textarea rows={2} className={input} value={v.queixaPrincipal} onChange={(e) => setV({ ...v, queixaPrincipal: e.target.value })} />
        </label>
        <label className="text-sm block">
          <span className={label}>Diagnóstico preliminar</span>
          <input className={input} value={v.diagnosticoPreliminar} onChange={(e) => setV({ ...v, diagnosticoPreliminar: e.target.value })} placeholder="Ex.: dislexia (laudo externo), em investigação…" />
        </label>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)] mb-2">Acompanhamento</p>
        <label className="text-sm block mb-3">
          <span className={label}>Objetivo do acompanhamento</span>
          <textarea rows={2} className={input} value={v.objetivo} onChange={(e) => setV({ ...v, objetivo: e.target.value })} />
        </label>
        <label className="text-sm block">
          <span className={label}>Observações</span>
          <textarea rows={3} className={input} value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} />
        </label>
      </div>

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
