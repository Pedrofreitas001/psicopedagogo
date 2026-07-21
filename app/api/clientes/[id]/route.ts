import { NextResponse } from "next/server";
import { getClient, updateClient, logEvent, type ClientInput } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora edita clientes." }, { status: 403 });

  const { id } = await params;
  const atual = await getClient(Number(id));
  if (!atual) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const body = (await req.json()) as Partial<ClientInput>;
  if (!body.nome?.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });

  const idade = body.idade === null || body.idade === undefined || (body.idade as unknown as string) === "" ? null : Number(body.idade);
  if (idade !== null && (!Number.isInteger(idade) || idade < 0 || idade > 120)) {
    return NextResponse.json({ error: "Idade inválida." }, { status: 400 });
  }

  const input: ClientInput = {
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
  };
  await updateClient(atual.id, input);
  if (input.observacoes !== atual.observacoes) {
    await logEvent(atual.id, "observacao", "Mentora atualizou as observações do acompanhamento.");
  }
  return NextResponse.json({ ok: true });
}
