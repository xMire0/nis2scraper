import { z } from "zod";

/**
 * Fail-fast environment parsing.
 *
 * Server-only. Importing this from a client component is a build error by
 * design — none of these values may ever reach the browser.
 */
const numeric = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().finite());

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v === undefined || v === "" ? fallback : v.toLowerCase() === "true",
    );

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  CVR_API_USERNAME: z.string().optional().default(""),
  CVR_API_PASSWORD: z.string().optional().default(""),
  CVR_API_KEY: z.string().optional().default(""),
  CVR_API_BASE: z
    .string()
    .url()
    .default("http://distribution.virk.dk/cvr-permanent"),
  REGNSKAB_API_BASE: z
    .string()
    .url()
    .default("http://distribution.virk.dk/offentliggoerelser"),
  CVR_REQUESTS_PER_SECOND: numeric(4),

  ENRICHMENT_PROVIDER: z
    .enum(["apollo", "hunter", "dropcontact", "none"])
    .default("none"),
  ENRICHMENT_API_KEY: z.string().optional().default(""),
  ENRICHMENT_MIN_CONFIDENCE: numeric(0.7),
  ENRICHMENT_REQUESTS_PER_SECOND: numeric(2),

  EUR_DKK_RATE: numeric(7.4604),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** HTTP Basic credential for the Erhvervsstyrelsen distribution endpoints. */
export function getCvrAuthHeader(env: Env = getEnv()): string | null {
  if (env.CVR_API_USERNAME && env.CVR_API_PASSWORD) {
    return `Basic ${Buffer.from(`${env.CVR_API_USERNAME}:${env.CVR_API_PASSWORD}`).toString("base64")}`;
  }
  if (env.CVR_API_KEY) {
    // Already base64("user:pass"), or a bearer-style token issued to you.
    return env.CVR_API_KEY.startsWith("Basic ")
      ? env.CVR_API_KEY
      : `Basic ${env.CVR_API_KEY}`;
  }
  return null;
}
