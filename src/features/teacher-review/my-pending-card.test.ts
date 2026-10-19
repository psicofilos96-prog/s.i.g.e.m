import { describe, expect, it } from "vitest";
import { pendingLines } from "./my-pending-card";

describe("pendências do docente com a OP", () => {
  it("ajuste pedido aparece antes e conta singular/plural", () => {
    expect(pendingLines([{ subject_kind: "plano", em_analise: 2, ajuste_solicitado: 1 }])).toEqual([
      "1 plano com ajuste pedido pela Orientação",
      "2 planos aguardando a Orientação",
    ]);
  });
  it("sem pendência não gera aviso", () => {
    expect(pendingLines([{ subject_kind: "instrumento", em_analise: 0, ajuste_solicitado: 0 }])).toEqual([]);
  });
});
