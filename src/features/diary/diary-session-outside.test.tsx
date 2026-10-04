/**
 * B4.10.0c.1 — consumidores do Diário fora de /diario.
 * Inventário (rotas não-/diario que alcançam roster/teaching/modo/stores do Diário): só
 * /laboratorio/recuperacao os usa em execução (instala dados fictícios e entra no Diário). As demais
 * (/regras-avaliativas*, /regras-de-situacao*, /ciece, /mapa-estatistico) importam apenas a constante
 * DIARY_REFERENCE_DATE ou funções puras e não leem modo/stores.
 * Reais: useSessionUser, controlador compartilhado, rota real do laboratório, roteador em memória.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
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

import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, useNavigate } from "@tanstack/react-router";
import { DiarySessionBoundary, DiaryLaboratoryGate } from "./diary-session";
import { diarySessionState } from "./diary-session-state";
import { diaryPersistenceMode, setDiaryPersistenceMode } from "./diary-persistence-mode";
import { rosterStudents } from "@/features/students/institutional-roster";
import { demonstrationStudents } from "@/features/students/students-data";
import { emptyLessonInput, localLessonStore } from "./lesson-records";
import { Route as LabRoute } from "@/routes/laboratorio.recuperacao";

const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); });
const emit = async (event: string, id: string | null) => {
  await act(async () => { for (const l of [...m.listeners]) l(event, id ? { user: { id } } : null); });
  await flush();
};
function accountDataset(u: "A" | "B"): Dataset {
  return {
    tables: {
      institutional_students: [{ id: `est-${u}`, display_name: `Estudante ${u}`, institutional_identifier: null }],
      institutional_schools: [],
      user_person_links: [{ user_id: `u${u}`, person_id: `p${u}` }],
      institutional_persons: [{ id: `p${u}`, display_name: `Pessoa ${u}` }],
      institutional_engagements: [],
      institutional_classes: [],
      institutional_curricular_components: [],
      lesson_record_versions: [],
    },
    rpc: { effective_capabilities: { data: [{ capability_id: `cap-${u}` }], error: null } },
  };
}
const confirmedSignedOut = () => { m.getSession = () => Promise.resolve({ data: { session: null }, error: null }); };
const signedInAs = (id: string) => { m.getSession = () => Promise.resolve({ data: { session: { user: { id } } }, error: null }); };
const pendingBootstrap = () => { m.getSession = () => new Promise(() => undefined); };
const studentReads = () => m.queries.filter((q) => q.table === "institutional_students").length;

let go: (to: string) => Promise<void> = async () => undefined;
function Nav() {
  const navigate = useNavigate();
  go = (to) => navigate({ to } as never);
  return null;
}
function DiaryProbe() {
  return <p data-testid="diario">modo:{diaryPersistenceMode()} estudantes:{rosterStudents().length}</p>;
}
function mountApp(path: string) {
  const root = createRootRoute({ component: () => (<><Nav /><Outlet /></>) });
  const diario = createRoute({ getParentRoute: () => root, path: "/diario", component: () => <DiarySessionBoundary><Outlet /></DiarySessionBoundary> });
  const diarioIndex = createRoute({ getParentRoute: () => diario, path: "/", component: DiaryProbe });
  const consolidacao = createRoute({ getParentRoute: () => diario, path: "/turmas/$turmaId/avaliacao/consolidacao", component: DiaryProbe });
  const lab = createRoute({ getParentRoute: () => root, path: "/laboratorio/recuperacao", component: LabRoute.options.component! });
  const outside = createRoute({ getParentRoute: () => root, path: "/regras-avaliativas", component: () => <p>fora do Diário</p> });
  const router = createRouter({
    routeTree: root.addChildren([diario.addChildren([diarioIndex, consolidacao]), lab, outside]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><RouterProvider router={router as never} /></QueryClientProvider>);
}
const nav = async (to: string) => { await act(async () => { await go(to); }); await flush(); };

beforeEach(() => {
  m.queries = [];
  m.rpcCalls = [];
  m.gate = null;
  m.rpcGate = null;
  m.dataset = accountDataset("A");
  pendingBootstrap();
  // Estado de partida do app (fora de unit tests): pendente, sem fronteira montada.
  setDiaryPersistenceMode("pendente");
});
afterEach(() => {
  localLessonStore.list().filter((r) => r.status === "Rascunho local").forEach((r) => localLessonStore.discard(r.id));
});

describe("B4.10.0c.1 — modo inicial", () => {
  it("módulo recém-carregado começa pendente (nunca laboratório antes da fronteira)", async () => {
    vi.resetModules();
    const fresh = await import("./diary-persistence-mode");
    expect(fresh.diaryPersistenceMode()).toBe("pendente");
    expect(fresh.isDiaryCloud()).toBe(true);
    expect(fresh.isDiaryMirrorReady()).toBe(false);
  });
});

describe("B4.10.0c.1 — entrada direta em /laboratorio/recuperacao", () => {
  it("bootstrap incerto: sem botão, sem fixtures, sem consulta", async () => {
    const view = mountApp("/laboratorio/recuperacao");
    await flush();
    expect(await screen.findByText("Laboratório da Recuperação Final")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ativar jornada de laboratório" })).toBeNull();
    expect(screen.getByText("Conferindo a sessão…")).toBeTruthy();
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(rosterStudents()).toEqual([]);
    expect(m.queries).toEqual([]);
    view.unmount();
  });

  it("erro de bootstrap: nunca laboratório", async () => {
    m.getSession = () => Promise.resolve({ data: { session: null }, error: { message: "rede" } });
    const view = mountApp("/laboratorio/recuperacao");
    await flush();
    expect(await screen.findByText(/Não foi possível confirmar a sua sessão/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ativar jornada de laboratório" })).toBeNull();
    expect(diaryPersistenceMode()).not.toBe("laboratorio");
    expect(m.queries).toEqual([]);
    view.unmount();
  });

  it("conta institucional: recusa por extenso e NENHUMA hidratação nesta rota", async () => {
    signedInAs("uA");
    const view = mountApp("/laboratorio/recuperacao");
    await flush();
    expect(await screen.findByText(/só abre sem sessão institucional/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ativar jornada de laboratório" })).toBeNull();
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(rosterStudents()).toEqual([]);
    expect(m.queries).toEqual([]);
    view.unmount();
  });

  it("sessão confirmadamente ausente: botão, laboratório e entrada no Diário com a mesma partição", async () => {
    confirmedSignedOut();
    const view = mountApp("/laboratorio/recuperacao");
    const button = await screen.findByRole("button", { name: "Ativar jornada de laboratório" });
    expect(diaryPersistenceMode()).toBe("laboratorio");
    expect(diarySessionState().phase).toBe("laboratorio");
    await act(async () => { fireEvent.click(button); });
    await flush();
    expect((await screen.findByTestId("diario")).textContent).toBe(`modo:laboratorio estudantes:${demonstrationStudents.length}`);
    expect(m.queries).toEqual([]);
    view.unmount();
  });
});

describe("B4.10.0c.1 — entrar e sair do Diário", () => {
  it("laboratório: sair deixa pendente; voltar reabre laboratório com rascunho preservado", async () => {
    confirmedSignedOut();
    const view = mountApp("/diario");
    await screen.findByTestId("diario");
    const draft = localLessonStore.upsert(emptyLessonInput("pro-lab", "2026-03-02"), "Rascunho local");
    await nav("/regras-avaliativas");
    expect(screen.getByText("fora do Diário")).toBeTruthy();
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(rosterStudents()).toEqual([]);
    expect(localLessonStore.get(draft.id)).toBeUndefined();
    await nav("/diario");
    expect(screen.getByTestId("diario").textContent).toContain("modo:laboratorio");
    expect(localLessonStore.get(draft.id)?.professionalId).toBe("pro-lab");
    view.unmount();
  });

  it("conta: fora do Diário nada fica hidratado; voltar relê só o contexto corrente; rascunho da conta volta", async () => {
    signedInAs("uA");
    const view = mountApp("/diario");
    await flush();
    await screen.findByTestId("diario"); await flush(); console.log("STATE", JSON.stringify(diarySessionState()));
    expect(screen.getByTestId("diario").textContent).toBe("modo:cloud estudantes:1");
    const draft = localLessonStore.upsert(emptyLessonInput("pA", "2026-03-02"), "Rascunho local");
    const reads = studentReads();
    await nav("/regras-avaliativas");
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(rosterStudents()).toEqual([]);
    expect(localLessonStore.get(draft.id)).toBeUndefined();
    expect(studentReads()).toBe(reads);
    await nav("/diario");
    expect(screen.getByTestId("diario").textContent).toBe("modo:cloud estudantes:1");
    expect(studentReads()).toBe(reads + 1);
    expect(localLessonStore.get(draft.id)?.professionalId).toBe("pA");
    view.unmount();
  });

  it("mesma conta em nova revisão de sessão: contexto novo, releitura, rascunho da conta preservado", async () => {
    signedInAs("uA");
    const view = mountApp("/diario");
    await flush();
    await screen.findByTestId("diario");
    const key1 = diarySessionState().key;
    const draft = localLessonStore.upsert(emptyLessonInput("pA", "2026-03-02"), "Rascunho local");
    await emit("SIGNED_OUT", null);
    expect(screen.getByTestId("diario").textContent).toContain("modo:laboratorio");
    expect(localLessonStore.get(draft.id)).toBeUndefined();
    const reads = studentReads();
    await emit("SIGNED_IN", "uA");
    const key2 = diarySessionState().key;
    expect(key2).not.toBe(key1);
    expect(key2?.startsWith("uA#")).toBe(true);
    expect(studentReads()).toBe(reads + 1);
    expect(screen.getByTestId("diario").textContent).toBe("modo:cloud estudantes:1");
    expect(localLessonStore.get(draft.id)?.professionalId).toBe("pA");
    view.unmount();
  });
});

describe("B4.10.0c.1 — duas fronteiras simultâneas", () => {
  it("porta do laboratório + fronteira do Diário compartilham um controlador; desmontar uma não derruba a outra", async () => {
    confirmedSignedOut();
    const client = new QueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <DiaryLaboratoryGate><p>porta</p></DiaryLaboratoryGate>
        <DiarySessionBoundary><p>diário</p></DiarySessionBoundary>
      </QueryClientProvider>,
    );
    await flush();
    expect(screen.getByText("porta")).toBeTruthy();
    expect(screen.getByText("diário")).toBeTruthy();
    expect(diarySessionState().phase).toBe("laboratorio");
    view.rerender(
      <QueryClientProvider client={client}>
        <DiarySessionBoundary><p>diário</p></DiarySessionBoundary>
      </QueryClientProvider>,
    );
    await flush();
    expect(diaryPersistenceMode()).toBe("laboratorio");
    view.unmount();
    expect(diaryPersistenceMode()).toBe("pendente");
    expect(diarySessionState().phase).toBe("sem-fronteira");
  });

  it("conta: a porta do laboratório não monta controlador nem atrapalha o Diário aberto ao lado", async () => {
    signedInAs("uA");
    const client = new QueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <DiaryLaboratoryGate><p>porta</p></DiaryLaboratoryGate>
        <DiarySessionBoundary><DiaryProbe /></DiarySessionBoundary>
      </QueryClientProvider>,
    );
    await flush();
    expect(screen.queryByText("porta")).toBeNull();
    expect(screen.getByTestId("diario").textContent).toBe("modo:cloud estudantes:1");
    expect(studentReads()).toBe(1);
    view.unmount();
  });
});
