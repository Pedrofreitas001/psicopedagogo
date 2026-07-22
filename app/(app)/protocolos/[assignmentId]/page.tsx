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
        <Link href={`/clientes/${cliente.id}`} className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--brand-deep)]">
          ← {cliente.nome}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{protocolo.nome}</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
          v{protocolo.versao} · aplicado em {assignment.dataAplicacao.slice(0, 10).split("-").reverse().join("/")} · por {assignment.criadoPor}
        </p>
        {protocolo.descricao && <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">{protocolo.descricao}</p>}
      </div>

      <ProtocolForm assignmentId={assignment.id} clientId={cliente.id} protocolo={protocolo} respostasIniciais={respostas} status={assignment.status} />
    </div>
  );
}
