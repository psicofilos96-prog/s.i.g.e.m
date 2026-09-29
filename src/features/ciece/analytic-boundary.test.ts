import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalFact, FactAvailability } from "./canonical-fact-types";
import { ANALYTIC_CAPABILITIES as C, currentDisclosurePolicy, queryAnalytic, grantCovers, type AnalyticAuthority, type AnalyticGrant, type DisclosurePolicy } from "./analytic-boundary";
import { computeIndicator } from "./indicator-engine";
import { proofRegistry } from "./indicator-proof-definitions";

const st = (s: string, cat: string | null, cls = "t1", school = "e1", a: FactAvailability = "disponivel"): CanonicalFact => ({
  factTypeId: "situacao-academica-oficial", familyId: "vida-academica", subject: { studentId: s, cycleId: "c26" },
  dimensions: { schoolId: school, classId: cls, cycleId: "c26" }, availability: a,
  payload: a === "disponivel" ? { kind: "categorico", categoryId: cat } : null,
  temporal: { cycleId: "c26" },
  provenance: { domainId: "12I", sourceId: "academic_standing_versions", recordId: `r-${s}`, recordVersion: 1 }, schemaVersion: 1,
});
const facts = [st("a", "aprovado"), st("b", "aprovado"), st("c", "aprovado"), st("d", "retido"), st("x", "aprovado", "t2"), st("y", "aprovado", "t9", "e2")];
const grant = (capabilityId: string, scope: Partial<AnalyticGrant> = { schoolId: "e1" }): AnalyticGrant => ({
  capabilityId, engagementId: "g", policyId: "p", policyVersion: 1, schoolId: null, classId: null, componentId: null, periodId: null, ...scope,
});
const who = (...grants: AnalyticGrant[]): AnalyticAuthority => ({ status: "signed-in", personId: "p1", grants });
const policy = (o: Partial<DisclosurePolicy> = {}): DisclosurePolicy => ({
  id: "div", version: 1, status: "homologada", decomposableDimensions: ["categoria"], minimumGroupSize: null,
  smallGroupTreatment: "suprimir-grupo", complementarySuppression: false, provenanceLevel: "referencias-institucionais", ...o,
});
const R = proofRegistry();
const q = (o: object = {}) => ({ definitionId: "prova-estudantes-por-situacao", reference: { cycleId: "c26" }, filters: { schoolId: "e1" }, ...o });
const ask = (authority: AnalyticAuthority, o: object = {}, p: DisclosurePolicy | null = policy()) =>
  queryAnalytic({ authority, query: q(o) as never, registry: R, facts, disclosurePolicy: p });

