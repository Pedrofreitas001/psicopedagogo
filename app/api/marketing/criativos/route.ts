import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { gerarCriativos, type CreativeInput } from "@/lib/creative";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const body = await req.json();
  const db = getDb();
  const produto = db.prepare("SELECT nome, categoria, preco FROM vtex_products WHERE id = ?").get(Number(body.produtoId)) as
    | { nome: string; categoria: string; preco: number }
    | undefined;
  if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const input: CreativeInput = {
    produto,
    canal: body.canal ?? "meta",
    objetivo: body.objetivo ?? "conversão",
    tom: body.tom ?? "profissional",
  };
  const variantes = gerarCriativos(input);
  audit(user.nome, "marketing.criativo", produto.nome, `3 variações geradas (${input.canal}, ${input.objetivo}, tom ${input.tom}).`);
  return NextResponse.json({ variantes });
}
