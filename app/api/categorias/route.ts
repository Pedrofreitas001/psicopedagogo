import { NextResponse } from "next/server";
import { getCategory, createCategory } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora organiza a biblioteca." }, { status: 403 });

  const { nome, parentId } = (await req.json()) as { nome?: string; parentId?: number | null };
  if (!nome?.trim()) return NextResponse.json({ error: "Dê um nome à pasta." }, { status: 400 });

  if (parentId && !(await getCategory(parentId))) {
    return NextResponse.json({ error: "Pasta de destino não encontrada." }, { status: 404 });
  }
  const id = await createCategory(nome.trim().slice(0, 60), parentId ?? null);
  return NextResponse.json({ ok: true, id });
}
