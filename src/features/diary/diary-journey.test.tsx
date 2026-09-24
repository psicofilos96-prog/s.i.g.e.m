import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { attendanceStore, fixtureAttendance } from "./attendance";
import { AttendancePage } from "./attendance-pages";
import { DiaryHomePage, LessonsHistoryPage } from "./diary-pages";
import {
  journeyAgenda,
  journeyHistory,
  journeyScenarios,
  journeyState,
  legitimatePending,
  nextAction,
  primaryAction,
  resumeItems,
  temporalityOf,
  type JourneySources,
} from "./diary-journey";
import {
  emptyLessonInput,
  localLessonStore,
  plannedLessonsFor,
  type LocalLessonRecord,
} from "./lesson-records";
import { LessonDetailPage, RegisterLessonPage } from "./lesson-pages";
import { emptyInfantExperience, infantExperienceStore } from "./infant-experiences";

afterEach(() => {
  attendanceStore.reset();
  localLessonStore.reset();
  infantExperienceStore.reset();
});

const none: JourneySources = { lessons: [], attendance: [], experiences: [] };
const sources = (): JourneySources => ({
  lessons: localLessonStore.list() as LocalLessonRecord[],
  attendance: attendanceStore.list(),
  experiences: infantExperienceStore.list(),
});

