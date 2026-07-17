import { NextResponse, type NextRequest } from "next/server";
import { authEnabled, parseSessionCookie, refreshSession, serializeSession, SESSION_COOKIE } from "@/lib/supabase-auth";

/**
 * Gate de autenticação (roda no Edge). Com Supabase Auth ativo:
 * - sem cookie de sessão → páginas redirecionam a /login, APIs recebem 401;
 * - access token perto de expirar → renova via refresh token e regrava o
 *   cookie, mantendo a sessão viva sem novo login.
 * A validação forte do token (assinatura) acontece no servidor em
 * getCurrentUser() — aqui é só o gate de conveniência.
 */
export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const publico = pathname === "/login" || pathname.startsWith("/api/auth/");
  const session = parseSessionCookie(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (publico) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado. Faça login." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Renova o token se falta menos de 2 minutos para expirar
  if (session.rt && session.exp - Math.floor(Date.now() / 1000) < 120) {
    const nova = await refreshSession(session.rt);
    const res = NextResponse.next();
    if (nova) {
      res.cookies.set(SESSION_COOKIE, serializeSession(nova), { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    } else {
      res.cookies.delete(SESSION_COOKIE);
    }
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
