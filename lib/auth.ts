import { cookies } from "next/headers";
import { cache } from "react";
import {
  type Role,
  getUserById,
  getFirstUser,
  getUserByAuthId,
  getUserByEmail,
  setUserAuthId,
  hasAnyAuthedUser,
  createUser,
  getClientByUserId,
  getClientByEmail,
  linkClientUser,
  createClientForUser,
} from "./data";
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

async function withClientId(user: { id: number; nome: string; email: string; papel: Role }): Promise<CurrentUser> {
  const client = user.papel === "cliente" ? await getClientByUserId(user.id) : null;
  return { ...user, clientId: client?.id ?? null };
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();

  if (!authEnabled()) {
    const uid = parseInt(store.get("uid")?.value ?? "1") || 1;
    const user = (await getUserById(uid)) ?? (await getFirstUser());
    if (!user) return null;
    return withClientId(user);
  }

  const session = parseSessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const authUser = await getAuthUser(session.at);
  if (!authUser) return null;

  // Provisionamento: auth_id → email semeado → cliente cadastrado → novo usuário
  let user = await getUserByAuthId(authUser.id);
  if (!user) {
    const byEmail = await getUserByEmail(authUser.email);
    if (byEmail) {
      await setUserAuthId(byEmail.id, authUser.id);
      user = byEmail;
    } else {
      const primeiroReal = !(await hasAnyAuthedUser());
      const clienteExistente = await getClientByEmail(authUser.email);
      const papel: Role = primeiroReal ? "mentora" : "cliente";
      const userId = await createUser({ nome: authUser.nome, email: authUser.email, papel, authId: authUser.id });
      if (papel === "cliente") {
        if (clienteExistente) {
          await linkClientUser(clienteExistente.id, userId);
        } else {
          await createClientForUser({ userId, nome: authUser.nome, email: authUser.email });
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
