/** 14.13 — Registro Institucional de Visitas: domínio, CIECE e Mapa. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { admitVisit, visitsIn, type VisitRow } from "./visit-record";
import { visitFacts } from "@/features/ciece/visit-facts";
import { validateFact } from "@/features/ciece/fact-catalog";
import { computeIndicator, IndicatorRegistry, type IndicatorDefinition } from "@/features/ciece/indicator-engine";
import { assembleMapSnapshot } from "@/features/statistical-map/map-domain";

const v = (id: string, on: string, o: Partial<VisitRow> = {}): VisitRow => ({
  id, logical_id: `L-${id}`, version: 1, supersedes_id: null, school_id: "e1", visited_on: on, visitor_kind_id: "supervisao",
  visitor_kind_version: 1, declared_identification: "Equipe de Supervisão", origin_organization: null, annulled: false, originating_act_ref: null, ...o,
});
const APRIL = ["2026-04-01", "2026-04-30"] as const;
const ctx = { capabilitySchools: ["e1"], homologatedKinds: [{ id: "supervisao", version: 1 }] };
const draft = { schoolId: "e1", visitedOn: "2026-04-10", visitorKindId: "supervisao", visitorKindVersion: 1, declaredIdentification: "Maria" };

describe("14.13 domínio", () => {
  it("nenhuma, uma, várias e mais de cinco visitas no mês (sem limite)", () => {
    expect(visitsIn([], "e1", ...APRIL)).toEqual([]);
    expect(visitsIn([v("a", "2026-04-02")], "e1", ...APRIL)).toHaveLength(1);
    const seven = Array.from({ length: 7 }, (_, i) => v(`m${i}`, `2026-04-0${i + 1}`));
    expect(visitsIn(seven, "e1", ...APRIL)).toHaveLength(7);
  });
  it("outra competência e outra escola não entram", () => {
    expect(visitsIn([v("a", "2026-05-01"), v("b", "2026-04-03", { school_id: "e2" })], "e1", ...APRIL)).toEqual([]);
  });
  it("correção v1 → v2: só a vigente conta; anulada não conta", () => {
    const v1 = v("a", "2026-04-02"); const v2 = v("a2", "2026-04-05", { logical_id: v1.logical_id, version: 2, supersedes_id: v1.id });
    expect(visitsIn([v1, v2], "e1", ...APRIL).map((x) => x.id)).toEqual(["a2"]);
    const an = { ...v2, id: "a3", version: 3, supersedes_id: "a2", annulled: true };
    expect(visitsIn([v1, v2, an], "e1", ...APRIL)).toEqual([]);
  });
  it("admissão: tipo não homologado, fora do escopo, sem documento pessoal, identificador adicional, escola imutável", () => {
    expect(admitVisit(draft, ctx)).toEqual({ ok: true }); // sem CPF/telefone/e-mail
    expect(admitVisit({ ...draft, originOrganization: null }, ctx).ok).toBe(true); // dado opcional ausente
    expect(admitVisit({ ...draft, visitorKindId: "x" }, ctx)).toEqual({ ok: false, code: "tipo-nao-homologado" });
    expect(admitVisit({ ...draft, schoolId: "e2" }, ctx)).toEqual({ ok: false, code: "sem-capacidade-na-escola" });
    expect(admitVisit(draft, { ...ctx, capabilitySchools: [] })).toEqual({ ok: false, code: "sem-capacidade-na-escola" }); // cargo sem capacidade
    expect(admitVisit({ ...draft, additionalIdentification: { cpf: "1" } }, ctx).ok).toBe(false);
    expect(admitVisit(draft, { ...ctx, base: v("a", "2026-04-02") })).toEqual({ ok: false, code: "correcao-sem-motivo" });
    expect(admitVisit(draft, { ...ctx, base: v("a", "2026-04-02", { school_id: "e2" }), correctionReason: "x", capabilitySchools: ["e1"] })).toEqual({ ok: false, code: "escola-imutavel" });
  });
  it("banco: RLS por escola, capacidade, tipo homologado, anulação, sem concessão", () => {
    const sql = readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
    expect(sql).toContain("has_school_capability('consultar-registro-de-visitas', school_id)");
    expect(sql).toContain("'registrar-visita-institucional' AND ec.school_id = _school");
    expect(sql).toContain("require_catalog('tipo-de-visitante'");
    expect(sql).toContain("Visita não muda de escola");
    expect(sql).not.toMatch(/position_label_snapshot[^;]*visit/);
  });
});

describe("14.13 CIECE", () => {
  it("um fato por visita, válido, sem dado pessoal; total só pelo motor", () => {
    const rows = [v("a", "2026-04-02", { declared_identification: "João Silva", origin_organization: "SEMED" }), v("b", "2026-04-03")];
    const facts = visitFacts(rows);
    expect(facts).toHaveLength(2);
    for (const f of facts) expect(validateFact(f, "institutional_visit_records")).toEqual([]);
    const s = JSON.stringify(facts);
    expect(s).not.toContain("João"); expect(s).not.toContain("SEMED");
    const def: IndicatorDefinition = { id: "visitas", version: 1, label: "Visitas", status: "homologada", factTypeId: "visita-institucional", subjectKey: "visitId",
      populationCriteria: {}, temporal: { kind: "intervalo" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "visitas" } as never;
    const reg = new IndicatorRegistry(); reg.register(def);
    const r = computeIndicator(reg, facts, { definitionId: def.id, reference: { from: APRIL[0], to: APRIL[1] }, filters: { schoolId: "e1" } } as never) as never as { ok: boolean; groups: { value: unknown }[] };
    expect(r.ok && r.groups[0]!.value).toBe(2);
  });
});

describe("14.13 Mapa", () => {
  const input = (visits: VisitRow[] | null) => ({ competence: { schoolId: "e1", year: 2026, month: 4 }, rule: null, schools: [], classes: [], facts: [], observations: { text: "", eventId: null }, visits }) as never;
  const cell = (s: ReturnType<typeof assembleMapSnapshot>) => s.cells.find((c) => c.cellId === "visitas")!;
  it("projeta visitas automaticamente, sem limite de cinco, com proveniência", () => {
    const seven = Array.from({ length: 7 }, (_, i) => v(`m${i}`, `2026-04-1${i}`));
    const c = cell(assembleMapSnapshot(input(seven)));
    expect(c).toMatchObject({ origin: "automatico", state: "disponivel" });
    expect(c.recordRefs).toHaveLength(7);
    expect(cell(assembleMapSnapshot(input([]))).state).toBe("ausente");
    expect(cell(assembleMapSnapshot(input(null))).state).toBe("indeterminado");
  });
  it("Mapa antigo preservado: correção posterior gera nova montagem, não reescreve a antiga", () => {
    const v1 = v("a", "2026-04-02");
    const old = assembleMapSnapshot(input([v1]));
    const frozen = JSON.stringify(old);
    const v2 = v("a2", "2026-04-09", { logical_id: v1.logical_id, version: 2, supersedes_id: "a" });
    const fresh = assembleMapSnapshot(input([v1, v2]));
    expect(JSON.stringify(old)).toBe(frozen);
    expect(cell(old).recordRefs).toEqual(["institutional_visit_records:a@1"]);
    expect(cell(fresh).recordRefs).toEqual(["institutional_visit_records:a2@2"]);
  });
});
