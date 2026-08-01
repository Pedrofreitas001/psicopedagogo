import Link from "next/link";
import { redirect } from "next/navigation";
import { listParticipantsWithLastEvent, listCasesByParticipant } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ParticipanteForm from "@/components/ParticipanteForm";

export default async function ParticipantesPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");
  const participantes = await listParticipantsWithLastEvent();
  const casosPorParticipante = await Promise.all(participantes.map((p) => listCasesByParticipant(p.id)));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold text-[var(--brand)]">Participantes</h1>
        <ParticipanteForm />
      </div>
      <div className="mt-6 card rounded-2xl divide-y divide-black/5">
        {participantes.map((p, i) => {
          const casos = casosPorParticipante[i];
          const ativos = casos.filter((c) => c.status === "ativo").length;
          return (
            <Link key={p.id} href={`/participantes/${p.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-black/2">
              <div className="h-9 w-9 rounded-full bg-[var(--brand)]/12 text-[var(--brand-deep)] grid place-items-center text-sm font-semibold shrink-0">
                {p.nome.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{p.nome}</div>
                <div className="text-[12.5px] text-[var(--ink-muted)] truncate">{p.estagioMentoria || "Estágio não definido"}</div>
              </div>
              <div className="text-[11.5px] text-[var(--ink-muted)] shrink-0 text-right">
                <div>{casos.length} caso(s) · {ativos} ativo(s)</div>
                <div>{p.ultimoEvento ? `último registro ${p.ultimoEvento.slice(0, 10).split("-").reverse().join("/")}` : "sem registros"}</div>
              </div>
            </Link>
          );
        })}
        {participantes.length === 0 && <p className="px-5 py-6 text-sm text-[var(--ink-muted)]">Cadastre a primeira participante para começar a mentoria.</p>}
      </div>
    </div>
  );
}
