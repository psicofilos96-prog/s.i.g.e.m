import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PROPOSED_EF_DESIGNATION_POLICY as P, criterionIssue, nextOrdinal, officialDesignationRefusal,
  simulateDesignations, summarizePreview, type PreviewClass,
} from "./class-designation";
import { assessClassReadiness, type ReadinessAllocation } from "./pedagogical-readiness";

const cls = (o: Partial<PreviewClass> & { classId: string }): PreviewClass => ({
  schoolId: "s1", academicYearId: "y2027", currentCode: null, category: "ef-5-ano", nature: "regular", studentPositions: [], ...o,
});

describe("U.5 designação de turmas", () => {
  it("primeira 500, segunda 501, terceira 502", () => {
    const r = simulateDesignations([cls({ classId: "a" }), cls({ classId: "b" }), cls({ classId: "c" })], P);
    expect(r.map((x) => x.proposed)).toEqual(["500", "501", "502"]);
  });
  it("escolas e anos diferentes reutilizam 500", () => {
    const r = simulateDesignations([cls({ classId: "a" }), cls({ classId: "b", schoolId: "s2" }), cls({ classId: "c", academicYearId: "y2028" })], P);
    expect(r.map((x) => x.proposed)).toEqual(["500", "500", "500"]);
  });
  it("código encerrado não é reutilizado e lacunas não são compactadas", () => {
    expect(nextOrdinal([0], 0)).toBe(1);
    expect(nextOrdinal([0, 2], 0)).toBe(3);
    const r = simulateDesignations([cls({ classId: "a", ended: true }), cls({ classId: "b" })], P);
    expect(r.map((x) => x.proposed)).toEqual(["500", "501"]);
  });
  it("turno não entra no código", () => {
    expect(simulateDesignations([cls({ classId: "a" })], P)[0]!.proposed).toMatch(/^[0-9]{3}$/);
  });
  it("categoria ausente ⇒ não determinável; nunca deduzida do código/nome atual", () => {
    const r = simulateDesignations([cls({ classId: "a", category: null, currentCode: "501 - 5º ano" })], P);
    expect(r[0]).toMatchObject({ status: "nao-determinavel", proposed: null });
  });
  it("AEE, complementar, EI/EJA e multietapa sem categoria EF ⇒ regra não definida", () => {
    const r = simulateDesignations([
      cls({ classId: "a", nature: "aee" }), cls({ classId: "b", nature: "atividade-complementar" }),
      cls({ classId: "c", category: "ei-maternal" }), cls({ classId: "d", category: "multietapa" }),
    ], P);
    expect(r.every((x) => x.status === "regra-nao-definida" && x.proposed === null)).toBe(true);
  });
  it("código 500 não faz aluno virar 5º ano; multietapa não escolhe posição", () => {
    const input = cls({ classId: "a", studentPositions: ["4-ano", "5-ano"] });
    const [row] = simulateDesignations([input], P, { "ef-5-ano": "5-ano" });
    expect(row!.studentPositions).toEqual(["4-ano", "5-ano"]);
    expect(row!.notes.join(" ")).toMatch(/não escolhe posição/);
    expect(row!.notes.join(" ")).toMatch(/Divergência para conferência/);
  });
  it("preview draft não grava: função pura e writer oficial recusa rascunho", () => {
    const before = JSON.stringify(P);
    simulateDesignations([cls({ classId: "a" })], P);
    expect(JSON.stringify(P)).toBe(before);
    expect(P.status).toBe("rascunho");
    expect(officialDesignationRefusal(P)).toBe("designation:no-homologated-policy");
    expect(officialDesignationRefusal({ ...P, status: "homologada" })).toBeNull();
  });
  it("critério fechado: tipo desconhecido, extras e expressões recusados", () => {
    expect(criterionIssue("js", {})).toBe("designation:unknown-criterion");
    expect(criterionIssue("ordinal-por-categoria", { prefixes: { "ef-5-ano": "5" }, first_ordinal: 0, ordinal_width: 2, sql: "x" })).toBe("designation:invalid-params");
    expect(criterionIssue("ordinal-por-categoria", { prefixes: { "ef-5-ano": "5+1" }, first_ordinal: 0, ordinal_width: 2 })).toBe("designation:invalid-params");
    expect(criterionIssue("ordinal-por-categoria", { prefixes: P.criterion.prefixes, first_ordinal: 0, ordinal_width: 2 })).toBeNull();
  });
  it("resumo agrega conformidade, divergência e duplicidades atuais", () => {
    const s = summarizePreview(simulateDesignations([cls({ classId: "a", currentCode: "500" }), cls({ classId: "b", currentCode: "500" }), cls({ classId: "c", category: null })], P));
    expect(s).toMatchObject({ total: 3, proposta: 2, naoDeterminavel: 1, jaConforme: 1, divergente: 1, duplicidadesAtuais: 1 });
  });
  it("banco: writer oficial consome só política homologada, reserva monotônica e não toca posição", () => {
    const sql = readFileSync("drizzle/migrations/0126_u_class_designation_policy.sql", "utf8");
    expect(sql).toMatch(/applicable_class_designation_policy/);
    expect(sql).toMatch(/JOIN public\.class_designation_policy_homologations/);
    expect(sql).toMatch(/UNIQUE \(school_id, academic_year_id, category_id, ordinal\)/);
    expect(sql).toMatch(/max\(r\.ordinal\) \+ 1/);
    expect(sql).toMatch(/designation:same-person/);
    expect(sql).toMatch(/designation:year-not-writable/);
    expect(sql).not.toMatch(/INSERT INTO public\.allocation_curricular_positions/);
  });
});

