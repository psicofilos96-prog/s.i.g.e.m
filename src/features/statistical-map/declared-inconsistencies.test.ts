import { describe, expect, it } from "vitest";
import { projectAll, type DeclaredMap } from "./declared-monthly-map";
import { declaredOccurrences, networkCategoryFromRef, occurrenceId } from "./declared-inconsistencies";

const base = (o: Partial<DeclaredMap>): DeclaredMap => ({
  school_id: "inep-1", inep_declared: "1", month: 3, source_file: "f.xlsx", source_sheet: "MARÇO", shifts: { total: 10 },
  previous_month_enrollment: 10, transfers_in: 0, new_students: 0, transfers_out: 0, dropouts: 0, withdrawn_cancelled: 0,
  total_ii: 10, declared_classes: 1, total_iii: 10, classes: [{ modalidade: "EI", etapa: "Maternal", turma: "Maternal A", alunos: 10 }], ...o,
} as DeclaredMap);

const run = (maps: DeclaredMap[], months = [2, 3]) => declaredOccurrences(maps, projectAll(maps, () => "1"), months);

describe("ocorrências dos mapas declarados", () => {
  it("saldo da movimentação que não fecha gera MV01 com valor esperado calculado", () => {
    const o = run([base({ month: 2 }), base({ new_students: 2 })]).find((x) => x.rule === "MV01")!;
    expect(o.declared).toBe("10"); expect(o.expected).toBe("12");
  });
  it("matrícula anterior divergente do mês anterior gera IM01 com mês correlato", () => {
    const o = run([base({ month: 2, total_ii: 9, shifts: { total: 9 }, total_iii: 9, classes: [{ modalidade: "EI", etapa: "M", turma: "A", alunos: 9 }] }), base({})]).find((x) => x.rule === "IM01")!;
    expect(o.related_month).toBe(2); expect(o.expected).toBe("9");
  });
  it("INEP divergente gera ID01 e mês faltante gera CB01", () => {
    const occ = run([base({ inep_declared: "999" })]);
    expect(occ.some((x) => x.rule === "ID01")).toBe(true);
    expect(occ.find((x) => x.rule === "CB01")!.month).toBe(2);
  });
  it("mapa coerente não gera ocorrência e ID é estável", () => {
    expect(run([base({ month: 2 }), base({})])).toEqual([]);
    expect(occurrenceId("MV01", "inep-1", 3, "saldo")).toBe("MAP26-MV01-1-03-saldo");
  });
  it("parcela em branco é incompleta, nunca zero", () => {
    expect(run([base({ month: 2 }), base({ dropouts: null })]).some((x) => x.rule === "MV02")).toBe(true);
  });
  it("rede vem do registro de origem: lotes 1–2 conveniadas, lote 3-4 rural/urbana", () => {
    expect(networkCategoryFromRef("technical-operation:mapas-declarados-lote2:abc")).toBe("conveniada");
    expect(networkCategoryFromRef("declaracao-escolar:lote-3-4:rural:lista-inep-oficial")).toBe("rural");
    expect(networkCategoryFromRef("declaracao-escolar:lote-3-4:urbana:lista-inep-oficial")).toBe("urbana");
    expect(networkCategoryFromRef(null)).toBe("nao-registrada");
  });
});
