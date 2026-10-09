import { describe, expect, it } from "vitest";
import { requiresSessionBeforeRead } from "./session-read-gate";

describe("PERF.LOADING.1 — portão de sessão antes da leitura", () => {
  it("as 8 rotas que liam antes da sessão exigem sessão", () => {
    for (const r of ["/administracao", "/central-de-integracoes", "/estacao-administrativa", "/infraestrutura", "/integracoes", "/revisao-de-anomalias", "/tarefas", "/transporte-escolar/"])
      expect(requiresSessionBeforeRead(r)).toBe(true);
  });
  it("não confunde prefixos parecidos", () => {
    expect(requiresSessionBeforeRead("/administracao-geral")).toBe(false);
    expect(requiresSessionBeforeRead("/")).toBe(false);
  });
});