const alloc = (o: Partial<ReadinessAllocation> & { allocationId: string }): ReadinessAllocation => ({
  validFrom: "2027-02-01", validUntil: null, position: { id: "5-ano", validFrom: "2027-02-01", validUntil: null }, resolvedMatrices: ["m-ef1"], ...o,
});

describe("U.1 prontidão pedagógica R4/R6/R7/R8", () => {
  const on = "2027-03-10";
  it("R7: exatamente uma ⇒ pronta", () => {
    expect(assessClassReadiness({ classId: "t", on, nature: "regular", allocations: [alloc({ allocationId: "a" })] }).ready).toBe(true);
  });
  it("R6: regular sem posição bloqueia, sem inferência", () => {
    const r = assessClassReadiness({ classId: "t", on, nature: "regular", allocations: [alloc({ allocationId: "a", position: null, resolvedMatrices: [] })] });
    expect(r.ready).toBe(false);
    expect(r.allocations[0]).toMatchObject({ issues: ["sem-posicao"], matrix: null });
  });
  it("R7: zero e duas bloqueiam", () => {
    const r = assessClassReadiness({ classId: "t", on, nature: "regular", allocations: [alloc({ allocationId: "a", resolvedMatrices: [] }), alloc({ allocationId: "b", resolvedMatrices: ["m1", "m2"] })] });
    expect(r.allocations.map((a) => a.issues[0])).toEqual(["sem-matriz", "matriz-ambigua"]);
  });
  it("R7: multietapa resolve várias matrizes legitimamente", () => {
    const r = assessClassReadiness({ classId: "t", on, nature: "regular", allocations: [alloc({ allocationId: "a", resolvedMatrices: ["m-ef1"] }), alloc({ allocationId: "b", position: { id: "6-ano", validFrom: "2027-02-01", validUntil: null }, resolvedMatrices: ["m-ef2"] })] });
    expect(r).toMatchObject({ ready: true, matrices: ["m-ef1", "m-ef2"] });
  });
  it("R8: alocação encerrada deixa de produzir efeito sem apagar o registro", () => {
    const a = alloc({ allocationId: "a", validUntil: "2027-03-01", resolvedMatrices: [] });
    const r = assessClassReadiness({ classId: "t", on, nature: "regular", allocations: [a] });
    expect(r.allocations[0]).toMatchObject({ active: false, issues: [] });
    expect(a.position).not.toBeNull();
  });
  it("R8: posição anterior à alocação ⇒ inconsistência temporal", () => {
    const r = assessClassReadiness({ classId: "t", on, nature: "regular", allocations: [alloc({ allocationId: "a", position: { id: "5-ano", validFrom: "2027-01-01", validUntil: null } })] });
    expect(r.allocations[0]!.issues).toEqual(["inconsistencia-temporal"]);
  });
  it("R4: AEE/complementar fora da correspondência regular, sem posição artificial; natureza ausente pendente", () => {
    const aee = assessClassReadiness({ classId: "t", on, nature: "aee", allocations: [alloc({ allocationId: "a", position: null })] });
    expect(aee).toMatchObject({ regular: false, ready: false, matrices: [] });
    expect(aee.allocations[0]!.issues).toEqual([]);
    expect(assessClassReadiness({ classId: "t", on, nature: null, allocations: [] }).classIssues).toContain("natureza-nao-definida");
  });
  it("U.4: jornada exigida sem valor ⇒ pendência estruturada", () => {
    expect(assessClassReadiness({ classId: "t", on, nature: "regular", journeyRequiredButUndefined: true, allocations: [] }).classIssues).toEqual(["jornada-nao-definida"]);
  });
});
