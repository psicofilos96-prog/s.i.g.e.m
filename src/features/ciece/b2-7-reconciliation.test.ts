/**
 * B2.7 — Reconciliação das fontes institucionais da B2 nos consumidores
 * (CIECE, Mapa, Diário). Oferta e Turno só pelos readers bitemporais B2.6,
 * com contexto temporal explícito; ausência permanece ausência.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

type Rpc = { fn: string; args: Record<string, unknown> };
const calls: Rpc[] = [];
const tables: string[] = [];
let rpcImpl: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown } = () => ({ data: [], error: null });
let tableImpl: (t: string) => { data: unknown; error: unknown; single?: unknown } = () => ({ data: [], error: null });

function fakeDb() {
  return {
    from(t: string) {
      tables.push(t);
      const res = tableImpl(t);
      const o: Record<string, unknown> = {};
      for (const k of ["select", "eq", "in", "contains", "order", "lte", "limit"]) o[k] = () => o;
      o["maybeSingle"] = () => Promise.resolve({ data: res.single ?? null, error: res.error });
      o["then"] = (r: (v: unknown) => unknown) => Promise.resolve({ data: res.data, error: res.error }).then(r);
      return o;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve(rpcImpl(fn, args));
    },
    auth: { getSession: () => Promise.resolve({ data: { session: { user: {} } } }) },
  };
}
vi.mock("@/integrations/supabase/client", () => ({ supabase: fakeDb() }));

import { loadClassCanonicalFacts } from "./fact-loader";
import { assembleMapSnapshot, latestObservations } from "@/features/statistical-map/map-domain";
import { institutionalTeachingClass, hydrateInstitutionalTeaching, teachingClass } from "@/features/diary/institutional-teaching";
import { setDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";

/** Tabela simulada do banco: v1 "manha" (registrada em 02/01), corrigida para "tarde" em 03/10. */
const shiftLedger = [
  { id: "s1", logical: "L", version: 1, supersedes: null as string | null, value: "manha", created: "2026-02-01T00:00:00Z", from: "2026-02-01", until: null as string | null },
  { id: "s2", logical: "L", version: 2, supersedes: "s1", value: "tarde", created: "2026-03-10T00:00:00Z", from: "2026-02-01", until: null as string | null },
];
/** Semântica do reader: só o conhecido em knownAt, sem versões substituídas conhecidas, válido em validOn. */
function shiftAt(args: Record<string, unknown>) {
  const known = String(args["_known_at"] ?? "9999-12-31");
  const valid = String(args["_valid_on"]);
  const k = shiftLedger.filter((r) => r.created <= known);
  const heads = k.filter((r) => !k.some((x) => x.supersedes === r.id));
  return heads.filter((r) => r.from <= valid && (!r.until || r.until >= valid)).map((r) => ({
    shift_version_id: r.id, logical_id: r.logical, version: r.version, valid_from: r.from, valid_until: r.until,
    correction_reason: null, originating_act_ref: "ato", created_at: r.created, value_id: r.value, value_version: 1, value_label: null,
  }));
}

const shiftOf = (r: Awaited<ReturnType<typeof loadClassCanonicalFacts>>) =>
  r.facts.filter((f) => f.factTypeId === "turno-da-turma").map((f) => (f.payload?.kind === "categorico" ? f.payload.categoryId : null));

beforeEach(() => {
  calls.length = 0; tables.length = 0;
  tableImpl = () => ({ data: [], error: null });
  rpcImpl = (fn, args) => ({ data: fn === "class_shift_at" ? shiftAt(args) : [], error: null });
});

