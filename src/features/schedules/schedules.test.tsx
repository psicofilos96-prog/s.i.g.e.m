import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderOperationalRoutes } from "@/test/router-harness";
import {
  detectPotentialConflicts,
  getJourneyForClass,
  getScheduleForClass,
  professionalScheduleSummary,
  scheduleConsistencyIssues,
  scheduleScenarios,
  scheduleSituation,
  scheduleVersions,
  schoolJourneys,
} from "./schedules-data";

describe("Horários 10A — modelo demonstrativo", () => {
  it("mantém jornada independente da grade", () => {
    expect(getJourneyForClass("tur-001")?.id).toBe("jor-001");
    expect(getScheduleForClass("tur-001")?.journeyId).toBe("jor-001");
  });
  it("preserva dias e durações variáveis", () => {
    const journey = getJourneyForClass("tur-003");
    expect(journey?.days.find((day) => day.day === "fri")?.declaredDuration).toBe("3h20");
    expect(new Set(journey?.days.map((day) => day.declaredDuration)).size).toBeGreaterThan(1);
  });
  it("representa sábado na EJA", () =>
    expect(getJourneyForClass("tur-004")?.days.some((day) => day.day === "sat")).toBe(true));
  it("não exige componente disciplinar em intervalos", () => {
    const interval = getScheduleForClass("tur-002")?.blocks.find(
      (item) => item.kind === "Intervalo",
    );
    expect(interval?.assignmentIds).toEqual([]);
  });
  it("mantém EI como campo de experiência", () =>
    expect(getScheduleForClass("tur-002")?.blocks[0]?.label).toContain("Campo de experiência"));
  it("mantém EJA organizada por fases", () =>
    expect(
      getScheduleForClass("tur-004")?.blocks.some((item) => item.label.includes("fases")),
    ).toBe(true));
  it("preserva corresponsabilidade como duas atuações", () =>
    expect(getScheduleForClass("tur-001")?.blocks[0]?.assignmentIds).toEqual([
      "atp-001",
      "atp-004",
    ]));
  it("preserva substituição temporária explicitamente", () =>
    expect(
      getScheduleForClass("tur-001")?.blocks.find((item) => item.id === "bl-007")?.assignmentIds,
    ).toEqual(["atp-010"]));
  it("preserva grade histórica", () =>
    expect(getScheduleForClass("tur-006")?.state).toBe("Histórica"));
  it("representa grade não iniciada sem inventar blocos", () =>
    expect(getScheduleForClass("tur-007")?.blocks).toEqual([]));
  it("cobre os cenários A a T", () =>
    expect(scheduleScenarios.map((item) => item[0]).join("")).toBe("ABCDEFGHIJKLMNOPQRST"));
  it("não contém referências estruturais contraditórias", () =>
    expect(scheduleConsistencyIssues()).toEqual([]));
  it("detecta conflito potencial considerando mais de uma unidade", () => {
    const conflicts = detectPotentialConflicts();
    expect(conflicts.some((item) => item.unitIds[0] !== item.unitIds[1])).toBe(true);
    expect(
      conflicts.every((item) => item.explanation.includes("não constitui infração automática")),
    ).toBe(true);
  });
  it("consolida horário apenas a partir de atuações explícitas", () => {
    const summary = professionalScheduleSummary("pro-001");
    expect(summary.entries.length).toBeGreaterThan(0);
    expect(summary.entries.every(({ block }) => block.assignmentIds.length > 0)).toBe(true);
  });
  it("distingue informação insuficiente", () =>
    expect(scheduleSituation(getScheduleForClass("tur-007"))).toBe("Informação insuficiente"));
  it("mantém versões e histórico separados dos blocos", () => {
    const schedule = scheduleVersions[0];
    expect(schedule?.label).toBe("Versão 2");
    expect(schedule?.history.length).toBeGreaterThan(1);
  });
  it("todas as jornadas declaram origem e vigência", () =>
    expect(schoolJourneys.every((item) => item.origin && item.effectiveFrom)).toBe(true));
});

describe("Horários 10A — rotas e consultas", () => {
  it("abre a página operacional", async () => {
    renderOperationalRoutes("/horarios");
    expect(await screen.findByRole("heading", { name: "Horários escolares" })).toBeInTheDocument();
    expect(screen.getByText("Conceitos independentes")).toBeInTheDocument();
  });
  it("lista grades por turma", async () => {
    renderOperationalRoutes("/horarios/turmas");
    expect(
      await screen.findByRole("heading", { name: "Grades semanais de turmas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Consulta de grades semanais por turma" }),
    ).toBeInTheDocument();
  });
  it("abre turma com jornada, grade e versão", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001");
    expect(
      await screen.findByRole("heading", { name: "Turma Aurora — 4º ano A" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Versões e alterações")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade semanal planejada")).toBeInTheDocument();
  });
  it("explicita ausência de grade", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-007");
    expect(await screen.findByText("Grade semanal não iniciada")).toBeInTheDocument();
  });
  it("lista horários individuais", async () => {
    renderOperationalRoutes("/horarios/profissionais");
    expect(
      await screen.findByRole("heading", { name: "Horários individuais de profissionais" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Consulta de horários individuais" }),
    ).toBeInTheDocument();
  });
  it("abre horário individual com minimização de dados", async () => {
    renderOperationalRoutes("/horarios/profissionais/pro-001");
    expect(await screen.findByText("Identidade profissional mínima")).toBeInTheDocument();
    expect(screen.queryByText(/CPF/i)).not.toBeInTheDocument();
    expect(screen.getByText(/cargas declaradas não foram convertidos/i)).toBeInTheDocument();
  });
  it("abre consulta da unidade", async () => {
    renderOperationalRoutes("/horarios/unidades/demo-001");
    expect(await screen.findByRole("heading", { name: /Escola Municipal/i })).toBeInTheDocument();
    expect(screen.getByText("Grades da unidade")).toBeInTheDocument();
  });
  it("gera visualização de impressão demonstrativa", async () => {
    renderOperationalRoutes("/horarios/turmas/tur-001/impressao");
    expect(await screen.findByText("Documento demonstrativo — não oficial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imprimir" })).toBeInTheDocument();
  });
  it("integra a turma à consulta de horários", async () => {
    renderOperationalRoutes("/turmas/tur-001");
    const header = await screen.findByRole("banner");
    expect(within(header).getByRole("link", { name: "Consultar horários" })).toHaveAttribute(
      "href",
      "/horarios/turmas/tur-001",
    );
  });
  it("integra o profissional à consulta individual", async () => {
    renderOperationalRoutes("/profissionais/pro-001");
    const header = await screen.findByRole("banner");
    expect(within(header).getByRole("link", { name: "Horários" })).toHaveAttribute(
      "href",
      "/horarios/profissionais/pro-001",
    );
  });
  it("integra a unidade à consulta de horários", async () => {
    renderOperationalRoutes("/unidades/demo-001");
    const header = await screen.findByRole("banner");
    expect(within(header).getByRole("link", { name: "Consultar horários" })).toHaveAttribute(
      "href",
      "/horarios/unidades/demo-001",
    );
  });
});
