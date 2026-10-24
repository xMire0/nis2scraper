import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sessionToken } from "@/lib/session";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ ok: true });
  const key = "shared";
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.until > now && entry.count >= 10)
    return NextResponse.json(
      { error: "For mange forsøg. Prøv igen om 10 minutter." },
      { status: 429 },
    );
  const raw = await request.text();
  if (raw.length > 2000)
    return NextResponse.json({ error: "Ugyldig adgangskode" }, { status: 400 });
  let password = "";
  try {
    password = JSON.parse(raw).password ?? "";
  } catch {}
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(password), Buffer.from(expected))
  ) {
    attempts.set(key, {
      count: entry && entry.until > now ? entry.count + 1 : 1,
      until: entry && entry.until > now ? entry.until : now + 600000,
    });
    return NextResponse.json({ error: "Forkert adgangskode" }, { status: 401 });
  }
  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("nis2-session", await sessionToken(expected), {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 28800,
  });
  return response;
}
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("nis2-session");
  return response;
}
