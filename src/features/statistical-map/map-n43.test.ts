import { describe, expect, it } from "vitest";
import { applyCellAdjustments, mediationCell, type MapAdjustmentRow, type MapCell } from "./map-domain";
import { originBadge, projectWorkflow, renderMapDocument } from "./map-structures";

const cell = (cellId: string, over: Partial<MapCell> = {}): MapCell => ({ cellId, sectionId: "turmas", label: cellId, origin: "automatico", state: "disponivel", value: 10, unit: null, reference: null, source: null, recordRefs: [], ruleRef: null, coverage: null, notes: [], ...over });
const adj = (o: Partial<MapAdjustmentRow>): MapAdjustmentRow => ({ id: "a1", cellId: "turmas", supersedesId: null, kind: "ajuste", calculatedValue: 10, adjustedValue: 12, reason: "erro de lançamento", actorSide: "escola", recordedAt: "2027-03-01T10:00:00Z", ...o });

describe("N4.3 — devolução própria", () => {
  it("enviado → devolvido (motivo) → reenviado → aprovado", () => {
    const ev = [{ kind: "conferencia", at: "1" }, { kind: "devolucao", at: "2", reason: "turma faltando" }];
    expect(projectWorkflow(true, ev, 0)).toMatchObject({ stage: "devolvido", returnReason: "turma faltando" });
    expect(projectWorkflow(true, [...ev, { kind: "conferencia", at: "3" }], 0).stage).toBe("reenviado");
    expect(projectWorkflow(true, [...ev, { kind: "conferencia", at: "3" }, { kind: "oficializacao", at: "4" }], 1).stage).toBe("aprovado");
  });
  it("aprovado nunca é rebaixado para devolvido", () => {
    const ev = [{ kind: "conferencia", at: "1" }, { kind: "oficializacao", at: "2" }, { kind: "devolucao", at: "3", reason: "x" }];
    expect(projectWorkflow(true, ev, 1).stage).toBe("aprovado");
  });
});

describe("N4.3 — ajustes", () => {
  it("efetivo = ajustado; calculado preservado; rótulo da escola", () => {
    const [c] = applyCellAdjustments([cell("turmas")], [adj({})], ["turmas"]);
    expect(c!.value).toBe(12);
    expect(c!.adjustment).toMatchObject({ calculated: 10, adjusted: 12, side: "escola" });
    expect(originBadge(c!)).toBe("Ajustado pela escola");
  });
  it("célula não declarada ajustável ignora ajuste", () => {
    expect(applyCellAdjustments([cell("turmas")], [adj({})], [])[0]!.value).toBe(10);
  });
  it("anulação é novo fato e volta ao calculado", () => {
    const rows = [adj({}), adj({ id: "a2", supersedesId: "a1", kind: "anulacao", adjustedValue: null })];
    const [c] = applyCellAdjustments([cell("turmas")], rows, ["turmas"]);
    expect(c!.value).toBe(10);
    expect(c!.adjustment).toBeUndefined();
  });
  it("ajuste pela Estatística tem rótulo próprio e o PDF mostra calculado e motivo", () => {
    const [c] = applyCellAdjustments([cell("turmas")], [adj({ actorSide: "estatistica" })], ["turmas"]);
    expect(originBadge(c!)).toBe("Ajustado pela Estatística (CIECE)");
    const snap = { schemaVersion: 1, competence: { schoolId: "s", year: 2027, month: 3, key: "2027-03", window: { from: "2027-03-01", to: "2027-03-31" } }, snapshotDate: "2027-03-31", rule: { id: "r", version: 1 }, cells: [c!], declarations: { observations: "", observationsEventId: null } } as never;
    const html = renderMapDocument({ headerLines: [], schoolName: "A", snapshot: snap, statusLabel: "Aprovado", revision: 1, signatures: [], generatedAt: "x" });
    expect(html).toContain("Calculado pelo SIGEM: 10");
    expect(html).toContain("Motivo: erro de lançamento");
  });
});

describe("N4.3 — mediadores (Estrutura V)", () => {
  const row = { assignmentLogicalId: "l1", assignmentVersion: 1, mediatorEngagementId: "e1", studentRef: "h1", validFrom: "2027-02-01", validTo: null, mediatorActive: true };
  it("conta mediadores distintos vigentes e estudantes vinculados", () => {
    const c = mediationCell("2027-03-31", [row, { ...row, assignmentLogicalId: "l2", studentRef: "h2" }, { ...row, assignmentLogicalId: "l3", mediatorEngagementId: "e2", studentRef: "h3", validTo: "2027-03-01" }]);
    expect(c.value).toBe(1);
    expect(c.groups?.[0]?.value).toBe(2);
    expect(c.notes.join(" ")).toContain("aguardando regra institucional");
  });
  it("leitura indisponível não vira zero", () => {
    expect(mediationCell("2027-03-31", null)).toMatchObject({ state: "indeterminado", value: null });
  });
  it("sem vínculos vigentes é zero observado (fonte lida)", () => {
    expect(mediationCell("2027-03-31", [])).toMatchObject({ state: "disponivel", value: 0 });
  });
});
