import { describe, expect, it } from "vitest";
import { currentNormVersions, normativeStateFromRows, type NormVersionRow } from "./assessment-normative-sources";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import { assessmentConfigurations } from "./assessment-fixtures";
import { applicableAssessmentRule, periodModelFromRule } from "./assessment-period-sources";

// Linhas SINTÉTICAS de teste (nunca gravadas): provam o contrato de leitura.
const rule = createAssessmentRuleFixtures()[0]!;
const conf = assessmentConfigurations.find((c) => c.allowsGrades) ?? assessmentConfigurations[0]!;
const row = (o: Partial<NormVersionRow>): NormVersionRow => ({
  id: crypto.randomUUID(), norm_kind: "regra-avaliativa", logical_id: "r1", version: 1, supersedes_id: null,
  academic_year_id: "ay", stage_ids: [], class_ids: ["t1"], valid_from: null, valid_until: null,
  definition: rule, homologation_act_ref: "ato-teste", recorded_at: "2026-01-01", ...o,
});
const periods = [{ id: "p1", label: "Período 1", starts_on: "2026-02-01", ends_on: "2026-04-30" }];
const base = { classId: "t1", stageId: undefined, academicYearId: "ay", periods };

describe("6D.FINAL — fonte única de regra/configuração", () => {
  it("sem configuração homologada ⇒ indisponível, nunca laboratório", () => {
    const { state, rules } = normativeStateFromRows({ ...base, rows: [] });
    expect(state.kind).toBe("inexistente");
    expect(rules).toEqual([]);
  });
  it("configuração homologada + períodos oficiais ⇒ estado homologado", () => {
    const { state } = normativeStateFromRows({ ...base, rows: [row({ norm_kind: "configuracao-avaliativa", logical_id: "c1", definition: conf })] });
    expect("configuration" in state && state.configuration.id).toBe("c1");
    expect("structure" in state && state.structure.periods.map((p) => p.id)).toEqual(["p1"]);
  });
  it("sem períodos oficiais ⇒ indisponível", () => {
    const { state } = normativeStateFromRows({ ...base, periods: [], rows: [row({ norm_kind: "configuracao-avaliativa", definition: conf })] });
    expect(state.kind).toBe("inexistente");
  });
  it("versão vigente é a maior da cadeia; histórico preservado", () => {
    const rows = [row({ version: 1 }), row({ version: 2 })];
    expect(currentNormVersions(rows, "regra-avaliativa").map((r) => r.version)).toEqual([2]);
    const out = normativeStateFromRows({ ...base, rows });
    expect(out.rules.map((r) => r.version)).toEqual([2]);
    expect(out.ruleVersions.map((r) => r.version).sort()).toEqual([1, 2]);
    expect(out.rules[0]!.status).toBe("homologada");
  });
  it("vigência explícita: fora do intervalo não se aplica", () => {
    const out = normativeStateFromRows({ ...base, date: "2027-01-01", rows: [row({ valid_until: "2026-12-31" })] });
    expect(out.rules).toEqual([]);
  });
  it("duas configurações aplicáveis ⇒ decisão institucional, sem escolha implícita", () => {
    const rows = [row({ norm_kind: "configuracao-avaliativa", logical_id: "a", definition: conf }), row({ norm_kind: "configuracao-avaliativa", logical_id: "b", definition: conf })];
    expect(normativeStateFromRows({ ...base, rows }).state.kind).toBe("inexistente");
  });
  it("paridade: mesma linha ⇒ mesma regra e mesmo modelo para todas as superfícies", () => {
    const rows = [row({})];
    const a = normativeStateFromRows({ ...base, rows }).rules;
    const b = normativeStateFromRows({ ...base, rows }).rules;
    const ra = applicableAssessmentRule(a, "ay", undefined, "t1");
    const rb = applicableAssessmentRule(b, "ay", undefined, "t1");
    expect(periodModelFromRule(ra)).toEqual(periodModelFromRule(rb));
    expect(ra?.id).toBe("r1");
  });
});

import { applicableAttendancePolicies, standingRuleSetsFromRows } from "./assessment-normative-sources";
import { officialRegisteredCount, officialEntriesFromVersions } from "./assessment-journey-sources";

describe("6D.FINAL.5 — frequência, situação e contagens só de fatos oficiais", () => {
  const pol = (o: object) => ({ id: "f1", version: 1, status: "homologada", definition: {}, homologation_act_ref: "ato", valid_from: null, valid_until: null, ...o });
  it("política de frequência: sem homologação ou sem ato ⇒ nenhuma", () => {
    expect(applicableAttendancePolicies([pol({ status: "rascunho" }), pol({ id: "f2", homologation_act_ref: null })])).toEqual([]);
  });
  it("política de frequência: versão mais recente e vigência explícita", () => {
    const out = applicableAttendancePolicies([pol({}), pol({ version: 2 })], "2026-05-01");
    expect(out.map((p) => (p as { version: number }).version)).toEqual([2]);
    expect(applicableAttendancePolicies([pol({ valid_until: "2026-01-01" })], "2026-05-01")).toEqual([]);
  });
  it("regra de situação: só a cadeia persistida do ano, versão vigente", () => {
    const rows = [row({ norm_kind: "regra-de-situacao-academica", logical_id: "s1", version: 1 }), row({ norm_kind: "regra-de-situacao-academica", logical_id: "s1", version: 2 })];
    expect(standingRuleSetsFromRows(rows, "ay").map((r) => r.version)).toEqual([2]);
    expect(standingRuleSetsFromRows(rows, "outro")).toEqual([]);
  });
  it("contagem e percurso: rascunho e versão superada nunca contam", () => {
    const v = (o: object) => ({ id: crypto.randomUUID(), logicalEntryId: "e1", version: 1, instrumentId: "i1", studentId: "s", placement: {}, value: { kind: "numerica", value: 7 }, status: "registrado", recordedAt: "2026-03-01", recordedByAssignmentId: "a", ...o }) as never;
    const v1 = v({}); const v2 = v({ version: 2, supersedesVersionId: (v1 as { id: string }).id, value: { kind: "numerica", value: 8 } });
    const draft = v({ logicalEntryId: "e2", status: "rascunho" });
    expect(officialRegisteredCount([v1, v2, draft], "i1")).toBe(1);
    const entries = officialEntriesFromVersions([v1, v2, draft]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.value).toEqual({ kind: "numerica", value: 8 });
  });
});
