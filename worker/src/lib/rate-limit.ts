const WINDOW_MS = 60 * 60 * 1000;
const KV_TTL_SECONDS = 60 * 60 + 120;

export type RateLimitOk = { allowed: true };
export type RateLimitBlocked = {
  allowed: false;
  retryAfterSeconds: number;
  limit: number;
};
export type RateLimitResult = RateLimitOk | RateLimitBlocked;

type WindowState = {
  timestamps: number[];
};

function formKey(formId: string): string {
  return `rl:form:${formId}`;
}

function ipKey(formId: string, ip: string): string {
  return `rl:ip:${formId}:${ip}`;
}

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  return timestamps.filter((stamp) => stamp > cutoff);
}

async function readWindow(kv: KVNamespace, key: string, now: number): Promise<number[]> {
  const stored = await kv.get<WindowState>(key, "json");
  if (!stored || !Array.isArray(stored.timestamps)) return [];
  return prune(stored.timestamps, now);
}

async function writeWindow(kv: KVNamespace, key: string, timestamps: number[]): Promise<void> {
  await kv.put(key, JSON.stringify({ timestamps } satisfies WindowState), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

function retryAfterSeconds(timestamps: number[], now: number): number {
  if (timestamps.length === 0) return 60;
  const oldest = Math.min(...timestamps);
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
}

export function normalizeHourlyLimit(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return 100;
  return Math.floor(value);
}

/**
 * Rolling 1-hour limit, counted both per form and per IP-on-that-form.
 * Either counter hitting `limit` produces HTTP 429.
 */
export async function consumeRateLimit(
  kv: KVNamespace,
  input: { formId: string; ip: string; limit: number },
): Promise<RateLimitResult> {
  const limit = normalizeHourlyLimit(input.limit);
  const now = Date.now();
  const formKvKey = formKey(input.formId);
  const ipKvKey = ipKey(input.formId, input.ip);

  try {
    const [formStamps, ipStamps] = await Promise.all([
      readWindow(kv, formKvKey, now),
      readWindow(kv, ipKvKey, now),
    ]);

    if (formStamps.length >= limit || ipStamps.length >= limit) {
      const retryAfterSecondsValue = Math.max(
        retryAfterSeconds(formStamps, now),
        retryAfterSeconds(ipStamps, now),
      );
      return { allowed: false, retryAfterSeconds: retryAfterSecondsValue, limit };
    }

    formStamps.push(now);
    ipStamps.push(now);
    await Promise.all([
      writeWindow(kv, formKvKey, formStamps),
      writeWindow(kv, ipKvKey, ipStamps),
    ]);

    return { allowed: true };
  } catch (error) {
    console.error("Rate limit KV error; allowing request:", error);
    return { allowed: true };
  }
}
