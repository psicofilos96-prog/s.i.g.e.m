import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { afterEach, describe, expect, it } from "vitest";
import { AttendancePage } from "./attendance-pages";
import { InfantExperienceRegisterPage } from "./infant-experience-pages";
import {
  eligibleChildren,
  emptyInfantExperience,
  experienceFields,
  infantExperienceFixtures,
  infantExperienceScenarios,
  infantExperienceStore,
  objectivesFor,
  unavailableChildren,
  validateInfantExperience,
} from "./infant-experiences";
import { localLessonStore } from "./lesson-records";
import { LessonDetailPage, RegisterLessonPage } from "./lesson-pages";

afterEach(() => {
  infantExperienceStore.reset();
  localLessonStore.reset();
});

const complete = () => ({
  ...emptyInfantExperience("pro-006", "2026-09-22", "atp-002"),
  title: "Descobertas no jardim",
  description: "As crianças investigaram folhas, sementes e diferenças de textura.",
  fieldIds: ["espacos-tempos" as const],
  objectiveIds: ["obj-et-01"],
});

describe("domínio da experiência infantil", () => {
  it("reutiliza os cinco campos documentados", () => {
    expect(experienceFields).toHaveLength(5);
    expect(experienceFields.map((item) => item.label)).toContain("O eu, o outro e o nós");
  });
  it("identifica objetivos como conteúdo demonstrativo", () => {
    expect(objectivesFor("EI03TS", "tracos-sons")).toHaveLength(2);
    expect(objectivesFor("EI03TS")[0]?.description).toMatch(/Exemplo fictício/);
  });
  it("não exige campo ou objetivo para registrar a experiência", () => {
    expect(validateInfantExperience({ ...complete(), fieldIds: [], objectiveIds: [] })).toEqual([]);
  });
  it("exige descrição do efetivamente realizado", () => {
    expect(validateInfantExperience({ ...complete(), description: "" })[0]?.field).toBe(
      "description",
    );
  });
  it("bloqueia atuação não infantil ou incompatível", () => {
    expect(validateInfantExperience({ ...complete(), assignmentId: "atp-001" })[0]?.field).toBe(
      "assignment",
    );
  });
  it("reutiliza a elegibilidade temporal da turma", () => {
    expect(eligibleChildren(complete()).map((item) => item.student.id)).toContain("alu-005");
    expect(
      unavailableChildren({ ...complete(), date: "2026-03-20" }).map((item) => item.id),
    ).toContain("alu-005");
  });
  it("rejeita observação para criança fora do contexto da data", () => {
    const input = {
      ...complete(),
      date: "2026-03-20",
      individualObservations: [
        { id: "obs-x", studentId: "alu-005", text: "Texto", fieldIds: [], objectiveIds: [] },
      ],
    };
    expect(validateInfantExperience(input)).toContainEqual(
      expect.objectContaining({ field: "individual" }),
    );
  });
  it("mantém rascunho local e impede sobrescrita após conclusão", () => {
    const draft = infantExperienceStore.upsert(complete(), "Rascunho local");
    const done = infantExperienceStore.upsert(
      complete(),
      "Concluído localmente (demonstração)",
      draft.id,
    );
    expect(done.status).toMatch(/Concluído/);
    expect(() => infantExperienceStore.upsert(complete(), "Rascunho local", done.id)).toThrow();
  });
  it("só descarta rascunhos", () => {
    const draft = infantExperienceStore.upsert(complete(), "Rascunho local");
    expect(infantExperienceStore.discard(draft.id)).toBe(true);
    expect(infantExperienceStore.discard(infantExperienceFixtures[0]!.id)).toBe(false);
  });
  it("preserva planejamento como referência separada", () => {
    const input = { ...complete(), relatedPlanning: { id: "pla-x", summary: "Referência" } };
    const record = infantExperienceStore.upsert(input, "Rascunho local");
    expect(record.relatedPlanning).toEqual({ id: "pla-x", summary: "Referência" });
  });
  it("cobre os cenários pedagógicos mínimos da etapa", () => {
    expect(infantExperienceScenarios.length).toBeGreaterThanOrEqual(20);
    expect(infantExperienceFixtures.some((item) => item.individualObservations.length > 0)).toBe(
      true,
    );
  });
});

