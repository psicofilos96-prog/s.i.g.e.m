// Lote 20 — integrações funcionais do Desenvolvimento.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { certificateFromCompletion, completionFromEvidence, externalHistory, programImpact } from "./development-flow";
import type { CompletionCriteria } from "./completion-engine";
import type { AttendanceRecord } from "./formation-attendance";

const crit: CompletionCriteria = { minAttendancePct: 75, minActivitiesDelivered: 1, rubricVersionId: "rub-1", acceptedOutcomes: ["atingiu"], approved: true };
const rec = (unitId: string, status: AttendanceRecord["status"], version = 1): AttendanceRecord =>
  ({ unitId, version, mode: "presencial", status, evidenceKind: "lista-de-presenca", evidenceRef: "doc", connectedMinutes: null, reason: null });

describe("frequência registrada → conclusão", () => {
  it("percentual sai das evidências: 3 presenças e 1 falta = 75% e apto", () => {
    const a = completionFromEvidence(crit, { expectedUnits: ["m1", "m2", "m3", "m4"], attendance: [rec("m1", "presente"), rec("m2", "presente"), rec("m3", "presente"), rec("m4", "ausente")],
      activitiesDelivered: 1, results: [{ rubricVersionId: "rub-1", outcome: "atingiu", reviewPending: false }] });
    expect(a.attendancePct).toBe(75);
    expect(a.verdict).toBe("apto");
  });
  it("unidade não lançada nunca vira falta: indeterminado", () => {
    const a = completionFromEvidence(crit, { expectedUnits: ["m1", "m2"], attendance: [rec("m1", "presente")], activitiesDelivered: 1,
      results: [{ rubricVersionId: "rub-1", outcome: "atingiu", reviewPending: false }] });
    expect(a.attendancePct).toBeNull();
    expect(a.verdict).toBe("indeterminado");
  });
  it("retificação vale: versão 2 ausente derruba a presença da versão 1", () => {
    const a = completionFromEvidence(crit, { expectedUnits: ["m1", "m2"], attendance: [rec("m1", "presente"), rec("m2", "presente"), rec("m2", "ausente", 2)],
      activitiesDelivered: 1, results: [{ rubricVersionId: "rub-1", outcome: "atingiu", reviewPending: false }] });
    expect(a.attendancePct).toBe(50);
    expect(a.verdict).toBe("nao-apto");
  });
});

describe("avaliação → critério", () => {
  it("resultado de outra rubrica é ignorado e deixa a conclusão indeterminada", () => {
    const a = completionFromEvidence(crit, { expectedUnits: ["m1"], attendance: [rec("m1", "presente")], activitiesDelivered: 1,
      results: [{ rubricVersionId: "rub-outra", outcome: "atingiu", reviewPending: false }] });
    expect(a.resultIgnored).toBe(1);
    expect(a.verdict).toBe("indeterminado");
  });
  it("desfecho não aceito pelo critério reprova", () => {
    const a = completionFromEvidence(crit, { expectedUnits: ["m1"], attendance: [rec("m1", "presente")], activitiesDelivered: 1,
      results: [{ rubricVersionId: "rub-1", outcome: "atingiu-parcialmente", reviewPending: false }] });
    expect(a.verdict).toBe("nao-apto");
  });
});

describe("conclusão → certificado", () => {
  it("sem confirmação, com não conclusão ou autoconfirmação: recusa", () => {
    expect(certificateFromCompletion({ confirmation: null, participant: "p" })).toHaveLength(1);
    expect(certificateFromCompletion({ confirmation: { decision: "nao-conclusao", confirmer: "g" }, participant: "p" })).toHaveLength(1);
    expect(certificateFromCompletion({ confirmation: { decision: "conclusao", confirmer: "p" }, participant: "p" })).toHaveLength(1);
    expect(certificateFromCompletion({ confirmation: { decision: "conclusao", confirmer: "g" }, participant: "p" })).toEqual([]);
  });
  it("banco exige conclusão confirmada para preparar certificado", () => {
    expect(readFileSync("drizzle/migrations/0445_dev16_certificates.sql", "utf8")).toContain("RAISE EXCEPTION 'dev:not-concluded'");
  });
});

describe("formação externa → histórico", () => {
  const v = (id: string, t: string, version: number, h: number) => ({ id, training_id: t, version, title: "Curso", provider: "Inst", hours_minutes: h, period_start: "2026-01-01", period_end: "2026-02-01" });
  it("só formações da pessoa, última versão; carga só das validadas", () => {
    const h = externalHistory(new Set(["t1", "t2"]), [v("a1", "t1", 1, 600), v("a2", "t1", 2, 480), v("b1", "t2", 1, 300), v("c1", "t-outra", 1, 999)],
      [{ version_id: "a2", seq: 1, stage: "conferencia", outcome: "conforme" }, { version_id: "a2", seq: 2, stage: "analise", outcome: "favoravel" },
       { version_id: "a2", seq: 3, stage: "decisao", outcome: "validado" }, { version_id: "b1", seq: 1, stage: "conferencia", outcome: "conforme" }]);
    expect(h.items.map((i) => i.id).sort()).toEqual(["a2", "b1"]);
    expect(h.validatedMinutes).toBe(480);
  });
});

describe("programa → impacto sem causalidade", () => {
  const obs = [{ moment: "antes" as const, observedOn: "2026-01-01", value: 10, groupSize: 20, schoolId: null },
    { moment: "depois" as const, observedOn: "2026-06-01", value: 14, groupSize: 20, schoolId: null }];
  it("variação é descritiva e nunca causal", () => {
    const r = programImpact(obs, null, { interpretation: "Observou-se aumento do indicador entre os dois momentos no mesmo escopo.", limitations: "Grupos e contexto diferentes." });
    expect(r.causal).toBe(false);
    expect(r.change.comparable && r.change.difference).toBe(4);
    expect(r.problems).toEqual([]);
  });
  it("interpretação com afirmação causal é recusada (tela e banco)", () => {
    const r = programImpact(obs, null, { interpretation: "O indicador subiu graças à formação oferecida pela rede neste semestre.", limitations: "Nenhuma relevante aqui." });
    expect(r.problems).toContain("Interpretação não pode afirmar causalidade");
    expect(readFileSync("drizzle/migrations/0506_dev20_impact_reading_no_causal_claim.sql", "utf8")).toContain("dev:causal-claim");
  });
  it("sem leitura humana não há conclusão de impacto", () => {
    expect(programImpact(obs, null, null).problems).toEqual(["Sem leitura humana registrada"]);
  });
});
