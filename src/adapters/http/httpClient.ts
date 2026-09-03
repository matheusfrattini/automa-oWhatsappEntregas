export class HttpRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export interface HttpClientOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrapper fino sobre fetch com timeout e retry com backoff.
 * Retenta em erro de rede, timeout, 5xx e 429. Não retenta em 4xx (exceto 429) —
 * esses são erros de request, retentar não ajuda.
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit,
  options: HttpClientOptions = {},
): Promise<T> {
  const {
    timeoutMs = 5000,
    retries = 2,
    retryDelayMs = 300,
    fetchFn = fetch,
    sleepFn = defaultSleep,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (response.status >= 500 || response.status === 429) {
        lastError = new HttpRequestError(`HTTP ${response.status}`, response.status);
        if (attempt < retries) {
          await sleepFn(retryDelayMs * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new HttpRequestError(`HTTP ${response.status}: ${body}`, response.status);
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timer);

      const isNonRetryableHttpError =
        err instanceof HttpRequestError && err.status !== undefined && err.status < 500 && err.status !== 429;
      if (isNonRetryableHttpError) throw err;

      lastError = err;
      if (attempt < retries) {
        await sleepFn(retryDelayMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
