"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Valores = { nome: string; email: string; estagioMentoria: string; observacoesMentora: string };

const VAZIO: Valores = { nome: "", email: "", estagioMentoria: "", observacoesMentora: "" };

/** Cria (sem `participanteId`) ou edita (com `participanteId`) uma participante da mentoria. */
export default function ParticipanteForm({ participanteId, valores }: { participanteId?: number; valores?: Valores }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState<Valores>(valores ?? VAZIO);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch(participanteId ? `/api/participantes/${participanteId}` : "/api/participantes", {
      method: participanteId ? "PATCH" : "POST",
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
          participanteId
            ? "text-[13px] text-[var(--brand-deep)] hover:underline"
            : "rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium"
        }
      >
        {participanteId ? "Editar" : "+ Nova mentora"}
      </button>
    );
  }

  const input = "mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm";
  const label = "text-[var(--ink-2)]";

  return (
    <form onSubmit={salvar} className="card rounded-2xl p-5 space-y-4 max-w-lg w-full">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm block col-span-2">
          <span className={label}>Nome</span>
          <input className={input} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required />
        </label>
        <label className="text-sm block col-span-2">
          <span className={label}>Email (para o acesso da mentora)</span>
          <input type="email" className={input} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </label>
        <label className="text-sm block col-span-2">
          <span className={label}>Estágio na mentoria</span>
          <input
            className={input}
            value={v.estagioMentoria}
            onChange={(e) => setV({ ...v, estagioMentoria: e.target.value })}
            placeholder="Ex.: Módulo 2 — Avaliação da compreensão leitora"
          />
        </label>
        <label className="text-sm block col-span-2">
          <span className={label}>Observações da mentora</span>
          <textarea
            rows={3}
            className={input}
            value={v.observacoesMentora}
            onChange={(e) => setV({ ...v, observacoesMentora: e.target.value })}
            placeholder="Pontos fortes, dificuldades recorrentes, o que acompanhar de perto…"
          />
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
