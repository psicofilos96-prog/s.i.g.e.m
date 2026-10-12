import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canRead, idpProblems, idpProgress, type IdpActivity } from "./competencies-idp";

const goals = [{ key: "g1", text: "Planejar sequências com avaliação formativa", competency_version_id: "c1" }];
const acts: IdpActivity[] = [{ key: "a1", goal_key: "g1", kind: "curso", description: "Curso X", course_id: "k" }, { key: "a2", goal_key: "g1", kind: "leitura", description: "Ler BNCC" }];

describe("L19 competências e PDI", () => {
  it("PDI válido; competência não aprovada e atividade órfã recusadas", () => {
    expect(idpProblems(goals, acts, new Set(["c1"]))).toEqual([]);
    expect(idpProblems(goals, [{ key: "a1", goal_key: "x", kind: "curso", description: "Curso" }], new Set()).length).toBe(3);
  });
  it("progresso conta atividades, abandonada sai", () =>
    expect(idpProgress(acts, new Map([["a1", "concluida"], ["a2", "abandonada"]]))).toEqual({ done: 1, total: 1 }));
  it("privacidade: só titular ou compartilhamento vigente", () => {
    const base = { owner: "o", today: "2026-10-12", shares: [{ grantee: "m", validUntil: "2026-12-31", revoked: false }] };
    expect(canRead({ ...base, viewer: "m" })).toBe(true);
    expect(canRead({ ...base, viewer: "chefe" })).toBe(false);
    expect(canRead({ ...base, viewer: "m", shares: [{ grantee: "m", validUntil: "2026-12-31", revoked: true }] })).toBe(false);
  });
  it("migration 0450: sem domínio comprovado, sem acesso por cargo, recomendação não obriga", () => {
    const sql = readFileSync("drizzle/migrations/0450_dev19_competencies_idp.sql", "utf8");
    expect(sql).toMatch(/CHECK \(relation = 'contribui-para'\)/);
    expect(sql).not.toMatch(/mastery|dominio_|dominada|achieved_level/i);
    expect(sql).not.toMatch(/dev_idp_readable[\s\S]{0,400}has_network_capability/);
    expect(sql).toMatch(/CHECK \(author_person <> person_id\)/);
    expect(sql).toMatch(/dev:self-approval/);
  });
});
