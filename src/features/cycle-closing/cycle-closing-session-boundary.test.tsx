/**
 * B4.6.2b.1 — fronteira de sessão do encerramento, disponibilidade genérica de fontes
 * e estado de configuração durante a autenticação.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

const session = vi.hoisted(() => ({ value: { status: "loading" } as Record<string, unknown> }));
const spies = vi.hoisted(() => ({
  useNetworkCalendars: vi.fn(() => [{ id: "cal-lab", year: 2026, status: "homologado" }]),
  get: vi.fn(),
  list: vi.fn(() => []),
  classConfigurationState: vi.fn(() => ({ kind: "inexistente", reason: "lab" })),
  teachingClass: vi.fn(() => undefined),
  useClassConfigurationState: vi.fn(() => ({ kind: "inexistente", reason: "x" })),
}));

vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => session.value,
  sessionActor: () => null,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(async () => ({ data: [], error: null })), from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) })) },
}));
vi.mock("@/features/calendar/calendar-store", () => ({
  useNetworkCalendars: spies.useNetworkCalendars,
  calendarRepository: { get: spies.get, list: spies.list, subscribe: () => () => {} },
}));
vi.mock("@/features/cycle-closing/cycle-closing-cloud", () => ({ useCloudCycleClosing: () => ({ policies: [] }) }));
vi.mock("@/features/assessment/period-closing-cloud", () => ({ useCloudClosingSync: () => {} }));
vi.mock("@/features/assessment/academic-standing-cloud", () => ({ useCloudStanding: () => {} }));
vi.mock("@/features/collegial/collegial-cloud", () => ({ useCloudCollegial: () => {} }));
vi.mock("@/features/diary/diary-context", () => ({ DiaryHeader: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

describe("CycleClosingPage — fronteira de sessão", () => {
  beforeEach(() => {
    Object.values(spies).forEach((s) => s.mockClear());
    vi.resetModules();
  });

  async function page() {
    vi.doMock("@/features/assessment/assessment-normative-sources", () => ({
      useClassConfigurationState: spies.useClassConfigurationState,
    }));
    return (await import("./cycle-closing-pages")).CycleClosingPage;
  }

  it("sessão incerta: só carregamento; nenhum calendário/storage, configuração ou motor", async () => {
    session.value = { status: "loading" };
    const Page = await page();
    render(<Page classId="t1" search={{} as never} />);
    expect(screen.getByText("Verificando sessão…")).toBeTruthy();
    expect(spies.useNetworkCalendars).not.toHaveBeenCalled();
    expect(spies.get).not.toHaveBeenCalled();
    expect(spies.useClassConfigurationState).not.toHaveBeenCalled();
  });

  it("com sessão: nenhum hook/leitura do calendário do laboratório", async () => {
    session.value = { status: "signed-in", user: { id: "u-a" }, person: null, capabilities: [] };
    const Page = await page();
    render(<Page classId="t1" search={{} as never} />);
    expect(spies.useNetworkCalendars).not.toHaveBeenCalled();
    expect(spies.get).not.toHaveBeenCalled();
    expect(spies.list).not.toHaveBeenCalled();
  });

  it("sem sessão: laboratório preservado (calendário do laboratório observado)", async () => {
    session.value = { status: "signed-out" };
    const Page = await page();
    render(<Page classId="t1" search={{} as never} />);
    expect(spies.useNetworkCalendars).toHaveBeenCalled();
  });

  it("troca de conta A→B remonta o corpo (chave por usuário)", async () => {
    session.value = { status: "signed-in", user: { id: "u-a" }, person: null, capabilities: [] };
    const Page = await page();
    const { rerender } = render(<Page classId="t1" search={{} as never} />);
    const before = spies.useClassConfigurationState.mock.calls.length;
    session.value = { status: "signed-in", user: { id: "u-b" }, person: null, capabilities: [] };
    rerender(<Page classId="t1" search={{} as never} />);
    expect(spies.useClassConfigurationState.mock.calls.length).toBeGreaterThan(before);
    expect(spies.useNetworkCalendars).not.toHaveBeenCalled();
  });
});

describe("useClassConfigurationState — estado durante autenticação", () => {
  beforeEach(() => {
    Object.values(spies).forEach((s) => s.mockClear());
    vi.resetModules();
    vi.doUnmock("@/features/assessment/assessment-normative-sources");
    vi.doMock("@/features/assessment/assessment-configuration", async (orig) => ({
      ...(await orig<object>()),
      classConfigurationState: spies.classConfigurationState,
    }));
    vi.doMock("@/features/diary/institutional-teaching", () => ({ teachingClass: spies.teachingClass }));
  });

  it("loading nunca devolve laboratório nem consulta a turma", async () => {
    session.value = { status: "loading" };
    const mod = await import("@/features/assessment/assessment-normative-sources");
    const { result } = renderHook(() => mod.useClassConfigurationState("t1"));
    expect(result.current).toBe(mod.SESSION_PENDING_STATE);
    expect(spies.classConfigurationState).not.toHaveBeenCalled();
    expect(spies.teachingClass).not.toHaveBeenCalled();
  });

  it("signed-out → loading → signed-in: laboratório só no signed-out confirmado", async () => {
    session.value = { status: "signed-out" };
    const mod = await import("@/features/assessment/assessment-normative-sources");
    const { result, rerender } = renderHook(() => mod.useClassConfigurationState("t1"));
    expect(spies.classConfigurationState).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ reason: "lab" });
    session.value = { status: "loading" };
    rerender();
    expect(result.current).toBe(mod.SESSION_PENDING_STATE);
    session.value = { status: "signed-in", user: { id: "u-a" }, person: null, capabilities: [] };
    rerender();
    expect(spies.classConfigurationState).toHaveBeenCalledTimes(1);
    expect(result.current).not.toMatchObject({ reason: "lab" });
  });
});
