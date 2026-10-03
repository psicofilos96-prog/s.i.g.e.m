import { describe, expect, it } from "vitest";
import { periodSourcePresentation } from "./period-source-presentation";

describe("B4.6.2b.3.1 — origem do período", () => {
  it("B2.4 é institucional, não demonstrativo nem oficial do calendário", () => {
    const p = periodSourcePresentation("institucional-b2.4");
    expect(p.badge).toMatch(/^Período institucional/);
    expect(p.badge).not.toMatch(/B2\.4|demonstrativo|homologado/);
    expect(p.technical).toMatch(/institucional-b2\.4/);
    expect(p.tone).toBe("warning");
  });
  it("homologado continua oficial; legado e ausente (histórico) continuam demonstrativos", () => {
    expect(periodSourcePresentation("calendario-homologado").tone).toBe("success");
    expect(periodSourcePresentation("legado-demonstrativo").detail).toMatch(/demonstrativo/);
    expect(periodSourcePresentation(undefined).detail).toMatch(/demonstrativo/);
  });
});
