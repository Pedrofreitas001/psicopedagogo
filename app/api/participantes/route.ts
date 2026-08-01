import { NextResponse } from "next/server";
import { createParticipant, type ParticipantInput } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora cadastra participantes." }, { status: 403 });

  const body = (await req.json()) as Partial<ParticipantInput>;
  if (!body.nome?.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });

  const id = await createParticipant({
    nome: body.nome,
    email: body.email ?? "",
    estagioMentoria: body.estagioMentoria ?? "",
    observacoesMentora: body.observacoesMentora ?? "",
  });
  return NextResponse.json({ ok: true, id });
}
