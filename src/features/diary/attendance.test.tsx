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
import {
  attendanceBlocker,
  attendanceCounts,
  attendanceScenarios,
  attendanceSlots,
  attendanceStatus,
  attendanceStore,
  duplicateAttendance,
  eligibleStudents,
  fixtureAttendance,
  frequencyIndicators,
  frequencyPreview,
  ineligibleStudents,
  recentlyAllocated,
} from "./attendance";
import { AttendanceHistoryPage, AttendancePage, FrequencyPage } from "./attendance-pages";
import { DiaryHomePage } from "./diary-pages";
import {
  allFixtureLessons,
  findLessonEntry,
  fixtureEntry,
  localLessonStore,
  emptyLessonInput,
} from "./lesson-records";
import { LessonDetailPage, RegisterLessonPage } from "./lesson-pages";

afterEach(() => {
  attendanceStore.reset();
  localLessonStore.reset();
});

const entry = (id: string) => findLessonEntry(id, [])!;
const all = () => allFixtureLessons.map(fixtureEntry);

describe("seleção temporal de estudantes", () => {
  it("lista apenas alunos alocados na data da aula", () => {
    expect(eligibleStudents(entry("aul-001")).map((s) => s.student.id)).toEqual([
      "alu-001",
      "alu-002",
    ]);
  });
  it("aluno movimentado não integra chamadas posteriores à saída", () => {
    const out = ineligibleStudents(entry("aul-001"));
    expect(out.find((s) => s.id === "alu-005")?.reason).toMatch(/encerrada em 20\/03\/2026/);
    expect(eligibleStudents(entry("aul-002")).map((s) => s.student.id)).toContain("alu-005");
  });
  it("histórico não é reescrito pela lista atual", () => {
    expect(eligibleStudents(entry("aul-004")).map((s) => s.student.id)).toEqual(["alu-007"]);
  });
  it("identifica recém-enturmado apenas próximo ao ingresso", () => {
    const aluno = eligibleStudents(entry("aul-008"))[0]!;
    expect(recentlyAllocated(aluno, "2026-02-20")).toBe(true);
    expect(recentlyAllocated(aluno, "2026-09-15")).toBe(false);
  });
});

describe("aulas múltiplas e marcação", () => {
  it("gera uma aula por bloco ministrado", () => {
    expect(attendanceSlots(entry("aul-001")).map((s) => s.key)).toEqual(["bl-001", "bl-002"]);
  });
  it("aula fora da previsão preserva o horário excepcional", () => {
    expect(attendanceSlots(entry("aul-006"))[0]!.time).toMatch(/fora da previsão/);
  });
  it("sem marcação não é presença nem falta", () => {
    const counts = attendanceCounts(entry("aul-001"), { "bl-001": { "alu-001": "Presente" } });
    expect(counts).toMatchObject({ total: 4, marked: 1, pending: 3, present: 1, absent: 0 });
  });
  it("distingue estados sem chamada, rascunho, parcial e concluída", () => {
    const e = entry("aul-003");
    expect(attendanceStatus(e)).toBe("Sem chamada");
    expect(
      attendanceStatus(e, { entryId: e.id, marks: {}, concluded: false, origin: "local" }),
    ).toBe("Rascunho");
    expect(attendanceStatus(entry("aul-008"), attendanceStore.get("aul-008"))).toBe(
      "Parcialmente preenchida",
    );
    expect(
      attendanceStatus(e, {
        entryId: e.id,
        marks: { "bl-007": { "alu-001": "Presente" } },
        concluded: false,
        origin: "local",
      }),
    ).toBe("Parcialmente preenchida");
    expect(attendanceStatus(entry("aul-001"), attendanceStore.get("aul-001"))).toBe("Concluída");
  });
  it("chamada concluída não é sobrescrita", () => {
    expect(() => attendanceStore.save("aul-001", {}, false)).toThrow();
    attendanceStore.save("aul-003", { "bl-007": {} }, true);
    expect(() => attendanceStore.save("aul-003", {}, false)).toThrow();
    expect(attendanceStore.discard("aul-003")).toBe(false);
  });
});

describe("validações de contexto", () => {
  it("bloqueia duplicidade no mesmo bloco ministrado", () => {
    expect(duplicateAttendance(entry("aul-009"))).toEqual({
      entryId: "aul-001",
      blockId: "bl-002",
    });
    expect(attendanceBlocker(entry("aul-009"), "pro-006")?.kind).toBe("duplicate");
  });
  it("bloqueia atuação de outro profissional", () => {
    expect(attendanceBlocker(entry("aul-007"), "pro-006")?.kind).toBe("assignment");
    expect(attendanceBlocker(entry("aul-007"), "pro-003")).toBeNull();
  });
  it("substituto opera apenas dentro da vigência preservada", () => {
    expect(attendanceBlocker(entry("aul-003"), "pro-009")).toBeNull();
  });
  it("aula com registro em elaboração não impede a chamada (ciclos irmãos)", () => {
    const draft = localLessonStore.upsert(
      { ...emptyLessonInput("pro-006", "2026-09-21", "atp-001"), blockIds: ["bl-001"] },
      "Rascunho local",
    );
    expect(attendanceBlocker(findLessonEntry(draft.id, [draft])!, "pro-006")).toBeNull();
  });

});

