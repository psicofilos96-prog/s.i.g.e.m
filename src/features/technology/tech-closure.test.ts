import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { closureProblems, SPEC_MATRIX, TECH_LOTS } from "./tech-closure";

const migs = readdirSync("drizzle/migrations");
describe("L24 fechamento de Tecnologia", () => {
  it("24 lotes, evidências presentes em disco", () => {
    expect(TECH_LOTS.map((l) => l.lot)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(closureProblems(existsSync, (p) => migs.some((m) => m.startsWith(`${p}_`)))).toEqual([]);
  });
  it("nenhum status alega homologação", () => {
    expect(TECH_LOTS.every((l) => ["implementado-tecnico", "parcial", "bloqueado"].includes(l.status))).toBe(true);
  });
  it("matriz 49×18 não é inventada sem o documento", () => {
    expect(SPEC_MATRIX).toMatchObject({ sections: 49, criteria: 18, mapped: false });
  });
  it("migrations de tecnologia ativam RLS e não dão DML direta", () => {
    for (const m of migs.filter((f) => /^04(7[7-9]|8\d|9[0-6])_/.test(f))) {
      const sql = readFileSync(`drizzle/migrations/${m}`, "utf8");
      expect(sql, m).not.toMatch(/GRANT\s+(ALL|INSERT|UPDATE|DELETE)[^;]*TO\s+(anon|authenticated)/i);
      for (const t of sql.matchAll(/CREATE TABLE public\.(\w+)/g)) expect(sql, `${m}:${t[1]}`).toMatch(new RegExp(`ALTER TABLE public\\.${t[1]} ENABLE ROW LEVEL SECURITY`));
    }
  });
});
