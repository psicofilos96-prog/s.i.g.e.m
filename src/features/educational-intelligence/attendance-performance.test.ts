import { describe, expect, it } from "vitest";
import { attendanceAt, DECLARED_2026, compareDeclared, duplicates, outreachState, performanceSummary, type AttendanceRow } from "./attendance-performance";

const r = (o: Partial<AttendanceRow>): AttendanceRow => ({ studentId: "a", enrollmentId: "m", schoolId: "s", classId: "t", period: 1, plannedHours: 100, attendedHours: 80, ...o });

describe("infrequência", () => {
  it("exatamente 75% fica fora da lista", () => expect(attendanceAt([r({ attendedHours: 75 })], 1, "periodo")[0]!.status).toBe("sem-alerta"));
  it("74,9% entra", () => expect(attendanceAt([r({ plannedHours: 1000, attendedHours: 749 })], 1, "periodo")[0]!.status).toBe("alerta"));
  it("acumulado soma períodos e calcula faltas", () => {
    const x = attendanceAt([r({ period: 1, attendedHours: 60 }), r({ period: 2, attendedHours: 90 })], 2, "acumulado")[0]!;
    expect(x).toMatchObject({ planned: 200, attended: 150, absences: 50, presencePct: 75, status: "sem-alerta" });
  });
  it("período faltante não vira zero", () => expect(attendanceAt([r({ period: 2 })], 2, "acumulado")[0]).toMatchObject({ status: "nao-apurado", presencePct: null }));
  it("hora sem fonte não apura", () => expect(attendanceAt([r({ attendedHours: null })], 1, "periodo")[0]!.status).toBe("nao-apurado"));
  it("frequentadas > previstas recusado", () => expect(attendanceAt([r({ attendedHours: 120 })], 1, "periodo")[0]!.status).toBe("nao-apurado"));
  it("resultado não tem campo de reprovação", () => expect(Object.keys(attendanceAt([r({})], 1, "periodo")[0]!)).not.toContain("failed"));
  it("duplicidades", () => expect(duplicates([r({}), r({}), r({ period: 2 })])).toEqual([{ key: "m|t|1", count: 2 }]));
});

describe("totais declarados 2026", () => {
  it("316 e 269, não auditados nem deduplicados", () => {
    expect(DECLARED_2026.map((d) => d.total)).toEqual([316, 269]);
    expect(DECLARED_2026.every((d) => !d.audited && !d.deduplicated)).toBe(true);
  });
  it("queda não é interpretada como resolução", () => expect(compareDeclared(DECLARED_2026[0]!, DECLARED_2026[1]!)).toMatchObject({ difference: -47, interpretable: false }));
});

describe("busca ativa", () => {
  it("encaminhamento aguarda retorno e vence prazo", () => {
    const s = outreachState([{ at: "2026-05-01", kind: "contato", author: "p", guardian: "mãe", note: "" }, { at: "2026-05-02", kind: "encaminhamento", author: "p", destination: "Conselho Tutelar", due: "2026-05-10", note: "" }], "2026-05-11");
    expect(s).toMatchObject({ state: "aguardando-retorno", overdue: true });
  });
  it("encerrar sem retorno é erro", () => expect(outreachState([{ at: "1", kind: "encerramento", author: "p", note: "" }], "2").errors).toContain("evento 1: encerramento sem retorno"));
  it("contato sem responsável é erro", () => expect(outreachState([{ at: "1", kind: "contato", author: "p", note: "" }], "2").errors.length).toBe(1));
});

describe("rendimento", () => {
  it("só conta situação oficial com período concluído; resto é parcial", () => {
    const s = performanceSummary([{ studentId: "a", year: 2026, officialStanding: "aprovado", periodClosed: true, grade: 7 }, { studentId: "b", year: 2026, officialStanding: null, periodClosed: false, grade: 4 }], 2026);
    expect(s).toEqual({ year: 2026, nature: "parcial", official: 1, partial: 1, byStanding: { aprovado: 1 } });
  });
  it("nota baixa sem situação oficial não vira reprovação", () => expect(performanceSummary([{ studentId: "b", year: 2026, officialStanding: null, periodClosed: true, grade: 0 }], 2026).byStanding).toEqual({}));
});
