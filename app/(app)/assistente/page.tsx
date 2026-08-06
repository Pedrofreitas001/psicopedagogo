import { listParticipants, listCasesByParticipant } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ChatAssistente from "@/components/ChatAssistente";

export default async function AssistentePage() {
  const user = (await getCurrentUser())!;

  const sugestoes =
    user.papel === "participante"
      ? [
          "Quais dados eu já tenho sobre este caso?",
          "Como eu decido entre hipótese de decodificação e de compreensão?",
          "Que evidências ainda preciso coletar?",
        ]
      : ["Como conduzir uma mentora que ainda não sabe organizar os dados do caso?", "O que o protocolo espera na etapa de hipóteses?"];

  let casos: { id: number; nome: string }[] = [];
  let permiteGeral = false;

  if (user.papel === "mentora") {
    const participantes = await listParticipants();
    const listas = await Promise.all(participantes.map((p) => listCasesByParticipant(p.id)));
    casos = listas.flatMap((lista, i) => lista.map((c) => ({ id: c.id, nome: `${c.nome} — ${participantes[i].nome}` })));
  } else if (user.participantId) {
    const meusCasos = await listCasesByParticipant(user.participantId);
    casos = meusCasos.map((c) => ({ id: c.id, nome: c.nome }));
    permiteGeral = true;
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--surface-1)] rounded-2xl border border-[var(--grid)] shadow-[var(--card-shadow)] overflow-hidden">
      <div className="shrink-0 flex items-center gap-3 px-5 md:px-8 py-4 border-b border-[var(--grid)] bg-[var(--surface-1)]">
        <div className="w-10 h-10 rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] grid place-items-center shrink-0">
          <span className="material-symbols-outlined fill-icon text-[22px]">psychology</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold text-[var(--brand)] leading-tight">Mentor Clínico</h1>
          <p className="text-[12.5px] text-[var(--ink-muted)] truncate">
            Conduz o raciocínio clínico por perguntas — com base no protocolo, nas hipóteses e no histórico de cada caso.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex justify-center bg-[var(--surface-1)] overflow-hidden">
        <div className="w-full max-w-4xl h-full min-h-0 px-5 md:px-8 py-5 flex flex-col">
          <ChatAssistente casos={casos} permiteGeral={permiteGeral} sugestoes={sugestoes} alturaFixa />
        </div>
      </div>
    </div>
  );
}
