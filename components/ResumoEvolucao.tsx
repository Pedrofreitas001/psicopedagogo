"use client";

import { useState } from "react";
import Markdown from "./Markdown";

/** O botão "uau": lê hipóteses, protocolo e conversas de todos os casos e devolve um resumo pré-encontro para a mentora. */
export default function ResumoEvolucao({ participantId }: { participantId: number }) {
  const [resumo, setResumo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    setErro(null);
    const res = await fetch(`/api/participantes/${participantId}/resumo`, { method: "POST" });
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
        {loading ? "Lendo o histórico…" : "✨ Gerar resumo pré-encontro"}
      </button>
      {erro && <p className="mt-2 text-[13px] text-red-600">{erro}</p>}
      {resumo && (
        <div className="mt-3 rounded-2xl border border-[var(--leaf)]/30 bg-[var(--leaf)]/5 p-4 text-sm leading-relaxed">
          <Markdown>{resumo}</Markdown>
        </div>
      )}
    </div>
  );
}
