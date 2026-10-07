import { describe, expect, it } from "vitest";
import { canOpenNext, groupByStructure, projectWorkflow, renderMapDocument, structureOf } from "./map-structures";
import type { MapCell, MapSnapshot } from "./map-domain";

const cell = (cellId: string, sectionId: string, over: Partial<MapCell> = {}): MapCell => ({ cellId, sectionId, label: cellId, origin: "automatico", state: "disponivel", value: 3, unit: null, reference: null, source: null, recordRefs: [], ruleRef: null, coverage: null, notes: [], ...over });

describe("Mapa I–VI", () => {
  it("distribui nas seis estruturas", () => {
    expect(structureOf(cell("direcao", "identificacao"))).toBe("I");
    expect(structureOf(cell("matricula-mes-anterior", "movimentacao"))).toBe("II");
    expect(structureOf(cell("entradas-mes", "movimentacao"))).toBe("IV");
    expect(structureOf(cell("turmas", "turmas"))).toBe("III");
    expect(structureOf(cell("mediadores", "pessoal"))).toBe("V");
    expect(structureOf(cell("visitas", "visitas"))).toBe("VI");
    expect(groupByStructure([]).map((g) => g.id)).toEqual(["I", "II", "III", "IV", "V", "VI"]);
  });
  it("rascunho → enviado → devolvido → reenviado → aprovado → retificação", () => {
    const e = [{ kind: "conferencia", at: "1" }];
    expect(projectWorkflow(true, [], 0).stage).toBe("rascunho");
    expect(projectWorkflow(true, e, 0).stage).toBe("enviado");
    const dev = [...e, { kind: "abertura-correcao", at: "2", reason: "turma errada" }];
    expect(projectWorkflow(true, dev, 0)).toMatchObject({ stage: "devolvido", returnReason: "turma errada" });
    const re = [...dev, { kind: "conferencia", at: "3" }];
    expect(projectWorkflow(true, re, 0).stage).toBe("reenviado");
    const ap = [...re, { kind: "oficializacao", at: "4" }];
    expect(projectWorkflow(true, ap, 1)).toMatchObject({ stage: "aprovado", revision: 1 });
    expect(projectWorkflow(true, [...ap, { kind: "abertura-correcao", at: "5", reason: "x" }], 1).stage).toBe("em-retificacao");
  });
  it("próxima competência exige aprovação quando a regra exige", () => {
    expect(canOpenNext("enviado", true)).toBe(false);
    expect(canOpenNext("aprovado", true)).toBe(true);
    expect(canOpenNext(null, false)).toBe(true);
  });
  it("PDF reproduz a revisão, A4, seis estruturas e escapa texto", () => {
    const snap = { schemaVersion: 1, competence: { schoolId: "s", year: 2027, month: 3, key: "2027-03", window: { from: "2027-03-01", to: "2027-03-31" } }, snapshotDate: "2027-03-31", rule: { id: "r", version: 2 }, cells: [cell("visitas", "visitas", { label: "<b>x</b>" })], declarations: { observations: "", observationsEventId: null } } as MapSnapshot;
    const html = renderMapDocument({ headerLines: ["PREFEITURA"], schoolName: "Escola A", snapshot: snap, statusLabel: "Aprovado", revision: 1, signatures: ["Secretaria"], generatedAt: "agora" });
    expect(html).toContain("size:A4");
    for (const t of ["I —", "II —", "III —", "IV —", "V —", "VI —"]) expect(html).toContain(t);
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("Revisão: </dt><dd>1");
    expect(renderMapDocument({ headerLines: [], schoolName: "A", snapshot: snap, statusLabel: "a", revision: 1, signatures: [], generatedAt: "agora" })).toBe(renderMapDocument({ headerLines: [], schoolName: "A", snapshot: snap, statusLabel: "a", revision: 1, signatures: [], generatedAt: "agora" }));
  });
});
