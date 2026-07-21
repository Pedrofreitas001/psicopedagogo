import { NextResponse } from "next/server";
import { createClient, type ClientInput } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora cadastra clientes." }, { status: 403 });

  const body = (await req.json()) as Partial<ClientInput>;
  if (!body.nome?.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });

  const idade = body.idade === null || body.idade === undefined || (body.idade as unknown as string) === "" ? null : Number(body.idade);
  if (idade !== null && (!Number.isInteger(idade) || idade < 0 || idade > 120)) {
    return NextResponse.json({ error: "Idade inválida." }, { status: 400 });
  }

  const id = await createClient({
    nome: body.nome,
    email: body.email ?? "",
    objetivo: body.objetivo ?? "",
    observacoes: body.observacoes ?? "",
    idade,
    diagnosticoPreliminar: body.diagnosticoPreliminar ?? "",
    escolaSerie: body.escolaSerie ?? "",
    responsavelNome: body.responsavelNome ?? "",
    responsavelContato: body.responsavelContato ?? "",
    queixaPrincipal: body.queixaPrincipal ?? "",
  });
  return NextResponse.json({ ok: true, id });
}
