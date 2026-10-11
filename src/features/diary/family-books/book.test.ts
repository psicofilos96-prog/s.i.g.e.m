import { describe, expect, it } from "vitest";
import { absencesOf, bookIssues, finalRow, gradeCells, modelMark, renderBook, renderSheets, type BookInput } from "./book";
import { FAMILIES } from "./families";
import { cellsFrom } from "../final-sheet-cloud";

const P1 = { label: "1º PL", from: "2026-02-01", to: "2026-04-30", planned: 34 };
const P2 = { label: "2º PL", from: "2026-05-01", to: "2026-07-15", planned: null };
const base = (over: Partial<BookInput> = {}): BookInput => ({
  family: "componente-fii-eja",
  header: { school: "Escola sintética", className: "600", stage: "6º ano", shift: "Manhã", teacher: null, yearLabel: "2026" },
  components: [{ id: "lp", label: "Língua Portuguesa" }], componentId: "lp",
  periods: [P1, P2],
  students: [{ id: "a", name: "Aluno A", status: "Ativo" }, { id: "b", name: "Aluno B", status: "Ativo" }, { id: "t", name: "Aluno T", status: "Transferido" }],
  attendance: [
    { componentId: "lp", date: "2026-02-10", marks: { a: "Presente", b: "Ausente" }, eligible: ["a", "b"] },
    { componentId: "lp", date: "2026-03-10", marks: { a: "Ausente" }, eligible: ["a", "b"] },
  ],
  lessons: [{ componentId: "lp", date: "2026-02-10", content: "Substantivos" }],
  grades: [
    { componentId: "lp", studentId: "a", column: "av1", periodIndex: 0, value: 15, notRecorded: false },
    { componentId: "lp", studentId: "a", column: "av2", periodIndex: 0, value: 16, notRecorded: false },
    { componentId: "lp", studentId: "a", column: "iv", periodIndex: 0, value: 12, notRecorded: false },
    { componentId: "lp", studentId: "a", column: "pa", periodIndex: 0, value: 7, notRecorded: false },
    { componentId: "lp", studentId: "b", column: "av1", periodIndex: 0, value: 5, notRecorded: false },
    { componentId: "lp", studentId: "b", column: "iv", periodIndex: 0, value: 10, notRecorded: false },
    { componentId: "lp", studentId: "b", column: "pa", periodIndex: 0, value: 5, notRecorded: false },
    { componentId: "lp", studentId: "b", column: "rp", periodIndex: 0, value: 40, notRecorded: false },
    { componentId: "lp", studentId: "b", column: "av2", periodIndex: 0, value: null, notRecorded: true },
  ],
  experiences: [], rule: null, unclassified: [],
  ...over,
});

describe("Livro do Diário — cálculos do modelo da rede", () => {
  it("Fund. II: nota do PL = MAX(AV1+AV2+IV+PA; RP+IV+PA)", () => {
    expect(gradeCells(base(), "a", "lp", 0).note).toBe(50);
    expect(gradeCells(base(), "b", "lp", 0).note).toBe(55); // 5+10+5=20 vs 40+10+5=55
  });
  it("sem lançamento a nota é nula, nunca zero; não registrado explícito não vira zero", () => {
    expect(gradeCells(base(), "a", "lp", 1).note).toBeNull();
    const b = gradeCells(base(), "b", "lp", 0);
    expect(b.av2).toBeNull();
    expect(b.notRecorded).toEqual(["av2"]);
  });
  it("Fund. I: N = soma dos instrumentos lançados", () => {
    expect(gradeCells(base({ family: "fundamental-i" }), "a", "lp", 0).note).toBe(50);
  });
  it("aluno elegível sem marcação torna as faltas desconhecidas, nunca presença", () => {
    const b = absencesOf(base(), "b", P1, "lp");
    expect(b.absences).toBeNull();
    expect(absencesOf(base(), "a", P1, "lp").absences).toBe(1);
  });
  it("média final exige todas as notas; sem regra o resultado é prévia (rascunho)", () => {
    const r = finalRow(base(), base().students[0]!, "lp");
    expect(r.avg).toBeNull();
    expect(r.result).toBe("PENDENTE");
    expect(r.draft).toBe(true);
    expect(finalRow(base(), base().students[2]!, "lp").result).toBe("TRANSFERIDO");
  });
  it("valor acima do máximo do modelo é sinalizado, não cortado", () => {
    const i = base({ grades: [{ componentId: "lp", studentId: "a", column: "av1", periodIndex: 0, value: 35, notRecorded: false }] });
    const g = gradeCells(i, "a", "lp", 0);
    expect(g.av1).toBe(35);
    expect(g.warnings.join()).toMatch(/AV1 acima do máximo/);
  });
  it("marcação impressa do modelo: '.' presente, 'F' falta, '—' sem marcação", () => {
    expect([modelMark("Presente"), modelMark("Ausente"), modelMark(undefined)]).toEqual([".", "F", "—"]);
  });
});

