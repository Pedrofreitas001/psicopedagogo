import Link from "next/link";
import { redirect } from "next/navigation";
import { listParticipantsWithLastEvent, listCasesByParticipant } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ParticipanteForm from "@/components/ParticipanteForm";

function dataBr(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

export default async function ParticipantesPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");
  const participantes = await listParticipantsWithLastEvent();
  const casosPorParticipante = await Promise.all(participantes.map((p) => listCasesByParticipant(p.id)));

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[var(--brand)]">Mentores</h1>
          <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">A evolução de cada mentora: estágio, casos clínicos e hipóteses.</p>
        </div>
        <ParticipanteForm />
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {participantes.map((p, i) => {
          const casos = casosPorParticipante[i];
          const ativos = casos.filter((c) => c.status === "ativo").length;
          return (
            <Link
              key={p.id}
              href={`/participantes/${p.id}`}
              className="card rounded-2xl p-5 flex flex-col gap-4 border-t-2 border-[var(--brand-container)] hover:-translate-y-0.5 transition-transform"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-full bg-[var(--brand)]/12 text-[var(--brand-deep)] grid place-items-center text-[16px] font-semibold shrink-0"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {p.nome.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold truncate">{p.nome}</div>
                  <div className="text-[12px] text-[var(--ink-muted)] truncate">{p.estagioMentoria || "Estágio não definido"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--grid)]">
                <div>
                  <div className="text-[20px] font-bold text-[var(--ink-1)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {casos.length}
                  </div>
                  <div className="text-[11px] text-[var(--ink-muted)]">caso(s)</div>
                </div>
                <div>
                  <div className="text-[20px] font-bold text-[var(--leaf)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {ativos}
                  </div>
                  <div className="text-[11px] text-[var(--ink-muted)]">ativo(s)</div>
                </div>
              </div>

              <div className="text-[11px] text-[var(--ink-muted)]">
                {p.ultimoEvento ? `Último registro em ${dataBr(p.ultimoEvento)}` : "Sem registros ainda"}
              </div>
            </Link>
          );
        })}
        {participantes.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">Cadastre a primeira mentora para começar a mentoria.</p>
        )}
      </div>
    </div>
  );
}
