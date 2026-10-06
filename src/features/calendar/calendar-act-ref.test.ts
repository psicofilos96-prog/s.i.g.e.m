import { describe, it, expect } from "vitest";
import { editorActRef } from "./calendar-central";

describe("BQ.0 — texto do ato do editor do calendário", () => {
  it("não atribui o ato a um setor fixo", () => {
    const t = editorActRef("Homologar", new Date("2027-01-01T00:00:00Z"));
    expect(t).not.toMatch(/Supervisão/);
    expect(t).toContain("conta autenticada");
    expect(t).toContain("2027-01-01T00:00:00.000Z");
  });
});
