import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  SourceInconsistency, allocationMoveAvailability, b3Message, capacityOccupancy, readClassAllocations,
  readCycleEnrollments, type CapacityRow, type ClassAllocationAtRow,
} from "./cycle-enrollment-source";
import { loadClassCanonicalFacts } from "@/features/ciece/fact-loader";

const dir = join(process.cwd(), "drizzle/migrations");
const sql = readFileSync(join(dir, readdirSync(dir).find((f) => f.includes("b3_cycle_enrollment"))!), "utf8");
const fn = (name: string) => {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  return sql.slice(start, sql.indexOf("END $$;", start));
};

/** Cliente simulado com semântica bitemporal: linhas com created_at; correções por supersedes. */
function client(rows: Record<string, unknown[]>, failing: string[] = []) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const empty = { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "contains", "maybeSingle"]) chain[m] = () => chain;
  (chain as { then: unknown }).then = (r: (v: unknown) => void) => r(empty);
  return {
    calls,
    from: (t: string) => { calls.push({ fn: `from:${t}`, args: {} }); return chain; },
    rpc: async (f: string, args: Record<string, unknown>) => {
      calls.push({ fn: f, args });
      if (failing.includes(f)) return { data: null, error: { message: `${f.split("_")[0]}:ambiguous-temporal-state` } };
      const known = (rows[f] ?? []) as { created_at: string; valid_from?: string; ended_on?: string | null }[];
      const at = args["_known_at"] as string | null;
      const on = args["_valid_on"] as string | null;
      return {
        data: known.filter((r) => (!at || r.created_at <= at) && (!on || ((r.valid_from ?? "") <= on && (!r.ended_on || r.ended_on >= on)))),
        error: null,
      };
    },
    auth: { getSession: async () => ({ data: { session: {} } }) },
  };
}

const alloc = (o: Partial<ClassAllocationAtRow>): ClassAllocationAtRow => ({
  id: "a1", logical_id: "a1", participation_logical_id: "p1", enrollment_id: "e1", student_id: "s1", school_id: "esc",
  class_id: "t1", valid_from: "2026-02-01", ended_on: null, ending_version_id: null, ending_reason: null,
  originating_act_ref: null, class_label_snapshot: null, created_at: "2026-02-01T10:00:00Z", ...o,
});

describe("B3 — readers bitemporais", () => {
  it("antes e depois da correção: knownAt anterior não vê a retificação", async () => {
    const c = client({ class_allocations_at: [alloc({}), alloc({ id: "a1b", created_at: "2026-03-10T10:00:00Z", valid_from: "2026-02-05" })] });
    const before = await readClassAllocations({ classId: "t1" }, { validOn: null, knownAt: "2026-03-01T00:00:00Z" }, c as never);
    expect(before.map((r) => r.id)).toEqual(["a1"]);
    const after = await readClassAllocations({ classId: "t1" }, { validOn: null, knownAt: "2026-04-01T00:00:00Z" }, c as never);
    expect(after.map((r) => r.id)).toContain("a1b");
    expect(c.calls[0]!.args).toMatchObject({ _class: "t1", _known_at: "2026-03-01T00:00:00Z" });
  });
  it("ausência = lista vazia, nunca valor fabricado", async () => {
    expect(await readCycleEnrollments("esc", { validOn: "2026-05-01" }, client({}) as never)).toEqual([]);
  });
  it("ambiguidade falha fechada (SourceInconsistency)", async () => {
    await expect(readCycleEnrollments("esc", { validOn: "2026-05-01" }, client({}, ["cycle_enrollments_at"]) as never)).rejects.toBeInstanceOf(SourceInconsistency);
  });
});

describe("B3 — capacidade e ocupação", () => {
  const cap: CapacityRow = { id: "c", logical_id: "c", version: 1, class_id: "t1", school_id: "esc", reference_limit: 1, valid_from: "2026-01-01", valid_until: null, basis_text: null, originating_act_ref: null, created_at: "" };
  it("ocupação é contagem derivada das alocações vigentes", () => {
    expect(capacityOccupancy([cap], [alloc({}), alloc({ id: "a2" })]).occupancy).toBe(2);
  });
  it("capacidade ausente não é zero", () => {
    expect(capacityOccupancy([], []).capacity).toEqual({ status: "nao-registrada" });
  });
  it("nenhuma regra automática de turma cheia", () => {
    const r = capacityOccupancy([cap], [alloc({}), alloc({ id: "a2" })]);
    expect(Object.keys(r)).toEqual(["capacity", "occupancy"]);
    expect(fn("record_class_allocation")).not.toMatch(/class_capacity/);
  });
  it("capacidade nunca é campo da turma", () => {
    expect(sql).not.toMatch(/ALTER TABLE public\.institutional_classes/);
  });
});

