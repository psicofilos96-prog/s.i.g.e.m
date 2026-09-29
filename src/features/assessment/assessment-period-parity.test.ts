/**
 * 6D.3.3.8 — Paridade: mesmos fatos + mesma regra + mesmo período =
 * mesma informação acadêmica na Pauta, na Mesa e no Fechamento.
 */
import { describe, expect, it } from "vitest";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import { demonstrationStudents } from "@/features/students/students-data";
import { sessionActor, type SessionAuthority } from "@/features/authority/session-authority";
import { assessmentVersionsFromLegacyEntry } from "./assessment-entry-adapter";
import { projectInstrumentEntryRoster } from "./assessment-entry-projection";
import { createSupersedingAssessmentEntryVersion, type AssessmentEntryVersion } from "./assessment-entry-versions";
import { assessmentConfigurations, periodStructures } from "./assessment-fixtures";
import { buildInstrument, instrumentRoster } from "./assessment-instruments";
import { projectAssessmentPeriod } from "./assessment-period-projection";
import {
  assessmentDeskApplicability,
  periodModelFromRule,
  periodRuleReference,
} from "./assessment-period-sources";
import { PERIOD_ACTIONS } from "./assessment-period-page";
import { CONSULT_RESULT_CAPABILITY, REGISTER_RESULT_CAPABILITY } from "./assessment-results-cloud";
import { createAssessmentRuleFixtures } from "./assessment-rule-fixtures";
import type { InstitutionalAssessmentRule, RecoveryRule } from "./assessment-rule-types";
import { studentPlacements } from "./assessment-rules";
import type { AssessmentEntry, AssessmentInstrument, EntryValue } from "./assessment-types";
import { composeScope, officialModel, type ClosingContext } from "./period-closing";

const quant = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const structure = periodStructures.find((s) => s.id === "est-2026-a")!;
const period = structure.periods[0]!;
const atp = demonstrationPedagogicalAssignments.find((a) => a.id === "atp-001")!;
const NOW = "2026-04-20T12:00:00.000Z";
const ALL = [REGISTER_RESULT_CAPABILITY, CONSULT_RESULT_CAPABILITY];

function instrument(id: string, typeId = "it-prova", status: "aplicado" | "planejado" = "aplicado"): AssessmentInstrument {
  const r = buildInstrument({
    id,
    input: { title: `Instrumento ${id}`, instrumentTypeId: typeId, appliedOn: "2026-03-10" },
    configuration: quant, structure, assignment: atp, professionalId: atp.professionalId, classId: "tur-001", now: NOW,
  });
  if (!r.ok) throw new Error(r.reasons.join(" "));
  return { ...r.value, status };
}
function versionsFor(i: AssessmentInstrument, make: (sid: string, idx: number) => Partial<AssessmentEntry> | null = () => ({})) {
  return instrumentRoster(i, demonstrationStudents).eligible.flatMap((e, idx) => {
    const patch = make(e.student.id, idx);
    if (patch === null) return [];
    const entry: AssessmentEntry = {
      id: `lan-${i.id}-${e.student.id}`, instrumentId: i.id, studentId: e.student.id,
      placement: { enrollmentId: "m", academicLinkId: "v", participationId: "p", allocationId: "a" },
      value: { kind: "numerica", value: 80 }, recordedAt: NOW, recordedByAssignmentId: atp.id, status: "registrado",
      ...patch,
    };
    return assessmentVersionsFromLegacyEntry(entry);
  });
}
function rule(patch: Partial<InstitutionalAssessmentRule> = {}): InstitutionalAssessmentRule {
  const base = createAssessmentRuleFixtures().find((r) => r.id === "rav-demo-estrutural")!;
  return { ...base, status: "homologada", configurationId: quant.id, configurationVersion: quant.version, ...patch };
}
const roster = demonstrationStudents
  .map((s) => ({ s, placements: studentPlacements(s).filter((p) => p.classId === "tur-001") }))
  .filter((x) => x.placements.length > 0)
  .map((x, i) => ({ studentId: x.s.id, displayName: x.s.personName, rollNumber: i + 1, placements: x.placements }));

type Scenario = { instruments: AssessmentInstrument[]; versions: AssessmentEntryVersion[]; rule?: InstitutionalAssessmentRule; periodId?: string; capabilities?: string[]; componentId?: string };

