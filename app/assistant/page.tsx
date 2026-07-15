import { getDb } from "@/lib/db";
import ChatClient from "@/components/ChatClient";

export default function AssistantPage() {
  const db = getDb();
  const agents = db.prepare("SELECT id, nome FROM agents WHERE workspace_id = 1 ORDER BY id").all() as { id: number; nome: string }[];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Assistente</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Pergunte em linguagem natural. No modo automático o Orchestrator escolhe (ou encadeia) os agentes; fixando um agente, ele
          recusa o que estiver fora do seu escopo.
        </p>
      </header>
      <ChatClient agents={agents} />
    </div>
  );
}
