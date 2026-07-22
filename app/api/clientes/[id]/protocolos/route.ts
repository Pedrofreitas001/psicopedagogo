import { NextResponse } from "next/server";
import { getClient, getProtocol, createAssignment, listClientAssignments, logEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora acessa os protocolos." }, { status: 403 });
  const { id } = await params;
  return NextResponse.json(await listClientAssignments(Number(id)));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora associa protocolos." }, { status: 403 });

  const { id } = await params;
  const clientId = Number(id);
  const cliente = await getClient(clientId);
  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const { protocolId, dataAplicacao } = (await req.json()) as { protocolId?: number; dataAplicacao?: string };
  if (!protocolId) return NextResponse.json({ error: "Selecione um protocolo." }, { status: 400 });
  const protocolo = await getProtocol(Number(protocolId));
  if (!protocolo) return NextResponse.json({ error: "Protocolo não encontrado." }, { status: 404 });

  const data = dataAplicacao?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const assignmentId = await createAssignment({ clientId, protocolId: protocolo.id, dataAplicacao: data, criadoPor: user.nome });
  await logEvent(clientId, "protocolo", `Mentora associou o protocolo “${protocolo.nome}” (${data.split("-").reverse().join("/")}).`);
  return NextResponse.json({ ok: true, id: assignmentId });
}
