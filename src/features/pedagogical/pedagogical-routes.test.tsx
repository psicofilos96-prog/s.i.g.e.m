import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";
import {
  currentPedagogical,
  demonstrationPedagogicalAssignments,
  functionalTrajectoryWithPedagogical,
  getPedagogicalAssignment,
  historicalPedagogical,
  pedagogicalAssignmentsForClass,
  pedagogicalAssignmentsForLink,
  pedagogicalAssignmentsForProfessional,
  pedagogicalContext,
  pedagogicalWarnings,
  professionalsWithoutPedagogical,
} from "./pedagogical-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";

describe("Atuação Pedagógica — consulta geral", () => {
  it("apresenta a consulta operacional com colunas de contexto acadêmico", async () => {
    renderOperationalRoutes("/atuacoes-pedagogicas");
    expect(
      await screen.findByRole("heading", { name: "Atuações pedagógicas", level: 1 }),
    ).toBeInTheDocument();
    const grid = screen.getByRole("table", {
      name: /Consulta de atuações pedagógicas fictícias/i,
    });
    for (const header of [
      "Profissional",
      "Vínculo contextual",
      "Unidade",
      "Período letivo",
      "Turma / contexto pedagógico",
      "Componente ou campo",
      "Papel na atuação",
      "Vigência",
      "Situação temporal",
    ])
      expect(within(grid).getByText(header)).toBeInTheDocument();
  });

  it("permite pesquisar por turma reduzindo os resultados", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderOperationalRoutes("/atuacoes-pedagogicas");
    const grid = await screen.findByRole("table", {
      name: /Consulta de atuações pedagógicas fictícias/i,
    });
    const initialRows = within(grid).getAllByRole("row").length;
    const search = screen.getByRole("textbox", { name: /Pesquisar atuações pedagógicas/i });
    await user.type(search, "EJA Fases II");
    const filtered = await screen.findByRole("table", {
      name: /Consulta de atuações pedagógicas fictícias/i,
    });
    expect(within(filtered).getAllByRole("row").length).toBeLessThan(initialRows);
  });

  it("aplica minimização de dados na consulta", async () => {
    renderOperationalRoutes("/atuacoes-pedagogicas");
    expect(await screen.findByText(/Minimização de dados/i)).toBeInTheDocument();
    expect(screen.queryByText(/CPF:/i)).not.toBeInTheDocument();
  });

  it("explicita que período letivo não é ano civil nem período avaliativo", async () => {
    renderOperationalRoutes("/atuacoes-pedagogicas");
    expect(
      await screen.findByText(/não se confunde com ano civil nem com período avaliativo/i),
    ).toBeInTheDocument();
  });
});

describe("Atuação Pedagógica — consulta por profissional", () => {
  it("separa atuações vigentes e históricas com rótulo textual", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes");
    expect(
      await screen.findByRole("heading", { name: /Atuações pedagógicas do profissional/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Atuações pedagógicas vigentes/i })).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: /Atuações pedagógicas históricas/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ATUAL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HISTÓRICO").length).toBeGreaterThan(0);
  });

  it("exige Pessoa, Profissional e Vínculo existentes", async () => {
    renderOperationalRoutes("/profissionais/pro-inexistente/atuacoes");
    expect(await screen.findByText("Profissional não encontrado")).toBeInTheDocument();
    expect(
      screen.getByText(/depende de Pessoa, Profissional e Vínculo Funcional existentes/i),
    ).toBeInTheDocument();
  });

  it("mostra múltiplas turmas do mesmo profissional no mesmo período letivo", () => {
    const records = currentPedagogical(pedagogicalAssignmentsForProfessional("pro-006"));
    const classes = new Set(records.map((record) => record.classId));
    expect(classes.size).toBeGreaterThan(1);
  });

  it("mantém múltiplos vínculos distintos nas atuações", async () => {
    renderOperationalRoutes("/profissionais/pro-008/atuacoes");
    expect(
      await screen.findByRole("list", { name: /Vínculos funcionais do profissional/i }),
    ).toBeInTheDocument();
    expect(pedagogicalAssignmentsForLink("vf-008")).toHaveLength(1);
    expect(pedagogicalAssignmentsForLink("vf-008-b")).toHaveLength(1);
  });

  it("apresenta a trajetória funcional distinguindo vínculo, lotação, função e atuação", async () => {
    renderOperationalRoutes("/profissionais/pro-001/atuacoes");
    const trajectory = await screen.findByRole("list", {
      name: /Trajetória funcional com atuações pedagógicas/i,
    });
    expect(within(trajectory).getAllByText("Vínculo funcional").length).toBeGreaterThan(0);
    expect(within(trajectory).getAllByText("Lotação").length).toBeGreaterThan(0);
    expect(within(trajectory).getAllByText("Função").length).toBeGreaterThan(0);
    expect(within(trajectory).getAllByText("Atuação pedagógica").length).toBeGreaterThan(0);
  });

  it("prepara os elementos da autorização contextual futura", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes");
    const list = await screen.findByRole("list", {
      name: /Elementos da autorização contextual futura/i,
    });
    for (const item of ["Vínculo funcional", "Turma", "Papel na atuação", "Capacidade específica"])
      expect(within(list).getByText(item)).toBeInTheDocument();
    expect(
      screen.getByText(/não concede acesso a todos os diários/i),
    ).toBeInTheDocument();
  });
});

