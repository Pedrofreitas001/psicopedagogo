import { notFound, redirect } from "next/navigation";
import { getClient, listClientDocuments, listClientEvents, listSessionNotes, listClientAssignments } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ClienteForm from "@/components/ClienteForm";
import ResumoEvolucao from "@/components/ResumoEvolucao";
import Historico from "@/components/Historico";
import UploadForm from "@/components/UploadForm";
import ChatAssistente from "@/components/ChatAssistente";
import SessionNotes from "@/components/SessionNotes";
import ProtocolosCliente from "@/components/ProtocolosCliente";

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

  const [docs, eventos, notas, protocolAssignments] = await Promise.all([
    listClientDocuments(cliente.id),
    listClientEvents(cliente.id, 40),
    listSessionNotes(cliente.id),
    listClientAssignments(cliente.id),
  ]);

  const secao = "card rounded-2xl p-6";
  const tituloSecao = "flex items-center gap-2 text-[15px] font-semibold";
  const iconeSecao = "material-symbols-outlined text-[20px] text-[var(--brand)]";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card rounded-2xl p-6 border-t-2 border-[var(--leaf)] flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-[var(--leaf-container)] text-[var(--leaf)] grid place-items-center text-[22px] font-bold shrink-0" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {cliente.nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[22px] font-bold">{cliente.nome}</h1>
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
          <div className="mt-2 flex flex-wrap gap-2">
            {cliente.idade ? (
              <span className="px-3 py-1 bg-[var(--brand)]/10 text-[var(--brand)] rounded-full text-[12px] font-medium">{cliente.idade} anos</span>
            ) : null}
            <span className="px-3 py-1 bg-[var(--leaf-container)]/40 text-[var(--leaf)] rounded-full text-[12px] font-medium">Em acompanhamento</span>
            <span className="px-3 py-1 bg-[var(--surface-high)] text-[var(--ink-2)] rounded-full text-[12px]">
              desde {cliente.criadoEm.slice(0, 10).split("-").reverse().join("/")}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] text-[var(--ink-muted)]">{cliente.email || "sem email"}</p>
        </div>
      </div>

      <div className={secao}>
        <h2 className={`${tituloSecao} mb-4`}><span className={iconeSecao}>badge</span> Ficha</h2>
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
        <ProtocolosCliente clienteId={cliente.id} assignments={protocolAssignments} />
      </div>

      <div className={secao}>
        <div className="flex items-center justify-between">
          <h2 className={tituloSecao}><span className={iconeSecao}>attach_file</span> Arquivos</h2>
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
        <h2 className={tituloSecao}><span className={iconeSecao}>timeline</span> Histórico</h2>
        <div className="mt-4">
          <Historico eventos={eventos} />
        </div>
      </div>

      <div className={secao}>
        <h2 className={tituloSecao}><span className={iconeSecao}>forum</span> Conversar no contexto de {cliente.nome.split(" ")[0]}</h2>
        <p className="mt-1 mb-4 text-[12.5px] text-[var(--ink-muted)]">A conversa fica registrada no histórico do cliente.</p>
        <ChatAssistente clienteFixo={cliente.id} />
      </div>
    </div>
  );
}
