/**
 * B4.6.2b.1.1 — prova do wiring real do encerramento com CONTEXTO RESOLVIDO:
 * turma/atuação/períodos B2.4/configuração resolvidos e política institucional fictícia vinda do
 * mock Cloud; o inspetor roda de fato. Dados só de teste; nenhuma gravação.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { assessmentConfigurations } from "@/features/assessment/assessment-fixtures";
import { demonstrationClosingPolicyFull, demonstrationClosingTerminology } from "./cycle-closing-fixtures";

const h = vi.hoisted(() => ({
  session: { value: { status: "loading" } as Record<string, unknown> },
  authCalls: 0,
  divergent: false,
  cal: {
    useNetworkCalendars: vi.fn(() => [{ id: "cal-fixture", year: 2026, status: "homologado", label: "Calendário fixture" }]),
    get: vi.fn(), list: vi.fn(() => []), forYear: vi.fn(), hydrate: vi.fn(),
  },
  calendarObservations: vi.fn(),
  inspect: vi.fn(),
  policies: new Map<string, Promise<{ data: unknown; error: null }>>(),
  userOf: { current: "u-a" },
  /** B4.6.2b.2 — fonte de ciclos HIPOTÉTICA, só de teste, para exercitar o inspetor além da fronteira A6. */
  hypotheticalCycleSource: true,
  timeline: vi.fn(),
  knownAt: "2026-03-01T12:00:00.000001Z" as string | null,
}));
vi.mock("@/features/assessment/cycle-configuration", async (orig) => {
  const real = await orig<typeof import("@/features/assessment/cycle-configuration")>();
  return {
    ...real,
    resolveCyclesForOrigin: (origin: "laboratorio" | "institucional", args: Parameters<typeof real.resolveCycles>[0]) =>
      origin === "institucional" && h.hypotheticalCycleSource
        ? { kind: "ready", origin, cycles: real.resolveCycles({ ...args, calendars: real.NO_LAB_CALENDARS }) }
        : real.resolveCyclesForOrigin(origin, args),
  };
});

vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => {
    h.authCalls++;
    // Divergência simulada: só a 1ª instância (fronteira) vê signed-in; qualquer outra vê loading.
    if (h.divergent && h.authCalls > 1) return { status: "loading" };
    return h.session.value;
  },
  sessionActor: () => null,
}));
vi.mock("@/features/calendar/calendar-store", () => ({
  useNetworkCalendars: h.cal.useNetworkCalendars,
  calendarRepository: { get: h.cal.get, list: h.cal.list, forYear: h.cal.forYear, hydrate: h.cal.hydrate, subscribe: () => () => {} },
}));
vi.mock("./cycle-closing-sources", async (orig) => {
  const real = await orig<typeof import("./cycle-closing-sources")>();
  return { ...real, calendarObservations: (...a: Parameters<typeof real.calendarObservations>) => { h.calendarObservations(...a); return real.calendarObservations(...a); } };
});
vi.mock("./cycle-closing-inspector", async (orig) => {
  const real = await orig<typeof import("./cycle-closing-inspector")>();
  return { ...real, inspectCycleClosing: (input: Parameters<typeof real.inspectCycleClosing>[0]) => { const out = real.inspectCycleClosing(input); h.inspect(input, out); return out; } };
});
vi.mock("@/features/diary/institutional-teaching", async (orig) => ({
  ...(await orig<object>()),
  teachingClass: (id: string) => (id === "class-1" ? { id, name: "Turma de teste", stageId: null, academicYearId: "ay" } : undefined),
}));
vi.mock("@/features/diary/diary-data", async (orig) => ({
  ...(await orig<object>()),
  diaryContext: () => ({ professionalId: "p-test", assignments: [{ classId: "class-1", unitId: "u", field: "f" }] }),
  diarySearch: () => ({}),
}));
vi.mock("@/features/diary/diary-session-state", async (orig) => ({
  ...(await orig<object>()),
  diaryReference: () => (h.knownAt ? { knownAt: h.knownAt } : null),
}));
vi.mock("@/features/students/institutional-roster", () => ({ rosterStudents: () => [] }));
vi.mock("@/features/academic/institutional-period-source", () => ({
  loadOfficialTimelineForClass: async (...a: unknown[]) => { h.timeline(...a); return {
    kind: "ready",
    year: { id: "ay", label: "Ano de teste", startsOn: "2026-01-01", endsOn: "2026-12-31" },
    organization: { id: "org-b24", label: "Organização B2.4 de teste" },
    periods: [{ id: "per-b24-1", label: "Período B2.4", starts_on: "2026-01-01", ends_on: "2026-12-31" }],
  }; },
}));
// B4.10.0a — espelhos prontos por padrão; `mirrors.ready=false` simula leitura do contexto em curso.
const mirrors = vi.hoisted(() => ({ ready: true }));
vi.mock("@/features/assessment/period-closing-cloud", () => ({ useCloudClosingSync: () => ({ ready: mirrors.ready }) }));
vi.mock("@/features/assessment/academic-standing-cloud", () => ({ useCloudStanding: () => ({ ready: mirrors.ready, error: "" }) }));
vi.mock("@/features/collegial/collegial-cloud", () => ({ useCloudCollegial: () => ({ ready: mirrors.ready, error: "" }) }));
vi.mock("@/features/diary/diary-context", () => ({ DiaryHeader: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
vi.mock("@/integrations/supabase/client", () => {
  const configRow = {
    id: "cfg-v", norm_kind: "configuracao-avaliativa", logical_id: "cfg", version: 1, supersedes_id: null,
    academic_year_id: "ay", stage_ids: [], class_ids: ["class-1"], valid_from: null, valid_until: null,
    definition: null as unknown, homologation_act_ref: "ato-teste", recorded_at: "2026-01-01",
  };
  const res = (data: unknown) => Promise.resolve({ data, error: null });
  return {
    supabase: {
      rpc: vi.fn(() => res([])),
      from: (table: string) => ({
        select: () => {
          if (table === "cycle_closing_policies") return h.policies.get(h.userOf.current) ?? res([]);
          const chain = {
            eq: () => (table === "assessment_norm_versions" ? res([{ ...configRow, definition: globalThis.__cfg }]) : res([])),
          };
          return chain;
        },
      }),
    },
  };
});

declare global { var __cfg: unknown }
globalThis.__cfg = assessmentConfigurations[0];

const policyRow = (id: string, label: string, requirements = demonstrationClosingPolicyFull.requirements) => ({
  id, version: 1,
  definition: { ...demonstrationClosingPolicyFull, label, requirements, terminalStandingRequirement: undefined, institutionalTerminology: demonstrationClosingTerminology },
});
const calendarReq = demonstrationClosingPolicyFull.requirements.filter((r) => r.parameters?.["sourceKind"] === "calendario");
const nonCalendarReq = demonstrationClosingPolicyFull.requirements.filter((r) => r.parameters?.["sourceKind"] !== "calendario");

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const signedIn = (id: string) => ({ status: "signed-in", user: { id }, person: null, capabilities: [] });

async function Page() { return (await import("./cycle-closing-pages")).CycleClosingPage; }
const lastInspect = () => h.inspect.mock.calls.at(-1)?.[0] as { policy: { id: string }; context: { observations: { sourceId: string }[]; sourceAvailability?: { sourceKind: string; state: string }[] } };

beforeEach(() => {
  Object.values(h.cal).forEach((s) => s.mockClear());
  h.calendarObservations.mockClear(); h.inspect.mockClear(); h.timeline.mockClear();
  h.policies.clear(); h.authCalls = 0; h.divergent = false; h.userOf.current = "u-a"; h.hypotheticalCycleSource = true;
});

describe("encerramento — fronteira e caminho institucional real", () => {
  it("sessão incerta: só carregamento; nada de calendário, configuração ou inspetor", async () => {
    h.session.value = { status: "loading" };
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    expect(screen.getByText("Verificando sessão…")).toBeTruthy();
    expect(h.cal.useNetworkCalendars).not.toHaveBeenCalled();
    expect(h.inspect).not.toHaveBeenCalled();
  });

  it("assinada, política COM requisito calendario: inspetor recebe 'indisponivel', nunca a fixture; requisito inconclusivo", async () => {
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-a", "Política teste A", calendarReq)], error: null }));
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(h.inspect).toHaveBeenCalled());
    const input = lastInspect();
    const out = h.inspect.mock.calls.at(-1)![1] as { classRequirements: { status: string; reason: string }[]; closable: boolean };
    expect(input.policy.id).toBe("pol-a");
    expect(input.context.sourceAvailability).toEqual([expect.objectContaining({ sourceKind: "calendario", state: "indisponivel" })]);
    expect(input.context.observations.some((o) => o.sourceId === "cal-fixture")).toBe(false);
    expect(out.classRequirements[0]!.status).toBe("inconclusivo");
    expect(out.classRequirements[0]!.reason).toMatch(/indisponível/);
    expect(out.closable).toBe(false);
    for (const s of [h.cal.useNetworkCalendars, h.cal.get, h.cal.list, h.cal.forYear, h.cal.hydrate, h.calendarObservations]) expect(s).not.toHaveBeenCalled();
    expect(screen.queryByText("Demonstração")).toBeNull();
  });

  it("assinada, política SEM requisito calendario: nenhum requisito vira inconclusivo por calendário", async () => {
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-b", "Política teste B", nonCalendarReq)], error: null }));
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(h.inspect).toHaveBeenCalled());
    const out = h.inspect.mock.calls.at(-1)![1] as { classRequirements: { reason: string }[] };
    expect(out.classRequirements.length).toBeGreaterThan(0);
    expect(out.classRequirements.some((r) => /Calendário institucional indisponível/.test(r.reason))).toBe(false);
  });

  it("divergência fronteira=assinada / outra instância=loading: corpo segue institucional, sem política/ator demo", async () => {
    h.divergent = true;
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-a", "Política teste A", calendarReq)], error: null }));
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(h.inspect).toHaveBeenCalled());
    expect(lastInspect().policy.id).toBe("pol-a");
    expect(h.inspect.mock.calls.every((c) => (c[0] as { policy: { id: string } }).policy.id !== demonstrationClosingPolicyFull.id)).toBe(true);
    expect(screen.queryByText("Demonstração")).toBeNull();
    expect(h.cal.useNetworkCalendars).not.toHaveBeenCalled();
  });

  it("dependências em carga: mostra carregamento, não 'não existe política'", async () => {
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", new Promise(() => {}));
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(screen.getByText("Carregando")).toBeTruthy());
    expect(screen.queryByText(/Não existe política/)).toBeNull();
    expect(h.inspect).not.toHaveBeenCalled();
  });

  it("B4.10.0a — espelhos de fechamento/situação/ata do contexto ainda não aceitos: só carregamento, inspetor não roda", async () => {
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-a", "Política teste A", calendarReq)], error: null }));
    mirrors.ready = false;
    try {
      const P = await Page();
      render(<P classId="class-1" search={{} as never} />);
      await waitFor(() => expect(screen.getByText("Carregando")).toBeTruthy());
      expect(screen.queryByText("Política teste A")).toBeNull();
      expect(h.inspect).not.toHaveBeenCalled();
    } finally {
      mirrors.ready = true;
    }
  });

  it("troca A→B com consulta de A pendente: resposta atrasada de A descartada", async () => {
    const late = deferred<{ data: unknown; error: null }>();
    h.policies.set("u-a", late.promise);
    h.policies.set("u-b", Promise.resolve({ data: [policyRow("pol-b", "Política teste B", calendarReq)], error: null }));
    h.session.value = signedIn("u-a");
    const P = await Page();
    const view = render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(screen.getByText("Carregando")).toBeTruthy());
    h.userOf.current = "u-b"; h.session.value = signedIn("u-b");
    view.rerender(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(lastInspect()?.policy.id).toBe("pol-b"));
    await act(async () => { late.resolve({ data: [policyRow("pol-a", "Política tardia A", calendarReq)], error: null }); });
    expect(h.inspect.mock.calls.every((c) => (c[0] as { policy: { id: string } }).policy.id === "pol-b")).toBe(true);
    expect(view.container.textContent).not.toContain("Política tardia A");
  });

  it("troca A→B: estado preenchido em A (justificativa) não aparece em B", async () => {
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-a", "Política teste A", calendarReq)], error: null }));
    h.policies.set("u-b", Promise.resolve({ data: [policyRow("pol-b", "Política teste B", calendarReq)], error: null }));
    h.session.value = signedIn("u-a");
    const P = await Page();
    const view = render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(view.container.querySelector("textarea")).toBeTruthy());
    fireEvent.change(view.container.querySelector("textarea")!, { target: { value: "justificativa da conta A" } });
    expect((view.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("justificativa da conta A");
    h.userOf.current = "u-b"; h.session.value = signedIn("u-b");
    view.rerender(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(lastInspect()?.policy.id).toBe("pol-b"));
    await waitFor(() => expect(view.container.querySelector("textarea")).toBeTruthy());
    expect((view.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
  });

  it("A6: assinada SEM fonte homologada de ciclos ⇒ indisponível por extenso; sem fallback anual, calendário ou inspetor", async () => {
    h.hypotheticalCycleSource = false;
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-a", "Política teste A")], error: null }));
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(screen.getByText(/Ciclos institucionais indisponíveis/)).toBeTruthy());
    expect(screen.queryByText(/Consolidação Anual/)).toBeNull();
    expect(screen.getByText(/não significa que a turma não tenha ciclos/)).toBeTruthy();
    expect(h.inspect).not.toHaveBeenCalled();
    for (const s of [h.cal.useNetworkCalendars, h.cal.get, h.cal.list, h.cal.forYear, h.cal.hydrate, h.calendarObservations]) expect(s).not.toHaveBeenCalled();
  });

  it("data: sem data informada, sessão consulta B2.4 com hoje operacional capturado — nunca a data fixa do laboratório", async () => {
    const { operationalToday } = await import("@/features/academic/academic-reference-date");
    const { DIARY_REFERENCE_DATE } = await vi.importActual<typeof import("@/features/diary/diary-data")>("@/features/diary/diary-data");
    h.session.value = signedIn("u-a");
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(h.timeline).toHaveBeenCalled());
    const dates = new Set(h.timeline.mock.calls.map((c) => c[2]));
    expect([...dates]).toEqual([operationalToday()]);
    if (operationalToday() !== DIARY_REFERENCE_DATE) expect(dates.has(DIARY_REFERENCE_DATE)).toBe(false);
  });

  it("data: data informada prevalece; inválida ⇒ indisponível sem consulta", async () => {
    h.session.value = signedIn("u-a");
    const P = await Page();
    const { unmount } = render(<P classId="class-1" search={{ data: "2026-05-10" } as never} />);
    await waitFor(() => expect(h.timeline).toHaveBeenCalled());
    expect(h.timeline.mock.calls.every((c) => c[2] === "2026-05-10")).toBe(true);
    unmount(); h.timeline.mockClear();
    render(<P classId="class-1" search={{ data: "2026-02-30" } as never} />);
    expect(screen.getByText(/Data acadêmica de referência inválida/)).toBeTruthy();
    expect(h.timeline).not.toHaveBeenCalled();
  });

  it("B4.6.3c — requisito calendario recebe o motivo real do adaptador central (sem vínculo declarado, sem RPC)", async () => {
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-a", "Política teste A", calendarReq)], error: null }));
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(h.inspect).toHaveBeenCalled());
    const av = (lastInspect().context.sourceAvailability as unknown as { reason: string }[])[0]!;
    expect(av.reason).toMatch(/não há calendário institucional declarado/);
    expect(av.reason).toMatch(/Nada foi contado como zero/);
    const out = h.inspect.mock.calls.at(-1)![1] as { closable: boolean };
    expect(out.closable).toBe(false);
  });

  it("B4.6.3c — sem knownAt do controlador: motivo de instante inválido, nunca determinado", async () => {
    h.knownAt = null;
    h.session.value = signedIn("u-a");
    h.policies.set("u-a", Promise.resolve({ data: [policyRow("pol-a", "Política teste A", calendarReq)], error: null }));
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    await waitFor(() => expect(h.inspect).toHaveBeenCalled());
    const av = (lastInspect().context.sourceAvailability as unknown as { reason: string }[])[0]!;
    expect(av.reason).toMatch(/instante de consulta é inválido/);
    h.knownAt = "2026-03-01T12:00:00.000001Z";
  });

  it("sem sessão: laboratório preservado (calendário local observado)", async () => {
    h.session.value = { status: "signed-out" };
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    expect(h.cal.useNetworkCalendars).toHaveBeenCalled();
  });
});