describe("Livro do Diário — famílias e impressão", () => {
  it("as 7 famílias têm folhas com campos, tabelas e paginação; folhas de professor têm assinatura", () => {
    expect(FAMILIES).toHaveLength(7);
    for (const f of FAMILIES) for (const s of f.sheets) {
      expect(s.fields.length, `${f.id}/${s.kind}`).toBeGreaterThan(0);
      expect(s.pagination).not.toBe("");
      if (s.kind !== "capa" && s.kind !== "boletim") expect(s.signatures.length, `${f.id}/${s.kind}`).toBeGreaterThan(0);
    }
    expect(FAMILIES.find((f) => f.id === "eja-i-v")!.periods.count).toBe(2);
  });
  it("componente: uma folha de frequência e uma de notas por período, mais capa e FINAL", () => {
    const kinds = renderSheets(base(), { issuedAt: "2026-10-11" }).map((s) => s.spec.kind);
    expect(kinds).toEqual(["capa", "frequencia", "frequencia", "notas-periodo", "notas-periodo", "final-componente"]);
  });
  it("sem regra homologada o livro sai marcado como RASCUNHO e escapa HTML", () => {
    const html = renderBook(base({ students: [{ id: "a", name: "<script>x</script>", status: "Ativo" }] }), { issuedAt: "2026-10-11" });
    expect(html).toContain("RASCUNHO");
    expect(html).not.toContain("<script>x");
    expect(bookIssues(base()).join()).toMatch(/Sem regra de resultado homologada/);
  });
  it("Folha Final/Boletim/Ficha/Ata não são recalculados no livro", () => {
    const html = renderBook(base({ family: "eja-i-v", componentId: null }), { issuedAt: "2026-10-11", kinds: ["ata-final"] });
    expect(html).toContain("emitido em Diário › Folha Final");
  });
});

describe("Folha Final compõe a nota pelas colunas do modelo", () => {
  const ins = (id: string, col: string) => ({ id, period_id: "p1", definition: { curriculumRef: { componentId: "lp" }, modelColumn: col } });
  const e = (i: string, v: number) => ({ id: i, logical_entry_id: i, version_number: 1, instrument_id: i, student_id: "a", period_id: "p1", value: { kind: "numerica", value: v } });
  it("AV1+AV2+IV+PA com recuperação paralela e final", () => {
    const r = cellsFrom([e("1", 10), e("2", 10), e("3", 10), e("4", 5), e("5", 50), e("6", 70)],
      [ins("1", "av1"), ins("2", "av2"), ins("3", "iv"), ins("4", "pa"), ins("5", "rp"), ins("6", "rf")], ["p1"], "fundamental-ii");
    expect(r.cells["a:lp"]!.periodGrades).toEqual([65]); // max(35, 50+10+5)
    expect(r.cells["a:lp"]!.finalRecovery).toBe(70);
  });
  it("sem compose, vários instrumentos continuam pendentes", () => {
    const r = cellsFrom([e("1", 10), e("2", 10)], [ins("1", "av1"), ins("2", "av2")], ["p1"]);
    expect(r.cells["a:lp"]!.periodGrades).toEqual([null]);
  });
});

describe("faltas sem aula", () => {
  it("período sem chamada não imprime zero falta", () => {
    const i = base();
    expect(absencesOf(i, "a", P2, "lp").absences).toBeNull();
    expect(finalRow(i, i.students[0]!, "lp").totalAbs).toBe(1);
  });
});
