import { describe, expect, it } from "vitest";
import { cellKey, projectFinalSheet, resultMinutes, type SheetInput } from "./final-sheet";

const base = (over: Partial<SheetInput> = {}): SheetInput => ({
  modality: "fundamental-anos-finais",
  periods: ["1º PL", "2º PL", "3º PL"],
  components: [{ id: "lp", label: "Língua Portuguesa" }],
  students: [{ id: "a", name: "Sintético A", status: "Ativo" }],
  cells: { [cellKey("a", "lp")]: { periodGrades: [60, 50, 40], finalRecovery: null, lessonsGiven: 100, absences: 10 } },
  ...over,
});

describe("Folha Final (modelos da rede)", () => {
  it("média 50 aprova", () => {
    const r = projectFinalSheet(base()).rows[0]!;
    expect(r.components[0]!.average).toBe(50);
    expect(r.overall).toBe("APROVADO");
  });
  it("nota ausente deixa PENDENTE e bloqueia fechamento, nunca vira zero", () => {
    const s = projectFinalSheet(base({ cells: { [cellKey("a", "lp")]: { periodGrades: [60, null, 40], finalRecovery: null, lessonsGiven: 100, absences: 0 } } }));
    expect(s.rows[0]!.overall).toBe("PENDENTE");
    expect(resultMinutes(s.rows).canClose).toBe(false);
  });
  it("nota zero é nota: reprova sem recuperação, recuperação final ≥ 50 aprova", () => {
    const z = projectFinalSheet(base({ cells: { [cellKey("a", "lp")]: { periodGrades: [0, 0, 0], finalRecovery: null, lessonsGiven: 100, absences: 0 } } }));
    expect(z.rows[0]!.overall).toBe("REPROVADO");
    const rf = projectFinalSheet(base({ cells: { [cellKey("a", "lp")]: { periodGrades: [0, 0, 0], finalRecovery: 50, lessonsGiven: 100, absences: 0 } } }));
    expect(rf.rows[0]!.overall).toBe("APROVADO");
  });
  it("transferido no meio do período recebe sigla, não resultado", () => {
    const s = projectFinalSheet(base({ students: [{ id: "a", name: "A", status: "Transferido" }] }));
    expect(s.rows[0]!.overall).toBe("TRANSFERIDO");
  });
  it("EJA reprova com frequência abaixo de 75% mesmo com notas", () => {
    const s = projectFinalSheet(base({ modality: "eja", periods: ["1º B", "2º B"], cells: { [cellKey("a", "lp")]: { periodGrades: [80, 80], finalRecovery: null, lessonsGiven: 100, absences: 30 } } }));
    expect(s.rows[0]!.overall).toBe("REPROVADO");
  });
  it("Educação Infantil é bloqueada para nota", () => {
    expect(projectFinalSheet(base({ modality: "educacao-infantil" })).blocked).toMatch(/parecer/);
  });
});
