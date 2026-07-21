import { NextResponse } from "next/server";
import { deleteSessionNote } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora exclui notas de sessão." }, { status: 403 });
  const { id } = await params;
  await deleteSessionNote(Number(id));
  return NextResponse.json({ ok: true });
}
