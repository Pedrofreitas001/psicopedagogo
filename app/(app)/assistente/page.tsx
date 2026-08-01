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
      : ["Como conduzir uma participante que ainda não sabe organizar os dados do caso?", "O que o protocolo espera na etapa de hipóteses?"];

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
    <div>
      <h1 className="text-[26px] font-bold text-[var(--brand)]">Mentor Clínico</h1>
      <p className="mt-1 mb-6 text-[13.5px] text-[var(--ink-muted)]">
        Conduz o raciocínio clínico por perguntas — com base no protocolo, nas hipóteses e no histórico de cada caso.
      </p>
      <ChatAssistente casos={casos} permiteGeral={permiteGeral} sugestoes={sugestoes} />
    </div>
  );
}
