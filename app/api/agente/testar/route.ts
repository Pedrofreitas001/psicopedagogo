import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { testarConexaoIA } from "@/lib/assistente";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora testa a conexão." }, { status: 403 });

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY não está definida nas variáveis de ambiente." });
  }
  const resultado = await testarConexaoIA();
  return NextResponse.json(resultado);
}
