import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAssignment, getProtocol, getResponses, getClient } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import ProtocolForm from "@/components/ProtocolForm";

export default async function ProtocoloAplicacaoPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const user = (await getCurrentUser())!;
  if (user.papel !== "mentora") redirect("/");

  const { assignmentId } = await params;
  const assignment = await getAssignment(Number(assignmentId));
  if (!assignment) notFound();

  const [protocolo, respostas, cliente] = await Promise.all([
    getProtocol(assignment.protocolId),
    getResponses(assignment.id),
    getClient(assignment.clientId),
  ]);
  if (!protocolo || !cliente) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/clientes/${cliente.id}`} className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-muted)] hover:text-[var(--brand)]">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> {cliente.nome}
        </Link>
        <div className="mt-3 flex items-start gap-4">
          <div className="w-14 h-14 bg-[var(--brand-container)]/15 rounded-2xl flex items-center justify-center text-[var(--brand)] shrink-0">
            <span className="material-symbols-outlined text-[30px]">assignment</span>
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[var(--brand)] leading-tight">{protocolo.nome}</h1>
            <p className="mt-1 text-[13px] text-[var(--ink-2)]">
              <span className="font-semibold text-[var(--leaf)]">{cliente.nome}</span>
              <span className="mx-2 text-[var(--grid)]">•</span>
              v{protocolo.versao} · aplicado em {assignment.dataAplicacao.slice(0, 10).split("-").reverse().join("/")} · por {assignment.criadoPor}
            </p>
            {protocolo.descricao && <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">{protocolo.descricao}</p>}
          </div>
        </div>
      </div>

      <ProtocolForm assignmentId={assignment.id} clientId={cliente.id} protocolo={protocolo} respostasIniciais={respostas} status={assignment.status} />
    </div>
  );
}
