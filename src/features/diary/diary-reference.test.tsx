/**
 * B4.10.0d — referência temporal explícita do Diário e domingo estrutural.
 * Reais: useSessionUser, DiarySessionBoundary/controlador, lista de estudantes, atuações, grade B4.4.
 * Só o cliente do backend é simulado (filtros `eq` aplicados; argumentos de RPC registrados).
 */
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: string, session: { user: { id: string } } | null) => void;
type Row = Record<string, unknown>;
type Res = { data: unknown; error: { message: string } | null };
type Dataset = { tables: Record<string, Row[]>; rpc: Record<string, Res>; errors?: Record<string, string> };

const m = vi.hoisted(() => ({
  listeners: new Set<Listener>(),
  getSession: (() => Promise.resolve({ data: { session: null }, error: null })) as () => Promise<unknown>,
  dataset: null as unknown as Dataset,
  gate: null as Promise<void> | null,
  queries: [] as { table: string; filters: [string, unknown][] }[],
  rpcCalls: [] as { fn: string; args: unknown }[],
  rpcGate: null as Promise<void> | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const ds = m.dataset;
    const gate = m.gate;
    const filters: [string, unknown][] = [];
    m.queries.push({ table, filters });
    const run = async (): Promise<Res> => {
      if (gate) await gate;
      const err = ds.errors?.[table];
      if (err) return { data: null, error: { message: err } };
      const rows = (ds.tables[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v));
      return { data: rows, error: null };
    };
    const b: Record<string, unknown> = {};
    for (const k of ["select", "in", "order", "lte", "contains", "is", "limit"]) b[k] = () => b;
    b["eq"] = (c: string, v: unknown) => { filters.push([c, v]); return b; };
    b["maybeSingle"] = async () => { const r = await run(); return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error }; };
    b["then"] = (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => run().then(ok, ko);
    return b;
  };
  return {
    supabase: {
      auth: {
        onAuthStateChange: (cb: Listener) => {
          m.listeners.add(cb);
          return { data: { subscription: { unsubscribe: () => m.listeners.delete(cb) } } };
        },
        getSession: () => m.getSession(),
      },
      from,
      rpc: async (fn: string, args: unknown) => {
        const ds = m.dataset;
        const gate = fn.startsWith("record_") ? m.rpcGate : m.gate;
        m.rpcCalls.push({ fn, args });
        if (gate) await gate;
        return ds.rpc[fn] ?? { data: [], error: null };
      },
    },
  };
});

