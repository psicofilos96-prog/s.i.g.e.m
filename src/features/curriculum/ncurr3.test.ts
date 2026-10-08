import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const d1 = readFileSync("src/features/curriculum/d1-import-page.tsx", "utf8");
describe("NCURR.3 — importação D1 em prévia", () => {
  it("tabela da prévia tem caption e cabeçalhos com scope", () => {
    expect(d1).toContain("<caption");
    expect(d1).not.toMatch(/<th>/);
  });
  it("situação desconhecida ou não lida nunca vira traço ou código cru", () => {
    expect(d1).toContain("knownLabel(STATUS_LABEL, s.status)");
    expect(d1).toContain("Situação ainda não lida");
  });
});
