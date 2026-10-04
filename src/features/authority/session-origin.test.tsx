/**
 * B4.10.0b — origem da sessão: hooks reais (useSessionUser/useSessionAuthority) + QueryClient real.
 * Só o cliente do backend é simulado.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: string, session: { user: { id: string } } | null) => void;
const m = vi.hoisted(() => ({
  listeners: new Set<Listener>(),
  getSession: vi.fn(),
  linkEq: vi.fn(),
  links: vi.fn(),
  person: vi.fn(),
  caps: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        m.listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => m.listeners.delete(cb) } } };
      },
      getSession: () => m.getSession(),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => {
          if (table === "user_person_links") {
            m.linkEq(col, val);
            return { limit: () => m.links(val) };
          }
          return { maybeSingle: () => m.person(val) };
        },
      }),
    }),
    rpc: () => m.caps(),
  },
}));
import { useSessionAuthority, useSessionUser, type SessionAuthority } from "./session-authority";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
const session = (id: string) => ({ data: { session: { user: { id } } }, error: null });
const emit = (event: string, id: string | null) =>
  act(() => { for (const l of [...m.listeners]) l(event, id ? { user: { id } } : null); });
const cap = (id: string) => ({ capability_id: id, engagement_id: "e", policy_id: "p", policy_version: 1, class_id: null, period_id: null, school_id: null, component_id: null });

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  m.getSession.mockReset();
  m.linkEq.mockReset();
  m.links.mockReset().mockImplementation(async (uid: string) => ({ data: [{ person_id: `per-${uid}` }], error: null }));
  m.person.mockReset().mockImplementation(async (pid: string) => ({ data: { id: pid, display_name: `Pessoa ${pid}` }, error: null }));
  m.caps.mockReset().mockResolvedValue({ data: [cap("c1")], error: null });
});

describe("B4.10.0b — useSessionUser", () => {
  it("getSession A adiado, evento B: resposta A descartada", async () => {
    const a = deferred<ReturnType<typeof session>>();
    m.getSession.mockReturnValue(a.promise);
    const { result, unmount } = renderHook(() => useSessionUser());
    expect(result.current.loading).toBe(true);
    await emit("SIGNED_IN", "u-b");
    expect(result.current.user?.id).toBe("u-b");
    await act(async () => { a.resolve(session("u-a")); });
    expect(result.current.user?.id).toBe("u-b");
    unmount();
  });

  it("signed-out posterior prevalece sobre bootstrap atrasado com sessão", async () => {
    const a = deferred<ReturnType<typeof session>>();
    m.getSession.mockReturnValue(a.promise);
    const { result, unmount } = renderHook(() => useSessionUser());
    await emit("SIGNED_OUT", null);
    expect(result.current).toMatchObject({ loading: false, user: null });
    await act(async () => { a.resolve(session("u-a")); });
    expect(result.current.user).toBeNull();
    unmount();
  });

  it("bootstrap com erro ou rejeição: incerto (loading+error), nunca signed-out", async () => {
    m.getSession.mockResolvedValue({ data: { session: null }, error: { message: "rede" } });
    const r1 = renderHook(() => useSessionUser());
    await waitFor(() => expect(r1.result.current.error).toBe("rede"));
    expect(r1.result.current.loading).toBe(true);
    r1.unmount();
    m.getSession.mockRejectedValue(new Error("caiu"));
    const r2 = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await waitFor(() => expect(r2.result.current).toEqual({ status: "loading", error: "caiu" }));
    r2.unmount();
  });

  it("unmount: resposta tardia e eventos após cleanup não fazem efeito nem lançam", async () => {
    const a = deferred<ReturnType<typeof session>>();
    m.getSession.mockReturnValue(a.promise);
    const { result, unmount } = renderHook(() => useSessionUser());
    unmount();
    expect(m.listeners.size).toBe(0);
    await act(async () => { a.resolve(session("u-a")); });
    expect(result.current.loading).toBe(true);
    // Nova montagem recomeça incerta, sem herdar a resposta descartada.
    m.getSession.mockReturnValue(new Promise(() => {}));
    const again = renderHook(() => useSessionUser());
    expect(again.result.current.loading).toBe(true);
    again.unmount();
  });
});

describe("B4.10.0b.1 — INITIAL_SESSION do SDK é bootstrap, não confirmação", () => {
  it("INITIAL_SESSION null + getSession com erro: loading+erro, nunca signed-out", async () => {
    const g = deferred<unknown>();
    m.getSession.mockReturnValue(g.promise);
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await emit("INITIAL_SESSION", null);
    expect(result.current).toEqual({ status: "loading" });
    await act(async () => { g.resolve({ data: { session: null }, error: { message: "armazenamento" } }); });
    expect(result.current).toEqual({ status: "loading", error: "armazenamento" });
    unmount();
  });

  it("INITIAL_SESSION null + getSession rejeitado: loading+erro", async () => {
    const g = deferred<unknown>();
    m.getSession.mockReturnValue(g.promise);
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await emit("INITIAL_SESSION", null);
    await act(async () => { g.reject(new Error("rejeitado")); });
    expect(result.current).toEqual({ status: "loading", error: "rejeitado" });
    unmount();
  });

  it("INITIAL_SESSION null + getSession sem sessão bem-sucedido: só então signed-out", async () => {
    const g = deferred<unknown>();
    m.getSession.mockReturnValue(g.promise);
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await emit("INITIAL_SESSION", null);
    expect(result.current.status).toBe("loading");
    await act(async () => { g.resolve({ data: { session: null }, error: null }); });
    expect(result.current).toEqual({ status: "signed-out" });
    unmount();
  });

  it("INITIAL_SESSION null, SIGNED_IN real, depois bootstrap atrasado (erro ou null) é descartado", async () => {
    const g = deferred<unknown>();
    m.getSession.mockReturnValue(g.promise);
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await emit("INITIAL_SESSION", null);
    await emit("SIGNED_IN", "u-real");
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    await act(async () => { g.resolve({ data: { session: null }, error: { message: "tarde" } }); });
    expect(result.current).toMatchObject({ status: "signed-in", user: { id: "u-real" } });
    unmount();
  });

  it("SIGNED_OUT real vence bootstrap atrasado com sessão", async () => {
    const g = deferred<unknown>();
    m.getSession.mockReturnValue(g.promise);
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await emit("INITIAL_SESSION", null);
    await emit("SIGNED_OUT", null);
    expect(result.current).toEqual({ status: "signed-out" });
    await act(async () => { g.resolve(session("u-velho")); });
    expect(result.current).toEqual({ status: "signed-out" });
    unmount();
  });
});

describe("B4.10.0b — useSessionAuthority", () => {
  it("vínculo filtrado explicitamente por user.id; várias linhas ⇒ erro, não ausência", async () => {
    m.getSession.mockResolvedValue(session("u-adm"));
    m.links.mockResolvedValueOnce({ data: [{ person_id: "x" }, { person_id: "y" }], error: null });
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await waitFor(() => expect(result.current).toEqual({ status: "loading", error: "vínculo institucional ambíguo" }));
    expect(m.linkEq).toHaveBeenCalledWith("user_id", "u-adm");
    unmount();
  });

  it("ausência validamente lida ≠ erro; erro de link/person/caps não vira ausência", async () => {
    m.getSession.mockResolvedValue(session("u-1"));
    m.links.mockResolvedValueOnce({ data: [], error: null });
    const ok = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await waitFor(() => expect(ok.result.current.status).toBe("signed-in"));
    expect(ok.result.current).toMatchObject({ person: null, capabilities: [] });
    ok.unmount();
    for (const fail of ["link", "person", "caps"] as const) {
      if (fail === "link") m.links.mockResolvedValueOnce({ data: null, error: new Error("link") });
      if (fail === "person") m.person.mockResolvedValueOnce({ data: null, error: new Error("person") });
      if (fail === "caps") m.caps.mockResolvedValueOnce({ data: null, error: new Error("caps") });
      const r = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
      await waitFor(() => expect(r.result.current).toEqual({ status: "loading", error: fail }));
      r.unmount();
    }
  });

  it("refetch com erro não preserva capabilities anteriores", async () => {
    m.getSession.mockResolvedValue(session("u-1"));
    const client = newClient();
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    m.caps.mockResolvedValueOnce({ data: null, error: new Error("caps") });
    await act(async () => { await client.refetchQueries({ queryKey: ["session-authority"] }); });
    await waitFor(() => expect(result.current).toEqual({ status: "loading", error: "caps" }));
    unmount();
  });

  it("logout→login da MESMA conta com cache existente: nova revisão, sem autoridade antiga antes da confirmação", async () => {
    m.getSession.mockResolvedValue(session("u-1"));
    const client = newClient();
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(client) });
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    const first = (result.current as Extract<SessionAuthority, { status: "signed-in" }>).sessionRevision;
    await emit("SIGNED_OUT", null);
    expect(result.current.status).toBe("signed-out");
    const pending = deferred<{ data: unknown; error: null }>();
    m.caps.mockReturnValueOnce(pending.promise);
    await emit("SIGNED_IN", "u-1");
    expect(result.current.status).toBe("loading"); // cache da sessão anterior não serve
    await act(async () => { pending.resolve({ data: [cap("c2")], error: null }); });
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    const now = result.current as Extract<SessionAuthority, { status: "signed-in" }>;
    expect(now.sessionRevision).toBeGreaterThan(first);
    expect(now.capabilities.map((c) => c.capabilityId)).toEqual(["c2"]);
    // Mesmo usuário reemitindo SIGNED_IN (refresh) não abre nova revisão.
    await emit("SIGNED_IN", "u-1");
    expect((result.current as typeof now).sessionRevision).toBe(now.sessionRevision);
    unmount();
  });

  it("duas contas: autoridade atrasada de A após troca para B nunca aparece em B", async () => {
    m.getSession.mockResolvedValue(session("u-a"));
    const capsA = deferred<{ data: unknown; error: null }>();
    m.caps.mockReturnValueOnce(capsA.promise).mockResolvedValueOnce({ data: [cap("cap-b")], error: null });
    const { result, unmount } = renderHook(() => useSessionAuthority(), { wrapper: wrapperWith(newClient()) });
    await waitFor(() => expect(m.caps).toHaveBeenCalledTimes(1));
    await emit("SIGNED_IN", "u-b");
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    await act(async () => { capsA.resolve({ data: [cap("cap-a")], error: null }); });
    const b = result.current as Extract<SessionAuthority, { status: "signed-in" }>;
    expect(b.user.id).toBe("u-b");
    expect(b.person?.id).toBe("per-u-b");
    expect(b.capabilities.map((c) => c.capabilityId)).toEqual(["cap-b"]);
    unmount();
  });
});
