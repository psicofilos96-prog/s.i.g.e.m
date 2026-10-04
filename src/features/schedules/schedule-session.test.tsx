/**
 * B4.10.0e — contexto de sessão e referência de consulta dos horários institucionais.
 * Reais: useSessionUser, HorariosLayout (roteador em memória), páginas, QueryClient, fontes B4.4/B4.5.
 * Só o cliente do backend é simulado (argumentos de RPC registrados).
 */
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: string, session: { user: { id: string } } | null) => void;
type Res = { data: unknown; error: { message: string } | null };
const m = vi.hoisted(() => ({
  listeners: new Set<Listener>(),
  getSession: (() => Promise.resolve({ data: { session: null }, error: null })) as () => Promise<unknown>,
  who: "A",
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  tables: [] as string[],
  gates: {} as Record<string, Promise<void>>,
  errors: {} as Record<string, string>,
}));

const block = (a: Record<string, unknown>, who: string, weekday = 1) => ({
  result_kind: "block", class_id: a["_class_id"], valid_on: a["_on"], known_at: a["_known_at"], schedule_state: "utilizavel", schedule_id: "g",
  version_id: "v1", version: 1, change_kind: "constituicao", valid_from: "2020-01-01", effective_until: null, originating_act_ref: "ato",
  change_reason: null, recorded_at: "2020-01-01T00:00:00Z", block_id: `blk-${who}`, block_key: "b1", weekday, starts_at: who === "A" ? "07:00:00" : "13:00:00",
  ends_at: who === "A" ? "08:00:00" : "14:00:00", block_minutes: 60, component_id: null, component_version: null, component_name: null,
  nature_scheme_id: null, nature_value_id: null, nature_value_version: null, nature_label: null, engagement_ids: [`eng-${who}`],
  block_state: "utilizavel", block_issues: [], overlapping_block_keys: [], coverage_state: "nao-comprovada", coverage_matrix_ids: [],
  day_minutes: 60, week_minutes: 60,
});

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const who = m.who;
    m.tables.push(table);
    const run = async (): Promise<Res> => {
      const g = m.gates[`from:${who}`]; if (g) await g;
      if (m.errors[table]) return { data: null, error: { message: m.errors[table]! } };
      if (table === "institutional_classes") return { data: [{ id: `turma-${who}` }], error: null };
      if (table === "institutional_engagements") return { data: [{ id: `eng-${who}`, person_id: `p-${who}`, created_at: "2020-01-01T00:00:00Z" }], error: null };
      if (table === "institutional_persons") return { data: [{ id: `p-${who}`, display_name: `Pessoa ${who}` }], error: null };
      return { data: [], error: null };
    };
    const b: Record<string, unknown> = {};
    for (const k of ["select", "in", "eq", "lte", "order"]) b[k] = () => b;
    b["then"] = (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => run().then(ok, ko);
    return b;
  };
  return {
    supabase: {
      auth: {
        onAuthStateChange: (cb: Listener) => { m.listeners.add(cb); return { data: { subscription: { unsubscribe: () => m.listeners.delete(cb) } } }; },
        getSession: () => m.getSession(),
      },
      from,
      rpc: async (fn: string, args: Record<string, unknown>) => {
        const who = m.who;
        m.rpcCalls.push({ fn, args });
        const g = m.gates[`rpc:${who}`]; if (g) await g;
        if (m.errors[fn]) return { data: null, error: { message: m.errors[fn]! } };
        if (fn === "class_at") return { data: [{ name: `Turma de ${who}` }], error: null };
        if (fn === "class_journey_at") return { data: [{ result_kind: "absent" }], error: null };
        if (fn === "class_schedule_at") return { data: [block(args, who, who === "A" ? 7 : 1)], error: null };
        if (fn === "current_person_id") return { data: `p-${who}`, error: null };
        return { data: [], error: null };
      },
    },
  };
});

import { HorariosLayout } from "@/routes/horarios";
import { operationalToday } from "@/features/academic/academic-reference-date";

const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); });
const emit = async (event: string, id: string | null) => { await act(async () => { for (const l of [...m.listeners]) l(event, id ? { user: { id } } : null); }); await flush(); };
function deferred() { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; }

