import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithRetry, withRetry } from "../retry.js";

afterEach(() => {
  vi.restoreAllMocks();
});

vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
  fn();
  return 0 as unknown as NodeJS.Timeout;
}) as typeof setTimeout);

describe("fetchWithRetry", () => {
  it("returns response on first success", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const res = await fetchWithRetry("https://example.com/api");
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 status for GET requests", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const res = await fetchWithRetry("https://example.com/api", undefined, 3);
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 status", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const res = await fetchWithRetry("https://example.com/api", undefined, 3);
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400 status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad request", { status: 400 })
    );

    const res = await fetchWithRetry("https://example.com/api");
    expect(res.status).toBe(400);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry POST requests by default", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("error", { status: 500 })
    );

    const res = await fetchWithRetry("https://example.com/api", {
      method: "POST",
    });
    expect(res.status).toBe(500);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries POST when retryNonIdempotent is true", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const res = await fetchWithRetry(
      "https://example.com/api",
      { method: "POST", retryNonIdempotent: true },
      3
    );
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns last response after exhausting retries", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));

    const res = await fetchWithRetry("https://example.com/api", undefined, 3);
    expect(res.status).toBe(500);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("throws on transient network error after exhausting retries", async () => {
    const error = new Error("connection failed");
    (error as any).code = "ECONNRESET";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(error);

    await expect(
      fetchWithRetry("https://example.com/api", undefined, 2)
    ).rejects.toThrow("connection failed");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on non-transient error", async () => {
    const error = new Error("bad thing happened");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(error);

    await expect(
      fetchWithRetry("https://example.com/api", undefined, 3)
    ).rejects.toThrow("bad thing happened");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("treats HEAD and OPTIONS as idempotent", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const res = await fetchWithRetry(
      "https://example.com",
      { method: "HEAD" },
      3
    );
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("withRetry", () => {
  it("returns value on first success", async () => {
    const fn = vi.fn().mockResolvedValueOnce(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error", async () => {
    const error = new Error("timeout");
    error.name = "TimeoutError";

    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on non-transient error", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fatal"));
    await expect(withRetry(fn)).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries on transient errors", async () => {
    const error = new Error("network");
    error.name = "AbortError";

    const fn = vi.fn().mockRejectedValue(error);
    await expect(withRetry(fn, 2)).rejects.toThrow("network");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