describe("14.3 fronteira analítica", () => {
  it("1-4. sem login / sem pessoa / sem capacidade efetiva ⇒ não autorizado", () => {
    expect(ask({ status: "signed-out" }).state).toBe("nao-autorizado");
    expect(ask({ status: "signed-in", personId: null, grants: [grant(C.aggregate)] }).state).toBe("nao-autorizado");
    expect(ask(who()).state).toBe("nao-autorizado");
  });
  it("5. cargo sozinho não concede (não há campo de cargo na autoridade)", () => {
    const src = readFileSync("src/features/ciece/analytic-boundary.ts", "utf8");
    expect(src).not.toMatch(/position_label|positionLabel|cargo\s*===|role\s*===/);
  });
  it("6. capacidade + escopo corretos ⇒ responde", () => {
    const r = ask(who(grant(C.aggregate)));
    expect(r.state).toBe("respondido");
    if (r.state === "respondido") expect(r.groups[0]!.value).toBe(5);
  });
  it("7. Escola A não consulta Escola B", () => {
    expect(ask(who(grant(C.aggregate)), { filters: { schoolId: "e2" } }).state).toBe("nao-autorizado");
  });
  it("8. turma restrita não consulta outra turma nem a escola inteira", () => {
    const g = grant(C.aggregate, { schoolId: "e1", classId: "t1" });
    expect(ask(who(g), { filters: { schoolId: "e1", classId: "t2" } }).state).toBe("nao-autorizado");
    expect(ask(who(g), { filters: { schoolId: "e1" } }).state).toBe("nao-autorizado");
    expect(ask(who(g), { filters: { schoolId: "e1", classId: "t1" } }).state).toBe("respondido");
  });
  it("9. componente/período fora do escopo", () => {
    const g = grant(C.aggregate, { schoolId: "e1", componentId: "lp", periodId: "p1" });
    expect(ask(who(g), { filters: { schoolId: "e1", componentId: "mat" } }).state).toBe("nao-autorizado");
    expect(ask(who(g), { filters: { schoolId: "e1", componentId: "lp" }, reference: { cycleId: "c26", periodId: "p2" } }).state).toBe("nao-autorizado");
  });
  it("10/15. agregado não concede decomposição; drill-down exige capacidade própria", () => {
    expect(ask(who(grant(C.aggregate)), { groupBy: "categoria" }).state).toBe("nao-autorizado");
    expect(ask(who(grant(C.aggregate), grant(C.decomposition)), { groupBy: "categoria" }).state).toBe("respondido");
    expect(ask(who(grant(C.aggregate), grant(C.decomposition)), { groupBy: "classId" }).state).toBe("nao-divulgavel");
  });
  it("11. proveniência protegida não revela sujeitos", () => {
    expect(ask(who(grant(C.aggregate)), { wantProvenance: true }).state).toBe("nao-autorizado");
    const r = ask(who(grant(C.aggregate), grant(C.provenance)), { wantProvenance: true });
    expect(r.state === "respondido" && r.provenance?.level).toBe("referencias-institucionais");
    expect(JSON.stringify(r)).not.toContain("studentId");
    const ind = ask(who(grant(C.aggregate), grant(C.provenance), grant(C.individual)), { wantProvenance: true }, policy({ provenanceLevel: "referencias-individuais" }));
    expect(ind.state === "respondido" && ind.provenance?.level).toBe("referencias-individuais");
  });
  it("12/14. supressão por parâmetro; suprimido ≠ zero/ausente/vazio/indeterminado", () => {
    const r = ask(who(grant(C.aggregate), grant(C.decomposition)), { groupBy: "categoria" }, policy({ minimumGroupSize: 3 }));
    if (r.state !== "respondido") throw new Error(r.state);
    const retido = r.groups.find((g) => g.groupKey === "retido")!;
    expect(retido.state).toBe("suprimido-por-politica");
    expect(retido.value).toBeNull(); expect(retido.coverage).toBeNull();
    expect(r.groups.find((g) => g.groupKey === "aprovado")!.value).toBe(4);
  });
  it("supressão complementar e agregação superior", () => {
    const r = ask(who(grant(C.aggregate), grant(C.decomposition)), { groupBy: "categoria" }, policy({ minimumGroupSize: 3, complementarySuppression: true }));
    expect(r.state).toBe("nao-divulgavel");
    expect(ask(who(grant(C.aggregate)), {}, policy({ minimumGroupSize: 3, complementarySuppression: true })).state).toBe("respondido");
    const up = ask(who(grant(C.aggregate), grant(C.decomposition)), { groupBy: "categoria" }, policy({ minimumGroupSize: 3, smallGroupTreatment: "agregar-superior" }));
    expect(up.state === "respondido" && up.groupBy).toBeNull();
    expect(ask(who(grant(C.aggregate), grant(C.decomposition)), { groupBy: "categoria" }, policy({ minimumGroupSize: 3, smallGroupTreatment: "nao-divulgar" })).state).toBe("nao-divulgavel");
  });
  it("14.3.1. total 30 com visíveis 22+5 não permite reconstruir o grupo de 3", () => {
    const many = [
      ...Array.from({ length: 22 }, (_, i) => st(`ap${i}`, "aprovado")),
      ...Array.from({ length: 5 }, (_, i) => st(`pg${i}`, "em-progressao")),
      ...Array.from({ length: 3 }, (_, i) => st(`rp${i}`, "reprovado")),
    ];
    const run = (o: object, p: DisclosurePolicy) => queryAnalytic({ authority: who(grant(C.aggregate), grant(C.decomposition)), query: q(o) as never, registry: R, facts: many, disclosurePolicy: p });
    const p = policy({ minimumGroupSize: 5, complementarySuppression: true });
    const total = run({}, p);
    expect(total.state === "respondido" && total.groups[0]!.value).toBe(30);
    const dec = run({ groupBy: "categoria" }, p);
    expect(dec.state).toBe("respondido");
    if (dec.state !== "respondido") return;
    const visible = dec.groups.filter((g) => g.state !== "suprimido-por-politica");
    const hidden = dec.groups.filter((g) => g.state === "suprimido-por-politica");
    expect(hidden.length).toBeGreaterThanOrEqual(2);
    const residue = 30 - visible.reduce((a, g) => a + (g.value ?? 0), 0);
    expect(residue).toBeGreaterThanOrEqual(5);
    expect(hidden.every((g) => g.value === null && g.numerator === null && g.denominator === null && g.coverage === null)).toBe(true);
    // sem supressão complementar, a limitação é declarada
    const weak = run({ groupBy: "categoria" }, policy({ minimumGroupSize: 5 }));
    expect(weak.state === "respondido" && weak.limitations.some((l) => l.includes("dedutível"))).toBe(true);
  });
  it("13. nenhum limiar fixo; nenhuma política homologada embutida", () => {
    const src = readFileSync("src/features/ciece/analytic-boundary.ts", "utf8");
    expect(src).not.toMatch(/minimumGroupSize\s*[:=]\s*\d/);
    expect(currentDisclosurePolicy()).toBeNull();
  });
  it("16. filtros combinados não ampliam escopo", () => {
    expect(ask(who(grant(C.aggregate)), { filters: { classId: "t9" } }).state).toBe("nao-autorizado");
  });
  it("17. autorização é do momento da consulta; fatos intactos", () => {
    const snapshot = JSON.stringify(facts);
    expect(ask(who(grant(C.aggregate))).state).toBe("respondido");
    expect(ask(who(grant(C.aggregate, { schoolId: "e2" }))).state).toBe("nao-autorizado");
    expect(JSON.stringify(facts)).toBe(snapshot);
  });
  it("18. política ausente/incompleta/rascunho falha fechada", () => {
    expect(ask(who(grant(C.aggregate)), {}, null).state).toBe("divulgacao-indisponivel");
    expect(ask(who(grant(C.aggregate)), {}, policy({ status: "rascunho" })).state).toBe("divulgacao-indisponivel");
    expect(ask(who(grant(C.aggregate)), {}, policy({ minimumGroupSize: -1 })).state).toBe("divulgacao-indisponivel");
  });
  it("19. resposta nunca carrega factRefs brutos; telas não importam motor/fatos", () => {
    expect(JSON.stringify(ask(who(grant(C.aggregate))))).not.toContain("factRefs");
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const bad = walk("src").filter((p) => p.endsWith(".tsx") && /indicator-engine|fact-loader|analytic-boundary/.test(readFileSync(p, "utf8")));
    expect(bad).toEqual([]);
  });
  it("20. fronteira não altera a matemática da 14.2", () => {
    const raw = computeIndicator(R, facts, q() as never);
    const r = ask(who(grant(C.aggregate)));
    expect(raw.ok && r.state === "respondido" && raw.groups[0]!.value === r.groups[0]!.value).toBe(true);
  });
});

