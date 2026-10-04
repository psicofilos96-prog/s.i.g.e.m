import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { AttendanceCalendarNoticePanel, CouncilCalendarAgendaPanel } from "./institutional-calendar-notices";
import { setDiarySessionState } from "@/features/diary/diary-session-state";

afterEach(() => {
  cleanup();
  setDiarySessionState({ phase: "sem-fronteira", key: null, userId: null });
});

describe("painéis de calendário seguem o contexto aceito do Diário", () => {
  it("troca de sessão retira diagnóstico antigo; registros existentes permanecem", () => {
    setDiarySessionState({
      phase: "pronto", key: "person-a#1", userId: "person-a",
      reference: { validOn: "2026-04-10", knownAt: "2026-10-04T12:00:00Z", source: "informada", operationalToday: "2026-10-04" },
    });
    render(<>
      <article data-testid="existing-record">Aula registrada em 10/04/2026 · Ata encerrada em 09/04/2026</article>
      <AttendanceCalendarNoticePanel date="2026-04-10" />
      <CouncilCalendarAgendaPanel />
    </>);
    const record = screen.getByTestId("existing-record");
    const original = record.textContent;
    expect(screen.getByTestId("attendance-calendar-notice").textContent).toContain("2026-04-10");
    expect(screen.getByTestId("council-calendar-agenda").textContent).toContain("isto não significa que não haja conselhos");
    act(() => setDiarySessionState({ phase: "carregando", key: "person-b#1", userId: "person-b" }));
    expect(screen.getByTestId("attendance-calendar-notice").textContent).not.toContain("2026-04-10");
    expect(screen.getByTestId("council-calendar-agenda").textContent).toContain("Contexto institucional ainda não confirmado");
    expect(record.textContent).toBe(original);
    act(() => setDiarySessionState({ phase: "laboratorio", key: "laboratorio", userId: null }));
    expect(screen.queryByTestId("attendance-calendar-notice")).toBeNull();
    expect(screen.queryByTestId("council-calendar-agenda")).toBeNull();
    expect(screen.getByTestId("existing-record")).toBe(record);
    expect(record.textContent).toBe(original);
  });
});
