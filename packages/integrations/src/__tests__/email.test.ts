import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { deriveBaseUrl } from "../email.js";

describe("deriveBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns BASE_URL when set", () => {
    process.env.BASE_URL = "https://mhp-connect.app";
    const req = {
      protocol: "http",
      get: (name: string) => (name === "host" ? "localhost:3001" : undefined),
    };
    expect(deriveBaseUrl(req)).toBe("https://mhp-connect.app");
  });

  it("derives URL from host header when no BASE_URL", () => {
    delete process.env.BASE_URL;
    const req = {
      protocol: "https",
      get: (name: string) => {
        if (name === "host") return "example.com";
        if (name === "x-forwarded-proto") return undefined;
        return undefined;
      },
    };
    expect(deriveBaseUrl(req)).toBe("https://example.com");
  });

  it("uses x-forwarded-proto when available", () => {
    delete process.env.BASE_URL;
    const req = {
      protocol: "http",
      get: (name: string) => {
        if (name === "x-forwarded-proto") return "https";
        if (name === "host") return "app.example.com";
        return undefined;
      },
    };
    expect(deriveBaseUrl(req)).toBe("https://app.example.com");
  });

  it("falls back to localhost when no host header", () => {
    delete process.env.BASE_URL;
    const req = {
      protocol: "http",
      get: () => undefined,
    };
    const result = deriveBaseUrl(req);
    expect(result).toContain("localhost");
  });
});
