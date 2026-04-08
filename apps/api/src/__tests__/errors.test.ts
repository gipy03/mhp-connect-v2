import { describe, it, expect } from "vitest";
import { AppError } from "../lib/errors.js";

describe("AppError", () => {
  it("creates error with message and default status 400", () => {
    const err = new AppError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("AppError");
    expect(err).toBeInstanceOf(Error);
  });

  it("creates error with custom status code", () => {
    const err = new AppError("Not found", 404);
    expect(err.statusCode).toBe(404);
  });

  it("creates error with code", () => {
    const err = new AppError("Rate limited", 429, "RATE_LIMIT");
    expect(err.code).toBe("RATE_LIMIT");
  });
});
