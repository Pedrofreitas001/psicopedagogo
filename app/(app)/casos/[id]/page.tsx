import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  getCase,
  getParticipant,
  listCaseDocuments,
  listCaseEvents,
  listCaseNotes,
  listCaseAssignments,
  listHypotheses,
} from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import CaseForm from "@/components/CaseForm";
import CaseNotes from "@/components/CaseNotes";
import ProtocolosCaso from "@/components/ProtocolosCaso";
import HipotesesCaso from "@/components/HipotesesCaso";
import Historico from "@/components/Historico";
import UploadForm from "@/components/UploadForm";
import ChatAssistente from "@/components/ChatAssistente";

const ICONE: Record<string, string> = { pdf: "📕", docx: "📘", doc: "📘", pptx: "📙", ppt: "📙", xlsx: "📗", xls: "📗" };

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{titulo}</div>
      <div className="mt-0.5 text-[13.5px] text-[var(--ink-1)] leading-relaxed whitespace-pre-wrap">{valor || "—"}</div>
    </div>
  );
}

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const caseId = Number(id);
  const caso = await getCase(caseId);
  if (!caso) notFound();
  if (user.papel !== "mentora" && user.participantId !== caso.participantId) redirect("/");

  const [participante, docs, eventos, notas, assignments, hipoteses] = await Promise.all([
    getParticipant(caso.participantId),
    listCaseDocuments(caso.id),
    listCaseEvents(caso.id, 40),
    listCaseNotes(caso.id),
    listCaseAssignments(caso.id),
    listHypotheses(caso.id),
  ]);

  const secao = "card rounded-2xl p-6";
  const tituloSecao = "flex items-center gap-2 text-[15px] font-semibold";
  const iconeSecao = "material-symbols-outlined text-[20px] text-[var(--brand)]";

  return (
    <div className="max-w-3xl space-y-6">
      {participante && user.papel === "mentora" && (
        <Link href={`/participantes/${participante.id}`} className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-muted)] hover:text-[var(--brand)]">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> {participante.nome}
        </Link>
      )}

      <div className="card rounded-2xl p-6 border-t-2 border-[var(--brand)] flex items-start gap-5">
        <div
          className="w-16 h-16 rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] grid place-items-center text-[22px] font-bold shrink-0"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {caso.nome.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[22px] font-bold">{caso.nome}</h1>
            <CaseForm
              caseId={caso.id}
              valores={{
                nome: caso.nome,
                idade: caso.idade,
                escolaSerie: caso.escolaSerie,
                queixaPrincipal: caso.queixaPrincipal,
                diagnosticoPreliminar: caso.diagnosticoPreliminar,
                responsavelNome: caso.responsavelNome,
                responsavelContato: caso.responsavelContato,
                objetivo: caso.objetivo,
                observacoes: caso.observacoes,
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {caso.idade ? <span className="px-3 py-1 bg-[var(--brand)]/10 text-[var(--brand)] rounded-full text-[12px] font-medium">{caso.idade} anos</span> : null}
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                caso.status === "ativo" ? "bg-[var(--leaf-container)]/40 text-[var(--leaf)]" : "bg-[var(--surface-high)] text-[var(--ink-2)]"
              }`}
            >
              {caso.status === "ativo" ? "Ativo" : "Encerrado"}
            </span>
            {participante && <span className="px-3 py-1 bg-[var(--surface-high)] text-[var(--ink-2)] rounded-full text-[12px]">acompanhado por {participante.nome}</span>}
          </div>
        </div>
      </div>

      <div className={secao}>
        <h2 className={`${tituloSecao} mb-4`}>
          <span className={iconeSecao}>badge</span> Ficha
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Campo titulo="Escola / série" valor={caso.escolaSerie} />
          <Campo titulo="Responsável" valor={[caso.responsavelNome, caso.responsavelContato].filter(Boolean).join(" · ")} />
          <div className="col-span-2">
            <Campo titulo="Queixa principal" valor={caso.queixaPrincipal} />
          </div>
          <div className="col-span-2">
            <Campo titulo="Diagnóstico preliminar" valor={caso.diagnosticoPreliminar} />
          </div>
          <div className="col-span-2">
            <Campo titulo="Objetivo da análise" valor={caso.objetivo} />
          </div>
          <div className="col-span-2">
            <Campo titulo="Observações" valor={caso.observacoes} />
          </div>
        </div>
      </div>

      <div className={secao}>
        <HipotesesCaso caseId={caso.id} hipoteses={hipoteses} />
      </div>

      <div className={secao}>
        <ProtocolosCaso caseId={caso.id} assignments={assignments} />
      </div>

      <div className={secao}>
        <CaseNotes caseId={caso.id} notas={notas} />
      </div>

      <div className={secao}>
        <div className="flex items-center justify-between">
          <h2 className={tituloSecao}>
            <span className={iconeSecao}>attach_file</span> Arquivos
          </h2>
          <UploadForm caseId={caso.id} comConteudo={false} />
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
        <h2 className={`${tituloSecao} mb-4`}>
          <span className={iconeSecao}>timeline</span> Linha do tempo do caso
        </h2>
        <Historico eventos={eventos} />
      </div>

      <div className={secao}>
        <h2 className={tituloSecao}>
          <span className={iconeSecao}>forum</span> Raciocinar sobre {caso.nome}
        </h2>
        <p className="mt-1 mb-4 text-[12.5px] text-[var(--ink-muted)]">A conversa fica registrada na linha do tempo deste caso.</p>
        <ChatAssistente casoFixo={caso.id} />
      </div>
    </div>
  );
}
