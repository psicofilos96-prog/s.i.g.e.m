import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readListFilters, writeListFilters } from "./list-url-state";

const LISTS = [
  "src/features/students/students-list-page.tsx",
  "src/features/professionals/professionals-list-page.tsx",
  "src/features/classes/classes-list-page.tsx",
  "src/features/pedagogical/pedagogical-list-page.tsx",
  "src/features/curriculum/matrices-list-page.tsx",
  "src/features/schedules/class-schedules-page.tsx",
  "src/features/schedules/schedule-reviews-page.tsx",
];

describe("NFILTER.2 — busca e filtros das listas", () => {
  it("toda lista com FilterBar e filtros guarda as opções na URL e a busca fora dela", () => {
    for (const f of LISTS) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/useListUrlFilters\(/);
      expect(s, f).toMatch(/usePersistentState\("[^"]+:busca"/);
      expect(s, f).toMatch(/onClear=/);
      expect(s, f).toMatch(/summary=/);
    }
  });
  it("valor fora do padrão seguro nunca entra na URL nem é lido dela", () => {
    const d = { unidade: "all" };
    expect(readListFilters({ unidade: "<script>" }, d).unidade).toBe("all");
    expect(writeListFilters({}, { unidade: "a".repeat(200) }, d)).toEqual({});
    expect(writeListFilters({ q: "x" }, { unidade: "all" }, d)).toEqual({ q: "x" });
  });
  it("limpar devolve o padrão e tira as chaves da URL", () => {
    const d = { unidade: "all", tipo: "all" };
    expect(writeListFilters({ unidade: "u1", tipo: "t" }, d, d)).toEqual({});
  });
});
