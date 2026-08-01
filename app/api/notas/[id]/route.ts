import { NextResponse } from "next/server";
import { deleteCaseNote } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora exclui registros." }, { status: 403 });
  const { id } = await params;
  await deleteCaseNote(Number(id));
  return NextResponse.json({ ok: true });
}
