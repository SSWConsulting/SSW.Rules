// How the page code must react to a failed Tina request:
// - "not-found": the record does not exist. A fallback (or a 404) is the correct result.
// - "transient": throttling, a 429/5xx response or a network failure. The same request can pass later.
// - "fatal": anything else, for example a query that the schema rejects. Retrying cannot help.
//
// Only "not-found" may turn into a fallback page. Pages are static, so a fallback rendered after
// any other error is cached and shown as NOT FOUND until the next deploy. The same applies to every
// default value that a loader returns after an error: the static page caches it.
export type TinaErrorKind = "not-found" | "transient" | "fatal";

const NOT_FOUND_PATTERN = /Unable to find record/;

const TRANSIENT_PATTERNS = [
  // TinaCloud stores content in DynamoDB and returns its throttling message as a GraphQL error
  /Throughput exceeds/i,
  /ProvisionedThroughputExceeded/i,
  /Rate exceeded/i,
  /Too Many Requests/i,
  // The Tina client's message for a response that is not ok
  /Server responded with status code (429|5\d\d)\b/,
  /fetch failed/i,
  /socket hang up/i,
  /\b(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|UND_ERR_[A-Z_]+)\b/,
];

export const tinaErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeText = cause instanceof Error ? ` ${cause.message} ${(cause as Error & { code?: string }).code ?? ""}` : "";
    return `${error.message}${causeText}`;
  }
  return String(error);
};

export const classifyTinaError = (error: unknown): TinaErrorKind => {
  const message = tinaErrorMessage(error);
  // One response can carry several errors. A transient error wins, because the full result may still exist.
  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))) return "transient";
  if (NOT_FOUND_PATTERN.test(message)) return "not-found";
  return "fatal";
};

export const isRecordNotFound = (error: unknown): boolean => classifyTinaError(error) === "not-found";

export interface TinaRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Retries transient errors with exponential backoff (about 1s, 2s, 4s, 8s by default), then throws the last error.
// "not-found" and "fatal" errors are thrown at once.
export const withTinaRetry = async <T>(label: string, request: (attempt: number) => Promise<T>, options: TinaRetryOptions = {}): Promise<T> => {
  const { attempts = 5, baseDelayMs = 1000, sleep = defaultSleep } = options;

  for (let attempt = 1; ; attempt++) {
    try {
      return await request(attempt);
    } catch (error) {
      if (attempt >= attempts || classifyTinaError(error) !== "transient") throw error;

      const delayMs = Math.round(baseDelayMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
      // The Tina client puts the server's own error text on the last line
      const detail = tinaErrorMessage(error)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .pop();
      console.warn(`[tina] ${label} failed with a transient error (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms: ${detail}`);
      await sleep(delayMs);
    }
  }
};

export interface TinaRequestOptions {
  fetchOptions?: Omit<RequestInit, "body" | "method">;
}

// TinaCloud returns throttling with HTTP 200, and Next's data cache stores a 200 response under a key that includes
// the request headers. A retry adds a header, so it sends a new request instead of reading back the throttled
// response. The first attempt sends the request unchanged, so it can still use the cache. The Tina client's disk
// cache does not store a response that throws with the default "throw" error policy.
export const tinaRetryOptions = (attempt: number, options: TinaRequestOptions = {}): TinaRequestOptions => {
  if (attempt === 1) return options;
  const headers = { ...(options.fetchOptions?.headers as Record<string, string> | undefined), "x-tina-retry": String(attempt) };
  return { ...options, fetchOptions: { ...options.fetchOptions, headers } };
};

export const tinaResponseErrorMessages = (response: unknown): string[] =>
  ((response as { errors?: unknown[] | null } | null)?.errors ?? [])
    .map((e) => (typeof e === "string" ? e : (e as { message?: unknown } | null)?.message))
    .filter((m): m is string => typeof m === "string" && m.length > 0);

// For errorPolicy "all": the response carries its errors instead of throwing them, so a transient error in it is
// thrown here to start a retry. The Tina disk cache stores these responses by request body, and each retry adds a
// GraphQL comment to the query so that it cannot read the throttled response back.
export const withTinaRetryAllowingErrors = <T>(label: string, query: string, send: (query: string) => Promise<T>, options?: TinaRetryOptions): Promise<T> =>
  withTinaRetry(
    label,
    async (attempt) => {
      const response = await send(attempt === 1 ? query : `${query}\n# attempt ${attempt}`);
      const messages = tinaResponseErrorMessages(response);
      if (messages.some((m) => classifyTinaError(m) === "transient")) {
        throw new Error(`${label} returned errors:\n${messages.join("\n")}`);
      }
      return response;
    },
    options
  );
