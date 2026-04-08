import { describe, it, expect } from "vitest";
import { AuthError } from "../services/auth.js";

describe("AuthError", () => {
  it("creates error with default status 400", () => {
    const err = new AuthError("Bad request");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("AuthError");
    expect(err).toBeInstanceOf(Error);
  });

  it("creates error with custom status code", () => {
    const err = new AuthError("Unauthorized", 401);
    expect(err.statusCode).toBe(401);
  });
});
