/**
 * Autenticação via Supabase Auth (GoTrue), sem SDK — chamadas REST diretas.
 *
 * Modo AUTENTICADO: quando SUPABASE_URL + SUPABASE_ANON_KEY estão definidos
 * (ex.: nas env vars da Vercel), toda a plataforma exige login. A sessão
 * (access + refresh token) vive num cookie httpOnly; o access token é
 * validado no servidor a cada request via GET /auth/v1/user — nunca
 * confiamos no conteúdo do cookie sem validar.
 *
 * Modo DEMO: sem as env vars, cai no seletor de usuário local (dev).
 */

export const SESSION_COOKIE = "ea_session";

export function supabaseUrl(): string | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

export function supabaseAnonKey(): string | null {
  return process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
}

export function authEnabled(): boolean {
  return !!(supabaseUrl() && supabaseAnonKey());
}

export type Session = { at: string; rt: string; exp: number };
export type AuthUser = { id: string; email: string; nome: string };

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id: string; email?: string; user_metadata?: { nome?: string } };
  error_description?: string;
  msg?: string;
  error?: { message?: string } | string;
};

function headers(): Record<string, string> {
  return { apikey: supabaseAnonKey()!, "Content-Type": "application/json" };
}

function errMsg(data: TokenResponse, fallback: string): string {
  if (typeof data.error === "string") return data.error;
  return data.error_description ?? data.msg ?? data.error?.message ?? fallback;
}

function toSession(data: TokenResponse): Session {
  return {
    at: data.access_token!,
    rt: data.refresh_token ?? "",
    exp: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  };
}

export async function signIn(email: string, password: string): Promise<{ session?: Session; user?: AuthUser; error?: string }> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    return { error: errMsg(data, "Email ou senha inválidos.") };
  }
  return {
    session: toSession(data),
    user: { id: data.user!.id, email: data.user!.email ?? email, nome: data.user!.user_metadata?.nome ?? email.split("@")[0] },
  };
}

export async function signUp(email: string, password: string, nome: string): Promise<{ session?: Session; user?: AuthUser; pendingConfirmation?: boolean; error?: string }> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/signup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password, data: { nome } }),
    cache: "no-store",
  });
  const data = (await res.json()) as TokenResponse & { id?: string; confirmation_sent_at?: string };
  if (!res.ok) return { error: errMsg(data, "Não foi possível criar a conta.") };
  // Projeto com confirmação de email ligada: não vem sessão no signup
  if (!data.access_token) return { pendingConfirmation: true };
  return {
    session: toSession(data),
    user: { id: data.user!.id, email: data.user!.email ?? email, nome },
  };
}

export async function refreshSession(rt: string): Promise<Session | null> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ refresh_token: rt }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as TokenResponse;
  return data.access_token ? toSession(data) : null;
}

/** Valida o access token no GoTrue e retorna o usuário. Fonte de verdade da sessão. */
export async function getAuthUser(at: string): Promise<AuthUser | null> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { ...headers(), Authorization: `Bearer ${at}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id: string; email?: string; user_metadata?: { nome?: string } };
  if (!data.id) return null;
  return { id: data.id, email: data.email ?? "", nome: data.user_metadata?.nome ?? data.email?.split("@")[0] ?? "usuário" };
}

// atob/btoa: disponíveis tanto no runtime Node quanto no Edge (middleware)
export function parseSessionCookie(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const s = JSON.parse(atob(value)) as Session;
    return s.at ? s : null;
  } catch {
    return null;
  }
}

export function serializeSession(s: Session): string {
  return btoa(JSON.stringify(s));
}
