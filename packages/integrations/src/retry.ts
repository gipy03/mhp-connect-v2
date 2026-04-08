const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return true;
    if ("code" in err) {
      const code = (err as { code: string }).code;
      if (
        code === "ECONNRESET" ||
        code === "ECONNREFUSED" ||
        code === "ETIMEDOUT" ||
        code === "EPIPE" ||
        code === "UND_ERR_SOCKET"
      )
        return true;
    }
  }
  return false;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function isIdempotentMethod(method?: string): boolean {
  if (!method) return true;
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit & { retryNonIdempotent?: boolean },
  retries = MAX_RETRIES
): Promise<Response> {
  const canRetry =
    isIdempotentMethod(init?.method) || init?.retryNonIdempotent === true;

  if (!canRetry) {
    return fetch(input, init);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !isRetryableStatus(res.status) || attempt === retries) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === retries) {
        throw err;
      }
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === retries) {
        throw err;
      }
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError;
}
