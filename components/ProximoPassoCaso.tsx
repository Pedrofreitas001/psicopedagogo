"use client";

import type { EtapaCaso } from "@/lib/metodologia";

const TOTAL_ETAPAS = 6;

/** Card fixo no topo do caso: mostra a etapa do método e dispara o mentor de
 * IA já com a pergunta certa — o agente "fala primeiro" em vez de esperar a
 * participante escrever. Ver evento "iniciar-mentor" em ChatAssistente. */
export default function ProximoPassoCaso({ etapa }: { etapa: EtapaCaso }) {
  function continuarComMentor() {
    window.dispatchEvent(new CustomEvent("iniciar-mentor", { detail: { pergunta: etapa.pergunta } }));
    document.getElementById("mentor-caso")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="card rounded-2xl p-6 border-l-4 border-[var(--brand)]">
      <div className="flex items-center gap-1.5 mb-2">
        {Array.from({ length: TOTAL_ETAPAS }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${n <= etapa.numero ? "bg-[var(--brand)]" : "bg-[var(--surface-high)]"}`}
          />
        ))}
      </div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--brand)]">
            {etapa.concluido ? "Onde este caso está" : `Próximo passo · ${etapa.titulo}`}
          </p>
          <p className="mt-1 text-[14.5px] text-[var(--ink-1)]">{etapa.proximoPasso}</p>
          <p className="mt-1 text-[12px] text-[var(--ink-muted)]">{etapa.descricao}</p>
        </div>
        <button
          onClick={continuarComMentor}
          className="shrink-0 inline-flex items-center gap-1.5 bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white rounded-full px-4 py-2.5 text-[13px] font-medium shadow-md transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">psychology</span>
          Continuar com o mentor
        </button>
      </div>
    </div>
  );
}
