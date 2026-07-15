"use client";

import { useRouter } from "next/navigation";
import type { UISpec } from "@/lib/types";
import SpecRenderer from "./SpecRenderer";

export default function DashboardCard({
  dash,
}: {
  dash: { id: number; titulo: string; descricao: string; spec_json: string; criado_por: string; criado_em: string };
}) {
  const router = useRouter();
  const specs = JSON.parse(dash.spec_json) as UISpec[];

  async function remove() {
    if (!window.confirm(`Excluir o dashboard “${dash.titulo}”?`)) return;
    const res = await fetch(`/api/dashboards/${dash.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Erro ao excluir.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold">{dash.titulo}</h2>
          <p className="text-[12.5px] text-[var(--ink-muted)]">
            {dash.descricao && <>“{dash.descricao}” · </>}salvo por {dash.criado_por} em {dash.criado_em.slice(0, 10).split("-").reverse().join("/")}
          </p>
        </div>
        <button onClick={remove} className="text-[12.5px] text-red-500 hover:underline shrink-0">
          excluir
        </button>
      </div>
      {specs.map((spec, i) => (
        <SpecRenderer key={i} spec={spec} />
      ))}
    </section>
  );
}
