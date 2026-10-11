import { describe, it, expect } from "vitest";
import { projectFinalSheet, resultMinutes } from "./final-sheet";

describe("LOTE 12 — Folha Final sem avaliações", () => {
  it("turma sem componente avaliado fica PENDENTE e não pode ser homologada", () => {
    const sheet = projectFinalSheet({
      modality: "fundamental-anos-finais", periods: [], components: [], cells: {},
      students: [{ id: "s1", name: "Sintético", status: "Ativo" }] as never,
      rule: { id: "r", label: "r", sourceRef: "t", passMark: 50, minAttendance: 0.75 } as never,
    } as never);
    expect(sheet.rows[0]!.overall).toBe("PENDENTE");
    expect(resultMinutes(sheet.rows).canClose).toBe(false);
  });
});