describe("camada de jornada docente", () => {
  it("cobre os cenários integrados A–X", () => expect(journeyScenarios).toHaveLength(24));
  it("classifica temporalidade da data consultada", () => {
    expect(temporalityOf("2026-09-22")).toBe("histórica");
    expect(temporalityOf("2026-09-23")).toBe("hoje");
    expect(temporalityOf("2026-10-01")).toBe("futura");
  });
  it("deriva estados da aula de forma única", () => {
    expect(journeyState("futura", "Prevista", null)).toBe("Prevista");
    expect(journeyState("hoje", "Prevista", null)).toBe("Prevista · sem registro");
    expect(journeyState("hoje", "Rascunho em elaboração", null)).toBe("Registro em elaboração");
    expect(journeyState("hoje", "Registrada", "Sem chamada")).toBe("Chamada pendente");
    expect(journeyState("hoje", "Registrada", "Parcialmente preenchida")).toBe(
      "Chamada em elaboração",
    );
    expect(journeyState("hoje", "Registrada", "Concluída")).toBe("Chamada concluída");
  });
  it("próxima ação derivada e terminologia da EI", () => {
    const base = { search: {}, date: "2026-09-23", assignmentId: "atp-001", entryId: "x" };
    expect(nextAction("Prevista · sem registro", { ...base, infant: false }).label).toBe(
      "Registrar aula",
    );
    expect(nextAction("Prevista · sem registro", { ...base, infant: true }).label).toBe(
      "Registrar experiência",
    );
    expect(nextAction("Registro em elaboração", { ...base, infant: false }).label).toBe(
      "Continuar registro",
    );
    expect(nextAction("Chamada pendente", { ...base, infant: false }).label).toBe("Fazer chamada");
    expect(nextAction("Chamada em elaboração", { ...base, infant: false }).label).toBe(
      "Continuar chamada",
    );
    expect(nextAction("Chamada concluída", { ...base, infant: false }).label).toBe("Ver registro");
  });
  it("agenda histórica reflete chamada concluída e preserva contexto nos links", () => {
    const items = journeyAgenda("pro-006", "2026-09-21", none, { turma: "tur-001" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.classId === "tur-001")).toBe(true);
    expect(items.some((item) => item.journeyState === "Chamada concluída")).toBe(true);
    expect(items.every((item) => item.action.search.turma === "tur-001")).toBe(true);
  });
  it("data futura não gera falsa pendência", () => {
    const future = journeyAgenda("pro-006", "2026-09-30", none);
    expect(future.every((item) => item.journeyState === "Prevista")).toBe(true);
    expect(legitimatePending("pro-006", none).some((item) => item.date > "2026-09-23")).toBe(false);
  });
  it("aula prevista não registrada não é pendência", () => {
    const pending = legitimatePending("pro-006", none);
    expect(pending.every((item) => item.kind !== ("prevista" as never))).toBe(true);
    const planned = plannedLessonsFor("pro-006", "2026-09-23");
    expect(planned.length).toBeGreaterThan(0);
    expect(pending.some((item) => item.date === "2026-09-23")).toBe(false);
  });
  it("chamada parcial aparece como a concluir (pro-008)", () => {
    const pending = legitimatePending("pro-008", none);
    expect(pending.find((item) => item.id === "attendance:aul-008")).toMatchObject({
      label: "A concluir",
      kind: "chamada-em-elaboracao",
    });
  });
  it("registro sem chamada é pendente com linguagem neutra", () => {
    const pending = legitimatePending("pro-006", none);
    expect(pending.some((item) => item.kind === "chamada-pendente")).toBe(true);
    expect(pending.every((item) => !/falha|irregular|atrasad/i.test(item.description))).toBe(true);
  });
  it("rascunho de aula e de experiência entram em continuar de onde parei", () => {
    localLessonStore.upsert(
      { ...emptyLessonInput("pro-006", "2026-09-23"), assignmentId: "atp-001" },
      "Rascunho local",
    );
    infantExperienceStore.upsert(
      {
        ...emptyInfantExperience("pro-006", "atp-002", "2026-09-22"),
        individualObservations: [
          { id: "o1", studentId: "alu-005", text: "Obs", fieldIds: [], objectiveIds: [] },
        ],
      },
      "Rascunho local",
    );
    const items = resumeItems("pro-006", sources());
    expect(items.map((item) => item.kind).sort()).toEqual([
      "experiencia-em-elaboracao",
      "registro-em-elaboracao",
    ]);
    expect(items.find((i) => i.kind === "experiencia-em-elaboracao")?.description).toMatch(
      /1 observação/,
    );
  });
  it("sem rascunhos, nada a continuar", () => expect(resumeItems("pro-006", none)).toEqual([]));
  it("primeira ação aberta do dia é a principal", () => {
    const items = journeyAgenda("pro-006", "2026-09-23", none);
    expect(primaryAction(items)?.action.kind).toBe("registrar");
  });
  it("histórico integrado sem duplicidade de identidade", () => {
    const history = journeyHistory("pro-006", none);
    const ids = history.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(history.some((item) => item.kind === "Experiência da EI")).toBe(true);
  });
  it("mesma aula tem a mesma identidade na agenda, pendências e histórico", () => {
    const agendaIds = journeyAgenda("pro-006", "2026-09-21", none).flatMap((i) =>
      i.entryId ? [i.entryId] : [],
    );
    const historyIds = journeyHistory("pro-006", none).map((i) => i.id);
    agendaIds.forEach((id) => expect(historyIds).toContain(id));
  });
  it("professor sem atuação vigente não tem agenda", () =>
    expect(journeyAgenda("pro-011", "2026-09-23", none)).toEqual([]));
  it("atuação encerrada não aparece (substituição pro-009 fora da vigência)", () =>
    expect(journeyAgenda("pro-009", "2026-09-23", none)).toEqual([]));
  it("chamadas fictícias permanecem as mesmas fontes", () =>
    expect(fixtureAttendance.every((item) => item.origin === "fixture")).toBe(true));
});

// ---------------------------------------------------------------------------
// Percursos
// ---------------------------------------------------------------------------

