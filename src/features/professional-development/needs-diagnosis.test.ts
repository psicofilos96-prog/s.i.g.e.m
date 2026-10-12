import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { consolidate, evidenceProblems } from "./needs-diagnosis";

const SQL = readFileSync("drizzle/migrations/0432_dev04_needs_diagnosis.sql", "utf8");

describe("L04 diagnóstico de necessidades", () => {
  it("evidência obrigatória e nunca individual", () => {
    expect(evidenceProblems([], 5)).toContain("Informe ao menos uma evidência.");
    expect(evidenceProblems([{ kind: "documento", document_version_ref: "d", summary: "Ata da reunião escolar", person_id: "x" } as never], 5)).toContain("Evidência não pode identificar pessoa.");
  });
  it("resultado agregado exige limiar aprovado e grupo ≥ limiar", () => {
    const e = { kind: "resultado-agregado" as const, instrument_ref: "ins-1", group_size: 4, summary: "Resultado agregado da turma" };
    expect(evidenceProblems([e], null)[0]).toMatch(/não aprovado/);
    expect(evidenceProblems([e], 5)[0]).toMatch(/menor que o limiar/);
    expect(evidenceProblems([{ ...e, group_size: 5 }], 5)).toEqual([]);
  });
  it("consolida por necessidade; prioridade só declarada e conflito sinalizado", () => {
    const subs = [
      { id: "s1", origin: "escola" as const, schoolId: "E1", topic: "Leitura inicial", createdAt: "" },
      { id: "s2", origin: "supervisao" as const, schoolId: "E2", topic: "Alfabetização", createdAt: "" },
      { id: "s3", origin: "orientacao" as const, schoolId: null, topic: "  leitura   INICIAL ", createdAt: "" },
    ];
    const r = consolidate(subs, [
      { submissionId: "s1", needId: "n1", priority: "media", priorityReason: "Pedido de três turmas do primeiro ano" },
      { submissionId: "s2", needId: "n1", priority: "alta", priorityReason: "Recorrência registrada em duas visitas" },
    ]);
    expect(r[0]).toMatchObject({ needId: "n1", submissions: 2, schools: 2, priority: "alta", conflictingPriorities: true });
    expect(r[1]).toMatchObject({ needId: null, submissions: 1, priority: null });
  });
  it("banco recusa evidência individual, agregado sem limiar e autoaprovação; sem coluna de pessoa avaliada", () => {
    for (const n of ["dev:individual-evidence", "dev:threshold-not-approved", "dev:group-below-threshold", "dev:self-approval", "dev:evidence-required", "REVOKE SELECT ON public.dev_need_evidence"]) expect(SQL).toContain(n);
    expect(SQL).not.toMatch(/\b(student_id|evaluated_person|professional_id)\s+uuid/);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