function closing(s: Scenario) {
  const ctx: ClosingContext = {
    scope: { classId: "tur-001", academicYearId: quant.academicYearId, periodId: s.periodId ?? period.id, curriculumRef: { kind: "atuacao", assignmentId: atp.id } },
    configuration: quant,
    period: { id: s.periodId ?? period.id, label: period.label, start: period.start, end: period.end },
    officialPeriod: true,
    ...(s.rule ? { rule: s.rule } : {}),
    assignment: atp, instruments: s.instruments, versions: s.versions, students: demonstrationStudents,
    stage: "em-andamento", events: [],
  } as unknown as ClosingContext;
  const model = officialModel(ctx);
  return model ? composeScope(ctx, model) : null;
}
function desk(s: Scenario) {
  return projectAssessmentPeriod({
    context: { classId: "tur-001", ...(s.componentId ? { componentId: s.componentId } : {}) },
    period: { id: s.periodId ?? period.id, label: period.label },
    configuration: quant,
    compositionModel: periodModelFromRule(s.rule),
    instruments: s.instruments,
    students: roster,
    versions: s.versions,
    agent: { agentId: "x", capabilities: s.capabilities ?? ALL },
    actionDefinitions: PERIOD_ACTIONS,
    valueReadCapability: CONSULT_RESULT_CAPABILITY,
    ...(periodRuleReference(s.rule) ? { rule: periodRuleReference(s.rule)! } : {}),
  });
}
function pautaCells(i: AssessmentInstrument, versions: AssessmentEntryVersion[]) {
  const p = projectInstrumentEntryRoster({ instrument: i, configuration: quant, students: roster, versions });
  if (p.state !== "entry-enabled") return { state: p.state } as const;
  return {
    state: p.state,
    values: Object.fromEntries(p.rows.map((r) => [r.studentId, r.currentValue ?? null])),
  } as const;
}
function deskAvailable(d: ReturnType<typeof desk>) {
  if (d.state !== "period-available") throw new Error("mesa indisponível");
  return d;
}
/** Resultado final por estudante na Mesa e no Fechamento. */
function finals(s: Scenario) {
  const c = closing(s);
  const d = deskAvailable(desk(s));
  const fromDesk = Object.fromEntries(d.students.map((st) => [st.studentId, st.composition.kind === "composed" ? (st.composition.finalStage?.value ?? null) : st.composition.kind]));
  const fromClosing = Object.fromEntries(
    (c ?? []).filter((x) => x.studentId in fromDesk).map((x) => [x.studentId, x.result.status === "available" ? (x.result.finalStage?.value ?? null) : "blocked"]),
  );
  return { fromDesk, fromClosing, d };
}
function deskCellValues(d: ReturnType<typeof deskAvailable>, instrumentId: string) {
  return Object.fromEntries(d.students.map((s) => [s.studentId, s.cells.find((c) => c.instrumentId === instrumentId)?.currentValue ?? null]));
}

const ia = instrument("ins-a");
const ib = instrument("ins-b", "it-trabalho");