function renderDiary(path: string) {
  const root = createRootRoute({ component: Outlet });
  const make = (
    routePath: string,
    component: (args: {
      params: Record<string, string>;
      search: Record<string, string>;
    }) => ReactNode,
  ) => {
    const route = createRoute({
      getParentRoute: () => root,
      path: routePath,
      validateSearch: (search: Record<string, unknown>) => search as Record<string, string>,
      component: () => (
        <>
          {component({
            params: route.useParams() as Record<string, string>,
            search: route.useSearch(),
          })}
        </>
      ),
    });
    return route;
  };
  const router = createRouter({
    routeTree: root.addChildren([
      make("/diario", () => <p>Diário</p>),
      make("/diario/aulas", () => <p>Histórico</p>),
      make("/diario/registrar", ({ search }) => <RegisterLessonPage search={search} />),
      make("/diario/registros/$registroId", ({ params, search }) => (
        <LessonDetailPage registroId={params["registroId"] ?? ""} search={search} />
      )),
      make("/diario/chamada/$registroId", ({ params, search }) => (
        <AttendancePage registroId={params["registroId"] ?? ""} search={search} />
      )),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router as never} />);
  return router;
}

describe("interface contextual da Educação Infantil", () => {
  it("troca automaticamente registro de aula por registro de experiência", async () => {
    renderDiary("/diario/registrar?atuacao=atp-002&data=2026-09-22");
    expect(
      await screen.findByRole("heading", { name: "Registrar experiência" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo ou atividade realizada")).not.toBeInTheDocument();
    expect(screen.getByText(/não usa disciplinas, provas, notas/)).toBeInTheDocument();
  });
  it("permite vários campos e informa o contador de objetivos", async () => {
    renderDiary("/diario/registrar?atuacao=atp-002&data=2026-09-22");
    fireEvent.click(await screen.findByLabelText("O eu, o outro e o nós"));
    fireEvent.click(screen.getByLabelText("Traços, sons, cores e formas"));
    const objective = screen.getByLabelText(/EI03TS01/);
    fireEvent.click(objective);
    expect(screen.getByText("1 objetivo(s) selecionado(s)")).toBeInTheDocument();
  });
  it("busca e filtra objetivos sem seleção automática", async () => {
    renderDiary("/diario/registrar?atuacao=atp-002&data=2026-09-22");
    expect(await screen.findByText("0 objetivo(s) selecionado(s)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar objetivos"), { target: { value: "texturas" } });
    expect(screen.getByText(/Investigar traços, texturas/)).toBeInTheDocument();
  });
  it("adiciona observação apenas para criança elegível", async () => {
    renderDiary("/diario/registrar?atuacao=atp-002&data=2026-09-22");
    fireEvent.click(await screen.findByLabelText("Selecionar criança elegível"));
    const options = await screen.findAllByRole("option");
    fireEvent.click(options[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar observação/ }));
    expect(screen.getByLabelText(/Observação de/)).toBeInTheDocument();
  });
  it("não conclui sem descrição", async () => {
    renderDiary("/diario/registrar?atuacao=atp-002&data=2026-09-22");
    expect(await screen.findByRole("button", { name: /Revisar e concluir/ })).toBeDisabled();
    expect(screen.getByText(/Descreva a experiência efetivamente realizada/)).toBeInTheDocument();
  });
  it("salva rascunho com aviso de memória temporária", async () => {
    renderDiary("/diario/registrar?atuacao=atp-002&data=2026-09-22");
    fireEvent.change(await screen.findByPlaceholderText(/Descreva a experiência efetivamente/), {
      target: { value: "Exploração coletiva" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Manter rascunho local/ }));
    expect(screen.getByText(/Rascunho mantido somente na memória desta aba/)).toBeInTheDocument();
  });
  it("revisa e conclui sem criar presença automática", async () => {
    renderDiary("/diario/registrar?atuacao=atp-002&data=2026-09-22");
    fireEvent.change(await screen.findByPlaceholderText(/Descreva a experiência efetivamente/), {
      target: { value: "Exploração coletiva" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Revisar e concluir/ }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Concluir demonstrativamente/ }));
    expect(await screen.findByText(/concluída apenas nesta demonstração/)).toBeInTheDocument();
    expect(localLessonStore.list()).toHaveLength(1);
  });
  it("abre detalhe infantil do registro histórico", async () => {
    renderDiary("/diario/registros/aul-002?professor=pro-006");
    expect(
      await screen.findByRole("heading", { name: "Exploração de formas, texturas e cores" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Experiência efetivamente realizada")).toBeInTheDocument();
    expect(screen.getByText(/não constituem catálogo oficial/)).toBeInTheDocument();
  });
});
