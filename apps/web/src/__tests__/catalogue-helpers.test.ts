import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatSessionDateRange,
  cheapestTier,
  upcomingSessions,
  type PricingTier,
  type CalendarSession,
} from "../hooks/useCatalogue";

describe("formatPrice", () => {
  it("formats total price in CHF", () => {
    const result = formatPrice("3900", "CHF", "total");
    const normalized = result.replace(/[\u2019\u2018\u202f\u00a0]/g, "'");
    expect(normalized).toBe("CHF 3'900.-");
  });

  it("formats per_day price", () => {
    expect(formatPrice("850", "CHF", "per_day")).toBe("CHF 850 / jour");
  });

  it("formats per_session price", () => {
    expect(formatPrice("200", "CHF", "per_session")).toBe("CHF 200 / session");
  });

  it("defaults to CHF and total", () => {
    const result = formatPrice("1500");
    const normalized = result.replace(/[\u2019\u2018\u202f\u00a0]/g, "'");
    expect(normalized).toBe("CHF 1'500.-");
  });

  it("handles decimal amounts", () => {
    const result = formatPrice("99.50", "CHF", "total");
    expect(result).toContain("CHF");
    expect(result).toContain("100");
  });

  it("handles zero", () => {
    expect(formatPrice("0")).toBe("CHF 0.-");
  });
});

describe("formatSessionDateRange", () => {
  it('returns "Date à confirmer" when no startDate', () => {
    expect(formatSessionDateRange(null, null)).toBe("Date à confirmer");
  });

  it("formats single date when no endDate", () => {
    const result = formatSessionDateRange("2025-03-14", null);
    expect(result).toContain("14");
    expect(result).toContain("2025");
  });

  it("formats same-day range", () => {
    const result = formatSessionDateRange("2025-03-14", "2025-03-14");
    expect(result).toContain("14");
    expect(result).toContain("2025");
  });

  it("formats same-month range with day–day format", () => {
    const result = formatSessionDateRange("2025-03-14", "2025-03-16");
    expect(result).toContain("14");
    expect(result).toContain("16");
    expect(result).toContain("2025");
  });

  it("formats same-year different-month range", () => {
    const result = formatSessionDateRange("2025-03-28", "2025-04-02");
    expect(result).toContain("28");
    expect(result).toContain("2");
    expect(result).toContain("2025");
  });

  it("formats different-year range", () => {
    const result = formatSessionDateRange("2025-12-28", "2026-01-05");
    expect(result).toContain("2025");
    expect(result).toContain("2026");
  });
});

describe("cheapestTier", () => {
  const makeTier = (overrides: Partial<PricingTier>): PricingTier => ({
    id: "1",
    programCode: "HB1",
    pricingType: "standard",
    label: "Standard",
    amount: "3900",
    unit: "total",
    currency: "CHF",
    conditions: null,
    validFrom: null,
    validUntil: null,
    active: true,
    ...overrides,
  });

  it("returns null for empty array", () => {
    expect(cheapestTier([])).toBeNull();
  });

  it("returns null when no active tiers", () => {
    expect(cheapestTier([makeTier({ active: false })])).toBeNull();
  });

  it("returns cheapest standard tier", () => {
    const tiers = [
      makeTier({ id: "a", amount: "5000" }),
      makeTier({ id: "b", amount: "3900" }),
      makeTier({ id: "c", amount: "4500" }),
    ];
    expect(cheapestTier(tiers)?.id).toBe("b");
  });

  it("prefers standard tiers over other types", () => {
    const tiers = [
      makeTier({ id: "retake", pricingType: "retake", amount: "500" }),
      makeTier({ id: "std", pricingType: "standard", amount: "3900" }),
    ];
    expect(cheapestTier(tiers)?.id).toBe("std");
  });

  it("falls back to cheapest active non-standard if no standard exists", () => {
    const tiers = [
      makeTier({ id: "retake", pricingType: "retake", amount: "500" }),
      makeTier({ id: "earlybird", pricingType: "earlybird", amount: "300" }),
    ];
    expect(cheapestTier(tiers)?.id).toBe("earlybird");
  });
});

describe("upcomingSessions", () => {
  const makeSession = (overrides: Partial<CalendarSession>): CalendarSession => ({
    id: "1",
    name: "Session",
    code: null,
    startDate: null,
    endDate: null,
    place: null,
    placeName: null,
    remote: false,
    inter: false,
    program: null,
    image: null,
    dates: [],
    ...overrides,
  });

  it("includes sessions with no start date", () => {
    const sessions = [makeSession({ startDate: null })];
    expect(upcomingSessions(sessions)).toHaveLength(1);
  });

  it("includes future sessions", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const sessions = [makeSession({ startDate: futureDate })];
    expect(upcomingSessions(sessions)).toHaveLength(1);
  });

  it("excludes past sessions", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const sessions = [makeSession({ startDate: pastDate })];
    expect(upcomingSessions(sessions)).toHaveLength(0);
  });
});
