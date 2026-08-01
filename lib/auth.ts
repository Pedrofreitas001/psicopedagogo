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
  getParticipantByUserId,
  getParticipantByEmail,
  linkParticipantUser,
  createParticipantForUser,
} from "./data";
import { authEnabled, getAuthUser, parseSessionCookie, SESSION_COOKIE } from "./supabase-auth";

/**
 * Usuário atual, em dois modos:
 *
 * AUTENTICADO (SUPABASE_URL + ANON_KEY definidos): sessão em cookie httpOnly,
 * access token validado no Supabase a cada request. Provisionamento no
 * primeiro login:
 *   - email igual ao de um usuário semeado → herda aquele papel;
 *   - email igual ao de uma participante cadastrada pela mentora → entra como
 *     participante e é vinculada àquele registro;
 *   - primeiro login real do workspace → mentora;
 *   - demais → participante (com registro de participante criado automaticamente).
 *
 * DEMO (sem env vars, dev local): seletor de usuário por cookie `uid`.
 */

export type CurrentUser = {
  id: number;
  nome: string;
  email: string;
  papel: Role;
  /** id em `participants` quando o papel é participante */
  participantId: number | null;
};

async function withParticipantId(user: { id: number; nome: string; email: string; papel: Role }): Promise<CurrentUser> {
  const participante = user.papel === "participante" ? await getParticipantByUserId(user.id) : null;
  return { ...user, participantId: participante?.id ?? null };
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();

  if (!authEnabled()) {
    const uid = parseInt(store.get("uid")?.value ?? "1") || 1;
    const user = (await getUserById(uid)) ?? (await getFirstUser());
    if (!user) return null;
    return withParticipantId(user);
  }

  const session = parseSessionCookie(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const authUser = await getAuthUser(session.at);
  if (!authUser) return null;

  // Provisionamento: auth_id → email semeado → participante cadastrada → novo usuário
  let user = await getUserByAuthId(authUser.id);
  if (!user) {
    const byEmail = await getUserByEmail(authUser.email);
    if (byEmail) {
      await setUserAuthId(byEmail.id, authUser.id);
      user = byEmail;
    } else {
      const primeiroReal = !(await hasAnyAuthedUser());
      const participanteExistente = await getParticipantByEmail(authUser.email);
      const papel: Role = primeiroReal ? "mentora" : "participante";
      const userId = await createUser({ nome: authUser.nome, email: authUser.email, papel, authId: authUser.id });
      if (papel === "participante") {
        if (participanteExistente) {
          await linkParticipantUser(participanteExistente.id, userId);
        } else {
          await createParticipantForUser({ userId, nome: authUser.nome, email: authUser.email });
        }
      }
      user = { id: userId, nome: authUser.nome, email: authUser.email, papel };
    }
  }
  return withParticipantId(user);
});

/** Garante que o usuário atual é a mentora; lança para uso em rotas de API. */
export function requireMentora(user: CurrentUser | null): asserts user is CurrentUser {
  if (!user || user.papel !== "mentora") {
    throw Object.assign(new Error("Apenas a mentora pode fazer isso."), { status: 403 });
  }
}
