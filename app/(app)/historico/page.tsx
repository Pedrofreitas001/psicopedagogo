import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import Historico from "@/components/Historico";

export default async function HistoricoPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "cliente" || !user.clientId) redirect("/");
  const db = getDb();
  const eventos = db
    .prepare("SELECT tipo, descricao, criado_em FROM events WHERE client_id = ? ORDER BY criado_em DESC LIMIT 60")
    .all(user.clientId) as { tipo: string; descricao: string; criado_em: string }[];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Meu Histórico</h1>
      <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">A linha do tempo do seu acompanhamento — registrada automaticamente.</p>
      <div className="mt-6">
        <Historico eventos={eventos} />
      </div>
    </div>
  );
}
