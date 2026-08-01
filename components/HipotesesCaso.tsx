"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Hipotese = {
  id: number;
  texto: string;
  status: "ativa" | "confirmada" | "descartada";
  evidenciasFavor: string;
  evidenciasContra: string;
  criadoEm: string;
};

const STATUS_ESTILO: Record<Hipotese["status"], string> = {
  ativa: "bg-amber-50 text-amber-700 border-amber-200",
  confirmada: "bg-emerald-50 text-emerald-700 border-emerald-200",
  descartada: "bg-black/4 text-[var(--ink-muted)] border-black/10",
};
const STATUS_LABEL: Record<Hipotese["status"], string> = { ativa: "Ativa", confirmada: "Confirmada", descartada: "Descartada" };

/**
 * Hipóteses clínicas do caso — o núcleo da "memória" do agente: fica
 * registrado o que foi levantado, com que status (ativa/confirmada/
 * descartada) e as evidências a favor e contra.
 */
export default function HipotesesCaso({ caseId, hipoteses }: { caseId: number; hipoteses: Hipotese[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [evidenciasFavor, setEvidenciasFavor] = useState("");
  const [evidenciasContra, setEvidenciasContra] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const res = await fetch(`/api/casos/${caseId}/hipoteses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, evidenciasFavor, evidenciasContra }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErro(body.error ?? "Não foi possível registrar a hipótese.");
      return;
    }
    setTexto("");
    setEvidenciasFavor("");
    setEvidenciasContra("");
    setAberto(false);
    router.refresh();
  }

  async function mudarStatus(id: number, status: Hipotese["status"]) {
    await fetch(`/api/hipoteses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="material-symbols-outlined text-[20px] text-[var(--brand)]">lightbulb</span> Hipóteses clínicas
        </h2>
        {!aberto && (
          <button onClick={() => setAberto(true)} className="rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white px-4 py-2 text-sm font-medium">
            + Registrar hipótese
          </button>
        )}
      </div>

      {aberto && (
        <form onSubmit={salvar} className="mt-3 rounded-xl border border-[var(--grid)] bg-[var(--surface-low)] p-4 space-y-3">
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Hipótese</span>
            <textarea
              rows={2}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm"
              placeholder="Ex.: a dificuldade de compreensão é predominantemente de integração/inferência, não de decodificação."
            />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Evidências a favor</span>
            <textarea rows={2} value={evidenciasFavor} onChange={(e) => setEvidenciasFavor(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" />
          </label>
          <label className="text-sm block">
            <span className="text-[var(--ink-2)]">Evidências contra / o que ainda falta verificar</span>
            <textarea rows={2} value={evidenciasContra} onChange={(e) => setEvidenciasContra(e.target.value)} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm" />
          </label>
          {erro && <p className="text-[13px] text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading || !texto.trim()} className="rounded-lg bg-[var(--brand)] text-white px-4 py-2 text-sm disabled:opacity-50">
              {loading ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setAberto(false)} className="rounded-lg border border-black/10 px-4 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {hipoteses.map((h) => (
          <div key={h.id} className="rounded-xl border border-[var(--grid)] bg-[var(--surface-low)] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13.5px] leading-relaxed flex-1">{h.texto}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border ${STATUS_ESTILO[h.status]}`}>{STATUS_LABEL[h.status]}</span>
            </div>
            {(h.evidenciasFavor || h.evidenciasContra) && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                {h.evidenciasFavor && (
                  <p className="text-emerald-700">
                    <span className="font-semibold">A favor:</span> {h.evidenciasFavor}
                  </p>
                )}
                {h.evidenciasContra && (
                  <p className="text-[var(--ink-muted)]">
                    <span className="font-semibold">Contra / falta verificar:</span> {h.evidenciasContra}
                  </p>
                )}
              </div>
            )}
            {h.status === "ativa" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => mudarStatus(h.id, "confirmada")} className="text-[11.5px] rounded-full border border-emerald-200 text-emerald-700 px-3 py-1 hover:bg-emerald-50">
                  Confirmar
                </button>
                <button onClick={() => mudarStatus(h.id, "descartada")} className="text-[11.5px] rounded-full border border-black/10 text-[var(--ink-muted)] px-3 py-1 hover:bg-black/4">
                  Descartar
                </button>
              </div>
            )}
            {h.status !== "ativa" && (
              <button onClick={() => mudarStatus(h.id, "ativa")} className="mt-3 text-[11.5px] text-[var(--ink-muted)] hover:text-[var(--brand)]">
                Reabrir como ativa
              </button>
            )}
          </div>
        ))}
        {hipoteses.length === 0 && <p className="mt-2 text-sm text-[var(--ink-muted)]">Nenhuma hipótese registrada ainda.</p>}
      </div>
    </div>
  );
}
