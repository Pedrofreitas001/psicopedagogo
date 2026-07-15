import { cookies } from "next/headers";
import { getDb, type Role } from "./db";

/**
 * Autenticação simplificada do MVP: o usuário atual vem de um cookie e pode
 * ser trocado pelo seletor na sidebar, para demonstrar o RBAC (admin /
 * steward / viewer) sem depender de um provedor externo. Em produção:
 * Auth.js/Clerk multi-tenant, conforme seção 2 do PRD.
 */

export type CurrentUser = { id: number; nome: string; email: string; papel: Role };

export async function getCurrentUser(): Promise<CurrentUser> {
  const store = await cookies();
  const uid = parseInt(store.get("uid")?.value ?? "1") || 1;
  const db = getDb();
  const user = db.prepare("SELECT id, nome, email, papel FROM users WHERE id = ? AND workspace_id = 1").get(uid) as CurrentUser | undefined;
  return user ?? (db.prepare("SELECT id, nome, email, papel FROM users WHERE id = 1").get() as CurrentUser);
}

export function canEdit(papel: Role): boolean {
  return papel === "admin" || papel === "steward";
}