function renderDiary(path: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const passthrough = (s: Record<string, unknown>) => s as Record<string, string>;
  const make = (
    p: string,
    el: (r: { params: Record<string, string>; search: Record<string, string> }) => ReactNode,
  ) => {
    const route = createRoute({
      getParentRoute: () => root,
      path: p,
      validateSearch: passthrough,
      component: function R() {
        return (
          <>{el({ params: route.useParams() as never, search: route.useSearch() as never })}</>
        );
      },
    });
    return route;
  };
  const stub = (p: string) => make(p, () => <p>stub {p}</p>);
  const router = createRouter({
    routeTree: root.addChildren([
      make("/diario", ({ search }) => <DiaryHomePage search={search} />),
      make("/diario/registrar", ({ search }) => <RegisterLessonPage search={search} />),
      make("/diario/registros/$registroId", ({ params, search }) => (
        <LessonDetailPage registroId={params["registroId"] ?? ""} search={search} />
      )),
      make("/diario/chamada/$registroId", ({ params, search }) => (
        <AttendancePage registroId={params["registroId"] ?? ""} search={search} />
      )),
      make("/diario/aulas", ({ search }) => <LessonsHistoryPage search={search} />),
      stub("/diario/turmas"),
      stub("/diario/turmas/$turmaId"),
      stub("/diario/chamadas"),
      stub("/diario/frequencia"),
      stub("/diario/documentos"),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router as never} />);
  return router;
}

describe("percursos do Meu Diário", () => {
  it("abre no contexto correto com Hoje e ação principal", async () => {
    renderDiary("/diario");
    expect(await screen.findByRole("heading", { name: "Hoje" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Registrar aula/ }).length).toBeGreaterThan(0);
  });
  it("data histórica indica consulta histórica", async () => {
    renderDiary("/diario?data=2026-09-21");
    expect(await screen.findByText("Consulta histórica")).toBeInTheDocument();
  });
  it("troca de data preserva demais parâmetros", async () => {
    const router = renderDiary("/diario?data=2026-09-23&turma=tur-001");
    await act(async () =>
      fireEvent.click(await screen.findByRole("link", { name: "Próximo dia" })),
    );
    expect(router.state.location.search).toMatchObject({ data: "2026-09-24", turma: "tur-001" });
  });
  it("data futura não mostra pendências de agenda", async () => {
    renderDiary("/diario?data=2026-09-30");
    expect(await screen.findByText("Data futura · previsão")).toBeInTheDocument();
    const agenda = screen.queryByRole("list", { name: "Aulas do dia" });
    if (agenda) expect(within(agenda).queryByText("Chamada pendente")).toBeNull();
  });
  it("agenda → registro com contexto preenchido", async () => {
    const router = renderDiary("/diario?data=2026-09-23");
    const link = (await screen.findAllByRole("link", { name: /^Registrar aula das/ }))[0]!;
    await act(async () => fireEvent.click(link));
    expect(router.state.location.pathname).toBe("/diario/registrar");
    expect(router.state.location.search).toMatchObject({ data: "2026-09-23" });
    expect((router.state.location.search as Record<string, string>)["atuacao"]).toBeTruthy();
  });
  it("chamada concluída oferece retorno ao Meu Diário na mesma data", async () => {
    const router = renderDiary("/diario/chamada/aul-001?data=2026-09-21");
    const back = await screen.findByRole("link", { name: "Voltar para Meu Diário" });
    await act(async () => fireEvent.click(back));
    expect(router.state.location.pathname).toBe("/diario");
    expect(router.state.location.search).toMatchObject({ data: "2026-09-21" });
  });
  it("rascunho aparece em continuar de onde parei", async () => {
    localLessonStore.upsert(
      { ...emptyLessonInput("pro-006", "2026-09-23"), assignmentId: "atp-001" },
      "Rascunho local",
    );
    renderDiary("/diario");
    expect(await screen.findByRole("heading", { name: "Continuar de onde parei" })).toBeVisible();
    expect(screen.getByText(/perdidos ao recarregar/)).toBeInTheDocument();
  });
  it("sem rascunhos a seção de retomada não é exibida", async () => {
    renderDiary("/diario");
    await screen.findByRole("heading", { name: "Hoje" });
    expect(screen.queryByRole("heading", { name: "Continuar de onde parei" })).toBeNull();
  });
  it("professor sem atuação recebe orientação específica", async () => {
    renderDiary("/diario?professor=pro-011");
    expect(await screen.findByText("Sem atuação pedagógica vigente")).toBeInTheDocument();
  });
  it("chamada parcial exibida como a concluir em pendências", async () => {
    renderDiary("/diario?professor=pro-008");
    const list = await screen.findByRole("list", { name: "Pendências" });
    expect(within(list).getByText("A concluir")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Continuar chamada" })).toBeInTheDocument();
  });
  it("EI reconhecida: agenda usa terminologia de experiência", async () => {
    renderDiary("/diario?data=2026-09-22");
    await screen.findByRole("heading", { name: "Agenda do dia" });
    const agenda = screen.queryByRole("list", { name: "Aulas do dia" });
    if (agenda)
      expect(within(agenda).queryAllByText(/experiência pedagógica/).length).toBeGreaterThan(0);
  });
});
