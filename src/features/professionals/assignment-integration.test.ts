import { describe, expect, it } from "vitest";
import { canRecordLesson, historicalRecordsPreserved, sectorProjection, teacherProfile, type FormalizedAssignment } from "./assignment-integration";

const a = (o: Partial<FormalizedAssignment> = {}): FormalizedAssignment => ({ id: "A1", personId: "P1", linkId: "V1", schoolId: "E1", classId: "T1", componentId: "MAT", slots: ["seg1"], validFrom: "2026-02-01", validUntil: null, status: "vigencia", endedOn: null, actRef: "ATO-1", ...o });

describe("integração das atribuições formalizadas", () => {
  it("só vigência com ato entra com escrita; proposta e sem ato não entram", () => {
    expect(teacherProfile("P1", "2026-03-01", [a()])[0]!.mode).toBe("escrita");
    expect(teacherProfile("P1", "2026-03-01", [a({ status: "validacao" })])).toEqual([]);
    expect(teacherProfile("P1", "2026-03-01", [a({ actRef: null })])).toEqual([]);
    expect(teacherProfile("P1", "2026-01-15", [a()])).toEqual([]);
  });
  it("diário só no horário, turma e período autorizados", () => {
    const ctx = teacherProfile("P1", "2026-03-01", [a()]);
    expect(canRecordLesson(ctx, "T1", "MAT", "2026-03-01", "seg1")).toBe(true);
    expect(canRecordLesson(ctx, "T1", "MAT", "2026-03-01", "ter1")).toBe(false);
    expect(canRecordLesson(ctx, "T2", "MAT", "2026-03-01", "seg1")).toBe(false);
  });
  it("encerramento/revogação viram histórico só leitura e não apagam registros", () => {
    const ended = a({ status: "revogada", endedOn: "2026-04-10" });
    const ctx = teacherProfile("P1", "2026-05-01", [ended]);
    expect(ctx[0]).toMatchObject({ mode: "somente-leitura-historico", period: { until: "2026-04-10" } });
    expect(canRecordLesson(ctx, "T1", "MAT", "2026-04-01", "seg1")).toBe(false);
    const recs = [{ assignmentId: "A1", id: "d1" }, { assignmentId: "A1", id: "av1" }];
    expect(historicalRecordsPreserved(recs, ended)).toHaveLength(2);
  });
  it("setores recebem só campos permitidos e só do próprio escopo", () => {
    const all = [a(), a({ id: "A2", schoolId: "E2" })];
    const ciece = sectorProjection({ sector: "ciece", schoolIds: "rede" }, "2026-03-01", all);
    expect(ciece).toHaveLength(2);
    expect(Object.keys(ciece[0]!)).not.toContain("personId");
    const dir = sectorProjection({ sector: "direcao", schoolIds: ["E1"] }, "2026-03-01", all);
    expect(dir.map((x) => x.id)).toEqual(["A1"]);
    expect(Object.keys(dir[0]!)).not.toContain("linkId");
    expect(sectorProjection({ sector: "mediador", schoolIds: ["E1"], classIds: ["T9"] }, "2026-03-01", all)).toEqual([]);
  });
});
