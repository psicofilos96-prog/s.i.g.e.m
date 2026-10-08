/** NMAP.5 — auditoria requisito por requisito do Mapa I–VI (complementa map-structures/map-n43/map-segregation). */
import { describe, expect, it } from "vitest";
import { canOpenNext, originBadge, projectWorkflow, renderMapDocument, structureOf } from "./map-structures";
import type { MapCell, MapSnapshot } from "./map-domain";

const cell = (cellId: string, sectionId: string, over: Partial<MapCell> = {}): MapCell => ({ cellId, sectionId, label: cellId, origin: "automatico", state: "disponivel", value: 3, unit: null, reference: null, source: null, recordRefs: [], ruleRef: null, coverage: null, notes: [], ...over });
const snap = (cells: MapCell[]) => ({ schemaVersion: 1, competence: { schoolId: "s", year: 2027, month: 3, key: "2027-03", window: { from: "2027-03-01", to: "2027-03-31" } }, snapshotDate: "2027-03-31", rule: { id: "r", version: 1 }, cells, declarations: { observations: "", observationsEventId: null } }) as MapSnapshot;
const doc = (cells: MapCell[]) => renderMapDocument({ headerLines: [], schoolName: "A", snapshot: snap(cells), statusLabel: "Aprovado", revision: 1, signatures: [], generatedAt: "t" });

describe("NMAP.5 — Mapa Estatístico", () => {
  it("transferências e desligamentos vão para a estrutura IV", () => {
    expect(structureOf(cell("transferidos-mes", "movimentacao"))).toBe("IV");
    expect(structureOf(cell("desligados-mes", "turmas"))).toBe("IV");
  });
  it("devolução depois de aprovado não desfaz a aprovação", () => {
    const ev = [{ kind: "conferencia", at: "1" }, { kind: "oficializacao", at: "2" }, { kind: "devolucao", at: "3", reason: "x" }];
    expect(projectWorkflow(true, ev, 1).stage).toBe("aprovado");
  });
  it("devolução antes de aprovar guarda o motivo e o reenvio limpa o estágio", () => {
    const ev = [{ kind: "conferencia", at: "1" }, { kind: "devolucao", at: "2", reason: "faltou turma" }];
    expect(projectWorkflow(true, ev, 0)).toMatchObject({ stage: "devolvido", returnReason: "faltou turma" });
    expect(projectWorkflow(true, [...ev, { kind: "conferencia", at: "3" }], 0)).toMatchObject({ stage: "reenviado", returnReason: null });
  });
  it("competência não aberta é sempre rascunho; próxima não abre se a anterior foi devolvida", () => {
    expect(projectWorkflow(false, [{ kind: "oficializacao", at: "1" }], 0).stage).toBe("rascunho");
    expect(canOpenNext("devolvido", true)).toBe(false);
  });
  it("ajuste manual mostra quem ajustou, o valor calculado e o motivo no PDF", () => {
    const c = cell("matricula", "turmas", { value: 30, adjustment: { side: "escola", calculated: 28, reason: "aluno em trânsito" } as MapCell["adjustment"] });
    expect(originBadge(c)).toBe("Ajustado pela escola");
    const html = doc([c]);
    expect(html).toContain("Calculado pelo SIGEM: 28");
    expect(html).toContain("Motivo: aluno em trânsito");
  });
  it("ausência nunca vira zero no PDF", () => {
    const html = doc([cell("mediadores", "pessoal", { state: "ausente", value: null })]);
    expect(html).toContain("Sem registro");
    expect(html).not.toMatch(/class="n">0</);
  });
});
