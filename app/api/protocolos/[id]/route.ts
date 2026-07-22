import { NextResponse } from "next/server";
import { getProtocol } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora acessa os protocolos." }, { status: 403 });
  const { id } = await params;
  const protocolo = await getProtocol(Number(id));
  if (!protocolo) return NextResponse.json({ error: "Protocolo não encontrado." }, { status: 404 });
  return NextResponse.json(protocolo);
}
