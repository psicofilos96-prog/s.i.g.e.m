import { describe, expect, it } from "vitest";
import { bySchool, classify, coverage, difference } from "./census-official";
import { BUILDER_SOURCES, mapRows } from "@/features/reports/builder-sources";
import { SECTOR_PACKS } from "@/features/reports/sector-packs";
import { mapRuleBaseTemplate } from "@/features/statistical-map/map-rule-template";
import { structureIVCells } from "@/features/statistical-map/map-movements";

describe("NCIECE.FINAL.2 — Censo oficial × base operacional", () => {
  it("classificação nunca trata ausência como zero", () => {
    expect(classify(10, 10)).toBe("coincide");
    expect(classify(10, 9)).toBe("divergente");
    expect(classify(null, 9)).toBe("sem-oficial");
    expect(classify(10, null)).toBe("sem-base-legivel");
    expect(difference(10, null)).toBeNull();
    expect(coverage(0, 3)).toBeNull();
    expect(coverage(148, 137)).toBe(92.6);
  });
  it("escola recebe a pior classificação entre as medidas", () => {
    const base = { inep: "1", censusYear: "2026", issuedAt: null, sourceRef: null, receiptVersion: 1 };
    const s = bySchool([{ ...base, schoolId: "a", measure: "turmas", official: 9, operational: 9 }, { ...base, schoolId: "a", measure: "alunos", official: 137, operational: 130 }]);
    expect(s[0]!.worst).toBe("divergente");
  });
});

describe("NCIECE.FINAL.2 — Mapa no gerador", () => {
  it("uma linha por célula da versão vigente, calculado × ajustado", () => {
    const rows = mapRows(
      [{ id: "m1", school_id: "e1", competence_year: 2027, competence_month: 3 }],
      [{ map_id: "m1", version: 1, snapshot: { cells: [{ cellId: "x", sectionId: "s", label: "Old", value: 1, state: "disponivel" }] }, correction_reason: null },
       { map_id: "m1", version: 2, snapshot: { cells: [{ cellId: "iv-remanejados", sectionId: "iv", label: "5. Remanejados", value: 2, state: "disponivel" }, { cellId: "c2", sectionId: "s", label: "Total", value: 30, state: "disponivel", adjustment: { calculatedValue: 28, adjustedValue: 30 } }] }, correction_reason: "erro" }],
      [{ map_id: "m1", kind: "oficializacao", recorded_at: "2027-04-01" }]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r["cell"] === "Total")).toMatchObject({ calculated: 28, value: 30, adjusted: "sim", status: "retificado", version: 2, competence: "2027-03" });
  });
  it("fontes disponíveis e packs CIECE ativos", () => {
    for (const id of ["gerador-mapa", "gerador-censo"]) expect(BUILDER_SOURCES.find((s) => s.id === id)?.unavailable).toBeUndefined();
    for (const id of ["ciece-mapa", "ciece-qualidade", "ciece-censo"]) expect(SECTOR_PACKS.find((p) => p.id === id)?.blockedBy).toBeUndefined();
    expect(SECTOR_PACKS).toHaveLength(54);
  });
});

describe("NCIECE.FINAL.2 — regra do Mapa", () => {
  it("modelo-base só traz o que o acervo define e não declara tipos de movimentação", () => {
    const t = mapRuleBaseTemplate(["e1"]);
    expect(t.snapshotDate).toEqual({ kind: "ultimo-dia-letivo-do-mes-calendario-oficial" });
    expect(t.structureIVGroups).toEqual({ remanejamentoTypeIds: [] });
  });
  it("grupo sem tipos mostra regra ainda não homologada, nunca zero", () => {
    const cells = structureIVCells([], mapRuleBaseTemplate(["e1"]).structureIVGroups ?? null, { from: "2027-03-01", to: "2027-03-31" });
    const rec = cells.find((c) => c.cellId === "iv-recebidos")!;
    expect(rec.state).toBe("sem-regra"); expect(rec.value).toBeNull(); expect(rec.notes[0]).toMatch(/Regra ainda não homologada/);
  });
});