describe("B2.7 — CIECE lê Oferta e Turno pelos readers bitemporais", () => {
  it("propaga validOn/knownAt explícitos aos readers e não lê as tabelas de versões", async () => {
    await loadClassCanonicalFacts("t1", { validOn: "2026-04-01", knownAt: "2026-03-01T00:00:00Z" }, fakeDb() as never);
    const off = calls.find((c) => c.fn === "class_offering_at")!;
    const shf = calls.find((c) => c.fn === "class_shift_at")!;
    expect(off.args).toEqual({ _class_id: "t1", _valid_on: "2026-04-01", _known_at: "2026-03-01T00:00:00Z" });
    expect(shf.args).toEqual(off.args);
    expect(tables).not.toContain("class_offering_versions");
    expect(tables).not.toContain("class_shift_versions");
  });
  it("1) antes da correção: o conhecido naquele instante", async () => {
    expect(shiftOf(await loadClassCanonicalFacts("t1", { validOn: "2026-04-01", knownAt: "2026-03-01T00:00:00Z" }, fakeDb() as never))).toEqual(["manha"]);
  });
  it("2) depois da correção: a versão corrigida, sem reescrever a visão anterior", async () => {
    expect(shiftOf(await loadClassCanonicalFacts("t1", { validOn: "2026-04-01", knownAt: "2026-03-11T00:00:00Z" }, fakeDb() as never))).toEqual(["tarde"]);
    expect(shiftOf(await loadClassCanonicalFacts("t1", { validOn: "2026-04-01", knownAt: "2026-03-01T00:00:00Z" }, fakeDb() as never))).toEqual(["manha"]);
  });
  it("3) estado atual: knownAt omitido vai como ausente ao reader (o banco usa agora)", async () => {
    const r = await loadClassCanonicalFacts("t1", { validOn: "2026-04-01" }, fakeDb() as never);
    expect(calls.find((c) => c.fn === "class_shift_at")!.args).not.toHaveProperty("_known_at");
    expect(shiftOf(r)).toEqual(["tarde"]);
  });
  it("4) ausência de registro permanece ausência (nenhum fato, nenhuma falha)", async () => {
    const r = await loadClassCanonicalFacts("t1", { validOn: "2026-01-15" }, fakeDb() as never);
    expect(shiftOf(r)).toEqual([]);
    expect(r.facts.filter((f) => f.factTypeId === "organizacao-da-oferta-da-turma")).toEqual([]);
    expect(r.failedSources).toEqual([]);
  });
  it("5) inconsistência do reader não é resolvida: fonte falha, nenhum fato escolhido", async () => {
    rpcImpl = (fn, args) => ({
      data: fn === "class_shift_at" ? [...shiftAt({ ...args, _known_at: "2026-03-01T00:00:00Z" }), ...shiftAt(args)]
        : fn === "class_offering_at" ? [
          { offering_version_id: "a", logical_id: "x", version: 1, valid_from: "2026-01-01", valid_until: null, correction_reason: null, originating_act_ref: null, created_at: "t", scheme_id: "etapa", value_id: "e", value_version: 1, value_label: null },
          { offering_version_id: "b", logical_id: "y", version: 1, valid_from: "2026-01-01", valid_until: null, correction_reason: null, originating_act_ref: null, created_at: "t", scheme_id: "etapa", value_id: "f", value_version: 1, value_label: null },
        ] : [],
      error: null,
    });
    const r = await loadClassCanonicalFacts("t1", { validOn: "2026-04-01" }, fakeDb() as never);
    expect(shiftOf(r)).toEqual([]);
    expect(r.failedSources).toEqual(expect.arrayContaining(["class_shift_versions", "class_offering_versions"]));
  });
  it("sem contexto temporal explícito não há 'atual' implícito", async () => {
    const r = await loadClassCanonicalFacts("t1", null, fakeDb() as never);
    expect(calls.some((c) => c.fn === "class_shift_at" || c.fn === "class_offering_at")).toBe(false);
    expect(r.failedSources).toEqual(expect.arrayContaining(["class_offering_at:sem-contexto-temporal", "class_shift_at:sem-contexto-temporal"]));
  });
  it("Mapa herda a projeção do CIECE (mesmo carregador, mesma data da fotografia)", async () => {
    const r = await loadClassCanonicalFacts("t1", { validOn: "2026-04-15" }, fakeDb() as never);
    const snap = assembleMapSnapshot({
      competence: { schoolId: "e1", year: 2026, month: 4 }, rule: null, schools: [], classes: [{ id: "t1", name: "6A" }], facts: r.facts,
      observations: latestObservations([]), links: [], leadership: null, functional: null, visits: null,
    } as never);
    expect(JSON.stringify(snap)).not.toContain("manha");
    const src = readFileSync("src/features/statistical-map/statistical-map.functions.ts", "utf8");
    expect(src).toMatch(/loadClassCanonicalFacts\(k\.id, temporal, db\)/);
    expect(src).not.toMatch(/class_offering_versions|class_shift_versions|select\("id, name"\)/);
  });
  it("fontes de CIECE/Mapa não usam campos legados nem currentVersions em Oferta/Turno", () => {
    const loader = readFileSync("src/features/ciece/fact-loader.ts", "utf8");
    expect(loader).not.toMatch(/from\("class_(offering|shift)_versions"\)/);
    const adapters = readFileSync("src/features/ciece/fact-adapters.ts", "utf8").split("B2.7 — Turno e Oferta")[1]!;
    expect(adapters).not.toMatch(/currentVersions/);
    const q = readFileSync("src/features/ciece/ciece-query.functions.ts", "utf8");
    expect(q).not.toMatch(/school_label_snapshot/);
  });
});

