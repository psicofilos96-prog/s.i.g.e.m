import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { knownLabel } from "@/config/ui-vocabulary";
import { NONCONFORMITY_LABEL } from "./receiving-model";
const read = (f: string) => readFileSync(`src/features/school-meals/${f}`, "utf8");
describe("NAE.9", () => {
  it("situação desconhecida nunca vira texto vazio nem undefined", () => {
    const out = knownLabel(NONCONFORMITY_LABEL, "estado-novo-do-banco");
    expect(out).not.toBe(""); expect(out).not.toContain("undefined");
  });
  it("status de banco nunca indexado direto", () => {
    for (const f of ["orders-section.tsx", "planning-section.tsx", "receiving-section.tsx", "stock-section.tsx"])
      expect(read(f)).not.toMatch(/_LABEL\[(order|o|r|n|row)\.(status|movement_class)\]/);
  });
  it("tabelas têm legenda e cabeçalho com escopo", () => {
    for (const f of ["nucleo-section.tsx", "operation-sections.tsx", "school-meals-page.tsx"]) {
      expect(read(f)).toContain("<caption"); expect(read(f)).toContain('scope="col"');
    }
  });
});
