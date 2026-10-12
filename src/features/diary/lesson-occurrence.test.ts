import { describe, expect, it } from "vitest";
import { canRegisterLesson, lessonSituation, type PlannedLesson } from "./lesson-occurrence";
import type { LessonRecordVersion } from "./lesson-versions";

const planned: PlannedLesson = {
  slotKey: "2026-10-12#b1", date: "2026-10-12", assignmentId: "atr-1",
  classId: "t1", componentId: "mat", titularProfessionalId: "prof-a",
};
const rec = (over: Partial<LessonRecordVersion> = {}, prof = "prof-a", slotDate = "2026-10-12"): LessonRecordVersion => ({
  id: "v1", logicalRecordId: "r1", version: 1, status: "Concluída", createdAt: "x",
  facts: { professionalId: prof, assignmentId: "atr-1", date: slotDate } as LessonRecordVersion["facts"],
  ...over,
});

describe("situação da aula (Docente L04)", () => {
  it("sem registro concluído continua Prevista", () => {
    expect(lessonSituation(planned, undefined, []).situation).toBe("Prevista");
    expect(lessonSituation(planned, rec({ status: "Em elaboração" }), []).situation).toBe("Prevista");
  });
  it("registro concluído do titular é Realizada; retificação preserva versão", () => {
    const v = lessonSituation(planned, rec({ version: 2, rectification: {} as never }), []);
    expect(v.situation).toBe("Realizada");
    expect(v.version).toBe(2);
    expect(v.rectified).toBe(true);
  });
  it("não realizada exige motivo e conflita com registro concluído", () => {
    const act = { kind: "nao-realizada" as const, slotKey: planned.slotKey, agentId: "prof-a", actedAt: "x", reason: "" };
    expect(lessonSituation(planned, undefined, [act]).situation).toBe("Inconsistente");
    const ok = { ...act, reason: "Paralisação" };
    expect(lessonSituation(planned, undefined, [ok]).situation).toBe("Não realizada");
    expect(lessonSituation(planned, rec(), [ok]).situation).toBe("Inconsistente");
  });
  it("reposição concluída torna a original Reposta", () => {
    const acts = [
      { kind: "nao-realizada" as const, slotKey: planned.slotKey, agentId: "a", actedAt: "x", reason: "Chuva" },
      { kind: "reposicao" as const, slotKey: "2026-10-19#b1", replacesSlotKey: planned.slotKey, agentId: "a", actedAt: "y" },
    ];
    expect(lessonSituation(planned, undefined, acts).situation).toBe("Não realizada");
    const done = new Map([["2026-10-19#b1", rec({}, "prof-a", "2026-10-19")]]);
    expect(lessonSituation(planned, undefined, acts, done).situation).toBe("Reposta");
  });
  it("substituto só registra com ato declarado; sem ato falha fechado", () => {
    expect(lessonSituation(planned, rec({}, "prof-b"), []).situation).toBe("Inconsistente");
    const s = [{ kind: "substituicao" as const, slotKey: planned.slotKey, substituteProfessionalId: "prof-b", agentId: "dir", actedAt: "x" }];
    expect(lessonSituation(planned, rec({}, "prof-b"), s).situation).toBe("Substituída");
    expect(canRegisterLesson(planned, "prof-b", []).allowed).toBe(false);
    expect(canRegisterLesson(planned, "prof-b", s).allowed).toBe(true);
  });
  it("registro de outra data/atribuição não conta como realização", () => {
    expect(lessonSituation(planned, rec({}, "prof-a", "2026-10-13"), []).situation).toBe("Inconsistente");
  });
});
