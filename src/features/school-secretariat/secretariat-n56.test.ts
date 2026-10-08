import { describe, expect, it } from "vitest";
import { decisionLabel, issueLabel, lifeKindLabel, movementTypeLabel } from "./secretariat";

describe("N5.6 — Secretaria nunca mostra código cru", () => {
  it("decisão de renovação tem nome; desconhecida fica explícita", () => {
    expect(decisionLabel("renovou")).toBe("Renovou");
    expect(decisionLabel("nao-renovou")).toBe("Não renovou");
    expect(decisionLabel("x-novo")).toBe("Situação não reconhecida");
  });
  it("tipo de movimentação vem do catálogo homologado", () => {
    expect(movementTypeLabel("mov-1", [{ id: "mov-1", label: "Transferência para outra rede" }])).toBe("Transferência para outra rede");
    expect(movementTypeLabel("mov-2", [])).toBe("Situação não reconhecida");
  });
  it("pendência e evento desconhecidos não mostram o código", () => {
    expect(issueLabel("sem-turma-vigente")).toBe("Vínculo ativo sem turma vigente");
    expect(issueLabel("codigo-x")).toBe("Situação não reconhecida");
    expect(lifeKindLabel("codigo-y")).toBe("Situação não reconhecida");
  });
});
