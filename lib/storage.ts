import fs from "fs";
import path from "path";
import { uploadsDir } from "./db";
import { supabaseUrl } from "./supabase-auth";

/**
 * Armazenamento de arquivos.
 *
 * Com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY definidos, os arquivos vão para
 * o bucket `documentos` do Supabase Storage (chamadas REST diretas, sem SDK) e
 * o download usa URL assinada. Sem as env vars, salvamos em data/uploads
 * (fallback /tmp na Vercel) — suficiente para o modo demo.
 */

const BUCKET = "documentos";

function serviceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function storageEnabled(): boolean {
  return !!(supabaseUrl() && serviceKey());
}

function sanitize(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/** Salva o arquivo e retorna o caminho a registrar em documents.storage_path. */
export async function salvarArquivo(nome: string, dados: Buffer): Promise<string> {
  const objeto = `${Date.now()}-${sanitize(nome)}`;
  if (storageEnabled()) {
    const res = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${objeto}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey()}`,
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Uint8Array(dados),
    });
    if (!res.ok) throw new Error(`Falha no upload para o Supabase Storage (${res.status}).`);
    return `supabase:${objeto}`;
  }
  const destino = path.join(uploadsDir(), objeto);
  fs.writeFileSync(destino, dados);
  return `local:${objeto}`;
}

/** URL assinada (Supabase) ou null quando o arquivo é local — nesse caso use lerArquivoLocal. */
export async function urlDeDownload(storagePath: string): Promise<string | null> {
  if (!storagePath.startsWith("supabase:")) return null;
  const objeto = storagePath.slice("supabase:".length);
  const res = await fetch(`${supabaseUrl()}/storage/v1/object/sign/${BUCKET}/${objeto}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!res.ok) throw new Error(`Falha ao assinar URL (${res.status}).`);
  const data = (await res.json()) as { signedURL: string };
  return `${supabaseUrl()}${data.signedURL.startsWith("/storage") ? "" : "/storage/v1"}${data.signedURL}`;
}

export function lerArquivoLocal(storagePath: string): Buffer | null {
  if (!storagePath.startsWith("local:")) return null;
  const arquivo = path.join(uploadsDir(), path.basename(storagePath.slice("local:".length)));
  return fs.existsSync(arquivo) ? fs.readFileSync(arquivo) : null;
}
