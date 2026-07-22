import { NextResponse } from "next/server";
import { syncBuiltinProtocols, listProtocolSummaries } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora acessa os protocolos." }, { status: 403 });
  await syncBuiltinProtocols();
  return NextResponse.json(await listProtocolSummaries());
}
