import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import UploadForm from "@/components/UploadForm";

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

export default async function DocumentosPage() {
  const user = (await getCurrentUser())!;
  if (user.papel !== "cliente" || !user.clientId) redirect("/");
  const db = getDb();
  const docs = db
    .prepare("SELECT id, nome, tipo, criado_em, enviado_por FROM documents WHERE client_id = ? ORDER BY criado_em DESC")
    .all(user.clientId) as { id: number; nome: string; tipo: string; criado_em: string; enviado_por: string }[];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="mt-1 text-[13.5px] text-[var(--ink-muted)]">Seus arquivos e atividades — visíveis só para você e sua mentora.</p>
        </div>
        <UploadForm clientId={user.clientId} comConteudo={false} />
      </div>
      <div className="mt-6 rounded-2xl border border-black/8 bg-[var(--surface-1)] divide-y divide-black/5">
        {docs.map((d) => (
          <a key={d.id} href={`/api/documentos/${d.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-black/2">
            <span className="text-lg">{ICONE[d.tipo] ?? "📄"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium truncate">{d.nome}</div>
              <div className="text-[11.5px] text-[var(--ink-muted)]">
                enviado por {d.enviado_por || "—"} em {d.criado_em.slice(0, 10).split("-").reverse().join("/")}
              </div>
            </div>
          </a>
        ))}
        {docs.length === 0 && <p className="px-5 py-6 text-sm text-[var(--ink-muted)]">Nenhum arquivo por aqui ainda.</p>}
      </div>
    </div>
  );
}
