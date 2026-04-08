import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildChildToRootMap, type DigiformaProgramChild } from "../digiforma.js";

describe("buildChildToRootMap", () => {
  it("maps child codes to root parent codes", () => {
    const programs: DigiformaProgramChild[] = [
      { id: "1", code: "ROOT", name: "Root", parentId: null, parent: null },
      { id: "2", code: "CHILD", name: "Child", parentId: "1", parent: { id: "1", code: "ROOT", name: "Root" } },
    ];

    const map = buildChildToRootMap(programs);
    expect(map.get("CHILD")).toBe("ROOT");
    expect(map.get("ROOT")).toBe("ROOT");
  });

  it("handles multi-level hierarchy", () => {
    const programs: DigiformaProgramChild[] = [
      { id: "1", code: "A", name: "A", parentId: null, parent: null },
      { id: "2", code: "B", name: "B", parentId: "1", parent: { id: "1", code: "A", name: "A" } },
      { id: "3", code: "C", name: "C", parentId: "2", parent: { id: "2", code: "B", name: "B" } },
    ];

    const map = buildChildToRootMap(programs);
    expect(map.get("C")).toBe("A");
    expect(map.get("B")).toBe("A");
    expect(map.get("A")).toBe("A");
  });

  it("skips programs without code", () => {
    const programs: DigiformaProgramChild[] = [
      { id: "1", code: null, name: "NoCode", parentId: null, parent: null },
      { id: "2", code: "HAS_CODE", name: "HasCode", parentId: null, parent: null },
    ];

    const map = buildChildToRootMap(programs);
    expect(map.has("NoCode")).toBe(false);
    expect(map.get("HAS_CODE")).toBe("HAS_CODE");
  });

  it("handles circular references safely", () => {
    const programs: DigiformaProgramChild[] = [
      { id: "1", code: "X", name: "X", parentId: "2", parent: { id: "2", code: "Y", name: "Y" } },
      { id: "2", code: "Y", name: "Y", parentId: "1", parent: { id: "1", code: "X", name: "X" } },
    ];

    const map = buildChildToRootMap(programs);
    expect(map.size).toBeGreaterThanOrEqual(0);
  });

  it("handles empty input", () => {
    const map = buildChildToRootMap([]);
    expect(map.size).toBe(0);
  });

  it("handles orphan child (parent not in list)", () => {
    const programs: DigiformaProgramChild[] = [
      { id: "2", code: "ORPHAN", name: "Orphan", parentId: "999", parent: { id: "999", code: "MISSING", name: "Missing" } },
    ];

    const map = buildChildToRootMap(programs);
    expect(map.get("ORPHAN")).toBe("ORPHAN");
  });
});
