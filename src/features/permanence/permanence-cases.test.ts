import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectCase, sortCases, validateSignal, projectSignal, hmacHex, type CaseRow } from "./permanence-cases";

const c: CaseRow = { id: "C1", schoolId: "E1", studentId: "S1", enrollmentId: "M1", responsibleLabel: "orientacao", openedAt: "2026-10-01T10:00:00Z" };
const cat = [{ code: "alta", label: "Alta", rank: 1 }];

describe("L06 casos", () => {
  it("estado derivado, matrícula temporal e prioridade de catálogo", () => {
    const v = projectCase(c, [{ caseId: "C1", seq: 1, kind: "encaminhamento", dueDate: "2026-10-05", recordedAt: "x" }],
      [{ caseId: "C1", seq: 1, priorityCode: "alta", justification: "faltas lançadas" }], cat, "BA-2026-00001", { from: "2026-02-01", to: null }, "2026-10-10");
    expect([v.state, v.priority?.code, v.enrollment?.activeOnOpening, v.number]).toEqual(["aguardando-retorno-vencido", "alta", true, "BA-2026-00001"]);
    const sem = projectCase(c, [], [{ caseId: "C1", seq: 1, priorityCode: "x", justification: "j" }], cat, null, null, "2026-10-10");
    expect([sem.priority, sem.priorityUnknown, sem.enrollment?.activeOnOpening]).toEqual([null, true, null]);
  });
  it("ordena por rank e nunca por nome", () => {
    const a = projectCase({ ...c, id: "A" }, [], [], cat, null, null, "2026-10-10");
    const b = projectCase({ ...c, id: "B" }, [], [{ caseId: "B", seq: 1, priorityCode: "alta", justification: "j" }], cat, null, null, "2026-10-10");
    expect(sortCases([a, b], new Map()).map((x) => x.id)).toEqual(["B", "A"]);
  });
});

describe("L06 sinalização fora da escola", () => {
  it("recusa identificadores em claro e nunca vira estudante", async () => {
    const d = { territorySchoolId: "E1", identityKey: "k", initials: "AB", birthYear: 2018, sourceKind: "visita" };
    expect(validateSignal({ ...d, identityKey: "chave-1" }, ["cpf"])).toMatch(/sensível/);
    expect(validateSignal({ ...d, identityKey: "chave-1", freeText: "mora na rua X" })).toMatch(/Texto livre/);
    expect(validateSignal({ ...d, identityKey: "chave-1" })).toBeNull();
    expect(await hmacHex("s", " Ana ")).toBe(await hmacHex("s", "ana"));
    const p = projectSignal("G", [{ signalId: "G", seq: 1, kind: "verificacao", enrollmentRef: null }]);
    expect([p.state, p.isStudent, p.closed]).toEqual(["verificacao", false, false]);
  });
  it("migration: sem tabela de estudante/matrícula nova e matriculado exige fato B3", () => {
    const sql = readFileSync("drizzle/migrations/0396_perm06_cases_out_of_school.sql", "utf8");
    expect(sql).not.toMatch(/CREATE TABLE public\.\w*(student|enrollment|matricula)/i);
    expect(sql).toMatch(/permcase:enrollment-not-found/);
    expect(sql).toMatch(/child_ref_hmac text NOT NULL/);
    expect(sql).not.toMatch(/\bcpf\b|full_name|address/i);
  });
});
