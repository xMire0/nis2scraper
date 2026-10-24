type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = ORDER[(process.env.LOG_LEVEL as Level) ?? "info"] ?? 20;

function emit(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < MIN) return;
  const line = { ts: new Date().toISOString(), level, scope, message, ...meta };
  // Structured single-line JSON: greps cleanly in Vercel/Supabase log drains.
  const out = level === "error" || level === "warn" ? console.error : console.log;
  out(JSON.stringify(line));
}

export function createLogger(scope: string) {
  return {
    debug: (m: string, meta?: Record<string, unknown>) => emit("debug", scope, m, meta),
    info: (m: string, meta?: Record<string, unknown>) => emit("info", scope, m, meta),
    warn: (m: string, meta?: Record<string, unknown>) => emit("warn", scope, m, meta),
    error: (m: string, meta?: Record<string, unknown>) => emit("error", scope, m, meta),
    child: (sub: string) => createLogger(`${scope}:${sub}`),
  };
}

export type Logger = ReturnType<typeof createLogger>;
