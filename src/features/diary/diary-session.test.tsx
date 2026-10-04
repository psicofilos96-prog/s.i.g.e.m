/**
 * B4.10.0c — isolamento dos carregamentos do Diário por sessão.
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
import { diaryPersistenceMode } from "./diary-persistence-mode";
import { rosterStudents } from "@/features/students/institutional-roster";
import { demonstrationStudents } from "@/features/students/students-data";
import { teachingAssignments, teachingPersonId } from "./institutional-teaching";
import { isOfficialLesson, recordAttendanceInCloud } from "./diary-cloud";
import { emptyLessonInput, localLessonStore } from "./lesson-records";
import { lessonCorrectionCloud } from "./lesson-correction-config";
import { UNREGISTERED_PEDAGOGICAL_ROLE } from "@/features/pedagogical/pedagogical-data";

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

/** Base de cada conta: estudante, vínculo, atuação e aula oficial próprios. */
function accountDataset(u: "A" | "B", over: Partial<Dataset> = {}): Dataset {
  return {
    tables: {
      institutional_students: [{ id: `est-${u}`, display_name: `Estudante ${u}`, institutional_identifier: null }],
      institutional_schools: [],
      user_person_links: [{ user_id: `u${u}`, person_id: `p${u}` }],
      institutional_persons: [{ id: `p${u}`, display_name: `Pessoa ${u}` }],
      institutional_engagements: [
        { id: `eng-${u}`, person_id: `p${u}`, class_id: "t1", component_id: null, period_id: null, valid_from: "2026-01-01", valid_until: null, created_at: "2026-01-01T00:00:00Z" },
      ],
      institutional_classes: [],
      institutional_curricular_components: [],
      lesson_record_versions: [
        { id: `lv-${u}`, logical_record_id: `aula-${u}`, version_number: 1, supersedes_version_id: null, facts: { ...emptyLessonInput(`p${u}`, "2026-03-02") }, rectification: null, author_person_id: `p${u}`, concluded_at: "2026-03-02T10:00:00Z" },
      ],
    },
    rpc: { effective_capabilities: { data: [{ capability_id: `cap-${u}` }], error: null } },
    ...over,
  };
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
function mount(children: ReactNode = <p>conteúdo do Diário</p>) {
  return render(<QueryClientProvider client={client()}><DiarySessionBoundary>{children}</DiarySessionBoundary></QueryClientProvider>);
}
const confirmedSignedOut = () => { m.getSession = () => Promise.resolve({ data: { session: null }, error: null }); };
const pendingBootstrap = () => { m.getSession = () => new Promise(() => undefined); };

beforeEach(() => {
  m.queries = [];
  m.rpcCalls = [];
  m.gate = null;
  m.rpcGate = null;
  m.dataset = accountDataset("A");
  pendingBootstrap();
});
afterEach(() => {
  // Volta ao laboratório e descarta rascunhos de teste do laboratório.
  localLessonStore.list().filter((r) => r.status === "Rascunho local").forEach((r) => localLessonStore.discard(r.id));
});

describe("B4.10.0c — bootstrap incerto", () => {
  it("sessão em bootstrap: nada renderiza, sem fixtures e sem consulta", async () => {
    const view = mount();
    await flush();
    expect(screen.queryByText("conteúdo do Diário")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Conferindo a sessão");
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(rosterStudents()).toEqual([]);
    expect(m.queries).toEqual([]);
    view.unmount();
  });

  it("erro do bootstrap: nunca laboratório; mensagem de sessão não confirmada", async () => {
    m.getSession = () => Promise.resolve({ data: { session: null }, error: { message: "rede" } });
    const view = mount();
    await flush();
    expect(screen.queryByText("conteúdo do Diário")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Não foi possível confirmar a sua sessão");
    expect(rosterStudents()).toEqual([]);
    expect(diaryPersistenceMode()).not.toBe("laboratorio");
    view.unmount();
  });

  it("sessão confirmadamente ausente: único caminho até o laboratório", async () => {
    confirmedSignedOut();
    const view = mount();
    await flush();
    expect(screen.getByText("conteúdo do Diário")).toBeTruthy();
    expect(diaryPersistenceMode()).toBe("laboratorio");
    expect(rosterStudents()).toBe(demonstrationStudents);
    expect(m.queries).toEqual([]);
    view.unmount();
  });
});

describe("B4.10.0c — contexto aceito", () => {
  it("A tardio depois de B aceito não hidrata estudantes, atuações, bases nem capacidades", async () => {
    const view = mount();
    const holdA = deferred();
    m.gate = holdA.promise;
    await emit("SIGNED_IN", "uA");
    expect(diarySessionState().phase).toBe("carregando");
    expect(rosterStudents()).toEqual([]);
    m.gate = null;
    m.dataset = accountDataset("B");
    await emit("SIGNED_IN", "uB");
    expect(diarySessionState()).toMatchObject({ phase: "pronto", userId: "uB" });
    holdA.resolve();
    await flush();
    expect(rosterStudents().map((s) => s.id)).toEqual(["est-B"]);
    expect(teachingAssignments().map((a) => a.id)).toEqual(["eng-B"]);
    expect(isOfficialLesson("aula-B")).toBe(true);
    expect(isOfficialLesson("aula-A")).toBe(false);
    expect(lessonCorrectionCloud()?.agent.capabilities).toEqual(["cap-B"]);
    expect(localLessonStore.list().map((r) => r.id)).toEqual(["aula-B"]);
    view.unmount();
  });

  it("logout com A pendente: laboratório confirmado; resposta de A descartada", async () => {
    const view = mount();
    const holdA = deferred();
    m.gate = holdA.promise;
    await emit("SIGNED_IN", "uA");
    await emit("SIGNED_OUT", null);
    expect(diaryPersistenceMode()).toBe("laboratorio");
    holdA.resolve();
    await flush();
    expect(diaryPersistenceMode()).toBe("laboratorio");
    expect(rosterStudents()).toBe(demonstrationStudents);
    expect(localLessonStore.list().some((r) => r.id === "aula-A")).toBe(false);
    expect(lessonCorrectionCloud()).toBeNull();
    view.unmount();
  });

  it("desmontagem com A pendente: nada é hidratado depois", async () => {
    const view = mount();
    const holdA = deferred();
    m.gate = holdA.promise;
    await emit("SIGNED_IN", "uA");
    view.unmount();
    holdA.resolve();
    await flush();
    expect(diarySessionState().phase).toBe("sem-fronteira");
    expect(rosterStudents()).toEqual([]);
    expect(isOfficialLesson("aula-A")).toBe(false);
    expect(lessonCorrectionCloud()).toBeNull();
  });

  it("erro nas capacidades: lote recusado inteiro, sem hidratação parcial", async () => {
    m.dataset = accountDataset("A", { rpc: { effective_capabilities: { data: null, error: { message: "caps indisponíveis" } } } });
    const view = mount();
    await emit("SIGNED_IN", "uA");
    expect(diarySessionState()).toMatchObject({ phase: "erro", userId: "uA" });
    expect(diarySessionState().error).toContain("caps indisponíveis");
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(rosterStudents()).toEqual([]);
    expect(teachingAssignments()).toEqual([]);
    expect(localLessonStore.list().some((r) => r.id === "aula-A")).toBe(false);
    expect(lessonCorrectionCloud()).toBeNull();
    const before = m.rpcCalls.length;
    expect(await recordAttendanceInCloud("aula-A", {})).toMatchObject({ ok: false });
    expect(m.rpcCalls.length).toBe(before);
    view.unmount();
  });

  it("mesma conta, nova sessão: contexto novo, nada do anterior visível enquanto carrega", async () => {
    const view = mount();
    await emit("SIGNED_IN", "uA");
    const firstKey = diarySessionState().key;
    expect(isOfficialLesson("aula-A")).toBe(true);
    await emit("SIGNED_OUT", null);
    const hold = deferred();
    m.gate = hold.promise;
    await emit("SIGNED_IN", "uA");
    expect(diarySessionState().key).not.toBe(firstKey);
    expect(diarySessionState().phase).toBe("carregando");
    expect(rosterStudents()).toEqual([]);
    expect(isOfficialLesson("aula-A")).toBe(false);
    expect(lessonCorrectionCloud()).toBeNull();
    hold.resolve();
    await flush();
    expect(diarySessionState().phase).toBe("pronto");
    view.unmount();
  });

  it("duas montagens simultâneas compartilham um carregamento", async () => {
    const a = mount();
    const b = mount();
    await emit("SIGNED_IN", "uA");
    expect(m.queries.filter((q) => q.table === "institutional_students")).toHaveLength(1);
    a.unmount();
    expect(diarySessionState().phase).toBe("pronto");
    b.unmount();
    expect(diarySessionState().phase).toBe("sem-fronteira");
  });
});

describe("B4.10.0c — vínculo e atuações próprios", () => {
  it("administrador lê vínculos e atuações alheias: só os da própria pessoa, sem papel inventado", async () => {
    const ds = accountDataset("A");
    ds.tables["user_person_links"]!.push({ user_id: "uX", person_id: "pX" });
    ds.tables["institutional_engagements"]!.push({ id: "eng-X", person_id: "pX", class_id: "t9", component_id: null, period_id: null, valid_from: "2026-01-01", valid_until: null, created_at: "2026-01-01T00:00:00Z" });
    m.dataset = ds;
    const view = mount();
    await emit("SIGNED_IN", "uA");
    expect(m.queries.find((q) => q.table === "user_person_links")?.filters).toEqual([["user_id", "uA"]]);
    expect(m.queries.find((q) => q.table === "institutional_engagements")?.filters).toEqual([["person_id", "pA"]]);
    expect(teachingAssignments().map((a) => a.id)).toEqual(["eng-A"]);
    expect(teachingAssignments()[0]!.role).toBe(UNREGISTERED_PEDAGOGICAL_ROLE);
    expect(teachingPersonId("qualquer")).toBe("pA");
    view.unmount();
  });

  it("vínculo próprio ambíguo: erro, nunca escolha", async () => {
    const ds = accountDataset("A");
    ds.tables["user_person_links"]!.push({ user_id: "uA", person_id: "pZ" });
    m.dataset = ds;
    const view = mount();
    await emit("SIGNED_IN", "uA");
    expect(diarySessionState()).toMatchObject({ phase: "erro" });
    expect(diarySessionState().error).toContain("ambíguo");
    expect(teachingAssignments()).toEqual([]);
    view.unmount();
  });
});

describe("B4.10.0c — escrita e releitura pós-RPC", () => {
  it("RPC iniciado em A, sessão troca para B: B não é rehidratado com A; sem contexto pronto, nenhuma RPC", async () => {
    const view = mount();
    await emit("SIGNED_IN", "uA");
    const rpcHold = deferred();
    m.rpcGate = rpcHold.promise;
    const pending = recordAttendanceInCloud("aula-A", {});
    m.dataset = accountDataset("B");
    const holdB = deferred();
    m.gate = holdB.promise;
    await emit("SIGNED_IN", "uB");
    // B carregando: escrita recusada sem RPC.
    const calls = m.rpcCalls.filter((c) => c.fn.startsWith("record_")).length;
    expect(await recordAttendanceInCloud("aula-B", {})).toMatchObject({ ok: false });
    expect(m.rpcCalls.filter((c) => c.fn.startsWith("record_")).length).toBe(calls);
    m.gate = null;
    holdB.resolve();
    await flush();
    const lessonReads = m.queries.filter((q) => q.table === "lesson_record_versions").length;
    m.dataset = accountDataset("A"); // se a releitura de A acontecesse, traria A
    rpcHold.resolve();
    const result = await pending;
    await flush();
    expect(result.ok).toBe(true); // RPC aceito não é desfeito
    expect(m.queries.filter((q) => q.table === "lesson_record_versions").length).toBe(lessonReads);
    expect(isOfficialLesson("aula-B")).toBe(true);
    expect(isOfficialLesson("aula-A")).toBe(false);
    view.unmount();
  });
});

describe("B4.10.0c — rascunhos isolados e preservados (memória da aba)", () => {
  it("laboratório, conta A e conta B não veem rascunhos uns dos outros; cada um volta ao seu dono", async () => {
    confirmedSignedOut();
    const view = mount();
    await flush();
    const lab = localLessonStore.upsert(emptyLessonInput("pro-lab", "2026-03-02"), "Rascunho local");
    await emit("SIGNED_IN", "uA");
    expect(localLessonStore.get(lab.id)).toBeUndefined();
    const draftA = localLessonStore.upsert(emptyLessonInput("pA", "2026-03-02"), "Rascunho local");
    m.dataset = accountDataset("B");
    await emit("SIGNED_IN", "uB");
    expect(localLessonStore.get(draftA.id)).toBeUndefined();
    expect(localLessonStore.get(lab.id)).toBeUndefined();
    await emit("SIGNED_OUT", null);
    expect(localLessonStore.get(lab.id)?.professionalId).toBe("pro-lab");
    expect(localLessonStore.get(draftA.id)).toBeUndefined();
    m.dataset = accountDataset("A");
    await emit("SIGNED_IN", "uA");
    expect(localLessonStore.get(draftA.id)?.professionalId).toBe("pA");
    expect(localLessonStore.get(lab.id)).toBeUndefined();
    localLessonStore.discard(draftA.id);
    await emit("SIGNED_OUT", null);
    view.unmount();
  });
});
