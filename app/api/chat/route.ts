import { NextResponse } from "next/server";
import { executeQuestion } from "@/lib/engine";

export async function POST(req: Request) {
  const body = await req.json();
  const question = String(body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Pergunta vazia" }, { status: 400 });
  const agentId = body.agentId ? Number(body.agentId) : undefined;
  return NextResponse.json(executeQuestion(question, agentId));
}
