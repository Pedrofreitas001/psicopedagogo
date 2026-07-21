import { listClients } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ChatAssistente from "@/components/ChatAssistente";

export default async function AssistentePage() {
  const user = (await getCurrentUser())!;

  const sugestoes =
    user.papel === "cliente"
      ? ["Como posso treinar leitura em casa?", "O que é leitura pareada?", "Como montar minha rotina de estudos?"]
      : ["Qual o protocolo de fluência de leitura?", "Como trabalhar consciência fonológica?", "O que a metodologia diz sobre rotina de estudos?"];

  const clientes = user.papel === "mentora" ? (await listClients()).map((c) => ({ id: c.id, nome: c.nome })) : undefined;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Assistente de Estudos</h1>
      <p className="mt-1 mb-6 text-[13.5px] text-[var(--ink-muted)]">
        Responde com base nos materiais e na metodologia da mentora — e no seu acompanhamento.
      </p>
      <ChatAssistente clientes={clientes} clienteFixo={user.papel === "cliente" ? user.clientId ?? undefined : undefined} sugestoes={sugestoes} />
    </div>
  );
}
