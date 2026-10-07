import { describe, expect, it } from "vitest";
import { bookReportRows, filterBook, vacancyState, vacancySummary, type BookRow, type VacancyRow } from "./vacancies-book";
import { runReport } from "@/features/reports/report-engine";
import { ENROLLMENT_BOOK_REPORT, bookPrintHtml } from "./vacancies-book";

const v = (o: Partial<VacancyRow>): VacancyRow => ({ class_id: "c", name: "1º A", shift_label: null, capacity: null, occupancy: 0, available: null, vacancy_state: "capacidade-nao-informada", ...o });
const b = (o: Partial<BookRow>): BookRow => ({ entry_order: 1, enrollment_id: "m", student_name: "Ana Júlia", institutional_number: "2026001", opened_on: "2026-02-03",
  class_label: "1º A", situation: "ativa", ended_on: null, end_reason: null, recorded_at: "2026-02-03T10:00:00Z", ...o });

describe("N5.3 vagas", () => {
  it("capacidade ausente é 'não informada', nunca lotada", () => {
    expect(vacancyState(null, 40)).toBe("capacidade-nao-informada");
    expect(vacancyState(25, 25)).toBe("lotada");
    expect(vacancyState(25, 24)).toBe("ha-vaga");
  });
  it("vagas somadas só das turmas com capacidade; sem nenhuma, nulo (não zero)", () => {
    expect(vacancySummary([v({}), v({})]).availableKnown).toBeNull();
    const s = vacancySummary([v({ capacity: 20, occupancy: 18, available: 2, vacancy_state: "ha-vaga" }), v({ capacity: 10, occupancy: 10, available: 0, vacancy_state: "lotada" }), v({})]);
    expect(s).toEqual({ classes: 3, full: 1, unknownCapacity: 1, availableKnown: 2 });
  });
});

describe("N5.3 Livro de Matrícula", () => {
  it("busca por nome sem acento e por código; filtra situação", () => {
    const rows = [b({}), b({ enrollment_id: "x", student_name: "Bruno", institutional_number: "2026002", situation: "encerrada" })];
    expect(filterBook(rows, { text: "julia" }).map((r) => r.enrollment_id)).toEqual(["m"]);
    expect(filterBook(rows, { text: "2026002" })).toHaveLength(1);
    expect(filterBook(rows, { situation: "encerrada" })[0]!.student_name).toBe("Bruno");
  });
  it("exportação vem da mesma linha do Livro, sem identificador interno, ausência explícita", () => {
    const r = runReport(ENROLLMENT_BOOK_REPORT, { params: {} }, bookReportRows([b({ class_label: null, institutional_number: null })]));
    expect(r.rows[0]).toEqual([1, "Ana Júlia", null, "03/02/2026", "Sem turma", "Ativa", null]);
    expect(r.columns.map((c) => c.id)).not.toContain("enrollment_id");
  });
});

describe("N5.3 PDF do Livro", () => {
  it("A4, páginas numeradas, cabeçalho da escola e conteúdo escapado", () => {
    const h = bookPrintHtml({ school: "E.M. <Teste>", inep: "33001260", year: "2026", knownAt: "07/10/2026" }, [b({ student_name: "<script>x</script>" })]);
    expect(h).toContain("size: A4");
    expect(h).toContain("counter(page)");
    expect(h).toContain("E.M. &lt;Teste&gt;");
    expect(h).toContain("INEP 33001260");
    expect(h).not.toContain("<script>x");
    expect(h).toContain("não é numeração oficial");
  });
});