import { DiarySessionBoundary } from "./diary-session";
import { diarySessionState } from "./diary-session-state";
import { diaryPersistenceMode, setDiaryPersistenceMode } from "./diary-persistence-mode";
import { rosterStudents } from "@/features/students/institutional-roster";
import { teachingAssignments, teachingClassBlocks, teachingScheduleState } from "./institutional-teaching";
import { DIARY_REFERENCE_DATE, diaryQueryDate, diaryToday, studentsForClassOn } from "./diary-data";
import { weekdayOf } from "./lesson-records";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}
const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); });
const emit = async (event: string, id: string | null) => {
  await act(async () => { for (const l of [...m.listeners]) l(event, id ? { user: { id } } : null); });
  await flush();
};
const T0 = "2020-01-01T00:00:00Z";
function dataset(tag: string, over: Partial<Record<string, Row[]>> = {}): Dataset {
  return {
    tables: {
      institutional_students: [{ id: `est-${tag}`, display_name: `Estudante ${tag}`, institutional_identifier: null }],
      institutional_schools: [],
      user_person_links: [{ user_id: "uA", person_id: "pA" }],
      institutional_persons: [{ id: "pA", display_name: "Pessoa A" }],
      institutional_engagements: [],
      institutional_classes: [{ id: "t1", school_id: "e1", academic_year_id: "a1" }],
      institutional_curricular_components: [{ id: "c1", label: "Rótulo de identidade" }],
      curricular_component_versions: [],
      engagement_endings: [],
      institutional_academic_year_versions: [],
      institutional_school_record_versions: [],
      institutional_school_identifiers: [],
      ...over,
    },
    rpc: { effective_capabilities: { data: [], error: null } },
  };
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const tree = (date?: string) => (
  <QueryClientProvider client={client()}><DiarySessionBoundary referenceDate={date}><p>conteúdo</p></DiarySessionBoundary></QueryClientProvider>
);
const signedIn = (id: string) => { m.getSession = () => Promise.resolve({ data: { session: { user: { id } } }, error: null }); };
const rpcArgs = (fn: string) => m.rpcCalls.filter((c) => c.fn === fn).map((c) => c.args as Record<string, unknown>);

beforeEach(() => {
  m.queries = [];
  m.rpcCalls = [];
  m.gate = null;
  m.rpcGate = null;
  m.dataset = dataset("D");
  m.getSession = () => new Promise(() => undefined);
  setDiaryPersistenceMode("pendente");
});
afterEach(() => vi.useRealTimers());

describe("B4.10.0d — referência de consulta e knownAt único", () => {
  it("data histórica distinta do relógio: mesma data e UM knownAt até class_at, class_shift_at e grade", async () => {
    signedIn("uA");
    const view = render(tree("2025-05-10"));
    await flush();
    const st = diarySessionState();
    expect(st.phase).toBe("pronto");
    expect(st.reference?.validOn).toBe("2025-05-10");
    expect(st.reference?.source).toBe("informada");
    const knownAt = st.reference!.knownAt;
    const readers = [...rpcArgs("class_at"), ...rpcArgs("class_shift_at")];
    expect(readers.length).toBe(2);
    for (const a of readers) {
      expect(a["_valid_on"]).toBe("2025-05-10");
      expect(a["_known_at"]).toBe(knownAt);
    }
    expect(diaryQueryDate()).toBe("2025-05-10");
    teachingScheduleState("t1", "2025-05-10");
    await flush();
    const sched = rpcArgs("class_schedule_at");
    expect(sched).toEqual([{ _class_id: "t1", _on: "2025-05-10", _known_at: knownAt }]);
    view.unmount();
  });

  it("sem data na URL: hoje operacional capturado uma vez (fonte declarada)", async () => {
    signedIn("uA");
    const view = render(tree());
    await flush();
    const ref = diarySessionState().reference!;
    expect(ref.source).toBe("hoje-operacional");
    expect(ref.validOn).toBe(ref.operationalToday);
    expect(diaryToday()).toBe(ref.operationalToday);
    expect(diaryQueryDate()).not.toBe(DIARY_REFERENCE_DATE);
    view.unmount();
  });

  it("data inválida: nenhuma consulta, nenhuma data substituta, Diário sem dados", async () => {
    signedIn("uA");
    const view = render(tree("2026-02-30"));
    await flush();
    expect(diarySessionState().phase).toBe("erro");
    expect(diarySessionState().error).toContain("inválida");
    expect(m.queries).toEqual([]);
    expect(m.rpcCalls).toEqual([]);
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(diaryQueryDate()).toBeNull();
    expect(studentsForClassOn("t1")).toEqual([]);
    view.unmount();
  });

  it("mudança de data na mesma conta: resposta tardia da data anterior é descartada", async () => {
    signedIn("uA");
    const hold = deferred();
    m.gate = hold.promise;
    m.dataset = dataset("D1");
    const view = render(tree("2026-03-02"));
    await flush();
    expect(diarySessionState().phase).toBe("carregando");
    m.gate = null;
    m.dataset = dataset("D2");
    view.rerender(tree("2026-04-06"));
    await flush();
    expect(diarySessionState().key?.endsWith("@2026-04-06")).toBe(true);
    expect(rosterStudents().map((s) => s.id)).toEqual(["est-D2"]);
    await act(async () => { hold.resolve(); });
    await flush();
    expect(rosterStudents().map((s) => s.id)).toEqual(["est-D2"]);
    expect(diarySessionState().reference?.validOn).toBe("2026-04-06");
    view.unmount();
  });
});

describe("B4.10.0d — nomes e atuações na data conhecida", () => {
  it("denominação futura ou registrada depois do knownAt é excluída", async () => {
    signedIn("uA");
    m.dataset = dataset("N", {
      institutional_engagements: [{ id: "e-1", person_id: "pA", class_id: "t1", component_id: "c1", period_id: null, valid_from: "2026-01-01", valid_until: null, created_at: T0 }],
      curricular_component_versions: [
        { component_id: "c1", official_name: "Matemática", version: 1, valid_from: "2020-01-01", created_at: T0 },
        { component_id: "c1", official_name: "Matemática (futura)", version: 2, valid_from: "2027-01-01", created_at: T0 },
        { component_id: "c1", official_name: "Matemática (registrada depois)", version: 3, valid_from: "2020-01-01", created_at: "2999-01-01T00:00:00Z" },
      ],
    });
    const view = render(tree("2026-03-02"));
    await flush();
    expect(teachingAssignments().map((a) => a.field)).toEqual(["Matemática"]);
    view.unmount();
  });

  it("atuação futura não é Atual; encerramento conhecido encerra; encerramento/atuação registrados depois do knownAt não contam", async () => {
    signedIn("uA");
    const eng = (id: string, valid_from: string, created_at = T0) => ({ id, person_id: "pA", class_id: "t1", component_id: null, period_id: null, valid_from, valid_until: null, created_at });
    m.dataset = dataset("E", {
      institutional_engagements: [eng("fut", "2026-06-01"), eng("enc", "2026-01-01"), eng("tarde", "2026-01-01"), eng("nova", "2026-01-01", "2999-01-01T00:00:00Z")],
      engagement_endings: [
        { engagement_id: "enc", ended_on: "2026-02-15", created_at: T0 },
        { engagement_id: "tarde", ended_on: "2026-02-15", created_at: "2999-01-01T00:00:00Z" },
      ],
    });
    const view = render(tree("2026-03-02"));
    await flush();
    const by = Object.fromEntries(teachingAssignments().map((a) => [a.id, a]));
    expect(Object.keys(by).sort()).toEqual(["enc", "fut", "tarde"]);
    expect(by["fut"]!.status).toBe("Futura");
    expect(by["enc"]!.status).toBe("Histórico");
    expect(by["enc"]!.end).toBe("2026-02-15");
    expect(by["tarde"]!.status).toBe("Atual");
    expect(by["tarde"]!.end).toBeUndefined();
    for (const a of Object.values(by)) expect(a.role).not.toMatch(/principal|corresponsável/i);
    view.unmount();
  });
});

describe("B4.10.0d — domingo estrutural", () => {
  const block = (weekday: number, ref: { validOn: string; knownAt: string }) => ({
    result_kind: "block", class_id: "t1", valid_on: ref.validOn, known_at: ref.knownAt, schedule_state: "utilizavel", schedule_id: "s1",
    version_id: "v1", version: 1, change_kind: "constituicao", valid_from: "2026-01-01", effective_until: null, originating_act_ref: "ato",
    change_reason: null, recorded_at: T0, block_id: `b${weekday}`, block_key: `k${weekday}`, weekday, starts_at: "08:00:00",
    ends_at: "09:00:00", block_minutes: 60, component_id: null, component_version: null, component_name: null,
    nature_scheme_id: null, nature_value_id: null, nature_value_version: null, nature_label: null, engagement_ids: [],
    block_state: "utilizavel", block_issues: [], overlapping_block_keys: [], coverage_state: "nao-comprovada", coverage_matrix_ids: [],
    day_minutes: 60, week_minutes: 60,
  });

  it("bloco de domingo cadastrado é preservado; sem bloco no domingo nada é fabricado", async () => {
    signedIn("uA");
    const view = render(tree("2026-03-01")); // domingo
    await flush();
    const ref = diarySessionState().reference!;
    expect(weekdayOf("2026-03-01")).toBe("sun");
    m.dataset.rpc["class_schedule_at"] = { data: [block(7, ref), block(1, ref)], error: null };
    teachingScheduleState("t1", "2026-03-01");
    await flush();
    expect(teachingClassBlocks("t1", "2026-03-01").map((b) => b.day).sort()).toEqual(["mon", "sun"]);
    m.dataset.rpc["class_schedule_at"] = { data: [block(1, { ...ref, validOn: "2026-03-08" })], error: null };
    teachingScheduleState("t1", "2026-03-08");
    await flush();
    expect(teachingClassBlocks("t1", "2026-03-08").map((b) => b.day)).toEqual(["mon"]);
    view.unmount();
  });
});

describe("B4.10.0d — laboratório legado", () => {
  it("sem sessão: data fixa do laboratório e nenhuma consulta", async () => {
    m.getSession = () => Promise.resolve({ data: { session: null }, error: null });
    const view = render(tree());
    await flush();
    expect(diaryPersistenceMode()).toBe("laboratorio");
    expect(diaryQueryDate()).toBe(DIARY_REFERENCE_DATE);
    expect(diaryToday()).toBe(DIARY_REFERENCE_DATE);
    expect(m.queries).toEqual([]);
    view.unmount();
  });
});

void emit;
void screen;
