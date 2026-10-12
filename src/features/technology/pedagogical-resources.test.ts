import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { pedagogicalCatalog } from "./pedagogical-resources";

const sv = (id: string, version: number, audience = ["estudantes"]) => ({ id, serviceKey: "leitura", version, name: "Leitura", kind: "aplicativo", audience, operator: "terceiro" as const, status: "em-uso" as const, dataClasses: ["criancas"], personId: "autor" });
const ap = (id: string) => ({ versionId: id, personId: "outro" });
const ev = (svId: string, rub: string, verdict: any, personId = "aval") => ({ serviceVersionId: svId, rubricVersionId: rub, verdict, personId, createdAt: "2026-10-01" });

describe("L20 recursos pedagógicos", () => {
  it("só serviços aprovados com público escolar entram", () => {
    expect(pedagogicalCatalog([sv("1", 1, ["gestao"])], [ap("1")], [], "R")).toHaveLength(0);
    expect(pedagogicalCatalog([sv("1", 1)], [], [], "R")).toHaveLength(0);
  });
  it("avaliação vale só para versão e rubrica vigentes", () => {
    const c = pedagogicalCatalog([sv("1", 1), sv("2", 2)], [ap("1"), ap("2")], [ev("1", "R", "recomendado")], "R");
    expect(c[0]!.situation).toBe("sem avaliação vigente");
    expect(pedagogicalCatalog([sv("1", 1)], [ap("1")], [ev("1", "OLD", "recomendado")], "R")[0]!.evaluations).toBe(0);
  });
  it("divergência explícita e atenção LGPD", () => {
    const c = pedagogicalCatalog([sv("1", 1)], [ap("1")], [ev("1", "R", "recomendado"), ev("1", "R", "nao-recomendado", "b")], "R")[0]!;
    expect(c.divergent).toBe(true);
    expect(c.lgpdAttention).toBe(true);
  });
  it("banco: rubrica aprovada ≠ autor, notas validadas, autor do cadastro não avalia", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.startsWith("0493"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    for (const s of ["autoaprovacao", "sem-rubrica-aprovada", "notas-invalidas", "autor-do-cadastro-nao-avalia", "item-curricular-inexistente", "nao-e-recurso-pedagogico"]) expect(sql).toContain(s);
    expect(sql).not.toMatch(/CREATE TABLE public\.tech_pedagogical_resources/);
  });
});
