import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const auth = vi.hoisted(() => ({ caps: [] as string[] }));
vi.mock("@/features/authority/session-authority", () => ({
  useSessionUser: () => ({ loading: false, user: { id: "u" }, revision: 1 }),
  useSessionAuthority: () => ({
    status: "signed-in", user: { id: "u" }, sessionRevision: 1, person: { id: "p", displayName: "Supervisão Escolar" },
    capabilities: auth.caps.map((capabilityId) => ({ capabilityId, engagementId: "e", policyId: null, policyVersion: null, classId: null, periodId: null, schoolId: null, componentId: null })),
  }),
}));
vi.mock("./institutional-calendar-pages", () => ({
  InstitutionalCalendarListView: () => <p>consulta-institucional</p>,
  InstitutionalCalendarDetailView: () => <p>consulta-institucional</p>,
}));
vi.mock("./calendar-pages", async () => {
  const { useSupervisionMode, useCalendarRepository } = await import("./calendar-supervision-context");
  const { supervisionCalendarRepository } = await import("./calendar-store");
  const Page = ({ profile }: { profile: string }) => {
    const sup = useSupervisionMode();
    const repo = useCalendarRepository();
    return <p>{`telas-originais perfil=${profile} supervisao=${sup ? "sim" : "nao"} exato=${repo === supervisionCalendarRepository() ? "sim" : "nao"}`}</p>;
  };
  return { CalendarListPage: Page, CalendarWorkspacePage: Page, CalendarPrintPage: Page };
});

import { CalendarDetailRoute, CalendarListRoute } from "./institutional-calendar-routes";

describe("fronteira do calendário com sessão", () => {
  beforeEach(() => { auth.caps = []; });
  it("Supervisão com autoridade real: telas originais, perfil forçado, repositório exato", () => {
    auth.caps = ["construir-calendario-da-rede"];
    render(<CalendarDetailRoute calendarId="x" perfil="professor" />);
    expect(screen.getByText("telas-originais perfil=supervisao supervisao=sim exato=sim")).toBeTruthy();
    expect(screen.queryByText("consulta-institucional")).toBeNull();
  });
  it("lista da Supervisão mantém a sincronização institucional como painel secundário", () => {
    auth.caps = ["construir-calendario-da-rede"];
    render(<CalendarListRoute perfil="escola" />);
    expect(screen.getByText(/perfil=supervisao/)).toBeTruthy();
    expect(screen.getByText(/Sincronização institucional/)).toBeTruthy();
  });
  it("autenticado comum: só consulta institucional, nenhum rascunho local", () => {
    render(<CalendarListRoute perfil="supervisao" />);
    expect(screen.getByText("consulta-institucional")).toBeTruthy();
    expect(screen.queryByText(/telas-originais/)).toBeNull();
  });
});
