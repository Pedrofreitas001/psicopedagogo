"use client";

import { useState } from "react";

/** Disclaimer sutil: um ícone pequeno ao lado do rótulo do campo que, ao ser
 * clicado, explica para que aquele campo serve. Fica discreto até que alguém
 * precise dele. */
export default function AjudaCampo({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <span className="relative inline-block ml-1 align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setAberto((v) => !v);
        }}
        aria-label="Para que serve este campo"
        className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors ${
          aberto ? "text-[var(--brand)]" : "text-[var(--ink-muted)]/50 hover:text-[var(--brand)]"
        }`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
      </button>
      {aberto && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <span className="absolute left-0 top-5 z-20 block w-60 rounded-lg border border-[var(--grid)] bg-white p-2.5 text-[11.5px] font-normal normal-case leading-relaxed text-[var(--ink-2)] shadow-lg">
            {texto}
          </span>
        </>
      )}
    </span>
  );
}