describe("Atuação Pedagógica — consulta por turma", () => {
  it("apresenta os profissionais relacionados à turma com vínculo, papel e intervalo", async () => {
    renderOperationalRoutes("/turmas/tur-001");
    const panel = await screen.findByRole("list", {
      name: /Atuações pedagógicas nesta turma/i,
    });
    expect(within(panel).getAllByText(/Vínculo funcional VF-DEMO/i).length).toBeGreaterThan(0);
    expect(within(panel).getByText("Responsável principal")).toBeInTheDocument();
    expect(within(panel).getByText("Corresponsável")).toBeInTheDocument();
  });

  it("admite mais de um profissional na mesma turma e no mesmo componente", () => {
    const records = pedagogicalAssignmentsForClass("tur-001");
    expect(records.length).toBeGreaterThan(1);
    const sameField = records.filter(
      (record) => record.field === "Componente curricular demonstrativo — Linguagens",
    );
    expect(sameField.length).toBeGreaterThan(1);
    expect(new Set(sameField.map((record) => record.role)).size).toBeGreaterThan(1);
  });

  it("não cria cópias independentes: turma e profissional leem o mesmo registro", () => {
    const record = pedagogicalAssignmentsForClass("tur-001")[0]!;
    expect(pedagogicalAssignmentsForProfessional(record.professionalId)).toContain(record);
    expect(getPedagogicalAssignment(record.id)).toBe(record);
  });

  it("informa quando a turma não possui atuação registrada", async () => {
    renderOperationalRoutes("/turmas/tur-008");
    expect(
      await screen.findByText(/Nenhuma atuação pedagógica registrada nesta turma/i),
    ).toBeInTheDocument();
  });
});

