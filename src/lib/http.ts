import { UpstreamError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("http");

/**
 * Token-bucket limiter. Erhvervsstyrelsen throttles aggressively and Apollo
 * bills per call, so every outbound client goes through one of these.
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst = Math.max(1, Math.ceil(ratePerSecond)),
  ) {
    this.tokens = this.burst;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.ratePerSecond);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = ((1 - this.tokens) / this.ratePerSecond) * 1000;
    await new Promise<void>((resolve) => setTimeout(resolve, Math.ceil(waitMs)));
    return this.acquire();
  }
}

export interface FetchJsonOptions extends RequestInit {
  /** Attempts including the first. */
  retries?: number;
  timeoutMs?: number;
  limiter?: RateLimiter;
  service?: string;
  /** Status codes worth retrying beyond the defaults. */
  retryOn?: number[];
}

const DEFAULT_RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

function backoffMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 30_000);
  }
  const base = Math.min(2 ** attempt * 500, 16_000);
  return base + Math.random() * 250; // jitter: avoids lock-step retries across workers
}

/** fetch + timeout + bounded exponential backoff + typed failures. */
export async function fetchWithRetry(url: string, options: FetchJsonOptions = {}): Promise<Response> {
  const {
    retries = 4,
    timeoutMs = 30_000,
    limiter,
    service = "upstream",
    retryOn = [],
    ...init
  } = options;
  const retryable = new Set([...DEFAULT_RETRYABLE, ...retryOn]);

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (limiter) await limiter.acquire();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.ok) return res;

      if (retryable.has(res.status) && attempt < retries - 1) {
        const wait = backoffMs(attempt, res.headers.get("retry-after"));
        log.warn("retrying upstream call", { service, url, status: res.status, attempt, wait });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      const body = await res.text().catch(() => "");
      throw new UpstreamError(
        `${service} responded ${res.status}: ${body.slice(0, 500)}`,
        service,
        res.status,
        retryable.has(res.status),
      );
    } catch (e) {
      if (e instanceof UpstreamError) throw e;
      lastError = e;
      const aborted = e instanceof Error && e.name === "AbortError";
      if (attempt < retries - 1) {
        const wait = backoffMs(attempt);
        log.warn("network failure, retrying", {
          service,
          url,
          attempt,
          wait,
          reason: aborted ? "timeout" : String(e),
        });
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new UpstreamError(`${service} unreachable after ${retries} attempts`, service, undefined, true, lastError);
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const res = await fetchWithRetry(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new UpstreamError(
      `${options.service ?? "upstream"} returned non-JSON: ${text.slice(0, 200)}`,
      options.service ?? "upstream",
      res.status,
      false,
      e,
    );
  }
}
