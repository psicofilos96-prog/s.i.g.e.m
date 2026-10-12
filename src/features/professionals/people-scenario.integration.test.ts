/**
 * L23 — cenário integrado sintético (sem banco): uma professora, dois vínculos, duas escolas.
 * Encadeia os núcleos L04–L22 sobre as MESMAS fixtures; nada é persistido.
 * O isolamento RLS no banco é provado em supabase/tests/gp23_people_rls_isolation.sql.
 */
import { describe, expect, it } from "vitest";
import { checkPlacement, movementHistory, type Placement } from "./placement-exercise";
import { stateOf, checkEvent, type DesignationEvent } from "./role-designations";
import { qty, toMinutes, type DurationRule } from "./workload";
import { activeSubstitute, type SubstitutionEvent } from "./leave-substitution";
import { ASSIGNMENT_STAGES, checkAssignmentEvent, isEffective, verify, type AEvent, type AssignmentDraft, type CheckContext, type StageCaps } from "./class-assignment-flow";
import { teacherProfile, canRecordLesson } from "./assignment-integration";
import { coverageGrid } from "./people-hub-model";
import { simulate } from "./staffing-simulator";
import { decide } from "./people-access";

const P = "P-ana", V1 = "V1", V2 = "V2", EA = "E-A", EB = "E-B";
const pl = (o: Partial<Placement>): Placement => ({ id: "x", linkLogicalId: V1, personId: P, schoolId: EA, validFrom: "2026-01-01", validUntil: null, actRef: "ato", reason: null, authorUserId: "dp", technical: false, recordedAt: "2026-01-01", ...o });

