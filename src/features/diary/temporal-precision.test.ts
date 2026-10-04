/**
 * B4.10.0d.1 — (1) instante de conhecimento comparado em microssegundos nas atuações;
 * (2) projeção temporal da lista de estudantes na data, sem situação fictícia nem alocação dominante.
 * Reais: readInstitutionalTeaching, readInstitutionalRoster, temporalSituation. Simulado: cliente do backend
 * e as três leituras de episódios (B3), cujos contratos não mudam.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const m = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  queries: [] as string[],
  rpcs: [] as string[],
  episodes: { alloc: [] as Row[], enr: [] as Row[], part: [] as Row[] },
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    m.queries.push(table);
    const filters: [string, unknown][] = [];
    const run = async () => ({ data: (m.tables[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v)), error: null });
    const b: Record<string, unknown> = {};
    for (const k of ["select", "in", "order", "lte", "limit"]) b[k] = () => b;
    b["eq"] = (c: string, v: unknown) => { filters.push([c, v]); return b; };
    b["maybeSingle"] = async () => { const r = await run(); return { data: r.data[0] ?? null, error: null }; };
    b["then"] = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => run().then(ok, ko);
    return b;
  };
  return { supabase: { from, rpc: async (fn: string) => { m.rpcs.push(fn); return { data: [], error: null }; } } };
});
vi.mock("@/features/student-life/cycle-enrollment-source", () => ({
  readClassAllocations: async () => m.episodes.alloc,
  readCycleEnrollments: async () => m.episodes.enr,
  readCycleParticipations: async () => m.episodes.part,
}));

import { readInstitutionalTeaching } from "./institutional-teaching";
import { readInstitutionalRoster } from "@/features/students/institutional-roster";
import { temporalSituation } from "@/features/students/institutional-temporal";

const K = "2026-03-10T12:00:00.000000Z";
const ON = "2026-03-10";

function teachingTables(engCreated: string[], endingCreated?: string) {
  m.tables = {
    user_person_links: [{ user_id: "u1", person_id: "p1" }],
    institutional_persons: [{ id: "p1", display_name: "Pessoa" }],
    institutional_engagements: engCreated.map((c, i) => ({ id: `e${i}`, person_id: "p1", class_id: "c1", component_id: null, period_id: null, valid_from: "2026-01-01", valid_until: null, created_at: c })),
    institutional_classes: [],
    institutional_curricular_components: [],
    curricular_component_versions: [],
    engagement_endings: endingCreated ? [{ engagement_id: "e0", ended_on: "2026-02-01", created_at: endingCreated }] : [],
  };
}

beforeEach(() => { m.queries = []; m.rpcs = []; m.tables = {}; m.episodes = { alloc: [], enr: [], part: [] }; });

describe("B4.10.0d.1 — knownAt em microssegundos (atuações)", () => {
  it("igualdade e 1µs antes entram; 1µs depois fica fora (Date.parse admitiria)", async () => {
    teachingTables(["2026-03-10T12:00:00.000000Z", "2026-03-10T11:59:59.999999Z", "2026-03-10T12:00:00.000001Z"]);
    const s = await readInstitutionalTeaching("u1", { validOn: ON, knownAt: K });
    expect(s.assignments.map((a) => a.id).sort()).toEqual(["e0", "e1"]);
  });
  it("offset equivalente conta como o mesmo instante; registro inválido nunca é conhecido", async () => {
    teachingTables(["2026-03-10T09:00:00-03:00", "2026-03-10T09:00:00.000001-03:00", "não-é-instante", "2026-02-30T00:00:00Z"]);
    const s = await readInstitutionalTeaching("u1", { validOn: ON, knownAt: K });
    expect(s.assignments.map((a) => a.id)).toEqual(["e0"]);
  });
  it("encerramento registrado 1µs depois do knownAt não encerra a atuação", async () => {
    teachingTables(["2026-01-01T00:00:00Z"], "2026-03-10T12:00:00.000001Z");
    expect((await readInstitutionalTeaching("u1", { validOn: ON, knownAt: K })).assignments[0]!.status).toBe("Atual");
    teachingTables(["2026-01-01T00:00:00Z"], "2026-03-10T12:00:00Z");
    expect((await readInstitutionalTeaching("u1", { validOn: ON, knownAt: K })).assignments[0]!.status).toBe("Histórico");
  });
  it("knownAt da fonte inválido falha antes de qualquer consulta", async () => {
    teachingTables(["2026-01-01T00:00:00Z"]);
    for (const bad of ["2026-03-10", "2026-02-30T00:00:00Z", "ontem"]) {
      await expect(readInstitutionalTeaching("u1", { validOn: ON, knownAt: bad })).rejects.toThrow(/inválido/);
    }
    expect(m.queries).toEqual([]);
    expect(m.rpcs).toEqual([]);
  });
});

describe("B4.10.0d.1 — projeção temporal na data (lista de estudantes)", () => {
  it("primitiva: futuro ≠ vigente ≠ encerrado; abertura ausente não é vigência; fim inclusivo", () => {
    expect(temporalSituation("2026-04-01", null, ON)).toBe("Futura");
    expect(temporalSituation(null, null, ON)).toBe("Abertura não registrada");
    expect(temporalSituation(null, "2026-01-01", ON)).toBe("Encerrada");
    expect(temporalSituation("2026-01-01", "2026-12-31", ON)).toBe("Vigente");
    expect(temporalSituation("2026-01-01", ON, ON)).toBe("Vigente");
    expect(temporalSituation("2026-01-01", "2026-03-09", ON)).toBe("Encerrada");
  });

  it("matrículas e alocações projetadas na data; duas vigentes sem dominante; histórico preservado", async () => {
    m.tables = { institutional_students: [{ id: "s1", display_name: "Ana", institutional_identifier: null }], institutional_schools: [{ id: "esc" }] };
    const en = (id: string, opened_on: string | null, ended_on: string | null) =>
      ({ id, logical_id: id, student_id: "s1", school_id: "esc", academic_year_id: "a", opened_on, ended_on, institutional_number: null, ending_reason: null });
    m.episodes.enr = [en("m-fut", "2026-05-01", null), en("m-sem", null, null), en("m-vig", "2025-01-01", "2026-12-31")];
    m.episodes.part = [{ id: "p1", logical_id: "p1", version: 1, enrollment_logical_id: "m-vig", student_id: "s1", school_id: "esc", nature_scheme_id: "n", nature_value_id: "v", nature_version: 1, valid_from: "2025-01-01", valid_until: null, annulled: false }];
    const al = (id: string, class_id: string, valid_from: string, ended_on: string | null) =>
      ({ id, logical_id: id, student_id: "s1", enrollment_id: "m-vig", school_id: "esc", class_id, valid_from, ended_on, ending_reason: null, participation_logical_id: "p1" });
    m.episodes.alloc = [
      al("reg", "turma-regular", "2026-01-01", "2026-12-31"),
      al("aee", "turma-aee", "2026-02-01", null),
      al("exato", "turma-x", "2026-01-01", ON),
      al("passado", "turma-antiga", "2025-02-01", "2025-12-15"),
      al("futura", "turma-futura", "2026-06-01", null),
    ];
    const [s] = await readInstitutionalRoster({ validOn: ON, knownAt: K });
    expect(s!.enrollments.map((e) => [e.id, e.situation])).toEqual([["m-fut", "Futura"], ["m-sem", "Abertura não registrada"], ["m-vig", "Vigente"]]);
    const allocs = s!.enrollments[2]!.academicLinks[0]!.participations[0]!.allocations;
    expect(allocs.map((a) => [a.id, a.situation])).toEqual([
      ["reg", "Vigente"], ["aee", "Vigente"], ["exato", "Vigente"], ["passado", "Encerrada"], ["futura", "Futura"],
    ]);
    expect(allocs.find((a) => a.id === "passado")!.until).toBe("2025-12-15");
    expect(s!.currentSituation).toBe("Várias alocações vigentes na data");
    expect(s!.currentClassId).toBeNull();
    expect(s!.currentUnitId).toBe("esc");
    expect(s!.dataOrigin).toBe("institucional");
    expect(s!.enrollments[2]!.academicLinks[0]!.participations[0]!.nature).toBeNull();
    const [n] = await readInstitutionalRoster({ validOn: "2026-03-11", knownAt: K });
    const nAllocs = n!.enrollments[2]!.academicLinks[0]!.participations[0]!.allocations;
    expect(nAllocs.find((a) => a.id === "exato")!.situation).toBe("Encerrada");
    expect(nAllocs).toHaveLength(5);
  });

  it("uma única alocação vigente é a corrente; nenhuma vigente não inventa turma", async () => {
    m.tables = { institutional_students: [{ id: "s1", display_name: "Ana", institutional_identifier: null }], institutional_schools: [{ id: "esc" }] };
    m.episodes.enr = [{ id: "e", logical_id: "e", student_id: "s1", school_id: "esc", academic_year_id: "a", opened_on: "2025-01-01", ended_on: null }];
    m.episodes.part = [{ id: "p", logical_id: "p", version: 1, enrollment_logical_id: "e", student_id: "s1", school_id: "esc", nature_scheme_id: "n", nature_value_id: "v", nature_version: 1, valid_from: "2025-01-01", valid_until: null, annulled: false }];
    m.episodes.alloc = [{ id: "r", logical_id: "r", student_id: "s1", enrollment_id: "e", school_id: "esc", class_id: "t1", valid_from: "2026-01-01", ended_on: null, ending_reason: null, participation_logical_id: "p" }];
    const [a] = await readInstitutionalRoster({ validOn: ON, knownAt: K });
    expect([a!.currentSituation, a!.currentClassId]).toEqual(["Alocação vigente na data", "t1"]);
    const [b] = await readInstitutionalRoster({ validOn: "2025-12-31", knownAt: K });
    expect([b!.currentSituation, b!.currentClassId, b!.currentUnitId]).toEqual(["Sem alocação vigente na data", null, null]);
  });
});
