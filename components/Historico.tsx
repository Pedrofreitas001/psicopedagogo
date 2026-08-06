"use client";

import { useState } from "react";

const ICONE: Record<string, string> = {
  conversa: "forum",
  material: "auto_stories",
  observacao: "assignment",
  resumo: "assignment",
  sessao: "history_edu",
  protocolo: "fact_check",
  hipotese: "lightbulb",
};
const PAGINA = 8;

function dataBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Linha do tempo do caso — paginada para não deixar a seção infinita quando o caso acumula muitos registros. */
export default function Historico({ eventos }: { eventos: { tipo: string; descricao: string; criadoEm: string }[] }) {
  const [visiveis, setVisiveis] = useState(PAGINA);

  if (eventos.length === 0) {
    return (
      <div className="card rounded-2xl p-6 text-sm text-[var(--ink-muted)]">
        Ainda não há registros — eles aparecem aqui conforme o acompanhamento acontece.
      </div>
    );
  }

  const pagina = eventos.slice(0, visiveis);

  return (
    <div>
      <ol className="relative border-l-2 border-[var(--grid)] pl-6 space-y-5">
        {pagina.map((e, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[31px] top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--surface-1)] border border-black/10 text-[var(--brand-deep)]">
              {ICONE[e.tipo] ? <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{ICONE[e.tipo]}</span> : <span className="text-[10px]">•</span>}
            </span>
            <div className="text-[11.5px] text-[var(--ink-muted)]">{dataBr(e.criadoEm)}</div>
            <div className="text-[13.5px] text-[var(--ink-1)] leading-relaxed">{e.descricao}</div>
          </li>
        ))}
      </ol>
      {visiveis < eventos.length && (
        <button
          onClick={() => setVisiveis((v) => v + PAGINA)}
          className="mt-4 text-[12.5px] text-[var(--brand-deep)] hover:underline"
        >
          Mostrar mais ({eventos.length - visiveis} restantes)
        </button>
      )}
    </div>
  );
}
