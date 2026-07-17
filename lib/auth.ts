import { cookies } from "next/headers";
import { cache } from "react";
import { getDb, audit, type Role } from "./db";
import { authEnabled, getAuthUser, parseSessionCookie, SESSION_COOKIE } from "./supabase-auth";

/**
 * Usuário atual, em dois modos:
 *
 * AUTENTICADO (SUPABASE_URL + ANON_KEY definidos): a sessão vem do cookie
 * httpOnly e o access token é validado no Supabase a cada request. O
 * usuário é provisionado na tabela `users` no primeiro login:
 *   - email igual ao de um usuário semeado → assume aquele papel;
 *   - primeiro login real do workspace → admin;
 *   - demais → viewer (um admin promove depois).
 * getCurrentUser() retorna null quando não autenticado — páginas
 * redirecionam para /login e APIs respondem 401.
 *
 * DEMO (sem env vars, dev local): seletor de usuário por cookie `uid`.
 */

export type CurrentUser = { id: number; nome: string; email: string; papel: Role };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const db = getDb();
  const store = await cookies();

  if (!authEnabled()) {
    const uid = parseInt(store.get("uid")?.value ?? "1") || 1;
    const user = db.prepare("SELECT id, nome, email, papel FROM users WHERE id = ? AND workspace_id = 1").get(uid) as CurrentUser | undefined;
    return user ?? (db.prepare("SELECT id, nome, email, papel FROM users WHERE id = 1").get() as CurrentUser);
  }

  const session = parseSessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const authUser = await getAuthUser(session.at);
  if (!authUser) return null;

  // Provisionamento: auth_id → email semeado → novo usuário
  let user = db.prepare("SELECT id, nome, email, papel FROM users WHERE auth_id = ? AND workspace_id = 1").get(authUser.id) as CurrentUser | undefined;
  if (!user) {
    const byEmail = db.prepare("SELECT id, nome, email, papel FROM users WHERE lower(email) = lower(?) AND workspace_id = 1").get(authUser.email) as CurrentUser | undefined;
    if (byEmail) {
      db.prepare("UPDATE users SET auth_id = ? WHERE id = ?").run(authUser.id, byEmail.id);
      user = byEmail;
    } else {
      const primeiroReal = !(db.prepare("SELECT 1 FROM users WHERE auth_id IS NOT NULL AND workspace_id = 1 LIMIT 1").get());
      const papel: Role = primeiroReal ? "admin" : "viewer";
      const info = db.prepare("INSERT INTO users (workspace_id, nome, email, papel, auth_id) VALUES (1, ?, ?, ?, ?)").run(
        authUser.nome, authUser.email, papel, authUser.id
      );
      user = { id: Number(info.lastInsertRowid), nome: authUser.nome, email: authUser.email, papel };
      audit(authUser.nome, "auth.provision", authUser.email, `Usuário criado no primeiro login com papel ${papel}.`);
    }
  }
  return user;
});

export function canEdit(papel: Role): boolean {
  return papel === "admin" || papel === "steward";
}
