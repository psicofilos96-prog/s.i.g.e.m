import { describe, it, expect } from "vitest";
import { planInterventionStep, analysisState, proposeVersion, projectPlanVersions, interventionHistory, ANALYSIS_CAP, type PlanVersion, type OpStepRequest } from "./op-intervention-plan";
import { CAP, type Plan, type Event } from "@/features/educational-intelligence/aa-intervention-flow";
import type { OpDesignation } from "./op-designations";

const plan: Plan = { objective: "Frações", skills: ["H1"], audience: { scope: "turma", ref: "c1" }, strategies: ["grupo"], responsibles: ["prof"], resources: [], due: "2026-11-30" };
const v1: PlanVersion = { logicalId: "iv", version: 1, plan, authorPersonId: "prof", at: "2026-10-01", justification: null, classId: "c1" };
const d: OpDesignation = { logicalId: "d", role: "orientador-da-unidade", personId: "op", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const access = { personNatural: true, date: "2026-10-12", schoolId: "s1", classId: "c1", purpose: "intervencao", designations: [d], capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: "s1" }] };
const caps = new Set([CAP]);
const ev = (seq: number, stage: Event["stage"], by = "op"): Event => ({ seq, stage, by, at: `2026-10-0${seq}`, note: "x" });
const pre = [ev(1, "diagnostico", "aa"), ev(2, "proposta", "prof"), ev(3, "analise")];
const req = (o: Partial<OpStepRequest> = {}): OpStepRequest => ({ events: pre, expectedSeq: 3, to: "plano", actor: { personId: "op", role: "orientacao", capabilities: caps }, at: "2026-10-05", note: "plano", versions: [v1], analyses: [{ seq: 1, versionRef: 1, byPersonId: "op", decision: "aprovada", reason: "ok", capability: ANALYSIS_CAP }], idempotencyKey: "k", seenKeys: [], actorClassIds: [], access, ...o });

describe("Lote 11 — planos de intervenção integrados", () => {
  it("plano só após análise competente aprovada por pessoa ≠ autor", () => {
    expect(planInterventionStep(req()).ok).toBe(true);
    expect(planInterventionStep(req({ analyses: [] })).ok).toBe(false);
    expect(analysisState(v1, [{ seq: 1, versionRef: 1, byPersonId: "prof", decision: "aprovada", reason: "", capability: ANALYSIS_CAP }]).approved).toBe(false);
    expect(analysisState(v1, [{ seq: 1, versionRef: 1, byPersonId: "op", decision: "aprovada", reason: "", capability: "outra" }]).approved).toBe(false);
  });
  it("análise vale só para a versão analisada", () => {
    const v2 = { ...v1, version: 2, justification: "ajuste", at: "2026-10-04" };
    expect(analysisState(v2, [{ seq: 1, versionRef: 1, byPersonId: "op", decision: "aprovada", reason: "", capability: ANALYSIS_CAP }]).approved).toBe(false);
  });
  it("docente executa só nas próprias atribuições; A&A não executa", () => {
    const after = [...pre, ev(4, "plano")];
    const doc = { personId: "prof", role: "docente" as const, capabilities: caps };
    expect(planInterventionStep(req({ events: after, expectedSeq: 4, to: "execucao", actor: doc, actorClassIds: ["c9"] })).ok).toBe(false);
    expect(planInterventionStep(req({ events: after, expectedSeq: 4, to: "execucao", actor: doc, actorClassIds: ["c1"] })).ok).toBe(true);
    expect(planInterventionStep(req({ events: after, expectedSeq: 4, to: "execucao", actor: { personId: "aa1", role: "aa", capabilities: caps } })).ok).toBe(false);
  });
  it("fail-closed: técnico, OP sem capacidade, base divergente; idempotente", () => {
    expect(planInterventionStep(req({ access: { ...access, personNatural: false } })).ok).toBe(false);
    expect(planInterventionStep(req({ access: { ...access, capabilities: [] } })).ok).toBe(false);
    expect(planInterventionStep(req({ expectedSeq: 2 })).ok).toBe(false);
    expect(planInterventionStep(req({ seenKeys: ["k"], access: { ...access, capabilities: [] } }))).toMatchObject({ ok: true, duplicate: true });
  });
  it("versões: base esperada, justificativa, plano completo; cadeia inválida recusada", () => {
    expect(proposeVersion([v1], { ...v1, justification: "" }, 1).ok).toBe(false);
    expect(proposeVersion([v1], { ...v1, justification: "rever" }, 0).ok).toBe(false);
    expect(proposeVersion([v1], { ...v1, justification: "rever", plan: { ...plan, skills: [] } }, 1).ok).toBe(false);
    const ok = proposeVersion([v1], { ...v1, authorPersonId: "op", justification: "rever" }, 1);
    expect(ok.ok && ok.version.version).toBe(2);
    expect(projectPlanVersions([v1, { ...v1, version: 2, justification: null }]).problems.length).toBe(1);
    expect(planInterventionStep(req({ versions: [v1, { ...v1, version: 3, justification: "x" }] })).ok).toBe(false);
  });
  it("histórico preserva autoria de cada registro", () => {
    const h = interventionHistory([v1], req().analyses, pre);
    expect(h.map((x) => x.by)).toEqual(["prof", "op", "aa", "prof", "op"]);
  });
});