describe("cenário integrado de Gestão de Pessoas", () => {
  const placements = [
    pl({ id: "p1", validUntil: "2026-05-31" }),
    pl({ id: "p2", schoolId: EB, validFrom: "2026-06-01" }),
    pl({ id: "p3", linkLogicalId: V2, schoolId: EB }),
  ];

  it("dois vínculos, duas escolas e transferência temporal", () => {
    expect(checkPlacement(placements[1]!, [placements[0]!], null)).toBeNull();
    expect(checkPlacement(pl({ id: "p9", schoolId: EB, validFrom: "2026-03-01" }), [placements[0]!], null)).toBe("excede-escolas-autorizadas");
    const mv = movementHistory(V1, placements);
    expect(mv.find((m) => m.date === "2026-06-01")).toMatchObject({ from: EA, to: EB });
  });

  it("designação vigente só pelo ledger, sem autodesignação", () => {
    const d: DesignationEvent = { designationId: "D1", seq: 1, kind: "registro", functionLogicalId: "coordenacao", linkLogicalId: V2, personId: P, schoolId: EB, validFrom: "2026-02-01", validUntil: null, actRef: "port-1", reason: null, authorUserId: "dp", technical: false, recordedAt: "2026-01-31" };
    const link = { linkLogicalId: V2, personId: P, schoolIds: [EB], authorPersonId: null };
    expect(checkEvent(d, [], link)).toBeNull();
    expect(checkEvent(d, [], link, new Set(), P)).toBe("autodesignacao");
    expect(stateOf([d], "D1", "2026-03-01", "2026-12-31T00:00:00Z")).toBe("vigente");
  });

  it("aulas de durações diferentes só com regra homologada por contexto", () => {
    const rules: DurationRule[] = [
      { id: "r1", context: "anos-iniciais", minutesPerClassHour: 50, validFrom: "2026-01-01", validUntil: null, homologated: true },
      { id: "r2", context: "eja", minutesPerClassHour: 40, validFrom: "2026-01-01", validUntil: null, homologated: true },
    ];
    const a = qty(4, "hora-aula", "anos-iniciais"), b = qty(4, "hora-aula", "eja"), c = qty(4, "hora-aula", "fundamental-ii");
    if (!a.ok || !b.ok || !c.ok) throw new Error("qty");
    expect(toMinutes(a.value, "2026-03-02", rules)).toEqual({ ok: true, value: 200 });
    expect(toMinutes(b.value, "2026-03-02", rules)).toEqual({ ok: true, value: 160 });
    expect(toMinutes(c.value, "2026-03-02", rules)).toEqual({ ok: false, error: "sem-regra-de-duracao" });
  });

  it("afastamento com substituição: substituto só na vigência", () => {
    const s = (seq: number, stage: SubstitutionEvent["stage"], o: Partial<SubstitutionEvent> = {}): SubstitutionEvent => ({ processId: "S1", seq, stage, authorUserId: "u", authorPersonId: "dp", technical: false, capabilityExercised: "c", recordedAt: "2026-04-01", ...o });
    const evs = [s(1, "necessidade", { leaveId: "AF1" }), s(2, "protocolo"), s(3, "conferencia"), s(4, "proposta", { proposedPersonId: "P-bia" }), s(5, "validacao", { authorPersonId: "chefe" }), s(6, "formalizacao", { actRef: "port-2" }), s(7, "vigencia", { validFrom: "2026-04-10", validUntil: "2026-05-10" })];
    expect(activeSubstitute(evs.slice(0, 6), "2026-04-15")).toBeNull();
    expect(activeSubstitute(evs, "2026-04-15")).toBe("P-bia");
    expect(activeSubstitute(evs, "2026-05-20")).toBeNull();
  });

  const draft: AssignmentDraft = { linkLogicalId: V2, personId: P, schoolId: EB, classId: "T1", componentId: "MAT", classHours: 2, blockIds: ["seg1", "seg2"], validFrom: "2026-03-02", validUntil: null };
  const ctx: CheckContext = { offerBlocks: () => ["seg1", "seg2", "ter1"], uncoveredHours: () => 3, qualified: () => true, freeMinutes: () => 600, minutesPerClassHour: () => 50, exercisingAt: () => true, personBusyBlocks: () => [] };
  const caps: StageCaps = Object.fromEntries(ASSIGNMENT_STAGES.map((st) => [st, `atr-${st}`]));
  const ev = (seq: number, stage: AEvent["stage"], o: Partial<AEvent> = {}): AEvent => ({ assignmentId: "AT1", seq, stage, authorUserId: "u", authorPersonId: "dir", technical: false, capabilityExercised: `atr-${stage}`, recordedAt: "2026-03-01", ...o });

  it("sobreposição e proposta rejeitada na validação", () => {
    expect(verify("AT1", draft, { ...ctx, personBusyBlocks: () => ["seg2"] })).toContain("sobreposicao-de-horario");
    const r = checkAssignmentEvent(ev(3, "validacao", { authorPersonId: "sme" }), [ev(1, "proposta", { draft }), ev(2, "analise")], caps, { ...ctx, personBusyBlocks: () => ["seg2"] });
    expect(r.refusal).toBe("verificacao-pendente");
  });

  it("atribuição válida chega ao Perfil Docente e à cobertura", () => {
    const flow = [ev(1, "proposta", { draft }), ev(2, "analise"), ev(3, "validacao", { authorPersonId: "sme" }), ev(4, "formalizacao", { authorPersonId: "sme", actRef: "port-3" }), ev(5, "vigencia")];
    flow.forEach((e, i) => expect(checkAssignmentEvent(e, flow.slice(0, i), caps, ctx).refusal).toBeNull());
    expect(isEffective(flow, "2026-03-10")).toBe(true);
    const ctxs = teacherProfile(P, "2026-03-10", [{ id: "AT1", personId: P, linkId: V2, schoolId: EB, classId: "T1", componentId: "MAT", slots: draft.blockIds, validFrom: draft.validFrom, validUntil: null, status: "vigencia", endedOn: null, actRef: "port-3" }]);
    expect(canRecordLesson(ctxs, "T1", "MAT", "2026-03-10", "seg1")).toBe(true);
    const cov = coverageGrid([{ classId: "T1", label: "1º A", state: "ok", cells: [{ classId: "T1", componentId: "MAT", lessons: 3, demandMinutes: 150, coveredMinutes: 100, uncoveredMinutes: 50, reasons: [], refs: [] } as any] }]);
    expect(cov[0]!.state).toBe("parcial");
  });

  it("simulação não altera a base", () => {
    const base = { demands: [{ classId: "T1", componentId: "MAT", lessons: 3, schoolId: EB }], assignments: [{ id: "AT1", linkId: V2, classId: "T1", componentId: "MAT", lessons: 2, slots: ["seg1", "seg2"] }], links: [{ linkId: V2, capacityLessons: 20, onLeave: false }] };
    const before = JSON.stringify(base);
    expect(simulate(base, [{ kind: "afastamento", linkId: V2 }]).impact.uncovered).toBe(2);
    expect(JSON.stringify(base)).toBe(before);
  });

  it("isolamento por escola na tela espelha a RLS", () => {
    const leitorA = { personId: "sec-a", grants: [{ capability: "consultar-registro-funcional", scope: "escola" as const, schoolId: EA, validFrom: "2026-01-01", validUntil: null }] };
    expect(decide(leitorA, { kind: "registro-funcional", schoolId: EA, subjectPersonId: P }, "ler", "2026-03-01").allowed).toBe(true);
    expect(decide(leitorA, { kind: "registro-funcional", schoolId: EB, subjectPersonId: P }, "ler", "2026-03-01").allowed).toBe(false);
  });
});
