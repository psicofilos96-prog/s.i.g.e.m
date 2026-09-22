import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderOperationalRoutes } from "@/test/router-harness";

/**
 * Testes de integridade da trajetória escolar (Jornadas A-H).
 * Verifica se cada cenário está devidamente representado nos fixtures e acessível na UI.
 */
describe("Trajetória Escolar — Jornadas A a H", () => {
  it("Jornada A: Trajetória simples e contínua", async () => {
    renderOperationalRoutes("/alunos/alu-001");
    expect(await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Um", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Ativo com alocação")).toBeInTheDocument();
  });

  it("Jornada B: Vários vínculos letivos, uma única matrícula escolar", async () => {
    renderOperationalRoutes("/alunos/alu-002");
    expect(await screen.findByRole("heading", { name: "Aluno Fictício Demonstrativo Dois", level: 1 })).toBeInTheDocument();
    const section = screen.getByRole("region", { name: /Matrículas escolares e vínculos letivos/i });
    expect(within(section).getByText(/ME-DEMO-1002/i)).toBeInTheDocument();
    expect(within(section).getAllByText(/Período letivo/i).length).toBeGreaterThan(1);
  });

  it("Jornada C: Transferência entre escolas, origem preservada", async () => {
    renderOperationalRoutes("/alunos/alu-003");
    expect(await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Três", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Trajetória escolar/i })).toBeInTheDocument();
  });

  it("Jornada D: Saída e retorno à mesma escola", async () => {
    renderOperationalRoutes("/alunos/alu-004");
    expect(await screen.findByRole("heading", { name: "Aluno Fictício Demonstrativo Quatro", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Retorno à mesma escola/i)).toBeInTheDocument();
  });

  it("Jornada E: Mudança de turma preservando a anterior", async () => {
    renderOperationalRoutes("/alunos/alu-005");
    expect(await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Cinco", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Mudança para a turma demonstrativa 3º ano B/i)).toBeInTheDocument();
  });

  it("Jornada F: Participação regular + AEE coexistindo", async () => {
    renderOperationalRoutes("/alunos/alu-006");
    expect(await screen.findByRole("heading", { name: "Aluno Fictício Demonstrativo Seis", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Atendimento educacional especializado \(AEE\)/i)).toBeInTheDocument();
  });

  it("Jornada G: Histórico sem participação atual", async () => {
    renderOperationalRoutes("/alunos/alu-007");
    expect(await screen.findByRole("heading", { name: "Aluna Fictícia Demonstrativa Sete", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Sem participação atual/i)).toBeInTheDocument();
    expect(screen.getByText(/Aluno sem participação atual/i)).toBeInTheDocument();
  });

  it("Jornada H: Múltiplas participações em unidades diferentes", async () => {
    renderOperationalRoutes("/alunos/alu-008");
    expect(await screen.findByRole("heading", { name: "Aluno Fictício Demonstrativo Oito", level: 1 })).toBeInTheDocument();
    const section = screen.getByRole("region", { name: /Matrículas escolares e vínculos letivos/i });
    expect(within(section).getByText(/Instituição Educacional Demonstrativa Horizonte/i)).toBeInTheDocument();
    expect(within(section).getByText(/Núcleo Educacional Demonstrativo Ponte/i)).toBeInTheDocument();
  });
});
