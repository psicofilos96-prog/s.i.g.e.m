/**
 * B4.10.0f.1 — diagnóstico de cadeia aceito por contexto; attendanceBlocker real.
 * Base do arnês: B4.10.0c — isolamento dos carregamentos do Diário por sessão.
 * Reais: useSessionUser, DiarySessionBoundary/controlador, stores do Diário, lista de estudantes,
 * atuações, QueryClient. Só o cliente do backend é simulado (com filtros `eq` aplicados de verdade).
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
  gateFn: null as { fn: string; gate: Promise<void> } | null,
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
        const gate = m.gateFn && m.gateFn.fn === fn ? m.gateFn.gate : fn.startsWith("record_") ? m.rpcGate : m.gate;
        m.rpcCalls.push({ fn, args });
        if (gate) await gate;
        return ds.rpc[fn] ?? { data: [], error: null };
      },
    },
  };
});

import { DiarySessionBoundary } from "./diary-session";
import { diarySessionState } from "./diary-session-state";
import { diaryPersistenceMode } from "./diary-persistence-mode";
import { rosterStudents } from "@/features/students/institutional-roster";
import { demonstrationStudents } from "@/features/students/students-data";
import { teachingAssignments, teachingPersonId } from "./institutional-teaching";
import { isOfficialLesson, recordAttendanceInCloud } from "./diary-cloud";
import { emptyLessonInput, localLessonStore } from "./lesson-records";
import { lessonCorrectionCloud } from "./lesson-correction-config";
import { UNREGISTERED_PEDAGOGICAL_ROLE } from "@/features/pedagogical/pedagogical-data";

import { attendanceBlocker } from "./attendance";
import { rosterChainDiagnostics } from "@/features/students/institutional-roster";
import type { LessonEntry } from "./lesson-records";

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

/** Conta com estudante válido em t1 e alocação legada (sem participação) em `legacyClass`. */
function dataset(u: "A" | "B", legacyClass: string): Dataset {
  const enr = { id: `e-${u}`, logical_id: `e-${u}`, student_id: `est-${u}`, school_id: "esc", academic_year_id: "a", opened_on: "2026-01-01", ended_on: null, institutional_number: null, ending_reason: null, created_at: "2026-01-01T00:00:00Z" };
  const part = { id: `p-${u}`, logical_id: `p-${u}`, version: 1, supersedes_id: null, enrollment_logical_id: `e-${u}`, student_id: `est-${u}`, school_id: "esc", nature_scheme_id: "n", nature_value_id: "v", nature_version: 1, valid_from: "2026-01-01", valid_until: null, annulled: false, created_at: "2026-01-01T00:00:00Z" };
  const al = (id: string, class_id: string, participation_logical_id: string | null) => ({ id, logical_id: id, participation_logical_id, enrollment_id: `e-${u}`, student_id: `est-${u}`, school_id: "esc", class_id, valid_from: "2026-01-01", ended_on: null, ending_reason: null, created_at: "2026-01-01T00:00:00Z" });
  const eng = (cls: string) => ({ id: `eng-${u}-${cls}`, person_id: `p${u}`, class_id: cls, component_id: null, period_id: null, valid_from: "2026-01-01", valid_until: null, created_at: "2026-01-01T00:00:00Z" });
  return {
    tables: {
      institutional_students: [{ id: `est-${u}`, display_name: `Estudante ${u}`, institutional_identifier: null }],
      institutional_schools: [{ id: "esc" }],
      user_person_links: [{ user_id: `u${u}`, person_id: `p${u}` }],
      institutional_persons: [{ id: `p${u}`, display_name: `Pessoa ${u}` }],
      institutional_engagements: [eng("t1"), eng("t2")],
      institutional_classes: [],
      institutional_curricular_components: [],
      lesson_record_versions: [],
    },
    rpc: {
      effective_capabilities: { data: [{ capability_id: `cap-${u}` }], error: null },
      cycle_enrollments_at: { data: [enr], error: null },
      cycle_participations_at: { data: [part], error: null },
      class_allocations_at: { data: [al(`a-${u}`, "t1", `p-${u}`), al(`leg-${u}`, legacyClass, null)], error: null },
    },
  };
}
const entry = (u: "A" | "B", classId: string): LessonEntry => ({
  id: `aula-${u}-${classId}`, origin: "local", status: "Rascunho local", date: "2026-03-02", classId, className: classId, unitId: "esc", unitName: "esc",
  assignmentId: `eng-${u}-${classId}`, field: "", role: "", professionalId: `p${u}`, professionalName: "", quantity: 1, blockIds: ["b1"],
  contentMode: "shared", contents: {}, summary: "", planningRelation: "sem-planejamento" as LessonEntry["planningRelation"], optional: {},
});
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DiarySessionBoundary><p>ok</p></DiarySessionBoundary></QueryClientProvider>);

beforeEach(() => {
  m.queries = []; m.rpcCalls = []; m.gate = null; m.rpcGate = null; m.gateFn = null;
  m.getSession = () => new Promise(() => undefined);
});

describe("B4.10.0f.1 — diagnóstico de cadeia por contexto e attendanceBlocker real", () => {
  it("A tardio (legado em t1) não bloqueia B; diagnóstico aceito de B bloqueia só a turma dele", async () => {
    const view = mount();
    const holdA = deferred();
    m.dataset = dataset("A", "t1");
    m.gateFn = { fn: "effective_capabilities", gate: holdA.promise }; // A lê toda a cadeia e espera só nas capacidades
    await emit("SIGNED_IN", "uA");
    expect(diarySessionState().phase).toBe("carregando");
    m.gateFn = null;
    m.dataset = dataset("B", "t2");
    await emit("SIGNED_IN", "uB");
    expect(diarySessionState()).toMatchObject({ phase: "pronto", userId: "uB" });
    holdA.resolve();
    await flush();
    expect(rosterChainDiagnostics().map((d) => [d.studentId, d.classId, d.code])).toEqual([["est-B", "t2", "allocation:legacy-without-participation"]]);
    // Turma não afetada: atuação e entrada próprias aceitas, sem impedimento temporal de fixture.
    expect(attendanceBlocker(entry("B", "t1"), "pB", [], [])).toBeNull();
    expect(attendanceBlocker(entry("B", "t2"), "pB", [], [])?.kind).toBe("roster-chain");
    view.unmount();
  });

  it("diagnóstico aceito de A bloqueia t1 de A; após troca para B, t1 volta a operar", async () => {
    const view = mount();
    m.dataset = dataset("A", "t1");
    await emit("SIGNED_IN", "uA");
    expect(attendanceBlocker(entry("A", "t1"), "pA", [], [])?.kind).toBe("roster-chain");
    expect(attendanceBlocker(entry("A", "t2"), "pA", [], [])).toBeNull();
    m.dataset = dataset("B", "t2");
    await emit("SIGNED_IN", "uB");
    expect(attendanceBlocker(entry("B", "t1"), "pB", [], [])).toBeNull();
    view.unmount();
  });
});
