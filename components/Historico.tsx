const ICONE: Record<string, string> = { conversa: "💬", material: "📚", observacao: "📝", resumo: "✨", sessao: "🗒️", protocolo: "🧩" };

function dataBr(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function Historico({ eventos }: { eventos: { tipo: string; descricao: string; criadoEm: string }[] }) {
  if (eventos.length === 0) {
    return (
      <div className="rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6 text-sm text-[var(--ink-muted)]">
        Ainda não há registros — eles aparecem aqui conforme o acompanhamento acontece.
      </div>
    );
  }
  return (
    <ol className="relative border-l-2 border-[var(--grid)] pl-6 space-y-5">
      {eventos.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[31px] top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--surface-1)] border border-black/10 text-[10px]">
            {ICONE[e.tipo] ?? "•"}
          </span>
          <div className="text-[11.5px] text-[var(--ink-muted)]">{dataBr(e.criadoEm)}</div>
          <div className="text-[13.5px] text-[var(--ink-1)] leading-relaxed">{e.descricao}</div>
        </li>
      ))}
    </ol>
  );
}
