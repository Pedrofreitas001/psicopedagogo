import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getParticipant, listCasesByParticipant, listParticipantEvents } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ParticipanteForm from "@/components/ParticipanteForm";
import CaseForm from "@/components/CaseForm";
import ResumoEvolucao from "@/components/ResumoEvolucao";
import Historico from "@/components/Historico";

export default async function ParticipantePage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");

  const { id } = await params;
  const participantId = Number(id);
  const participante = await getParticipant(participantId);
  if (!participante) notFound();

  const [casos, eventos] = await Promise.all([listCasesByParticipant(participantId), listParticipantEvents(participantId, 40)]);

  const secao = "card rounded-2xl p-6";
  const tituloSecao = "flex items-center gap-2 text-[15px] font-semibold";
  const iconeSecao = "material-symbols-outlined text-[20px] text-[var(--brand)]";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card rounded-2xl p-6 border-t-2 border-[var(--leaf)] flex items-start gap-5">
        <div
          className="w-16 h-16 rounded-2xl bg-[var(--leaf-container)] text-[var(--leaf)] grid place-items-center text-[22px] font-bold shrink-0"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {participante.nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[22px] font-bold">{participante.nome}</h1>
            <ParticipanteForm
              participanteId={participante.id}
              valores={{
                nome: participante.nome,
                email: participante.email,
                estagioMentoria: participante.estagioMentoria,
                observacoesMentora: participante.observacoesMentora,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {participante.estagioMentoria && (
              <span className="px-3 py-1 bg-[var(--brand)]/10 text-[var(--brand)] rounded-full text-[12px] font-medium">{participante.estagioMentoria}</span>
            )}
            <span className="px-3 py-1 bg-[var(--surface-high)] text-[var(--ink-2)] rounded-full text-[12px]">
              na mentoria desde {participante.criadoEm.slice(0, 10).split("-").reverse().join("/")}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] text-[var(--ink-muted)]">{participante.email || "sem email"}</p>
        </div>
      </div>

      {participante.observacoesMentora && (
        <div className={secao}>
          <h2 className={`${tituloSecao} mb-2`}>
            <span className={iconeSecao}>badge</span> Observações da mentora
          </h2>
          <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed whitespace-pre-wrap">{participante.observacoesMentora}</p>
        </div>
      )}

      <div className={secao}>
        <h2 className={`${tituloSecao} mb-1`}>
          <span className={iconeSecao}>fact_check</span> Resumo pré-encontro
        </h2>
        <p className="mb-4 text-[12.5px] text-[var(--ink-muted)]">
          Hipóteses formadas, pontos frágeis e dúvidas recorrentes em todos os casos ativos — para preparar o próximo encontro da mentoria.
        </p>
        <ResumoEvolucao participantId={participante.id} />
      </div>

      <div className={secao}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={tituloSecao}>
            <span className={iconeSecao}>cases</span> Casos clínicos
          </h2>
          <CaseForm participantId={participante.id} />
        </div>
        <div className="space-y-2">
          {casos.map((c) => (
            <Link
              key={c.id}
              href={`/casos/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-[var(--grid)] bg-[var(--surface-low)] p-4 hover:border-[var(--brand)]/40"
            >
              <div>
                <div className="text-[13.5px] font-medium">
                  {c.nome}
                  {c.idade ? <span className="text-[var(--ink-muted)] font-normal"> · {c.idade} anos</span> : null}
                </div>
                <div className="text-[11.5px] text-[var(--ink-muted)] truncate">{c.queixaPrincipal || c.objetivo || "Sem informações ainda"}</div>
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
          {casos.length === 0 && <p className="text-sm text-[var(--ink-muted)]">Nenhum caso clínico cadastrado ainda.</p>}
        </div>
      </div>

      <div className={secao}>
        <h2 className={`${tituloSecao} mb-4`}>
          <span className={iconeSecao}>timeline</span> Linha do tempo da mentoria
        </h2>
        <Historico eventos={eventos} />
      </div>
    </div>
  );
}
