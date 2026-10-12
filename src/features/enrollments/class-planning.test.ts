import { describe, expect, it } from "vitest";
import { applyProposalAction, canonicalPlan, evidenceIssues, proposalState,
  type ClassProposal, type PlanActor, type PlanningCompetence, type PlanningEvidence, type ProposalAction, type ProposalEvent } from "./class-planning";

const comp: PlanningCompetence = { criar: "propor-turma", submeter: "propor-turma", analisar: "analisar-turma", devolver: "analisar-turma", deferir: "decidir-turma", indeferir: "decidir-turma", efetivar: "manter-cadastro-de-turmas" };
const esc: PlanActor = { personId: "p-esc", isHuman: true, capabilities: ["propor-turma", "manter-cadastro-de-turmas"], schoolIds: ["A"] };
const rede: PlanActor = { personId: "p-rede", isHuman: true, capabilities: ["analisar-turma", "decidir-turma"], schoolIds: "rede" };
const open: ClassProposal = { proposalId: "pr1", kind: "abertura", schoolId: "A", offerId: "of-1", shiftId: "man", classId: null, requestedCapacity: 25, justification: "demanda" };
const ev: PlanningEvidence = { demand: 30, authorizedCapacity: 28, currentEnrolled: null, offerAccepts: true, matrixHomologated: true, uncoveredTeacherNeed: false };

const step = (p: ClassProposal, e: ProposalEvent[], a: ProposalAction, who: PlanActor, x: Record<string, unknown> = {}) => {
  const r = applyProposalAction(p, e, a, who, { reason: "m", at: "2026-10-12", expectedSeq: e.length, ...x }, comp);
  if (!r.ok) throw new Error(r.reason + (r.issues?.join(";") ?? ""));
  return [...e, r.event];
};
const toDecision = (p = open, evidence = ev) => step(p, step(p, step(p, [], "criar", esc), "submeter", esc, { evidence }), "analisar", rede);

describe("Planejamento de turmas L04", () => {
  it("abertura deferida gera só plano para o writer canônico; efetivar exige o fato gravado", () => {
    let e = step(open, toDecision(), "deferir", rede, { actRef: "ato-1", evidence: ev });
    expect(canonicalPlan(open, e)).toEqual({ writer: "secretariat_create_class", schoolId: "A", offerId: "of-1", shiftId: "man", capacity: 25 });
    expect(applyProposalAction(open, e, "efetivar", esc, { reason: "m", at: "t", expectedSeq: 4 }, comp).ok).toBe(false);
    e = step(open, e, "efetivar", esc, { appliedFactRef: "institutional_classes:cls-9" });
    expect(proposalState(e)).toBe("efetivada");
    expect(canonicalPlan(open, e)).toBeNull();
  });
  it("evidência ausente ou incoerente bloqueia submissão", () => {
    expect(evidenceIssues(open, { ...ev, authorizedCapacity: null })).toContain("Capacidade autorizada não lido(a).");
    expect(evidenceIssues(open, { ...ev, authorizedCapacity: 20 }).join()).toMatch(/excede/);
    expect(evidenceIssues(open, { ...ev, matrixHomologated: false }).join()).toMatch(/não homologada/);
    expect(evidenceIssues(open, { ...ev, offerAccepts: false }).join()).toMatch(/Oferta/);
    const r = applyProposalAction(open, step(open, [], "criar", esc), "submeter", esc, { reason: "m", at: "t", expectedSeq: 1, evidence: { ...ev, demand: null } }, comp);
    expect(r.ok).toBe(false);
  });
  it("decisão refaz verificações, exige ato, decisor ≠ proponente e ciência da falta de professor", () => {
    const base = toDecision(open, { ...ev, uncoveredTeacherNeed: true });
    const d = (who: PlanActor, x: Record<string, unknown>) => applyProposalAction(open, base, "deferir", who, { reason: "m", at: "t", expectedSeq: 3, ...x }, comp);
    expect(d(rede, { evidence: ev }).ok).toBe(false);
    expect(d({ ...rede, personId: "p-esc" }, { actRef: "a", evidence: ev }).ok).toBe(false);
    expect(d(rede, { actRef: "a", evidence: { ...ev, uncoveredTeacherNeed: true } }).ok).toBe(false);
    expect(d(rede, { actRef: "a", evidence: { ...ev, uncoveredTeacherNeed: true }, acknowledgeUncovered: true }).ok).toBe(true);
    expect(d(rede, { actRef: "a", evidence: { ...ev, authorizedCapacity: 10 } }).ok).toBe(false);
  });
  it("executor técnico, competência ausente e escopo errado são recusados", () => {
    expect(applyProposalAction(open, [], "criar", { ...esc, isTechnicalExecutor: true }, { reason: "m", at: "t", expectedSeq: 0 }, comp).ok).toBe(false);
    expect(applyProposalAction(open, [], "criar", esc, { reason: "m", at: "t", expectedSeq: 0 }, {}).ok).toBe(false);
    expect(applyProposalAction(open, [], "criar", { ...esc, schoolIds: ["B"] }, { reason: "m", at: "t", expectedSeq: 0 }, comp).ok).toBe(false);
  });
  it("encerramento exige turma e destino dos enturmados; plano move antes de inativar", () => {
    const close: ClassProposal = { ...open, proposalId: "pr2", kind: "encerramento", classId: "cls-1", requestedCapacity: null };
    const e0: PlanningEvidence = { ...ev, currentEnrolled: 12 };
    expect(evidenceIssues(close, e0).join()).toMatch(/sem destino/);
    const okEv = { ...e0, destinationClassIds: ["cls-2"] };
    const e = step(close, toDecision(close, okEv), "deferir", rede, { actRef: "ato-2", evidence: okEv });
    expect(canonicalPlan(close, e)).toEqual({ writer: "move_allocations_then_inactivate_class", classId: "cls-1", destinationClassIds: ["cls-2"], inactivate: true });
  });
  it("devolução volta a rascunho preservando a cadeia", () => {
    const e = step(open, toDecision(), "devolver", rede);
    expect(e.map((x) => x.to)).toEqual(["rascunho", "submetida", "analisada", "rascunho"]);
  });
});
