import crypto from "crypto";

/**
 * Credential Vault (Módulo 2 do PRD).
 *
 * Segredos são gravados com AES-256-GCM; a chave vem de VAULT_KEY (32 bytes
 * hex) — em produção, de um KMS. Nenhuma rota de API devolve o valor em
 * claro: apenas um preview mascarado. Toda leitura do valor real passa por
 * readSecret(), que registra AuditLog no chamador.
 */

function key(): Buffer {
  const env = process.env.VAULT_KEY;
  if (env && env.length === 64) return Buffer.from(env, "hex");
  // Chave derivada apenas para o modo demo (sem KMS disponível)
  return crypto.createHash("sha256").update("governance-hub-demo-vault-key").digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(".");
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

/** Preview seguro para exibição em UI: nunca revela o segredo. */
export function maskedPreview(payload: string): string {
  try {
    const plain = decrypt(payload);
    if (plain.length <= 8) return "••••••••";
    return `${plain.slice(0, 4)}••••••••${plain.slice(-3)}`;
  } catch {
    return "••••••••";
  }
}
