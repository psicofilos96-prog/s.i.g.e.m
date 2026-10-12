import { describe, expect, it } from "vitest";
import { eligibleOn, advanceApplication, applicationState, recordParticipation, participationSummary, occurrenceProblems, PARTICIPATION_PROPOSAL, type Allocation } from "./aa-application";

const allocs: Allocation[] = [
  { studentId: "s1", schoolId: "A", classId: "T1", from: "2026-02-01", to: null },
  { studentId: "s2", schoolId: "A", classId: "T1", from: "2026-02-01", to: "2026-05-09" }, // transferido
  { studentId: "s2", schoolId: "B", classId: "T9", from: "2026-05-10", to: null },
  { studentId: "s3", schoolId: "A", classId: "T1", from: "2026-02-01", to: null },
  { studentId: "s3", schoolId: "A", classId: "T2", from: "2026-03-01", to: null }, // sobreposição
];

describe("A&A Lote 06 aplicação e participação", () => {
  it("elegibilidade na data de referência respeita transferência; sobreposição vai à conferência", () => {
    const r = eligibleOn(allocs, "2026-06-01", { schoolIds: new Set(["A"]) });
    expect(r.eligible.map((a) => a.studentId)).toEqual(["s1"]); expect(r.ambiguous).toEqual(["s3"]);
    expect(eligibleOn(allocs, "2026-04-01", { schoolIds: new Set(["A"]) }).eligible.map((a) => a.studentId)).toContain("s2");
    expect(eligibleOn(allocs, "2026-06-01", { schoolIds: new Set(["B"]) }).eligible.map((a) => a.studentId)).toEqual(["s2"]);
  });
  it("estados prevista→iniciada→concluída só por responsável, base esperada e motivo na pendência", () => {
    const base = { applicationId: "ap", responsibles: new Set(["p"]), reason: null, at: "t" };
    expect(advanceApplication({ ...base, events: [], to: "iniciada", actorPersonId: "x", expectedSeq: 0 }).ok).toBe(false);
    const r1 = advanceApplication({ ...base, events: [], to: "iniciada", actorPersonId: "p", expectedSeq: 0 }); if (!r1.ok) throw 0;
    expect(advanceApplication({ ...base, events: [r1.event], to: "pendente", actorPersonId: "p", expectedSeq: 1 })).toMatchObject({ ok: false, reason: /motivo/ });
    expect(advanceApplication({ ...base, events: [r1.event], to: "concluida", actorPersonId: "p", expectedSeq: 0 })).toMatchObject({ ok: false, reason: /base/ });
    const r2 = advanceApplication({ ...base, events: [r1.event], to: "concluida", actorPersonId: "p", expectedSeq: 1 }); if (!r2.ok) throw 0;
    expect(applicationState([r1.event, r2.event], "ap")).toBe("concluida");
  });
  it("participação: categorias configuradas, motivo exigido, dado clínico recusado, correção = nova versão", () => {
    const base = { categories: PARTICIPATION_PROPOSAL, eligibleIds: new Set(["s1"]), prior: [], appState: "iniciada" as const };
    const e = { applicationId: "ap", studentId: "s1", categoryId: "excepcional", reasonCode: null, recordedBy: "p", at: "t" };
    expect(recordParticipation({ ...base, categories: null, entry: e }).ok).toBe(false);
    expect(recordParticipation({ ...base, entry: e })).toMatchObject({ ok: false, reason: /motivo/ });
    expect(recordParticipation({ ...base, entry: { ...e, reasonCode: "laudo TDAH" } })).toMatchObject({ ok: false, reason: /clínico/ });
    expect(recordParticipation({ ...base, entry: { ...e, studentId: "s9", categoryId: "participou" } })).toMatchObject({ ok: false, reason: /elegível/ });
    const v1 = recordParticipation({ ...base, entry: { ...e, categoryId: "ausente" } }); if (!v1.ok) throw 0;
    const v2 = recordParticipation({ ...base, prior: [v1.entry], entry: { ...e, categoryId: "participou" } });
    expect(v2.ok && v2.entry.version).toBe(2);
  });
  it("resumo: sem registro não é ausência; taxa só com denominador", () => {
    const s = participationSummary(["s1", "s2", "s3"], [{ applicationId: "ap", studentId: "s1", categoryId: "participou", reasonCode: null, recordedBy: "p", version: 1, at: "t" },
      { applicationId: "ap", studentId: "s2", categoryId: "nao-realizada", reasonCode: "chuva", recordedBy: "p", version: 1, at: "t" }], PARTICIPATION_PROPOSAL);
    expect(s).toMatchObject({ unregistered: 1, rate: 1 });
    expect(participationSummary(["s1"], [], PARTICIPATION_PROPOSAL).rate).toBeNull();
    expect(occurrenceProblems({ kind: "adaptacao", description: "prova ampliada", studentId: "s1", adaptationApprovedRef: null, isAdaptation: true })).toHaveLength(1);
  });
});