describe("B2.7 — Diário institucional", () => {
  it("não lê stage_id/offer_id/snapshots legados nem fabrica turno", () => {
    const src = readFileSync("src/features/diary/institutional-teaching.ts", "utf8");
    for (const legacy of ["stage_id", "offer_id", "school_label_snapshot", "academic_year_label", "curriculum_age_group_ids", '"Manhã"', 'select("*")']) expect(src).not.toContain(legacy);
  });
  it("ausência de turno/etapa/oferta é null, nunca string institucional", () => {
    const k = institutionalTeachingClass({ id: "t1", schoolId: "e1", academicYearId: "a", academicYearName: "2026",
      record: [{ name: "6A", code: "6A", administrative_status: "ativa", created_at: "t" }], shift: [] });
    expect(k).toMatchObject({ name: "6A", shift: null, stageId: null, offerId: null, situation: "Em atividade", groupings: [] });
  });
  it("turno registrado vem do reader; inconsistência ⇒ null; sem cadastro na data ⇒ situação null", () => {
    const row = (id: string, v: string) => ({ shift_version_id: id, logical_id: "L", version: 1, valid_from: "2026-01-01", valid_until: null, correction_reason: null, originating_act_ref: null, created_at: "t", value_id: v, value_version: 1, value_label: v.toUpperCase() });
    expect(institutionalTeachingClass({ id: "t", schoolId: "e", academicYearId: "a", academicYearName: null, record: [], shift: [row("1", "tarde")] }).shift).toBe("TARDE");
    const amb = institutionalTeachingClass({ id: "t", schoolId: "e", academicYearId: "a", academicYearName: null, record: [], shift: [row("1", "a"), row("2", "b")] });
    expect(amb.shift).toBeNull();
    expect(amb.situation).toBeNull();
  });
  it("com sessão: só o banco (class_at/class_shift_at); falha de fonte não cai para demo", async () => {
    setDiaryPersistenceMode("cloud");
    tableImpl = (t) => t === "user_person_links" ? { data: [{ person_id: "p1" }], error: null }
      : t === "institutional_classes" ? { data: [{ id: "t1", school_id: "e1", academic_year_id: "a1" }], error: null }
      : { data: [], error: null };
    rpcImpl = (fn) => ({ data: fn === "class_at" ? [{ name: "6A", code: null, administrative_status: "ativa", created_at: "t" }] : [], error: null });
    await hydrateInstitutionalTeaching("u1", { validOn: "2026-03-02", knownAt: "2026-03-02T12:00:00.000Z" });
    expect(teachingClass("t1")).toMatchObject({ name: "6A", shift: null, stageId: null });
    expect(calls.map((c) => c.fn)).toEqual(expect.arrayContaining(["class_at", "class_shift_at"]));
    expect(teachingClass("tur-001")).toBeUndefined();
    tableImpl = (t) => t === "user_person_links" ? { data: [{ person_id: "p1" }], error: null }
      : t === "institutional_classes" ? { data: null, error: { message: "x" } } : { data: [], error: null };
    await hydrateInstitutionalTeaching("u1", { validOn: "2026-03-02", knownAt: "2026-03-02T12:00:00.000Z" });
    expect(teachingClass("t1")).toBeUndefined();
    expect(teachingClass("tur-001")).toBeUndefined();
  });
  it("sem sessão: demonstração continua", () => {
    setDiaryPersistenceMode("laboratorio");
    expect(teachingClass("tur-001")?.shift).toBeTruthy();
  });
});
