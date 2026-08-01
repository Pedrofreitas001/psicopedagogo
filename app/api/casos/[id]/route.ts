import { NextResponse } from "next/server";
import { getCase, updateCase, updateCaseStatus, logEvent, type ClinicalCaseInput } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

async function podeAcessarCaso(user: { papel: string; participantId: number | null }, caseId: number): Promise<boolean> {
  if (user.papel === "mentora") return true;
  const caso = await getCase(caseId);
  return !!caso && caso.participantId === user.participantId;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const caseId = Number(id);
  if (!(await podeAcessarCaso(user, caseId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const caso = await getCase(caseId);
  if (!caso) return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
  return NextResponse.json(caso);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const caseId = Number(id);
  if (!(await podeAcessarCaso(user, caseId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const atual = await getCase(caseId);
  if (!atual) return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });

  const body = (await req.json()) as Partial<ClinicalCaseInput> & { status?: "ativo" | "encerrado" };

  if (body.status && body.status !== atual.status) {
    await updateCaseStatus(caseId, body.status);
    await logEvent(atual.participantId, caseId, "observacao", `Caso ${atual.nome} marcado como ${body.status === "encerrado" ? "encerrado" : "ativo"}.`);
  }

  if (body.nome !== undefined) {
    if (!body.nome.trim()) return NextResponse.json({ error: "Informe um identificador para o caso." }, { status: 400 });
    const idade = body.idade === null || body.idade === undefined || (body.idade as unknown as string) === "" ? null : Number(body.idade);
    if (idade !== null && (!Number.isInteger(idade) || idade < 0 || idade > 120)) {
      return NextResponse.json({ error: "Idade inválida." }, { status: 400 });
    }
    await updateCase(caseId, {
      nome: body.nome,
      idade,
      diagnosticoPreliminar: body.diagnosticoPreliminar ?? "",
      escolaSerie: body.escolaSerie ?? "",
      responsavelNome: body.responsavelNome ?? "",
      responsavelContato: body.responsavelContato ?? "",
      queixaPrincipal: body.queixaPrincipal ?? "",
      objetivo: body.objetivo ?? "",
      observacoes: body.observacoes ?? "",
    });
  }

  return NextResponse.json({ ok: true });
}
