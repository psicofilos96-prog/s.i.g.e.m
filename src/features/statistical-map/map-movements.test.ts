import { describe, expect, it } from "vitest";
import { classifyMovements, reconcileIIxIV, structureIVCells, type MovementEvent } from "./map-movements";
import { structureOf, renderMapDocument } from "./map-structures";

const W = { from: "2026-05-01", to: "2026-05-31" };
const ev = (p: Partial<MovementEvent>): MovementEvent => ({ id: "x", studentId: "s", effectiveOn: "2026-05-10", source: "student_movement_events", movementTypeId: null, endingReason: null, origin: null, destination: null, stage: null, ...p });
const rule = { recebidos: ["t-rec"], transferidos: ["t-tra"], evadidos: ["t-eva"], cancelados: ["t-can"], remanejamentoTypeIds: ["t-rem"] };

describe("Estrutura IV — cinco grupos", () => {
  it("remanejamento interno de turma cai só em Remanejados", () => {
    const c = classifyMovements([ev({ id: "e1", source: "class_enrollment_episode_endings", endingReason: "remanejamento", origin: "1º A", destination: "1º B" })], rule, W);
    expect(c.byGroup.remanejados).toHaveLength(1);
    expect(c.byGroup.transferidos).toHaveLength(0);
  });
  it("encerramento comum não é movimentação", () => {
    expect(classifyMovements([ev({ source: "class_enrollment_episode_endings", endingReason: "fim-do-ano" })], rule, W).byGroup.remanejados).toHaveLength(0);
  });
  it("mesmo evento nunca em dois grupos", () => {
    const c = classifyMovements([ev({ movementTypeId: "dup" })], { recebidos: ["dup"], transferidos: ["dup"] }, W);
    expect(c.conflicts).toHaveLength(1);
    expect(Object.values(c.byGroup).flat()).toHaveLength(0);
  });
  it("sem regra o grupo é sem-regra, nunca zero; Remanejados sempre existe", () => {
    const cells = structureIVCells([], null, W);
    expect(cells.map((x) => x.cellId)).toEqual(["iv-recebidos", "iv-transferidos", "iv-evadidos", "iv-cancelados", "iv-remanejados"]);
    expect(cells[0]!.state).toBe("sem-regra"); expect(cells[0]!.value).toBeNull();
    expect(cells[4]!.value).toBe(0);
  });
  it("remanejamento entre unidades: encerramento + movimento do mesmo aluno/dia contam uma vez", () => {
    const cells = structureIVCells([ev({ id: "m", movementTypeId: "t-rem", origin: "A", destination: "B" }), ev({ id: "e", source: "class_enrollment_episode_endings", endingReason: "remanejamento" })], rule, W);
    expect(cells.find((x) => x.cellId === "iv-remanejados")!.value).toBe(1);
  });
  it("fora da competência não entra", () => {
    expect(classifyMovements([ev({ movementTypeId: "t-rec", effectiveOn: "2026-04-30" })], rule, W).byGroup.recebidos).toHaveLength(0);
  });
  it("células de IV caem na estrutura IV", () => { expect(structureOf({ cellId: "iv-remanejados", sectionId: "entrada-saida" })).toBe("IV"); });
});

describe("reconciliação II × IV", () => {
  const iv = structureIVCells([ev({ id: "1", movementTypeId: "t-rec" }), ev({ id: "2", movementTypeId: "t-tra" }), ev({ id: "3", movementTypeId: "t-rem", origin: "A", destination: "B" })], rule, W);
  const rem = [ev({ id: "3", movementTypeId: "t-rem", origin: "A", destination: "B" })];
  it("remanejamento interno não altera o total (sem dupla contagem)", () => {
    const internal = [ev({ origin: "1A", destination: "1B" })];
    expect(reconcileIIxIV({ previous: 100, current: 100, iv, schoolId: "A", remanejados: internal }).state).toBe("reconciliado");
  });
  it("entre unidades: origem perde, destino ganha pela alocação", () => {
    expect(reconcileIIxIV({ previous: 100, current: 99, iv, schoolId: "A", remanejados: rem }).state).toBe("reconciliado");
    expect(reconcileIIxIV({ previous: 100, current: 101, iv, schoolId: "B", remanejados: rem }).state).toBe("reconciliado");
  });
  it("divergência é mostrada", () => {
    expect(reconcileIIxIV({ previous: 100, current: 90, iv, schoolId: "C", remanejados: [] })).toMatchObject({ state: "divergente", difference: -10 });
  });
  it("sem competência anterior é indeterminado", () => {
    expect(reconcileIIxIV({ previous: null, current: 90, iv, schoolId: "C", remanejados: [] }).state).toBe("indeterminado");
  });
});

describe("PDF", () => {
  it("documento traz I–VI e Remanejados com override discreto", () => {
    const cells = structureIVCells([], rule, W).map((c) => c.cellId === "iv-remanejados" ? { ...c, value: 2, adjustment: { calculated: 0, adjusted: 2, reason: "correção CIECE", actorSide: "estatistica", recordedAt: "2026-06-01" } as never } : c);
    const html = renderMapDocument({ snapshot: { schemaVersion: 1, competence: { schoolId: "A", year: 2026, month: 5, key: "2026-05", window: W }, snapshotDate: "2026-05-29", rule: { id: "r", version: 1 }, cells, declarations: { observations: "", observationsEventId: null } },
      schoolName: "Escola A", statusLabel: "Aprovado", revision: 1, headerLines: ["SEMED"], signatures: ["Secretaria", "CIECE"], generatedAt: "2026-06-01" } as never);
    for (const s of ["I —", "II —", "III —", "IV —", "V —", "VI —", "5. Remanejados", "Calculado pelo SIGEM: 0", "correção CIECE"]) expect(html).toContain(s);
    expect(html).not.toMatch(/<button|<nav/);
  });
});