describe("B3 — escritores fail-closed (SQL)", () => {
  it("participação exige natureza homologada", () => {
    expect(fn("declare_cycle_participation")).toMatch(/attribute_value_homologated\('natureza-da-participacao-educacional'[\s\S]*participation:nature-not-homologated/);
  });
  it("múltiplas participações: sobreposição sem política é recusada, sem inferir coexistência", () => {
    expect(fn("declare_cycle_participation")).toMatch(/participation:coexistence-policy-absent/);
  });
  it("alocação aponta para participação e valida escola, ano, turma ativa e vigência", () => {
    const f = fn("record_class_allocation");
    for (const code of ["participation-unknown", "class-other-school", "academic-year-mismatch", "class-inactive-on-date", "outside-participation", "cardinality-policy-absent"]) expect(f).toContain(`allocation:${code}`);
    expect(f).toMatch(/class_at\(_class, _valid_from/);
    expect(f).toMatch(/participation_logical_id/);
  });
  it("término anterior ao início é rejeitado; retificação é nova versão com motivo", () => {
    expect(fn("record_cycle_enrollment_ending")).toMatch(/ending:before-start/);
    expect(fn("record_class_allocation_ending")).toMatch(/allocation-ending:before-start/);
    expect(fn("record_cycle_enrollment_ending")).toMatch(/correction-reason-required[\s\S]*_v := _prev\.version \+ 1/);
    expect(sql).toMatch(/immutable_cycle_enrollment_endings BEFORE UPDATE OR DELETE/);
  });
  it("situação do vínculo vem do catálogo homologado situacao-do-vinculo", () => {
    expect(fn("record_cycle_enrollment_ending")).toMatch(/attribute_value_homologated\('situacao-do-vinculo'/);
  });
  it("oferta educacional sem designação homologada é recusada", () => {
    expect(fn("constitute_cycle_enrollment")).toMatch(/enrollment:offer-designation-not-homologated/);
  });
  it("tipo de movimentação não homologado continua recusado; writer de tipos exige ato", () => {
    expect(fn("record_movement_type_definition")).toMatch(/homologation-act-required/);
  });
  it("capabilities históricas por escopo", () => {
    expect(fn("constitute_cycle_enrollment")).toMatch(/has_school_capability\('manter-matricula-e-enturmacao', _school\)/);
    expect(fn("record_movement_type_definition")).toMatch(/has_network_capability\('manter-catalogos-institucionais'\)/);
  });
  it("nenhum valor semeado", () => {
    expect(sql).not.toMatch(/INSERT INTO (public\.)?(attribute_value_definitions|movement_type_definitions|capability_policy)/i.source.replace("INSERT INTO (public\\.)?(attribute", "INSERT INTO (public\\.)?(attribute"));
    expect(sql).not.toMatch(/INSERT INTO public\./);
  });
});

describe("B3 — segurança", () => {
  it("anon/PUBLIC sem EXECUTE nos escritores; escritores antigos fora de uso", () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION[\s\S]*constitute_cycle_enrollment[\s\S]*FROM PUBLIC, anon;/);
    expect(sql).toMatch(/register_school_enrollment\([^)]*\) FROM PUBLIC, anon, authenticated/);
  });
  it("sem DML direto para anon/authenticated/sandbox_exec", () => {
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.school_enrollments[\s\S]*FROM anon, authenticated;/);
    expect(sql).toMatch(/FROM sandbox_exec/);
  });
  it("readers são SECURITY INVOKER (RLS da sessão)", () => {
    expect(fn("class_allocations_at")).not.toMatch(/SECURITY DEFINER/);
  });
});

describe("B3 — movimentação entre alocações", () => {
  it("sem política temporal declarativa fica indisponível e preserva origem", () => {
    expect(allocationMoveAvailability().available).toBe(false);
    expect(b3Message(new Error("allocation:cardinality-policy-absent"))).toMatch(/cardinalidade/);
  });
});

describe("B3 — consumidores", () => {
  it("CIECE lê alocações, inscrições e movimentações pelos readers B3 com knownAt", async () => {
    const c = client({ class_allocations_at: [alloc({})] });
    const r = await loadClassCanonicalFacts("t1", { validOn: "2026-05-01", knownAt: "2026-06-01T00:00:00Z" }, c as never);
    expect(c.calls.some((x) => x.fn === "class_allocations_at" && x.args["_known_at"] === "2026-06-01T00:00:00Z")).toBe(true);
    expect(c.calls.some((x) => x.fn === "from:class_enrollment_episodes")).toBe(false);
    expect(r.facts.some((f) => f.provenance.sourceId === "class_enrollment_episodes" || f.factTypeId.includes("enturm"))).toBe(true);
  });
  it("sem contexto temporal a fonte falha, nunca 'atual' implícito", async () => {
    const r = await loadClassCanonicalFacts("t1", null, client({}) as never);
    expect(r.failedSources).toContain("class_allocations_at:sem-contexto-temporal");
  });
  it("roster do Diário não usa currentVersions nem demonstração com sessão", () => {
    const src = readFileSync(join(process.cwd(), "src/features/students/institutional-roster.ts"), "utf8");
    expect(src).not.toMatch(/currentVersions/);
    expect(src).toMatch(/readClassAllocations/);
    expect(src).toMatch(/isDiaryCloud\(\) \? cloudStudents : demonstrationStudents/);
  });
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc: async () => ({ data: [], error: null }), from: () => ({}) } }));
