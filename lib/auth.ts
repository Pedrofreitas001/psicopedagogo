import { cookies } from "next/headers";
import { cache } from "react";
import { getDb, type Role } from "./db";
import { authEnabled, getAuthUser, parseSessionCookie, SESSION_COOKIE } from "./supabase-auth";

/**
 * Usuário atual, em dois modos:
 *
 * AUTENTICADO (SUPABASE_URL + ANON_KEY definidos): sessão em cookie httpOnly,
 * access token validado no Supabase a cada request. Provisionamento no
 * primeiro login:
 *   - email igual ao de um usuário semeado → herda aquele papel;
 *   - email igual ao de um cliente cadastrado pela mentora → entra como
 *     cliente e é vinculado àquele registro;
 *   - primeiro login real do workspace → mentora;
 *   - demais → cliente (com registro de cliente criado automaticamente).
 *
 * DEMO (sem env vars, dev local): seletor de usuário por cookie `uid`.
 */

export type CurrentUser = {
  id: number;
  nome: string;
  email: string;
  papel: Role;
  /** id em `clients` quando o papel é cliente */
  clientId: number | null;
};

function withClientId(user: { id: number; nome: string; email: string; papel: Role }): CurrentUser {
  const db = getDb();
  const client =
    user.papel === "cliente"
      ? (db.prepare("SELECT id FROM clients WHERE user_id = ? AND workspace_id = 1").get(user.id) as { id: number } | undefined)
      : undefined;
  return { ...user, clientId: client?.id ?? null };
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const db = getDb();
  const store = await cookies();

  if (!authEnabled()) {
    const uid = parseInt(store.get("uid")?.value ?? "1") || 1;
    const user =
      (db.prepare("SELECT id, nome, email, papel FROM users WHERE id = ? AND workspace_id = 1").get(uid) as CurrentUser | undefined) ??
      (db.prepare("SELECT id, nome, email, papel FROM users WHERE workspace_id = 1 ORDER BY id LIMIT 1").get() as CurrentUser);
    return withClientId(user);
  }

  const session = parseSessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const authUser = await getAuthUser(session.at);
  if (!authUser) return null;

  // Provisionamento: auth_id → email semeado → cliente cadastrado → novo usuário
  let user = db.prepare("SELECT id, nome, email, papel FROM users WHERE auth_id = ? AND workspace_id = 1").get(authUser.id) as
    | { id: number; nome: string; email: string; papel: Role }
    | undefined;
  if (!user) {
    const byEmail = db
      .prepare("SELECT id, nome, email, papel FROM users WHERE lower(email) = lower(?) AND workspace_id = 1")
      .get(authUser.email) as { id: number; nome: string; email: string; papel: Role } | undefined;
    if (byEmail) {
      db.prepare("UPDATE users SET auth_id = ? WHERE id = ?").run(authUser.id, byEmail.id);
      user = byEmail;
    } else {
      const primeiroReal = !db.prepare("SELECT 1 FROM users WHERE auth_id IS NOT NULL AND workspace_id = 1 LIMIT 1").get();
      const clienteExistente = db
        .prepare("SELECT id FROM clients WHERE lower(email) = lower(?) AND workspace_id = 1")
        .get(authUser.email) as { id: number } | undefined;
      const papel: Role = primeiroReal ? "mentora" : "cliente";
      const info = db
        .prepare("INSERT INTO users (workspace_id, nome, email, papel, auth_id) VALUES (1, ?, ?, ?, ?)")
        .run(authUser.nome, authUser.email, papel, authUser.id);
      const userId = Number(info.lastInsertRowid);
      if (papel === "cliente") {
        if (clienteExistente) {
          db.prepare("UPDATE clients SET user_id = ? WHERE id = ?").run(userId, clienteExistente.id);
        } else {
          db.prepare("INSERT INTO clients (workspace_id, user_id, nome, email) VALUES (1, ?, ?, ?)").run(
            userId, authUser.nome, authUser.email
          );
        }
      }
      user = { id: userId, nome: authUser.nome, email: authUser.email, papel };
    }
  }
  return withClientId(user);
});

/** Garante que o usuário atual é a mentora; lança para uso em rotas de API. */
export function requireMentora(user: CurrentUser | null): asserts user is CurrentUser {
  if (!user || user.papel !== "mentora") {
    throw Object.assign(new Error("Apenas a mentora pode fazer isso."), { status: 403 });
  }
}
