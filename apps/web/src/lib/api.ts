const BASE = "/api";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the API returns a feature-locked 403. */
  get isLocked(): boolean {
    return (
      this.status === 403 &&
      typeof this.data === "object" &&
      this.data !== null &&
      "locked" in (this.data as object)
    );
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (data as { error?: string }).error ?? `HTTP ${res.status}`,
      data
    );
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Typed HTTP methods
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
