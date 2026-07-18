"use client";

import { useState } from "react";

/** O botão "uau": lê conversas + linha do tempo e devolve uma síntese para a mentora. */
export default function ResumoEvolucao({ clienteId }: { clienteId: number }) {
  const [resumo, setResumo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    setErro(null);
    const res = await fetch(`/api/clientes/${clienteId}/resumo`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErro(data.error ?? "Não foi possível gerar o resumo.");
      return;
    }
    setResumo(data.resumo);
  }

  return (
    <div>
      <button
        onClick={gerar}
        disabled={loading}
        className="rounded-lg bg-[var(--leaf)] hover:opacity-90 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Lendo o histórico…" : "✨ Gerar resumo da evolução"}
      </button>
      {erro && <p className="mt-2 text-[13px] text-red-600">{erro}</p>}
      {resumo && (
        <div className="mt-3 rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf)]/5 p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {resumo}
        </div>
      )}
    </div>
  );
}
