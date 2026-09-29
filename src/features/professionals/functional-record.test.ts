/** 14.12.6 — contratos do registro funcional, fatos do CIECE e estabilidade do Mapa. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { postingsAt, functionalEventsIn, type FunctionalLinkRow, type PostingRow, type FunctionalEventRow } from "./functional-record";
import { postingFacts, functionalEventFacts } from "@/features/ciece/functional-facts";
import { validateFact } from "@/features/ciece/fact-catalog";
import { assembleMapSnapshot } from "@/features/statistical-map/map-domain";

const link = (id: string, o: Partial<FunctionalLinkRow> = {}): FunctionalLinkRow => ({ id: `${id}-v1`, logical_id: id, version: 1, supersedes_id: null, person_id: `p-${id}`, functional_registration: `M-${id}`,
  link_nature_id: "efetivo", link_nature_version: 1, position_id: "professor", position_version: 1, valid_from: "2020-01-01", valid_until: null, originating_act_ref: "ato", ...o });
const post = (id: string, lnk: string, school: string, from: string | null, until: string | null = null, o: Partial<PostingRow> = {}): PostingRow => ({ id: `${id}-v1`, logical_id: id, version: 1, supersedes_id: null,
  functional_link_logical_id: lnk, school_id: school, function_id: "regencia", function_version: 1, functional_status_id: "ativo", functional_status_version: 1, valid_from: from, valid_until: until, originating_act_ref: "ato", ...o });
const ev = (id: string, date: string | null, o: Partial<FunctionalEventRow> = {}): FunctionalEventRow => ({ id: `${id}-v1`, logical_id: id, version: 1, supersedes_id: null, functional_link_logical_id: "L1",
  posting_logical_id: null, school_id: "e1", event_kind_id: "remocao", event_kind_version: 1, occurred_on: date, originating_act_ref: "ato", ...o });

describe("14.12 lotação", () => {
  const links = [link("L1"), link("L2")];
  it("uma lotação vigente; ausência de lotação", () => {
    expect(postingsAt([post("P1", "L1", "e1", "2026-01-01")], links, "e1", "2026-04-15").valid).toHaveLength(1);
    expect(postingsAt([], links, "e1", "2026-04-15").valid).toHaveLength(0);
  });
  it("mudança de escola: antes/depois", () => {
    const ps = [post("P1", "L1", "e1", "2026-01-01", "2026-05-09"), post("P2", "L1", "e2", "2026-05-10")];
    expect(postingsAt(ps, links, "e1", "2026-04-15").valid).toHaveLength(1);
    expect(postingsAt(ps, links, "e1", "2026-05-20").valid).toHaveLength(0);
    expect(postingsAt(ps, links, "e2", "2026-05-20").valid).toHaveLength(1);
  });
  it("duas lotações simultâneas legítimas em escolas distintas; conflito na mesma escola", () => {
    const ps = [post("P1", "L1", "e1", "2026-01-01"), post("P2", "L1", "e2", "2026-01-01")];
    expect(postingsAt(ps, links, "e1", "2026-04-15").conflicts).toEqual([]);
    expect(postingsAt([...ps, post("P3", "L1", "e1", "2026-02-01")], links, "e1", "2026-04-15").conflicts).toEqual(["L1"]);
  });
  it("vínculo encerrado não conta; ausência de data é indeterminada", () => {
    const closed = [link("L1", { valid_until: "2026-03-31" })];
    expect(postingsAt([post("P1", "L1", "e1", "2026-01-01")], closed, "e1", "2026-04-15").valid).toHaveLength(0);
    const r = postingsAt([post("P1", "L1", "e1", null)], links, "e1", "2026-04-15");
    expect(r.valid).toHaveLength(0); expect(r.undated).toHaveLength(1);
  });
  it("correção não apaga a anterior e a versão substituída não é contada", () => {
    const v1 = post("P1", "L1", "e1", "2026-01-01");
    const v2 = { ...v1, id: "P1-v2", version: 2, supersedes_id: v1.id, function_id: "coordenacao" };
    const r = postingsAt([v1, v2], links, "e1", "2026-04-15");
    expect(r.valid.map((p) => p.id)).toEqual(["P1-v2"]);
  });
  it("profissional inativo: situação é dado do catálogo, não exclusão", () => {
    const r = postingsAt([post("P1", "L1", "e1", "2026-01-01", null, { functional_status_id: "afastado" })], links, "e1", "2026-04-15");
    expect(r.valid[0]!.functional_status_id).toBe("afastado");
  });
  it("eventos no intervalo; sem data é indeterminado", () => {
    const r = functionalEventsIn([ev("E1", "2026-04-03"), ev("E2", "2026-05-01"), ev("E3", null)], "e1", "2026-04-01", "2026-04-30");
    expect(r.inWindow.map((e) => e.logical_id)).toEqual(["E1"]); expect(r.undated).toHaveLength(1);
  });
});

describe("14.12 CIECE e fronteiras", () => {
  it("fatos atômicos válidos, nunca contagens prontas", () => {
    const facts = [...postingFacts([post("P1", "L1", "e1", "2026-01-01")], [link("L1")]), ...functionalEventFacts([ev("E1", "2026-04-03")])];
    for (const f of facts) expect(validateFact(f, f.provenance.sourceId)).toEqual([]);
    for (const f of facts) expect(Object.keys(f.dimensions).join()).not.toMatch(/total|count|quantidade|deficit/i);
    expect(facts[0]!.provenance.sources?.[0]?.kind).toBe("professional_functional_links");
  });
  it("atuação não é lotação e cargo não concede capacidade", () => {
    const sql = readdirSync("supabase/migrations").sort().map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
    const cap = sql.slice(sql.lastIndexOf("CREATE OR REPLACE FUNCTION public.effective_capabilities"));
    expect(cap.slice(0, cap.indexOf("$$;"))).not.toMatch(/professional_|position_id/);
    const src = readFileSync("src/features/professionals/functional-record.ts", "utf8");
    expect(src).not.toMatch(/institutional_engagements/);
  });
});

describe("14.12 Mapa", () => {
  const school = { schoolId: "e1", identifiers: [], versions: [{ id: "v1", schoolId: "e1", versionNumber: 1, supersedesVersionId: null, officialName: "E", address: null, district: null, locationKind: null, active: true, validFrom: "2020-01-01", originatingActRef: null }] };
  const rule = { id: "r", version: 1, status: "homologada" as const, homologationActRef: "a", validFrom: "2026-01-01", validUntil: null, definition: { snapshotDate: { kind: "dia-do-mes" as const, day: 15 }, cells: [], blockingCellIds: [] } };
  const map = (month: number, functional: Parameters<typeof assembleMapSnapshot>[0]["functional"]) =>
    assembleMapSnapshot({ competence: { schoolId: "e1", year: 2026, month }, rule, schools: [school], classes: [], facts: [], observations: { text: "", eventId: null }, functional });
  const cell = (s: ReturnType<typeof map>, id: string) => s.cells.find((c) => c.cellId === id)!;
  it("Mapa histórico estável após mudança posterior; campos D de pessoal deixaram de existir", () => {
    const p1 = post("P1", "L1", "e1", "2026-01-01");
    const before = cell(map(4, { links: [link("L1")], postings: [p1], events: [] }), "lotacao");
    const p1v2 = { ...p1, id: "P1-v2", version: 2, supersedes_id: p1.id, valid_until: "2026-05-09" };
    const after = cell(map(4, { links: [link("L1")], postings: [p1, p1v2], events: [] }), "lotacao");
    expect(after.value).toBe(before.value);
    expect(cell(map(6, { links: [link("L1")], postings: [p1, p1v2], events: [] }), "lotacao").state).toBe("ausente");
    expect(cell(map(4, null), "lotacao").state).toBe("indeterminado");
    expect(map(4, null).cells.filter((c) => c.origin === "sem-fonte").map((c) => c.cellId)).not.toContain("lotacao");
  });
});
