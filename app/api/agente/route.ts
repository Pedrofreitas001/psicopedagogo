import { NextResponse } from "next/server";
import { getAgentSettings, updateAgentSettings, type AgentSettings } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora vê o escopo do assistente." }, { status: 403 });
  return NextResponse.json(await getAgentSettings());
}

const TONS = new Set(["acolhedor", "formal", "direto"]);

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora configura o assistente." }, { status: 403 });

  const body = (await req.json()) as Partial<AgentSettings>;
  if (body.tom && !TONS.has(body.tom)) return NextResponse.json({ error: "Tom inválido." }, { status: 400 });

  const atual = await getAgentSettings();
  const novo: AgentSettings = {
    usaBiblioteca: body.usaBiblioteca ?? atual.usaBiblioteca,
    usaMetodologia: body.usaMetodologia ?? atual.usaMetodologia,
    usaHistorico: body.usaHistorico ?? atual.usaHistorico,
    usaProntuario: body.usaProntuario ?? atual.usaProntuario,
    usaProtocolos: body.usaProtocolos ?? atual.usaProtocolos,
    instrucoesExtra: (body.instrucoesExtra ?? atual.instrucoesExtra).slice(0, 2000),
    tom: (body.tom as AgentSettings["tom"]) ?? atual.tom,
    modelo: (body.modelo ?? atual.modelo).slice(0, 200),
  };
  await updateAgentSettings(novo);
  return NextResponse.json({ ok: true });
}
