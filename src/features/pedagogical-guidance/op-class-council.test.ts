import { describe, it, expect } from "vitest";
import { councilProvided, buildPreparation, proposeAgenda, analysisStatement, opMayConduct, councilReferralTasks, type AccessCtx, type PreparationSources } from "./op-class-council";
import type { CollegialBodyConfiguration, StructuredMinute } from "../collegial/collegial-types";
import type { OpDesignation } from "./op-designations";

const cfg = (o: Partial<CollegialBodyConfiguration> = {}): CollegialBodyConfiguration => ({ id: "cc", version: 1, label: "Conselho de Classe", status: "homologada", scope: { unitIds: ["s1"] },
  sessionNatures: [{ id: "ordinaria" } as never], requiredParticipantRoles: [], audit: { events: [], demonstrative: false }, ...o });
const d: OpDesignation = { logicalId: "d", role: "orientador-da-unidade", personId: "op1", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const ctx = (o: Partial<AccessCtx> = {}): AccessCtx => ({ personNatural: true, personId: "op1", date: "2026-06-30", schoolId: "s1", classId: "c1", designations: [d],
  capabilities: [{ id: "consultar-acompanhamento-pedagogico", scope: "escola", schoolId: "s1" }, { id: "registrar-acompanhamento-pedagogico", scope: "escola", schoolId: "s1" }], ...o });
const src = (o: Partial<PreparationSources> = {}): PreparationSources => ({
  classRoster: { status: "lido", readAt: "t", value: [{ studentId: "a1", studentName: "Ana" }] },
  attendance: { status: "lido", readAt: "t", value: [{ studentId: "a1", rate: 82, sourceId: "f1", version: 3 }] },
  results: { status: "lido", readAt: "t", value: [{ studentId: "a1", label: "Mat", value: "7", scale: "0-10", sourceId: "r1", version: 2 }] },
  interventions: { status: "nao-lido", reason: "Fonte não consultada" }, documents: { status: "lido", readAt: "t", value: [] }, ...o });

describe("OP Lote 16 — Conselho de Classe", () => {
  it("sem configuração homologada o conselho não está previsto", () => {
    expect(councilProvided(null, "s1", "c1")).toMatch(/não está previsto/);
    expect(councilProvided(cfg({ status: "rascunho" }), "s1", "c1")).toMatch(/não homologada/);
    expect(councilProvided(cfg(), "s2", "c1")).toMatch(/escola/);
    expect(buildPreparation(ctx(), null, src(), "t").ok).toBe(false);
  });
  it("preparação congela fatos com versão; fonte não lida vira limitação, nunca zero", () => {
    const p = buildPreparation(ctx(), cfg(), src({ attendance: { status: "negado", reason: "Sem acesso" } }), "2026-06-30T10:00");
    expect(p.ok).toBe(true); if (!p.ok) return;
    const f = p.dossiers[0]!.dossier.facts.find((x) => x.factId === "frequencia")!;
    expect(f.value).toBeNull();
    expect(p.limitations.join()).toMatch(/attendance|interventions/);
    expect(p.dossiers[0]!.dossier.computed).toBeUndefined();
    expect(p.dossiers[0]!.dossier.sources).toContainEqual({ kind: "resultado", id: "r1", version: 2 });
  });
  it("fail-closed: executor técnico, central, sem enturmação", () => {
    expect(buildPreparation(ctx({ personNatural: false }), cfg(), src(), "t").ok).toBe(false);
    expect(buildPreparation(ctx({ designations: [{ ...d, role: "coordenacao-central-op", schoolIds: "rede" }] }), cfg(), src(), "t").ok).toBe(false);
    expect(buildPreparation(ctx(), cfg(), src({ classRoster: { status: "nao-lido", reason: "x" } }), "t").ok).toBe(false);
  });
  it("pauta proposta é institucional e não antecipa deliberação", () => {
    const ok = proposeAgenda(ctx(), cfg(), [{ id: "i1", title: "Leitura da turma" }]);
    expect(ok.ok && ok.agenda[0]!.origin.kind).toBe("pauta-institucional");
    expect(proposeAgenda(ctx(), cfg(), [{ id: "i2", title: "Reprovação de Ana" }]).ok).toBe(false);
  });
  it("análise da OP é manifestação, nunca decisão nem dado clínico", () => {
    expect(analysisStatement(ctx(), "OP", "Avanço em leitura após intervenção", "t", "m1").ok).toBe(true);
    expect(analysisStatement(ctx(), "OP", "Aluna aprovada pelo conselho", "t", "m2").ok).toBe(false);
    expect(analysisStatement(ctx(), "OP", "Laudo indica", "t", "m3").ok).toBe(false);
  });
  it("condução só com capacidades declaradas na configuração homologada", () => {
    expect(opMayConduct(cfg(), { capabilities: ["x"] } as never).length).toBeGreaterThan(0);
  });
  it("encaminhamentos só de ata vigente encerrada, com responsável; dedupe estável", () => {
    const m = (id: string, v: number, closed: boolean) => ({ id, sessionId: "s", version: v, closedAt: closed ? "t" : "" }) as unknown as StructuredMinute;
    const r = councilReferralTasks([m("m1", 1, true), m("m2", 2, true)], [
      { id: "f1", minuteId: "m1", text: "antigo", responsibleEngagementId: "e1", dueOn: null },
      { id: "f2", minuteId: "m2", text: "Plano de leitura", responsibleEngagementId: "e1", dueOn: "2026-07-15" },
      { id: "f3", minuteId: "m2", text: "Sem dono", responsibleEngagementId: null, dueOn: null }], "s1");
    expect(r.tasks).toHaveLength(1); expect(r.tasks[0]!.dedupeKey).toBe("fonte:op-conselho:m2:f2:s1");
    expect(r.pending).toHaveLength(2);
  });
});
