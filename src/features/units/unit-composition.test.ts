import { describe, it, expect } from "vitest";
import { unitComposition } from "./units-list-page";
describe("unitComposition", () => {
  it("conta ativas e localizações sem converter ausência em categoria", () => {
    const r = unitComposition([
      { active: true, location: "Urbana" }, { active: false, location: "Rural" },
      { active: null, location: null }, { active: true, location: "Urbana" },
    ]);
    expect(r[0]).toEqual({ label: "Ativas", value: 2, total: 4 });
    expect(r.find((i) => i.label === "Urbana")?.value).toBe(2);
    expect(r.find((i) => i.label === "Localização não informada")?.value).toBe(1);
  });
});