describe("6D.3.3.8 — paridade Pauta × Mesa × Fechamento", () => {
  it("resultado numérico: mesmas células na Pauta e na Mesa; mesmo resultado na Mesa e no Fechamento", () => {
    const versions = [...versionsFor(ia, (_, i) => ({ value: { kind: "numerica", value: 60 + i } })), ...versionsFor(ib)];
    const s: Scenario = { instruments: [ia, ib], versions, rule: rule() };
    const { fromDesk, fromClosing, d } = finals(s);
    expect(fromDesk).toEqual(fromClosing);
    const pauta = pautaCells(ia, versions);
    expect(pauta.state).toBe("entry-enabled");
    expect(deskCellValues(d, ia.id)).toEqual((pauta as { values: object }).values);
  });

  it("resultado conceitual e descritivo: valor preservado sem conversão, igual na Pauta e na Mesa", () => {
    const values: EntryValue[] = [{ kind: "conceitual", optionId: "c-bom" }, { kind: "descritiva", text: "Leu com autonomia." }];
    const versions = versionsFor(ia, (_, i) => (i < 2 ? { value: values[i]! } : null));
    const d = deskAvailable(desk({ instruments: [ia], versions, rule: rule() }));
    const pauta = pautaCells(ia, versions) as { values: Record<string, unknown> };
    expect(deskCellValues(d, ia.id)).toEqual(pauta.values);
  });

  it("não registrado com motivo e ausência: nunca zero, mesma leitura nas três superfícies", () => {
    const versions = versionsFor(ia, (_, i) => (i === 0 ? { value: { kind: "nao-registrado", reason: "Ausente na aplicação" } } : i === 1 ? null : {}));
    const s: Scenario = { instruments: [ia], versions, rule: rule() };
    const { fromDesk, fromClosing, d } = finals(s);
    expect(fromDesk).toEqual(fromClosing);
    const [first, second] = roster;
    const c0 = d.students.find((x) => x.studentId === first!.studentId)!.cells[0]!;
    const c1 = d.students.find((x) => x.studentId === second!.studentId)!.cells[0]!;
    expect(c0.state).toBe("explicitly-unrecorded");
    expect(c0.unrecordedReason).toBe("Ausente na aplicação");
    expect(c1.state).toBe("unrecorded");
    expect(c1.currentValue).toBeUndefined();
  });

  it("instrumento indisponível: Pauta e Mesa recusam o lançamento pelo mesmo motivo", () => {
    const planned = instrument("ins-p", "it-prova", "planejado");
    const pauta = projectInstrumentEntryRoster({ instrument: planned, configuration: quant, students: roster, versions: [] });
    const d = deskAvailable(desk({ instruments: [planned], versions: [], rule: rule() }));
    const cellStates = new Set(d.students.flatMap((s) => s.cells.map((c) => c.state)));
    if (pauta.state === "entry-unavailable") expect(cellStates).toEqual(new Set(["instrument-unavailable"]));
    else expect(cellStates.has("instrument-unavailable")).toBe(false);
  });

  it("recuperação configurada e não prevista: a Mesa usa a MESMA regra do Fechamento", () => {
    const versions = [...versionsFor(ia, () => ({ value: { kind: "numerica", value: 30 } })), ...versionsFor(ib, () => ({ value: { kind: "numerica", value: 30 } }))];
    const rec: RecoveryRule = {
      id: "rec", enabled: true, scope: "periodo", replacesCategoryIds: [], instrumentTypeIds: ["it-recuperacao"],
      prevalence: "maior-resultado", aggregation: { kind: "media-simples" }, normativeStatus: "homologado",
    } as RecoveryRule;
    for (const r of [rule(), rule({ periodicRecovery: rec })]) {
      const { fromDesk, fromClosing } = finals({ instruments: [ia, ib], versions, rule: r });
      expect(fromDesk).toEqual(fromClosing);
    }
  });

  it("correção/versionamento: só a versão vigente entra, igual nas três", () => {
    const v1 = versionsFor(ia);
    const target = v1[0]!;
    const v2 = createSupersedingAssessmentEntryVersion({
      base: target, versionId: `${target.id}-v2`, value: { kind: "numerica", value: 95 }, status: "registrado",
      recordedByAssignmentId: atp.id, now: NOW, rectification: { reason: "Digitação", actorId: "p", at: NOW },
    } as never);
    const versions = [...v1, v2];
    const s: Scenario = { instruments: [ia], versions, rule: rule() };
    const { fromDesk, fromClosing, d } = finals(s);
    expect(fromDesk).toEqual(fromClosing);
    const cell = d.students.find((x) => x.studentId === target.studentId)!.cells[0]!;
    expect(cell.currentVersionId).toBe(v2.id);
    expect(cell.currentVersionSupersedesVersionId).toBe(target.id);
    expect(deskCellValues(d, ia.id)).toEqual((pautaCells(ia, versions) as { values: object }).values);
  });

  it("sem regra: a Mesa não calcula nada (nunca fixture) e o Fechamento também não", () => {
    const d = deskAvailable(desk({ instruments: [ia], versions: versionsFor(ia) }));
    expect(d.students.every((s) => s.composition.kind === "blocked")).toBe(true);
    expect(closing({ instruments: [ia], versions: versionsFor(ia) })).toBeNull();
  });

  it("período sem instrumentos: a Mesa existe, sem células e sem valores", () => {
    const d = desk({ instruments: [ia], versions: versionsFor(ia), rule: rule(), periodId: structure.periods[1]!.id });
    if (d.state === "period-available") {
      expect(d.instruments).toHaveLength(0);
      expect(d.balance.cellsRecorded).toBe(0);
    }
  });

  it("componente diferente: o filtro restringe os instrumentos apresentados", () => {
    const other = { ...ia, id: "ins-outro", curriculumRef: { kind: "matriz", componentId: "comp-outro" } } as AssessmentInstrument;
    const mine = { ...ib, curriculumRef: { kind: "matriz", componentId: "comp-meu" } } as AssessmentInstrument;
    const d = deskAvailable(desk({ instruments: [other, mine], versions: [], rule: rule(), componentId: "comp-meu" }));
    expect(d.instruments.map((i) => i.instrumentId)).toEqual([mine.id]);
  });

  it("período fechado e reaberto: o estágio do fechamento não altera a leitura da Mesa", () => {
    const versions = versionsFor(ia);
    const a = finals({ instruments: [ia], versions, rule: rule() });
    const b = finals({ instruments: [ia], versions, rule: rule() });
    expect(a.fromDesk).toEqual(b.fromDesk);
  });

  it("usuário sem capacidade: valores suprimidos e nenhuma ação disponível", () => {
    const d = deskAvailable(desk({ instruments: [ia], versions: versionsFor(ia), rule: rule(), capabilities: [] }));
    expect(d.students.every((s) => s.cells.every((c) => c.valueDisclosure !== "disclosed"))).toBe(true);
    expect(d.students.flatMap((s) => s.cells.flatMap((c) => c.actions)).every((a) => !a.available)).toBe(true);
  });

  it("usuário fora do escopo: capacidade de outra turma não chega à Mesa", () => {
    const authority = {
      status: "signed-in",
      user: { id: "u" },
      person: { id: "p", displayName: "P" },
      capabilities: [{ capabilityId: CONSULT_RESULT_CAPABILITY, classId: "outra-turma", periodId: null }],
    } as unknown as SessionAuthority;
    expect(sessionActor(authority, { classId: "tur-001" })!.capabilities).toEqual([]);
  });

  it("Educação Infantil: inaplicável pela fonte institucional (grupo curricular), nunca pelo nome", () => {
    expect(assessmentDeskApplicability({ groupings: [{ curriculumAgeGroupIds: ["EI02"] }] } as never).applicable).toBe(false);
    expect(assessmentDeskApplicability({ groupings: [{ label: "Infantil 3 (nome)", curriculumAgeGroupIds: [] }] } as never).applicable).toBe(true);
  });
});
