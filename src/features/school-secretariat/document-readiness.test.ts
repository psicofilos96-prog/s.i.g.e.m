import { describe, expect, it } from "vitest";
import { batchPrint, documentReadiness } from "./document-readiness";

// Estado medido no banco em 2026-10-11: 2 tipos compostos, 0 matrizes, 0 atas, 0 encerramentos, 0 inícios declarados.
const real = { composable: ["declaracao-de-matricula", "declaracao-escolar"], matrices: 0, collegialMinutes: 0, closings: 0, enrollmentStartsDeclared: 0 };

describe("prontidão de documentos", () => {
  it("histórico bloqueia sem modelo, matriz e fechamento", () =>
    expect(documentReadiness("historico", real).blockers).toEqual(["modelo-nao-composto-pelo-banco", "matrices:sem-registro", "closings:sem-registro"]));
  it("declaração bloqueia sem início declarado", () =>
    expect(documentReadiness("declaracao-de-matricula", real).blockers).toEqual(["enrollmentStartsDeclared:sem-registro"]));
  it("fonte não lida não é zero", () =>
    expect(documentReadiness("ata", { ...real, collegialMinutes: null }).blockers).toContain("collegialMinutes:nao-lido"));
  it("declaração pronta com fonte", () => expect(documentReadiness("declaracao-escolar", { ...real, enrollmentStartsDeclared: 3 }).ready).toBe(true));
  it("lote não esconde recusados", () =>
    expect(batchPrint([{ id: "a", ready: true }, { id: "b", ready: false }])).toEqual({ printable: ["a"], refused: ["b"], total: 2 }));
});