describe("Atuação Pedagógica — detalhe", () => {
  it("mostra vínculo, cargo contextual, lotação, turma, componente, papel e vigência", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes/atp-001");
    expect(await screen.findByText("Vínculo funcional")).toBeInTheDocument();
    expect(screen.getByText("Cargo contextual")).toBeInTheDocument();
    expect(screen.getByText("Lotação relacionada")).toBeInTheDocument();
    expect(screen.getByText("Turma")).toBeInTheDocument();
    expect(screen.getByText("Componente ou campo")).toBeInTheDocument();
    expect(screen.getByText("Papel na atuação")).toBeInTheDocument();
    expect(screen.getByText("Situação temporal")).toBeInTheDocument();
  });

  it("representa substituição temporária sem encerrar a atuação original", async () => {
    renderOperationalRoutes("/profissionais/pro-009/atuacoes/atp-010");
    expect(await screen.findByText("Atuação substituída")).toBeInTheDocument();
    expect(
      screen.getByText(/não encerra automaticamente a atuação do profissional original/i),
    ).toBeInTheDocument();
    expect(getPedagogicalAssignment("atp-001")?.status).toBe("Atual");
  });

  it("representa corresponsabilidade no mesmo componente", async () => {
    renderOperationalRoutes("/profissionais/pro-001/atuacoes/atp-004");
    expect(await screen.findByText("Corresponsabilidade")).toBeInTheDocument();
  });

  it("registra contexto de Educação Infantil sem disciplina convencional", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes/atp-002");
    expect(await screen.findByText(/Campo de experiência/i)).toBeInTheDocument();
    expect(screen.queryByText(/Componente curricular:/i)).not.toBeInTheDocument();
  });

  it("registra contexto de EJA por fases", async () => {
    renderOperationalRoutes("/profissionais/pro-008/atuacoes/atp-007");
    expect(await screen.findByText(/Fase/i)).toBeInTheDocument();
    expect(screen.getByText(/Campo pedagógico/i)).toBeInTheDocument();
  });

  it("não exige série única em turma multietapa", async () => {
    renderOperationalRoutes("/profissionais/pro-004/atuacoes/atp-009");
    expect(await screen.findByText(/Nenhuma série única é exigida/i)).toBeInTheDocument();
  });

  it("sinaliza divergência entre unidade da atuação e lotação conhecida", async () => {
    renderOperationalRoutes("/profissionais/pro-003/atuacoes/atp-006");
    expect(
      await screen.findByText("Compatibilidade entre atuação e lotação requer validação."),
    ).toBeInTheDocument();
  });

  it("recusa atuação que não pertence ao profissional informado", async () => {
    renderOperationalRoutes("/profissionais/pro-001/atuacoes/atp-001");
    expect(await screen.findByText("Atuação pedagógica não encontrada")).toBeInTheDocument();
  });

  it("prepara as operações da Etapa 9E2 como área futura", async () => {
    renderOperationalRoutes("/profissionais/pro-006/atuacoes/atp-001");
    const future = await screen.findByRole("button", {
      name: /Registrar, editar, encerrar ou substituir — Etapa 9E2/i,
    });
    expect(future).toBeDisabled();
  });
});

describe("Atuação Pedagógica — invariantes conceituais", () => {
  it("toda atuação referencia um vínculo funcional existente do profissional", () => {
    for (const record of demonstrationPedagogicalAssignments) {
      const professional = getDemonstrationProfessional(record.professionalId);
      expect(professional).toBeDefined();
      expect(professional?.links.some((link) => link.id === record.linkId)).toBe(true);
    }
  });

  it("lotação não gera atuação pedagógica automaticamente", () => {
    const withoutActivity = professionalsWithoutPedagogical();
    expect(withoutActivity.length).toBeGreaterThan(0);
    expect(
      withoutActivity.every((professional) =>
        professional.links.some((link) => link.allocations.length > 0),
      ),
    ).toBe(true);
  });

  it("função administrativa não gera atuação docente automaticamente", () => {
    const record = getPedagogicalAssignment("atp-004")!;
    const { link } = pedagogicalContext(record);
    expect(link?.functions.some((assignment) => assignment.status === "Atual")).toBe(true);
    expect(record.role).not.toBe("Responsável principal");
    expect(pedagogicalWarnings(record).some((warning) => warning.level === "informativo")).toBe(
      true,
    );
  });

  it("um profissional pode atuar em duas unidades pelo mesmo vínculo", () => {
    const records = pedagogicalAssignmentsForProfessional("pro-003");
    const units = new Set(records.map((record) => pedagogicalContext(record).unitName));
    expect(units.size).toBe(2);
    expect(new Set(records.map((record) => record.linkId)).size).toBe(1);
  });

  it("papéis pedagógicos são distinguíveis", () => {
    const roles = new Set(demonstrationPedagogicalAssignments.map((record) => record.role));
    expect(roles.size).toBeGreaterThanOrEqual(4);
  });

  it("vigência própria e histórico preservado", () => {
    const historical = historicalPedagogical(demonstrationPedagogicalAssignments);
    expect(historical.length).toBeGreaterThan(0);
    expect(historical.every((record) => Boolean(record.end))).toBe(true);
  });

  it("período letivo da atuação vem do contexto da turma", () => {
    const record = getPedagogicalAssignment("atp-003")!;
    expect(pedagogicalContext(record).periodLabel).toMatch(/2025/);
  });

  it("a trajetória não apresenta logs técnicos", () => {
    const professional = getDemonstrationProfessional("pro-006")!;
    const trajectory = functionalTrajectoryWithPedagogical(professional);
    expect(trajectory.length).toBeGreaterThan(0);
    for (const period of trajectory)
      for (const entry of period.entries) expect(entry.text).not.toMatch(/atp-|vf-|lot-|pro-/);
  });
});