function mount(path: string, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const horarios = createRoute({ getParentRoute: () => root, path: "/horarios", component: HorariosLayout });
  const lab = createRoute({ getParentRoute: () => horarios, path: "/", component: () => <p>laboratório de horários</p> });
  const prof = createRoute({ getParentRoute: () => horarios, path: "/profissionais", component: () => <p>laboratório profissionais</p> });
  const router = createRouter({ routeTree: root.addChildren([horarios.addChildren([lab, prof])]), history: createMemoryHistory({ initialEntries: [path] }) });
  const r = render(<QueryClientProvider client={client}><RouterProvider router={router as never} /></QueryClientProvider>);
  return { ...r, client, router };
}
const signedIn = (id: string) => { m.getSession = () => Promise.resolve({ data: { session: { user: { id } } }, error: null }); };

beforeEach(() => { m.who = "A"; m.rpcCalls = []; m.tables = []; m.gates = {}; m.errors = {}; });
afterEach(async () => { await emit("SIGNED_OUT", null); });

describe("B4.10.0e — sessão dos horários", () => {
  it("sessão carregando ou com erro nunca abre laboratório nem consulta", async () => {
    m.getSession = () => new Promise(() => undefined);
    const a = mount("/horarios"); await flush();
    expect(screen.getByText("Verificando sessão…")).toBeTruthy();
    expect(screen.queryByText(/laboratório/)).toBeNull();
    a.unmount();
    m.getSession = () => Promise.resolve({ data: { session: null }, error: { message: "falha" } });
    mount("/horarios"); await flush();
    expect(screen.getByRole("alert").textContent).toMatch(/Não foi possível confirmar a sessão/);
    expect(screen.queryByText(/laboratório/)).toBeNull();
    expect(m.rpcCalls).toEqual([]); expect(m.tables).toEqual([]);
  });

  it("sem sessão confirmada o laboratório continua (legado intacto)", async () => {
    m.getSession = () => Promise.resolve({ data: { session: null }, error: null });
    mount("/horarios"); await flush();
    expect(screen.getByText("laboratório de horários")).toBeTruthy();
    expect(m.rpcCalls).toEqual([]);
  });

  it("data da URL prevalece; UM knownAt até class_at, jornada, grade e nomes; domingo preservado", async () => {
    signedIn("user-A");
    mount("/horarios?data=2025-11-02"); await flush(); await flush();
    expect(await screen.findByText("Domingo")).toBeTruthy();
    expect(screen.getByText(/Pessoa A/)).toBeTruthy();
    const ats = m.rpcCalls.filter((c) => ["class_at", "class_journey_at", "class_schedule_at"].includes(c.fn));
    expect(new Set(ats.map((c) => c.fn))).toEqual(new Set(["class_at", "class_journey_at", "class_schedule_at"]));
    expect(new Set(ats.map((c) => c.args["_valid_on"] ?? c.args["_on"]))).toEqual(new Set(["2025-11-02"]));
    const known = new Set(ats.map((c) => c.args["_known_at"]));
    expect(known.size).toBe(1);
    expect(screen.getByText(new RegExp(`knownAt ${[...known][0]}`.replace(/[.+]/g, "\\$&")))).toBeTruthy(); // nomes no mesmo snapshot da grade
  });

  it("sem data na URL usa o hoje operacional; data inválida e campo limpo não consultam", async () => {
    signedIn("user-A");
    const a = mount("/horarios"); await flush(); await flush();
    expect(m.rpcCalls.find((c) => c.fn === "class_at")!.args["_valid_on"]).toBe(operationalToday());
    a.unmount(); m.rpcCalls = []; m.tables = [];
    mount("/horarios?data=2026-02-30"); await flush();
    expect(screen.getByRole("alert").textContent).toMatch(/inválida.*substituta/);
    expect(m.rpcCalls).toEqual([]); expect(m.tables).toEqual([]);
  });

  it("limpar o campo bloqueia e não mostra dados anteriores", async () => {
    signedIn("user-A");
    mount("/horarios?data=2026-03-02"); await flush(); await flush();
    expect(await screen.findByText(/07:00–08:00/)).toBeTruthy();
    const input = screen.getByLabelText("Data de referência") as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");
    m.rpcCalls = [];
    fireEvent.change(input, { target: { value: "" } }); await flush();
    expect(screen.getByRole("alert").textContent).toMatch(/Informe uma data/);
    expect(screen.queryByText(/07:00–08:00/)).toBeNull();
    expect(m.rpcCalls).toEqual([]);
  });

  it("A→B com resposta atrasada de A: nada de A aparece em B; cache de A é descartado", async () => {
    signedIn("user-A");
    const gateA = deferred(); m.gates["rpc:A"] = gateA.promise;
    const { client } = mount("/horarios?data=2026-03-02"); await flush();
    m.who = "B"; await emit("SIGNED_IN", "user-B");
    await flush(); await flush();
    expect(await screen.findByText(/13:00–14:00/)).toBeTruthy();
    gateA.resolve(); await flush(); await flush();
    expect(screen.queryByText(/Turma de A|Pessoa A|07:00/)).toBeNull();
    const owners = new Set(client.getQueryCache().getAll().map((q) => String(q.queryKey[1])));
    expect([...owners].every((o) => o.startsWith("user-B#"))).toBe(true);
  });

  it("logout → login da MESMA conta gera contexto novo, sem reaproveitar cache", async () => {
    signedIn("user-A");
    const { client } = mount("/horarios?data=2026-03-02"); await flush(); await flush();
    expect(await screen.findByText(/07:00–08:00/)).toBeTruthy();
    const first = String(client.getQueryCache().getAll()[0]!.queryKey[1]);
    await emit("SIGNED_OUT", null);
    expect(screen.getByText("laboratório de horários")).toBeTruthy();
    m.rpcCalls = [];
    await emit("SIGNED_IN", "user-A"); await flush();
    expect(await screen.findByText(/07:00–08:00/)).toBeTruthy();
    const owners = new Set(client.getQueryCache().getAll().map((q) => String(q.queryKey[1])));
    expect(owners.has(first)).toBe(false);
    expect(m.rpcCalls.some((c) => c.fn === "class_schedule_at")).toBe(true); // leu de novo
  });

  it("cache pré-preenchido de outro dono não é exibido", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["b44-classes", "user-X#1", "2026-03-02", "x"], [{ id: "turma-X", name: "Turma de X" }]);
    client.setQueryData(["b45-my", "user-X#1", "2026-03-02", "x"], { kind: "ausente", validOn: "2026-03-02", knownAt: "x" });
    signedIn("user-A");
    mount("/horarios?data=2026-03-02", client); await flush(); await flush();
    expect(screen.queryByText(/Turma de X/)).toBeNull();
    expect(client.getQueryCache().getAll().some((q) => q.queryKey[1] === "user-X#1")).toBe(false);
  });

  it("erro na lista de turmas é falha, não vazio; erro de nomes vira rótulo neutro sem derrubar a grade", async () => {
    signedIn("user-A");
    m.errors["class_at"] = "boom";
    const a = mount("/horarios?data=2026-03-02"); await flush(); await flush();
    expect(screen.getByRole("alert").textContent).toMatch(/Não foi possível listar as turmas/);
    expect(screen.queryByText(/Nenhuma turma consultável/)).toBeNull();
    expect(m.rpcCalls.some((c) => c.fn === "class_schedule_at")).toBe(false);
    a.unmount(); m.errors = { institutional_persons: "negado" };
    mount("/horarios?data=2026-03-02"); await flush(); await flush();
    expect(await screen.findByText(/07:00–08:00/)).toBeTruthy();
    expect(screen.getByTestId("resp-names-warning")).toBeTruthy();
    expect(screen.getByText("Responsável sem nome legível")).toBeTruthy();
  });

  it("Meu horário: contexto userId#revisão, data da URL e knownAt único", async () => {
    signedIn("user-A");
    const { client } = mount("/horarios/profissionais?data=2025-12-31"); await flush(); await flush();
    const call = m.rpcCalls.find((c) => c.fn === "person_schedule_at")!;
    expect(call.args["_on"]).toBe("2025-12-31");
    const key = client.getQueryCache().findAll({ queryKey: ["b45-my"] })[0]!.queryKey;
    expect(String(key[1])).toMatch(/^user-A#\d+$/);
    expect(key[3]).toBe(call.args["_known_at"]);
  });
});
