import { describe, expect, it } from "vitest";
import { stationAllowsPath } from "./station-navigation";

describe("BQ.1 Lote 2 — isolamento de navegação por estação", () => {
  it("Supervisão não abre Secretaria, Alunos nem Central de acessos", () => {
    expect(stationAllowsPath("supervisao", "/supervisao-escolar")).toBe(true);
    expect(stationAllowsPath("supervisao", "/secretaria")).toBe(false);
    expect(stationAllowsPath("supervisao", "/alunos")).toBe(false);
    expect(stationAllowsPath("supervisao", "/central-de-acessos")).toBe(false);
  });
  it("Secretaria abre alunos (inclusive subrotas), não abre CIECE nem Alimentação", () => {
    expect(stationAllowsPath("secretaria_escolar", "/alunos/abc")).toBe(true);
    expect(stationAllowsPath("secretaria_escolar", "/ciece")).toBe(false);
    expect(stationAllowsPath("secretaria_escolar", "/alimentacao-escolar")).toBe(false);
  });
  it("nenhuma estação setorial abre administração geral ou estação administrativa", () => {
    for (const s of ["ciece", "supervisao", "alimentacao", "avaliacao", "secretaria_escolar", "direcao_escolar", "orientacao_pedagogica"]) {
      expect(stationAllowsPath(s, "/administracao-geral")).toBe(false);
      expect(stationAllowsPath(s, "/estacao-administrativa")).toBe(false);
      expect(stationAllowsPath(s, "/central-de-acessos")).toBe(false);
    }
  });
  it("estação desconhecida recusa tudo, inclusive a página inicial", () => {
    expect(stationAllowsPath("administracao_geral", "/")).toBe(false);
    expect(stationAllowsPath("x", "/")).toBe(false);
  });
  it("prefixo parecido não vaza (/alunosx não é /alunos)", () => {
    expect(stationAllowsPath("orientacao_pedagogica", "/alunosx")).toBe(false);
  });
});
