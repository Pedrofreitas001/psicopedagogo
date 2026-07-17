import Link from "next/link";
import { getDb } from "@/lib/db";
import DashboardCard from "@/components/DashboardCard";

export default function DashboardsPage() {
  const db = getDb();
  const dashboards = db.prepare("SELECT * FROM dashboards WHERE workspace_id = 1 ORDER BY id DESC").all() as {
    id: number; titulo: string; descricao: string; spec_json: string; criado_por: string; criado_em: string;
  }[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboards</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Visualizações geradas pelos agentes e salvas como spec JSON — o Dynamic UI Engine as renderiza de forma idêntica a qualquer momento.
        </p>
      </header>

      {dashboards.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-[var(--ink-muted)]">
          Nenhum dashboard salvo ainda. Faça uma pergunta no{" "}
          <Link href="/assistant" className="text-[var(--brand)] hover:underline">Assistente</Link> e clique em “Salvar como dashboard”.
        </div>
      )}

      <div className="space-y-10">
        {dashboards.map((d) => (
          <DashboardCard key={d.id} dash={d} />
        ))}
      </div>
    </div>
  );
}
