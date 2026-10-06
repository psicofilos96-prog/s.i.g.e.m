import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluate, ITEMS } from "./readiness-model";
import { readProbes, type ReadClient, type ReadQuery } from "./readiness-probes";

type Row = Record<string, unknown>;
function fake(db: Record<string, Row[] | "denied">, calls: string[] = []): ReadClient {
  return new Proxy({}, { get: (_t, m) => {
    if (m !== "from") { calls.push(`write:${String(m)}`); return () => { throw new Error("write"); }; }
    return (table: string) => new Proxy({}, { get: (_x, op) => {
      if (op !== "select") { calls.push(`write:${String(op)}`); return () => { throw new Error("write"); }; }
      return () => {
        const f: ((r: Row) => boolean)[] = []; let rg: [number, number] = [0, 1e9];
        const q: ReadQuery = {
          in: (c, v) => (f.push((r) => v.includes(String(r[c]))), q),
          eq: (c, v) => (f.push((r) => String(r[c]) === v), q),
          gte: (c, v) => (f.push((r) => String(r[c]) >= v), q),
          lte: (c, v) => (f.push((r) => String(r[c]) <= v), q),
          range: (a, b) => ((rg = [a, b]), q),
          then: (ok, ko) => {
            calls.push(`select:${table}`);
            const t = db[table];
            const res = t === "denied" ? { data: null, error: { code: "42501" } } : { data: (t ?? []).filter((r) => f.every((g) => g(r))).slice(rg[0], rg[1] + 1), error: null };
            return Promise.resolve(res).then(ok, ko);
          },
        };
        return q;
      };
    } });
  } }) as ReadClient;
}

const base2026: Record<string, Row[]> = {
  institutional_academic_year_versions: [{ academic_year_id: "y26", starts_on: "2026-02-01", ends_on: "2026-12-20" }],
  academic_year_operational_states: [{ id: "s1", academic_year_id: "y26", state: "historico-importado" }],
  institutional_classes: [{ id: "c26", academic_year_id: "y26" }],
  class_offering_versions: [{ id: "o", class_id: "c26" }],
  class_schedules: [{ id: "g", class_id: "c26" }],
  teaching_assignments: [{ id: "t", class_id: "c26" }],
  curricular_matrix_applicability: [{ matrix_version_id: "mv26", academic_year_id: "y26" }],
  curricular_matrix_version_homologations: [{ id: "h", matrix_version_id: "mv26" }],
  institutional_schools: [{ id: "e" }],
  institutional_students: [{ id: "a" }],
  institutional_engagements: [{ id: "en", valid_from: "2026-01-01", valid_until: "2026-12-31" }],
  capability_policies: [{ id: "p", status: "homologated", valid_from: "2026-01-01", valid_until: "2026-12-31" }],
};
const ANNUAL = ITEMS.filter((i) => i.scope === "annual").map((i) => i.id);
const run = async (db: Record<string, Row[] | "denied">) => new Map(evaluate(await readProbes(fake(db), 2027)).map((s) => [s.id, s.state]));

describe("BB — escopo de ano do readiness 2027", () => {
  it("cada item tem escopo explícito", () => expect(ITEMS.every((i) => i.scope === "annual" || i.scope === "timeless")).toBe(true));
  it("dados de 2026 e zero de 2027 ⇒ nenhum item anual pronto", async () => {
    const st = await run(base2026);
    for (const id of ANNUAL) expect(st.get(id), id).not.toBe("READY");
    expect(st.get("escolas")).toBe("READY");
    expect(st.get("alunos")).toBe("READY");
  });
  it("turma de 2027 torna pronto só o item de turmas", async () => {
    const db = { ...base2026,
      institutional_academic_year_versions: [...base2026.institutional_academic_year_versions as Row[], { academic_year_id: "y27", starts_on: "2027-02-01", ends_on: "2027-12-20" }],
      institutional_classes: [...base2026.institutional_classes as Row[], { id: "c27", academic_year_id: "y27" }] };
    const st = await run(db);
    expect(st.get("ano")).toBe("READY");
    expect(st.get("turmas")).toBe("READY");
    for (const id of ["oferta", "grade", "atribuicoes", "matrizes", "abertura", "atuacoes", "capacidades"]) expect(st.get(id), id).not.toBe("READY");
  });
  it("fonte negada ⇒ UNKNOWN, nunca zero", async () => {
    const st = await run({ ...base2026, institutional_schools: "denied" });
    expect(st.get("escolas")).toBe("UNKNOWN");
    const st2 = await run({ ...base2026, institutional_academic_year_versions: "denied" });
    for (const id of ["ano", "turmas", "abertura"]) expect(st2.get(id)).toBe("UNKNOWN");
  });
  it("dependência pendente bloqueia a posterior", async () => {
    const st = await run({ ...base2026, institutional_classes: [{ id: "c27", academic_year_id: "y27" }] }); // turma sem ano 2027 legível
    expect(st.get("ano")).toBe("PENDING");
    expect(st.get("turmas")).not.toBe("READY");
  });
  it("só SELECT: nenhum writer/RPC chamado; 2026 segue historico-importado e 2027 sem estado", async () => {
    const calls: string[] = [];
    const p = await readProbes(fake(base2026, calls), 2027);
    expect(calls.every((c) => c.startsWith("select:"))).toBe(true);
    expect(p.year2027State).toEqual({ kind: "count", n: 0 });
    expect(base2026["academic_year_operational_states"]).toEqual([{ id: "s1", academic_year_id: "y26", state: "historico-importado" }]);
    const src = readFileSync("src/features/year-preparation/readiness-probes.ts", "utf8");
    expect(src).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(/);
  });
});