describe("indicadores", () => {
  it("separa previstas, ministradas e com chamada concluída", () => {
    const [scope] = frequencyIndicators("pro-006", "2026-09-21", "2026-09-21", all()).filter(
      (s) => s.assignmentId === "atp-001",
    );
    expect(scope!.taught).toBe(3);
    expect(scope!.withConcluded).toBe(2);
    expect(scope!.planned).toBeGreaterThan(0);
  });
  it("não oferece prévia com chamadas pendentes nem na Educação Infantil", () => {
    const scopes = frequencyIndicators("pro-006", "2026-09-01", "2026-09-23", all());
    const atp1 = scopes.find((s) => s.assignmentId === "atp-001")!;
    expect(frequencyPreview(atp1, atp1.students[0]!).available).toBe(false);
    const ei = scopes.find((s) => s.stage === "Educação Infantil")!;
    expect(frequencyPreview(ei, ei.students[0]!).available).toBe(false);
  });
  it("prévia explicita numerador e denominador sem pendências", () => {
    const [scope] = frequencyIndicators("pro-003", "2026-09-16", "2026-09-16", all()).filter(
      (s) => s.assignmentId === "atp-006",
    );
    expect(frequencyPreview(scope!, scope!.students[0]!)).toMatchObject({
      available: true,
      numerator: 1,
      denominator: 1,
    });
  });
  it("cenários e fixtures fictícias", () => {
    expect(attendanceScenarios.length).toBeGreaterThanOrEqual(14);
    expect(fixtureAttendance.every((item) => item.origin === "fixture")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Navegação entre agenda, registro, chamada, detalhe e histórico.
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
  const router = createRouter({
    routeTree: root.addChildren([
      make("/diario", ({ search }) => <DiaryHomePage search={search} />),
      make("/diario/registrar", ({ search }) => <RegisterLessonPage search={search} />),
      make("/diario/registros/$registroId", ({ params, search }) => (
        <LessonDetailPage registroId={params["registroId"]!} search={search} />
      )),
      make("/diario/chamada/$registroId", ({ params, search }) => (
        <AttendancePage registroId={params["registroId"]!} search={search} />
      )),
      make("/diario/chamadas", ({ search }) => <AttendanceHistoryPage search={search} />),
      make("/diario/frequencia", ({ search }) => <FrequencyPage search={search} />),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router as never} />);
  return router;
}

describe("navegação do Diário com chamada", () => {
  it("agenda → chamada de aula registrada", async () => {
    const router = renderDiary("/diario?data=2026-09-21");
    const link = (await screen.findAllByRole("link", { name: /^Chamada das/ }))[0]!;
    await act(async () => fireEvent.click(link));
    expect(router.state.location.pathname).toMatch(/^\/diario\/chamada\//);
    expect(await screen.findByRole("heading", { name: "Chamada" })).toBeInTheDocument();
  });
  it("detalhe → chamada → marcação incompleta não conclui", async () => {
    const router = renderDiary("/diario/registros/aul-003?professor=pro-009");
    await act(async () =>
      fireEvent.click(await screen.findByRole("link", { name: /Fazer chamada/ })),
    );
    expect(router.state.location.pathname).toBe("/diario/chamada/aul-003");
    const group = await screen.findAllByRole("group", { name: /Frequência de/ });
    fireEvent.click(within(group[0]!).getByRole("button", { name: /Presente/ }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar e concluir" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/1 marcação\(ões\) pendente/);
    fireEvent.click(within(group[1]!).getByRole("button", { name: /Ausente/ }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar e concluir" }));
    fireEvent.click(screen.getByRole("button", { name: /Concluir chamada/ }));
    expect(attendanceStore.get("aul-003")?.concluded).toBe(true);
    expect(screen.getByText(/Chamada concluída localmente/)).toBeInTheDocument();
  });
  it("atalhos de teclado marcam a linha em foco", async () => {
    renderDiary("/diario/chamada/aul-003?professor=pro-009");
    const group = (await screen.findAllByRole("group", { name: /Frequência de/ }))[0]!;
    fireEvent.keyDown(within(group).getByRole("button", { name: /Presente/ }), { key: "f" });
    expect(within(group).getByRole("button", { name: /Ausente/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("chamada de outro profissional é somente conflito", async () => {
    renderDiary("/diario/chamada/aul-007");
    expect(await screen.findByText(/pertence a outro profissional/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar e concluir" })).not.toBeInTheDocument();
  });
  it("histórico de chamadas filtra por estado e abre a chamada", async () => {
    const router = renderDiary("/diario/chamadas?estado=Concluída");
    const list = await screen.findByRole("list", { name: "Chamadas" });
    expect(within(list).queryByText(/Chamada: Sem chamada/)).not.toBeInTheDocument();
    await act(async () => fireEvent.click(within(list).getAllByRole("link")[0]!));
    expect(router.state.location.pathname).toMatch(/^\/diario\/chamada\//);
  });
  it("chamada histórica concluída fica somente leitura", async () => {
    renderDiary("/diario/chamada/aul-004");
    expect(await screen.findAllByText("Consulta histórica")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /Presente/ })).toBeDisabled();
    expect(screen.getByText("Solicitar alteração")).toBeInTheDocument();
  });
  it("frequência exibe separação de aulas e aviso normativo", async () => {
    renderDiary("/diario/frequencia");
    expect(await screen.findByText("Regras de contabilização não homologadas")).toBeInTheDocument();
    expect(screen.getAllByText("Com chamada concluída").length).toBeGreaterThan(0);
  });
});
