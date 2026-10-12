import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeNewClassFeasibility, familyNotice, SECTOR_LINKS } from "./operations-integrations";

const ALL_SQL = ["drizzle/migrations", "supabase/migrations"].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`${d}/${f}`, "utf8"))).join("\n");
const SRC = readFileSync("src/features/operations-center/operations-integrations.ts", "utf8");

describe("Centro de Operações L22 — integrações e viabilidade de nova turma", () => {
  it("toda fonte e writer citados existem; projeções existem em disco", () => {
    expect(SECTOR_LINKS).toHaveLength(8);
    for (const l of SECTOR_LINKS) {
      for (const t of l.reads) expect(ALL_SQL, t).toMatch(new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${t}\\b`));
      for (const f of l.writesVia) expect(ALL_SQL, f).toMatch(new RegExp(`FUNCTION public\\.${f}\\(`));
      if (l.projection.startsWith("src/")) expect(existsSync(l.projection), l.projection).toBe(true);
    }
  });
  it("família só aviso genérico aprovado", () => {
    expect(familyNotice("Haverá alteração no atendimento amanhã.", false).ok).toBe(false);
    expect(familyNotice("A rota 3 muda de horário.", true)).toEqual({ ok: false, reason: "termo-interno" });
    expect(familyNotice("Procure a secretaria da escola para informações.", true).ok).toBe(true);
  });
  it("viabilidade por dimensão, ausência ⇒ indeterminado, nunca decide", () => {
    const r = analyzeNewClassFeasibility({ expectedStudents: 25, space: { value: 30, basis: ["sala 4"] }, teacherHoursNeeded: 25, teacherHoursUncovered: null, transportNeeded: true, transportSeatsFree: 10, transportStudents: 12, furnitureAvailable: null });
    expect(r.dimensions.map((d) => d.status)).toEqual(["atende", "indeterminado", "nao-atende", "indeterminado"]);
    expect(r.decision).toBeNull();
    expect(r.writes).toEqual([]);
    expect(SRC).not.toMatch(/\.(insert|update|upsert|rpc)\(/);
  });
});
