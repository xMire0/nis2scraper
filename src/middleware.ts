import { NextRequest, NextResponse } from "next/server";
import { sessionToken } from "./lib/session";
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/leads") || path.startsWith("/api/prospecting"))
    return NextResponse.json(
      {
        error: "Denne tidligere scoping-API er erstattet af /api/intelligence.",
      },
      { status: 410 },
    );
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    let validOrigin = false;
    try {
      validOrigin = Boolean(
        origin &&
        new URL(origin).host === request.headers.get("host") &&
        new URL(origin).protocol === request.nextUrl.protocol,
      );
    } catch {
      /* A malformed or opaque origin must fail closed. */
    }
    if (!validOrigin)
      return NextResponse.json({ error: "Ugyldig origin" }, { status: 403 });
  }
  const password = process.env.APP_PASSWORD;
  if (!password) {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(
      (request.headers.get("host") ?? "").replace(/:\d+$/, ""),
    );
    if (process.env.NODE_ENV === "production" || !local)
      return NextResponse.json(
        { error: "Sæt APP_PASSWORD før brug uden for lokal udvikling." },
        { status: 503 },
      );
    return NextResponse.next();
  }
  if (path === "/login" || path === "/api/session") return NextResponse.next();
  if (
    request.cookies.get("nis2-session")?.value ===
    (await sessionToken(password))
  )
    return NextResponse.next();
  return path.startsWith("/api/")
    ? NextResponse.json({ error: "Log ind for at fortsætte" }, { status: 401 })
    : NextResponse.redirect(new URL("/login", request.url));
}
export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*", "/login"],
};
