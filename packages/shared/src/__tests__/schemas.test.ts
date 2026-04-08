import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  setPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateUserRoleSchema,
  updateUserRoleParamsSchema,
  accredibleWebhookSchema,
  programOverrideBodySchema,
  enrollmentBodySchema,
} from "../schema.js";

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "securepass",
      firstName: "Jean",
      lastName: "Dupont",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "securepass",
      firstName: "Jean",
      lastName: "Dupont",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "short",
      firstName: "Jean",
      lastName: "Dupont",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("8 caractères");
    }
  });

  it("rejects empty firstName", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "securepass",
      firstName: "",
      lastName: "Dupont",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty lastName", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "securepass",
      firstName: "Jean",
      lastName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "any",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
      password: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("setPasswordSchema / resetPasswordSchema", () => {
  for (const schema of [setPasswordSchema, resetPasswordSchema]) {
    it("accepts valid token + password", () => {
      expect(schema.safeParse({ token: "abc123", password: "12345678" }).success).toBe(true);
    });

    it("rejects empty token", () => {
      expect(schema.safeParse({ token: "", password: "12345678" }).success).toBe(false);
    });

    it("rejects short password", () => {
      expect(schema.safeParse({ token: "abc", password: "1234567" }).success).toBe(false);
    });
  }
});

describe("updateProfileSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial profile update", () => {
    const result = updateProfileSchema.safeParse({
      firstName: "Marie",
      phone: "+41 79 123 45 67",
      directoryVisibility: "public",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid directoryVisibility", () => {
    const result = updateProfileSchema.safeParse({
      directoryVisibility: "everyone",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid directoryVisibility values", () => {
    for (const vis of ["hidden", "internal", "public"]) {
      expect(updateProfileSchema.safeParse({ directoryVisibility: vis }).success).toBe(true);
    }
  });

  it("accepts nullable latitude/longitude", () => {
    expect(updateProfileSchema.safeParse({ latitude: null, longitude: null }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ latitude: 46.204, longitude: 6.143 }).success).toBe(true);
  });

  it("accepts specialties array", () => {
    const result = updateProfileSchema.safeParse({
      specialties: ["hypnose", "PNL"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty firstName if provided", () => {
    const result = updateProfileSchema.safeParse({ firstName: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateUserRoleSchema", () => {
  it("accepts valid roles", () => {
    expect(updateUserRoleSchema.safeParse({ role: "member" }).success).toBe(true);
    expect(updateUserRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
  });

  it("rejects invalid role", () => {
    expect(updateUserRoleSchema.safeParse({ role: "superadmin" }).success).toBe(false);
  });
});

describe("updateUserRoleParamsSchema", () => {
  it("accepts valid UUID", () => {
    expect(
      updateUserRoleParamsSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" }).success
    ).toBe(true);
  });

  it("rejects non-UUID string", () => {
    const result = updateUserRoleParamsSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(updateUserRoleParamsSchema.safeParse({ id: "" }).success).toBe(false);
  });
});

describe("accredibleWebhookSchema", () => {
  const validPayload = {
    event: "credential.issued",
    data: {
      credential: {
        id: 12345,
        recipient: { name: "Jean Dupont", email: "jean@example.com" },
        group: { name: "HB1" },
        name: "Certificat Hypnose de Base",
        description: null,
        issued_at: "2025-01-15",
        expires_at: null,
        badge: { url: "https://example.com/badge.png" },
        certificate: { url: "https://example.com/cert.pdf" },
        url: "https://example.com/cred/123",
      },
    },
  };

  it("accepts valid webhook payload", () => {
    expect(accredibleWebhookSchema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts payload with null optionals", () => {
    const payload = {
      ...validPayload,
      data: {
        credential: {
          ...validPayload.data.credential,
          group: null,
          description: null,
          badge: null,
          certificate: null,
          url: null,
        },
      },
    };
    expect(accredibleWebhookSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects missing event", () => {
    const { event: _, ...noEvent } = validPayload;
    expect(accredibleWebhookSchema.safeParse(noEvent).success).toBe(false);
  });

  it("rejects empty event string", () => {
    expect(
      accredibleWebhookSchema.safeParse({ ...validPayload, event: "" }).success
    ).toBe(false);
  });

  it("rejects invalid recipient email", () => {
    const bad = {
      ...validPayload,
      data: {
        credential: {
          ...validPayload.data.credential,
          recipient: { name: "Test", email: "not-email" },
        },
      },
    };
    expect(accredibleWebhookSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects non-numeric credential id", () => {
    const bad = {
      ...validPayload,
      data: {
        credential: { ...validPayload.data.credential, id: "abc" },
      },
    };
    expect(accredibleWebhookSchema.safeParse(bad).success).toBe(false);
  });
});

describe("programOverrideBodySchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(programOverrideBodySchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial overrides", () => {
    const result = programOverrideBodySchema.safeParse({
      published: true,
      displayName: "Formation Avancée",
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts nullable fields", () => {
    const result = programOverrideBodySchema.safeParse({
      displayName: null,
      description: null,
      imageUrl: null,
      tags: null,
      category: null,
      highlightLabel: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid imageUrl", () => {
    const result = programOverrideBodySchema.safeParse({
      imageUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    const result = programOverrideBodySchema.safeParse({
      sortOrder: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects displayName exceeding 500 chars", () => {
    const result = programOverrideBodySchema.safeParse({
      displayName: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects highlightLabel exceeding 100 chars", () => {
    const result = programOverrideBodySchema.safeParse({
      highlightLabel: "B".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe("enrollmentBodySchema", () => {
  it("accepts valid enrollment data", () => {
    const result = enrollmentBodySchema.safeParse({
      programCode: "HB1",
      sessionId: "sess-123",
      pricingTierId: "tier-456",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional finalAmount", () => {
    const result = enrollmentBodySchema.safeParse({
      programCode: "HB1",
      sessionId: "sess-123",
      pricingTierId: "tier-456",
      finalAmount: 3900,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty programCode", () => {
    expect(
      enrollmentBodySchema.safeParse({
        programCode: "",
        sessionId: "s",
        pricingTierId: "t",
      }).success
    ).toBe(false);
  });

  it("rejects negative finalAmount", () => {
    expect(
      enrollmentBodySchema.safeParse({
        programCode: "HB1",
        sessionId: "s",
        pricingTierId: "t",
        finalAmount: -100,
      }).success
    ).toBe(false);
  });

  it("rejects Infinity finalAmount", () => {
    expect(
      enrollmentBodySchema.safeParse({
        programCode: "HB1",
        sessionId: "s",
        pricingTierId: "t",
        finalAmount: Infinity,
      }).success
    ).toBe(false);
  });

  it("rejects NaN finalAmount", () => {
    expect(
      enrollmentBodySchema.safeParse({
        programCode: "HB1",
        sessionId: "s",
        pricingTierId: "t",
        finalAmount: NaN,
      }).success
    ).toBe(false);
  });
});
