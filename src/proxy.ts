/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Next.js 16 renomeou o "middleware" para "proxy".
 * Mesma API; arquivo precisa chamar-se proxy.ts e exportar função `proxy`.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = ["/login", "/register", "/api/auth", "/api/webhooks", "/api/asaas", "/api/followups/run"];
  const publicFiles = ["/manifest.json", "/robots.txt", "/sitemap.xml", "/favicon.ico"];
  const isPublicRoute =
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    publicFiles.includes(pathname);

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    // Rotas /api/* devem retornar 401 explícito (não redirect).
    // EventSource/fetch não seguem 3xx para HTML de login, e um redirect
    // num endpoint SSE faz o cliente travar em "loading" sem disparar onerror.
    if (pathname.startsWith("/api/")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)"],
};
