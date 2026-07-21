import { NextResponse } from "next/server";
import { getCategory, countChildCategories, countDocsInCategory, deleteCategory } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora organiza a biblioteca." }, { status: 403 });

  const { id } = await params;
  const categoriaId = Number(id);
  const cat = await getCategory(categoriaId);
  if (!cat) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });

  const [filhas, docs] = await Promise.all([countChildCategories(categoriaId), countDocsInCategory(categoriaId)]);
  if (filhas > 0 || docs > 0) {
    return NextResponse.json({ error: "A pasta não está vazia. Mova ou exclua as subpastas e os arquivos primeiro." }, { status: 400 });
  }
  await deleteCategory(categoriaId);
  return NextResponse.json({ ok: true });
}
