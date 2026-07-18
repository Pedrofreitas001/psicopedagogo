import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import ClienteForm from "@/components/ClienteForm";
import ResumoEvolucao from "@/components/ResumoEvolucao";
import Historico from "@/components/Historico";
import UploadForm from "@/components/UploadForm";
import ChatAssistente from "@/components/ChatAssistente";

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");

  const { id } = await params;
  const db = getDb();
  const cliente = db
    .prepare("SELECT id, nome, email, objetivo, observacoes, criado_em FROM clients WHERE id = ? AND workspace_id = 1")
    .get(Number(id)) as { id: number; nome: string; email: string; objetivo: string; observacoes: string; criado_em: string } | undefined;
  if (!cliente) notFound();

  const docs = db
    .prepare("SELECT id, nome, tipo, criado_em, enviado_por FROM documents WHERE client_id = ? ORDER BY criado_em DESC")
    .all(cliente.id) as { id: number; nome: string; tipo: string; criado_em: string; enviado_por: string }[];
  const eventos = db
    .prepare("SELECT tipo, descricao, criado_em FROM events WHERE client_id = ? ORDER BY criado_em DESC LIMIT 40")
    .all(cliente.id) as { tipo: string; descricao: string; criado_em: string }[];

  const secao = "rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{cliente.nome}</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
            {cliente.email || "sem email"} · acompanhamento desde {cliente.criado_em.slice(0, 10).split("-").reverse().join("/")}
          </p>
        </div>
        <ClienteForm clienteId={cliente.id} valores={{ nome: cliente.nome, email: cliente.email, objetivo: cliente.objetivo, observacoes: cliente.observacoes }} />
      </div>

      <div className={secao}>
        <h2 className="text-[15px] font-semibold">🎯 Objetivo</h2>
        <p className="mt-2 text-[13.5px] text-[var(--ink-2)] leading-relaxed">{cliente.objetivo || "Ainda não definido."}</p>
        <h2 className="mt-5 text-[15px] font-semibold">📝 Observações</h2>
        <p className="mt-2 text-[13.5px] text-[var(--ink-2)] leading-relaxed whitespace-pre-wrap">{cliente.observacoes || "—"}</p>
      </div>

      <div className={secao}>
        <ResumoEvolucao clienteId={cliente.id} />
      </div>

      <div className={secao}>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">📂 Arquivos</h2>
          <UploadForm clientId={cliente.id} comConteudo={false} />
        </div>
        <div className="mt-3 divide-y divide-black/5">
          {docs.map((d) => (
            <a key={d.id} href={`/api/documentos/${d.id}`} className="flex items-center gap-2.5 py-2.5 text-[13.5px] hover:text-[var(--brand-deep)]">
              <span>{ICONE[d.tipo] ?? "📄"}</span> {d.nome}
              <span className="ml-auto text-[11.5px] text-[var(--ink-muted)]">{d.criado_em.slice(0, 10).split("-").reverse().join("/")}</span>
            </a>
          ))}
          {docs.length === 0 && <p className="py-2 text-sm text-[var(--ink-muted)]">Nenhum arquivo enviado.</p>}
        </div>
      </div>

      <div className={secao}>
        <h2 className="text-[15px] font-semibold">🕰️ Histórico</h2>
        <div className="mt-4">
          <Historico eventos={eventos} />
        </div>
      </div>

      <div className={secao}>
        <h2 className="text-[15px] font-semibold">💬 Conversar no contexto de {cliente.nome.split(" ")[0]}</h2>
        <p className="mt-1 mb-4 text-[12.5px] text-[var(--ink-muted)]">A conversa fica registrada no histórico do cliente.</p>
        <ChatAssistente clienteFixo={cliente.id} />
      </div>
    </div>
  );
}
