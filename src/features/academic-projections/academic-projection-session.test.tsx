/** B4.6.2b.2 — projeção respeita sessão, leitura do encerramento e fronteira A6. Fixtures de teste. */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { assessmentConfigurations } from "@/features/assessment/assessment-fixtures";

const h = vi.hoisted(() => ({
  session: { status: "loading" } as Record<string, unknown>,
  closing: { ready: false, policies: [], commit: async () => ({ ok: true }), refresh: async () => {} } as Record<string, unknown>,
  calGet: vi.fn(),
  chain: vi.fn(() => []),
  configDate: vi.fn(),
}));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => h.session, sessionActor: () => null }));
vi.mock("@/features/cycle-closing/cycle-closing-cloud", () => ({ useCloudCycleClosing: () => h.closing }));
vi.mock("@/features/cycle-closing/cycle-closing-store", async (o) => ({
  ...(await o<object>()),
  useCycleClosingStore: () => ({ chain: h.chain, current: () => undefined, snapshots: () => [] }),
}));
vi.mock("@/features/calendar/calendar-store", () => ({ calendarRepository: { get: h.calGet }, useNetworkCalendars: () => [] }));
vi.mock("@/features/diary/institutional-teaching", async (o) => ({
  ...(await o<object>()),
  teachingClass: (id: string) => ({ id, name: "Turma de teste", stageId: null, academicYearId: "ay" }),
}));
vi.mock("@/features/diary/diary-data", async (o) => ({
  ...(await o<object>()),
  diaryContext: () => ({ professionalId: "p", assignments: [{ classId: "class-1", field: "f" }] }),
  diarySearch: () => ({}),
}));
vi.mock("@/features/assessment/assessment-normative-sources", async (o) => ({
  ...(await o<object>()),
  useClassConfigurationState: (_c: string, d?: string) => {
    h.configDate(d);
    return {
      kind: "resolvida", configuration: assessmentConfigurations[0],
      structure: { id: "s", academicYearId: "ay", calendarId: "cal-x", periods: [{ id: "p1", sequence: 1, label: "P1", start: "2026-01-01", end: "2026-12-31" }] },
      year: { id: "ay", label: "Ano" },
    };
  },
}));
vi.mock("@/features/diary/diary-context", () => ({ DiaryHeader: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const Page = async () => (await import("./academic-projection-pages")).AcademicProjectionPage;
const signedIn = { status: "signed-in", user: { id: "u" }, person: null, capabilities: [] };

beforeEach(() => { h.calGet.mockClear(); h.chain.mockClear(); h.configDate.mockClear(); });

describe("projeção — sessão, carregamento e ciclos", () => {
  it("sessão incerta: só verificação, sem store nem calendário", async () => {
    h.session = { status: "loading" };
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    expect(screen.getByText("Verificando sessão…")).toBeTruthy();
    expect(h.chain).not.toHaveBeenCalled();
  });
  it("leitura do encerramento em carga: não afirma catálogo vazio nem lê o store", async () => {
    h.session = signedIn; h.closing = { ...h.closing, ready: false };
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    expect(screen.getByText("Carregando")).toBeTruthy();
    expect(screen.queryByText(/não existe|Nenhum/i)).toBeNull();
    expect(h.chain).not.toHaveBeenCalled();
  });
  it("erro de leitura: indisponível, nada concluído", async () => {
    h.session = signedIn; h.closing = { ...h.closing, ready: true, error: "negado" };
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    expect(screen.getByText(/Nada é concluído/)).toBeTruthy();
    expect(h.chain).not.toHaveBeenCalled();
  });
  it("pronto com sessão: ciclos indisponíveis (A6), sem cycles[0], calendário ou store; data não é a do laboratório", async () => {
    h.session = signedIn; h.closing = { ready: true, policies: [] };
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    expect(screen.getByText(/Ciclos institucionais indisponíveis/)).toBeTruthy();
    expect(screen.queryByText(/Nenhum ciclo configurado/)).toBeNull();
    expect(h.calGet).not.toHaveBeenCalled();
    expect(h.chain).not.toHaveBeenCalled();
    const { operationalToday } = await import("@/features/academic/academic-reference-date");
    expect(h.configDate).toHaveBeenLastCalledWith(operationalToday());
  });
  it("sem sessão: laboratório mantém legado (ciclo demonstrativo lido do store)", async () => {
    h.session = { status: "signed-out" }; h.closing = { ready: false, policies: [] };
    const P = await Page();
    render(<P classId="class-1" search={{} as never} />);
    expect(screen.queryByText(/Ciclos institucionais indisponíveis/)).toBeNull();
    expect(h.chain).toHaveBeenCalled();
  });
});
