import { describe, expect, it } from "vitest";
import { addKnown } from "./attendance-cycle-consolidation";

describe("B4.6.2b.3.1 — consolidação propaga indisponibilidade", () => {
  it("parcela null ⇒ null; números conhecidos (inclusive 0) somam", () => {
    expect(addKnown(3, null)).toBeNull();
    expect(addKnown(null, 0)).toBeNull();
    expect(addKnown(0, 0)).toBe(0);
    expect(addKnown(2, 5)).toBe(7);
  });
});
