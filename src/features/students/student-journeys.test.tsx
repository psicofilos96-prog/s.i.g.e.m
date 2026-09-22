import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Testes de integridade da trajetória escolar (Jornadas A-H).
 * Verifica se cada cenário está devidamente representado nos fixtures e acessível na UI.
 */
describe("Trajetória Escolar — Jornadas A a H", () => {
  it("Jornada A: Trajetória simples e contínua", async () => {
    renderOperationalRoutes("/alunos/alu-001");
    expect(
      await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Um", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ativo com alocação").length).toBeGreaterThan(0);
  });

  it("Jornada B: Vários vínculos letivos, uma única matrícula escolar", async () => {
    renderOperationalRoutes("/alunos/alu-002");
    expect(
      await screen.findByRole("heading", { name: "Aluno Fictício Demonstrativo Dois", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/ME-DEMO-1002/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Período letivo/i).length).toBeGreaterThan(1);
  });

  it("Jornada C: Transferência entre escolas, origem preservada", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-003");
    expect(
      await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Três", level: 1 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Trajetória escolar/i }));
    expect(await screen.findByText(/Nova matrícula escolar no destino/i)).toBeInTheDocument();
    expect(screen.getByText(/Ingresso na escola de origem/i)).toBeInTheDocument();
  });

  it("Jornada D: Saída e retorno à mesma escola", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-004");
    expect(
      await screen.findByRole("heading", {
        name: "Aluno Fictício Demonstrativo Quatro",
        level: 1,
      }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("tab", { name: /Trajetória escolar/i }));
    expect(await screen.findByText(/Retorno à mesma escola/i)).toBeInTheDocument();
  });

  it("Jornada E: Mudança de turma preservando a anterior", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-005");
    expect(
      await screen.findByRole("heading", {
        name: "Aluna Fictícia Demonstrativa Cinco",
        level: 1,
      }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("tab", { name: /Trajetória escolar/i }));
    expect(
      await screen.findByText(/Mudança para a turma demonstrativa 3º ano B/i),
    ).toBeInTheDocument();
  });

  it("Jornada F: Participação regular + AEE coexistindo", async () => {
    renderOperationalRoutes("/alunos/alu-006");
    expect(
      await screen.findByRole("heading", { name: "Aluno Fictício Demonstrativo Seis", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Atendimento educacional especializado \(AEE\)/i).length,
    ).toBeGreaterThan(0);
  });

  it("Jornada G: Histórico sem participação atual", async () => {
    renderOperationalRoutes("/alunos/alu-007");
    expect(
      await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Sete", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Sem participação atual/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Aluno sem participação atual: a trajetória permanece consultável/i),
    ).toBeInTheDocument();
  });

  it("Jornada H: Múltiplas participações em unidades diferentes", async () => {
    const user = userEvent.setup();
    renderOperationalRoutes("/alunos/alu-003");
    expect(
      await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Três", level: 1 }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("tab", { name: /Trajetória escolar/i }));
    expect(screen.getAllByText(/Escola Demonstrativa Águas Claras/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Núcleo Educacional Demonstrativo Ponte/i).length).toBeGreaterThan(0);
  });
});
