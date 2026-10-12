import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { AA_TRACE, canAAWrite, classifyAssessment, roleGrants, traceSummary } from "./aa-architecture";

describe("A&A Lote 01 arquitetura", () => {
  it("toda tela citada existe como rota", () => {
    const map: Record<string, string> = { "/acompanhamento-avaliacao": "acompanhamento-avaliacao.tsx", "/referencias-curriculares": "referencias-curriculares.tsx", "/avaliacao-desempenho": "avaliacao-desempenho.tsx", "/acompanhamento-planejamento": "acompanhamento-planejamento.tsx", "/avaliacoes-do-professor": "avaliacoes-do-professor.tsx", "/diario": "diario.tsx" };
    for (const a of AA_TRACE) if (a.screen) expect(existsSync(`src/routes/${map[a.screen] ?? "x"}`) || existsSync(`src/routes${a.screen}`), a.screen).toBe(true);
  });
  it("setor não grava Diário, notas, matrícula nem currículo", () => {
    for (const id of ["diario-notas", "matriculas", "correlacao", "sia", "sipe"]) expect(canAAWrite(id).ok).toBe(false);
    expect(canAAWrite("externas").ok).toBe(true);
  });
  it("institucional × cotidiana nunca se misturam", () => {
    expect(classifyAssessment({ programId: "p", editionId: "e" })).toBe("institucional");
    expect(classifyAssessment({ teacherAssignmentId: "r" })).toBe("cotidiana-docente");
    expect(classifyAssessment({ programId: "p", editionId: "e", teacherAssignmentId: "r" })).toEqual({ refused: "ambigua:programa-e-regencia" });
    expect(classifyAssessment({})).toEqual({ refused: "sem-origem" });
  });
  it("papéis não concedem nada sem política homologada", () => {
    expect(roleGrants("coordenacao", false)).toEqual([]);
    expect(roleGrants("aplicador", true)).toEqual(["aplicar-avaliacao-institucional"]);
    expect(traceSummary().entregue).toBeGreaterThan(0);
  });
});
