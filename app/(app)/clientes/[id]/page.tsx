import { notFound, redirect } from "next/navigation";
import { getClient, listClientDocuments, listClientEvents, listSessionNotes } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ClienteForm from "@/components/ClienteForm";
import ResumoEvolucao from "@/components/ResumoEvolucao";
import Historico from "@/components/Historico";
import UploadForm from "@/components/UploadForm";
import ChatAssistente from "@/components/ChatAssistente";
import SessionNotes from "@/components/SessionNotes";

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{titulo}</div>
      <div className="mt-0.5 text-[13.5px] text-[var(--ink-1)] leading-relaxed whitespace-pre-wrap">{valor || "—"}</div>
    </div>
  );
}

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");

  const { id } = await params;
  const clientId = Number(id);
  const cliente = await getClient(clientId);
  if (!cliente) notFound();

  const [docs, eventos, notas] = await Promise.all([
    listClientDocuments(cliente.id),
    listClientEvents(cliente.id, 40),
    listSessionNotes(cliente.id),
  ]);

  const secao = "rounded-2xl border border-black/8 bg-[var(--surface-1)] p-6";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {cliente.nome}
            {cliente.idade ? <span className="text-[var(--ink-muted)] font-normal text-lg"> · {cliente.idade} anos</span> : null}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
            {cliente.email || "sem email"} · acompanhamento desde {cliente.criadoEm.slice(0, 10).split("-").reverse().join("/")}
          </p>
        </div>
        <ClienteForm
          clienteId={cliente.id}
          valores={{
            nome: cliente.nome,
            email: cliente.email,
            idade: cliente.idade,
            escolaSerie: cliente.escolaSerie,
            queixaPrincipal: cliente.queixaPrincipal,
            diagnosticoPreliminar: cliente.diagnosticoPreliminar,
            responsavelNome: cliente.responsavelNome,
            responsavelContato: cliente.responsavelContato,
            objetivo: cliente.objetivo,
            observacoes: cliente.observacoes,
          }}
        />
      </div>

      <div className={secao}>
        <h2 className="text-[15px] font-semibold mb-4">📋 Ficha</h2>
        <div className="grid grid-cols-2 gap-4">
          <Campo titulo="Escola / série" valor={cliente.escolaSerie} />
          <Campo titulo="Responsável" valor={[cliente.responsavelNome, cliente.responsavelContato].filter(Boolean).join(" · ")} />
          <div className="col-span-2">
            <Campo titulo="Queixa principal" valor={cliente.queixaPrincipal} />
          </div>
          <div className="col-span-2">
            <Campo titulo="Diagnóstico preliminar" valor={cliente.diagnosticoPreliminar} />
          </div>
          <div className="col-span-2">
            <Campo titulo="Objetivo do acompanhamento" valor={cliente.objetivo} />
          </div>
          <div className="col-span-2">
            <Campo titulo="Observações" valor={cliente.observacoes} />
          </div>
        </div>
      </div>

      <div className={secao}>
        <ResumoEvolucao clienteId={cliente.id} />
      </div>

      <div className={secao}>
        <SessionNotes clienteId={cliente.id} notas={notas} />
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
              <span className="ml-auto text-[11.5px] text-[var(--ink-muted)]">{d.criadoEm.slice(0, 10).split("-").reverse().join("/")}</span>
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
