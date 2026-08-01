import { NextResponse } from "next/server";
import { getParticipant, updateParticipant, type ParticipantInput } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora edita participantes." }, { status: 403 });

  const { id } = await params;
  const atual = await getParticipant(Number(id));
  if (!atual) return NextResponse.json({ error: "Participante não encontrada." }, { status: 404 });

  const body = (await req.json()) as Partial<ParticipantInput>;
  if (!body.nome?.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });

  const input: ParticipantInput = {
    nome: body.nome,
    email: body.email ?? "",
    estagioMentoria: body.estagioMentoria ?? "",
    observacoesMentora: body.observacoesMentora ?? "",
  };
  await updateParticipant(atual.id, input);
  return NextResponse.json({ ok: true });
}
