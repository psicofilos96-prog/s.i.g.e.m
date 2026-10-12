import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decisionProblems, matchStrength, normName } from "./student-reconciliation";

const sql = readFileSync("drizzle/migrations/0458_enr06_preliminary_student_reconciliation.sql", "utf8");

describe("Matrículas L06 — reconciliação supervisionada", () => {
  it("nome sozinho nunca é candidato; nome+nascimento é fraca; identificador oficial é forte", () => {
    const p = { name: "João  da SILVA", birth: "2020-03-01", official: null };
    expect(normName("João  da SILVA")).toBe("joao da silva");
    expect(matchStrength(p, { name: "joao da silva", birth: "2020-03-02", official: null })).toBeNull();
    expect(matchStrength(p, { name: "Joao da Silva", birth: "2020-03-01", official: null })).toBe("fraca");
    expect(matchStrength({ ...p, official: "123456" }, { name: "Outro", birth: "2019-01-01", official: "123456" })).toBe("forte");
  });
  it("vincular só a candidato apurado; fraca exige evidência; autor não decide", () => {
    const c = [{ student_id: "s1", strength: "fraca" as const }];
    expect(decisionProblems({ decision: "mesmo-estudante", studentId: "s2", reason: "conferido certidão", evidence: "x" }, c, false)).not.toEqual([]);
    expect(decisionProblems({ decision: "mesmo-estudante", studentId: "s1", reason: "conferido certidão", evidence: null }, c, false)).not.toEqual([]);
    expect(decisionProblems({ decision: "mesmo-estudante", studentId: "s1", reason: "conferida certidão de nascimento", evidence: "certidão" }, c, false)).toEqual([]);
    expect(decisionProblems({ decision: "indeterminado", studentId: null, reason: "aguardando documento" }  as never, c, true)).not.toEqual([]);
    expect(decisionProblems({ decision: "sem-correspondencia", studentId: null, reason: "nada encontrado aqui", evidence: null }, c, false)).not.toEqual([]);
  });
  it("busca devolve só id e força; nunca funde nem cria estudante", () => {
    expect(sql).toContain("RETURNS TABLE(student_id text, strength text)");
    expect(sql).not.toMatch(/INSERT INTO public\.institutional_students|UPDATE public\.(institutional_students|student_identity_versions)|register_institutional_student/);
    expect(sql).toContain("enr:self-reconciliation");
    expect(sql).toContain("enr:not-a-candidate");
    expect(sql).toContain("enr:candidates-pending");
  });
  it("tabelas append-only, sem DML direta, sem anon, leitura só por capacidade", () => {
    expect(sql.match(/doc_numbering_append_only\(\)/g)?.length).toBe(2);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE[^;]*FROM authenticated, anon/);
    expect(sql).not.toMatch(/TO anon/);
    expect(sql).not.toMatch(/USING \(true\)/);
  });
});
