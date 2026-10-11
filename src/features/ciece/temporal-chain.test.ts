import { describe, expect, it } from "vitest";
import { snapshotAt, studentHistory, overlaps, type Enrollment } from "./temporal-chain";

const E = (p: Partial<Enrollment>): Enrollment => ({ id: "e", logicalId: "l", studentId: "s", schoolId: "A", yearId: "2026", openedOn: "2026-02-01", endedOn: null, supersedesId: null, ...p });

describe("cadeia temporal", () => {
  it("transferência: só a matrícula vigente na data conta; pessoa ≠ matrícula", () => {
    const es = [E({ id: "1", endedOn: "2026-05-10" }), E({ id: "2", schoolId: "B", openedOn: "2026-05-11" })];
    expect(snapshotAt(es, [], "2026-04-01")).toMatchObject({ pessoas: 1, matriculas: 1 });
    expect(snapshotAt(es, [], "2026-06-01")).toMatchObject({ pessoas: 1, matriculas: 1, semEnturmacao: 1 });
    expect(overlaps(es, "s")).toEqual([]);
  });
  it("múltiplas escolas: 1 pessoa, 2 matrículas, sinalizada", () => {
    const r = snapshotAt([E({ id: "1" }), E({ id: "2", schoolId: "B" })], [], "2026-03-01");
    expect(r).toMatchObject({ pessoas: 1, matriculas: 2, multiSchoolStudents: ["s"] });
  });
  it("sem data inicial: não conta na data e fica listada", () => {
    const r = snapshotAt([E({ id: "1", openedOn: null })], [], "2026-03-01");
    expect(r).toMatchObject({ pessoas: 0, matriculas: 0, unknownTemporal: ["1"] });
    expect(overlaps([E({ openedOn: null })], "s")).toBe("nao-verificavel");
    expect(studentHistory([E({ id: "1", openedOn: null }), E({ id: "0", yearId: "2025", openedOn: "2025-02-01", endedOn: "2025-12-20" })], "s").map((h) => h.from)).toEqual(["2025-02-01", "início não declarado"]);
  });
  it("rematrícula e correção: versão superada não conta", () => {
    const es = [E({ id: "1", yearId: "2025", openedOn: "2025-02-01", endedOn: "2025-12-20" }), E({ id: "2" }), E({ id: "3", supersedesId: "2", openedOn: "2026-02-03" })];
    expect(snapshotAt(es, [{ id: "a", enrollmentId: "3", classId: "T", from: null, to: null }], "2026-03-01")).toMatchObject({ matriculas: 1, alocacoes: 0, alocacaoDesconhecida: 1 });
  });
});
