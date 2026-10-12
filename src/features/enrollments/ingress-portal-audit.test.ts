import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { FORBIDDEN_DUPLICATES, INGRESS_CRITERIA, INGRESS_SECTIONS, INGRESS_SOURCES, ingressAuditProblems, ingressSummary } from "./ingress-portal-audit";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8");

describe("Matrículas L01 — auditoria do Portal de Ingresso", () => {
  it("45 seções + 22 critérios com evidência real e lacuna descrita", () => {
    expect(ingressAuditProblems(existsSync)).toEqual([]);
    expect(new Set(INGRESS_SECTIONS.map((s) => s.n)).size).toBe(45);
  });
  it("toda fonte canônica citada existe no banco", () => {
    const tables = new Set([...Object.values(INGRESS_SOURCES), ...INGRESS_SECTIONS.flatMap((s) => s.tables)]);
    for (const t of tables) expect(types, t).toContain(`      ${t}: {`);
  });
  it("nenhuma migration cria tabela duplicada de estudante/matrícula/vaga", () => {
    const re = new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.(${FORBIDDEN_DUPLICATES.join("|")})\\s*\\(`, "i");
    const bad = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql") && re.test(readFileSync(`drizzle/migrations/${f}`, "utf8")));
    expect(bad).toEqual([]);
  });
  it("nunca afirma homologação", () => {
    for (const x of [...INGRESS_SECTIONS, ...INGRESS_CRITERIA]) expect(x.status).not.toMatch(/homolog/);
    const s = ingressSummary(INGRESS_SECTIONS);
    expect(s.existente + s.parcial + s.lacuna + s.bloqueado).toBe(45);
  });
});