describe("14.14.8 — escopo de rede explícito", () => {
  const base = { capabilityId: "consultar-indicador-agregado", engagementId: "g", policyId: "p", policyVersion: 1, schoolId: null, classId: null, componentId: null, periodId: null };
  const q = (filters: Record<string, string>) => ({ reference: { periodId: undefined }, filters } as never);
  it("concessão sem escopo nenhum não é rede", () => {
    expect(grantCovers(base, q({ schoolId: "a" }))).toBe(false);
  });
  it("rede declarada cobre duas escolas", () => {
    const g = { ...base, scopeLevel: "rede" as const };
    expect(grantCovers(g, q({ schoolId: "a" }))).toBe(true);
    expect(grantCovers(g, q({ schoolId: "b" }))).toBe(true);
  });
  it("rede declarada com dimensão preenchida é incoerente e nega", () => {
    expect(grantCovers({ ...base, scopeLevel: "rede", schoolId: "a" }, q({ schoolId: "a" }))).toBe(false);
  });
  it("escola declarada não cobre outra escola", () => {
    const g = { ...base, scopeLevel: "escola" as const, schoolId: "a" };
    expect(grantCovers(g, q({ schoolId: "a" }))).toBe(true);
    expect(grantCovers(g, q({ schoolId: "b" }))).toBe(false);
  });
});
