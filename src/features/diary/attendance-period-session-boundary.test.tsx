/**
 * B4.6.2b.3 — fronteira de sessão do fechamento de frequência e do fechamento de período:
 * sessão incerta não monta corpo (sem calendário, rascunhos locais, stores ou consultas);
 * com sessão nada do calendário do laboratório é lido; sem sessão o laboratório é preservado.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({
  session: { status: "loading" } as Record<string, unknown>,
  useNetworkCalendars: vi.fn(() => []),
  calGet: vi.fn(),
  localLessons: vi.fn(() => []),
  localAttendance: vi.fn(() => []),
  from: vi.fn(),
}));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => h.session, sessionActor: () => null }));
vi.mock("@/features/calendar/calendar-store", async (o) => ({
  ...(await o<object>()),
  useNetworkCalendars: h.useNetworkCalendars,
  calendarRepository: { get: h.calGet, list: () => [], forYear: () => undefined, subscribe: () => () => {} },
}));
vi.mock("./lesson-records", async (o) => ({ ...(await o<object>()), useLocalLessonRecords: h.localLessons }));
vi.mock("./attendance", async (o) => ({ ...(await o<object>()), useLocalAttendance: h.localAttendance }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => { h.from(t); const q: Record<string, unknown> = {}; const never = new Promise(() => {}); for (const k of ["select", "eq", "in", "lte", "order"]) q[k] = () => q; q["then"] = (...a: Parameters<Promise<unknown>["then"]>) => never.then(...a); q["maybeSingle"] = () => never; return q; },
    rpc: () => new Promise(() => {}),
  },
}));
vi.mock("./diary-context", () => ({ DiaryHeader: () => null }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const signedIn = { status: "signed-in", user: { id: "u" }, person: null, capabilities: [] };
const Attendance = async () => (await import("./attendance-closing-pages")).AttendanceClosingPage;
const Period = async () => (await import("@/features/assessment/period-closing-pages")).PeriodClosingPage;

beforeEach(() => { Object.values(h).forEach((v) => typeof v === "function" && "mockClear" in v && (v as { mockClear: () => void }).mockClear()); });

describe("B4.6.2b.3 — fronteira de sessão: frequência e período", () => {
  for (const [name, load] of [["frequência", Attendance], ["período", Period]] as const) {
    it(`${name}: sessão incerta não monta corpo nem consulta nada`, async () => {
      h.session = { status: "loading" };
      const P = await load();
      render(<P classId="class-1" search={{} as never} />);
      expect(screen.getByText("Verificando sessão…")).toBeTruthy();
      expect(h.useNetworkCalendars).not.toHaveBeenCalled();
      expect(h.calGet).not.toHaveBeenCalled();
      expect(h.localLessons).not.toHaveBeenCalled();
      expect(h.localAttendance).not.toHaveBeenCalled();
      expect(h.from).not.toHaveBeenCalled();
    });
    it(`${name}: com sessão não lê calendário do laboratório; data inválida bloqueia sem consulta`, async () => {
      h.session = signedIn;
      const P = await load();
      const { unmount } = render(<P classId="class-1" search={{} as never} />);
      expect(h.useNetworkCalendars).not.toHaveBeenCalled();
      expect(h.calGet).not.toHaveBeenCalled();
      unmount(); h.from.mockClear();
      render(<P classId="class-1" search={{ data: "2026-02-30" } as never} />);
      expect(screen.getByText(/Data acadêmica de referência inválida/)).toBeTruthy();
      expect(h.from).not.toHaveBeenCalled();
    });
  }
  it("frequência sem sessão: laboratório preservado (assina calendários do lab)", async () => {
    h.session = { status: "signed-out" };
    const P = await Attendance();
    render(<P classId="class-1" search={{} as never} />);
    expect(h.useNetworkCalendars).toHaveBeenCalled();
  });
});
