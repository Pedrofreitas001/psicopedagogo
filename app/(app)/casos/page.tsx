import Link from "next/link";
import { redirect } from "next/navigation";
import { listCasesByParticipant } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import CaseForm from "@/components/CaseForm";

export default async function MeusCasosPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "participante" || !user.participantId) redirect("/");
  const casos = await listCasesByParticipant(user.participantId);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-[var(--brand)]">Meus Casos</h1>
          <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">Os casos clínicos que você está analisando na mentoria.</p>
        </div>
        <CaseForm participantId={user.participantId} />
      </div>
      <div className="mt-6 card rounded-2xl divide-y divide-black/5">
        {casos.map((c) => (
          <Link key={c.id} href={`/casos/${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-black/2">
            <div className="h-9 w-9 rounded-full bg-[var(--brand)]/12 text-[var(--brand-deep)] grid place-items-center text-sm font-semibold shrink-0">
              {c.nome.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                {c.nome}
                {c.idade ? <span className="text-[var(--ink-muted)] font-normal"> · {c.idade} anos</span> : null}
              </div>
              <div className="text-[12.5px] text-[var(--ink-muted)] truncate">{c.queixaPrincipal || c.objetivo || "Sem informações ainda"}</div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                c.status === "ativo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-black/4 text-[var(--ink-muted)] border-black/10"
              }`}
            >
              {c.status === "ativo" ? "Ativo" : "Encerrado"}
            </span>
          </Link>
        ))}
        {casos.length === 0 && <p className="px-5 py-6 text-sm text-[var(--ink-muted)]">Cadastre o primeiro caso clínico para começar a analisar com o agente.</p>}
      </div>
    </div>
  );
}
