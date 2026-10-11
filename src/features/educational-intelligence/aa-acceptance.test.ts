// A&A Lote 10 — aceite encadeado das regras puras do setor:
// importação → validação → indicadores → relatório (CSV/XLSX) → intervenção → reavaliação.
import { describe, expect, it } from "vitest";
import { projectBatches, localHits, comparableMeasures, type ImportBatch, type ImportRow } from "./result-import";
import { attendanceAt, type AttendanceRow } from "./attendance-performance";
import { diagnosticBand, canCompare, validateMeasure } from "./methodology-rules";
import { projectInterventions, type InterventionVersion, type InterventionEvent } from "./interventions";
import { suppressSmallGroups } from "./aa-suppression";
import { AA_SOURCES } from "../reports/aa-report-sources";
import { runReport, toCsv, toXlsx, ReportError } from "../reports/report-engine";

const batch: ImportBatch = { id: "b1", adapter_key: "simula-saeb-folha-respostas", adapter_version: 1, file_name: "f.xlsx", sha256: "h", sheet: "4A",
  program_key: "simula-saeb", edition_year: 2026, cycle: null, round: "3", school_label: "Escola A", measure_kind: "acertos-locais", formula_note: null, executor_label: "executor-tecnico", recorded_at: "2026-10-01" };
const row = (id: string, s: ImportRow["match_state"]): ImportRow => ({ id, batch_id: "b1", row_no: 1, class_label: "4A", student_name: "x", match_state: s, candidate_student_ids: [], matched_student_id: s === "exato-inep" ? "st1" : null, payload: {} });

describe("aceite A&A ponta a ponta (regras)", () => {
  it("importação: ambíguo bloqueia confirmação até revisão humana", () => {
    const rows = [row("r1", "exato-inep"), row("r2", "revisao-nome")];
    const ev = [{ batch_id: "b1", seq: 1, event: "preparado" as const, reason: null, recorded_at: "t" }];
    expect(projectBatches([batch], rows, [], ev)[0]!.canConfirm).toBe(false);
    const rev = [{ row_id: "r2", seq: 1, decision: "vincular" as const, student_id: "st2", reason: "conferido", recorded_at: "t" }];
    expect(projectBatches([batch], rows, rev, ev)[0]!.canConfirm).toBe(true);
  });
  it("validação: sem gabarito não há acertos; acertos ≠ TRI", () => {
    expect(localHits(["A", null], null).hits).toBeNull();
    expect(localHits(["A", "B"], ["A", "C"]).hits).toBe(1);
    expect(comparableMeasures(batch, { ...batch, measure_kind: "proficiencia-tri" }).ok).toBe(false);
    expect(validateMeasure("saeb-ideb", "acertos-locais").length).toBe(1);
  });
  it("indicadores: ausente ≠ zero, limite 75% estrito, transferência separa matrícula, ciclos acumulados", () => {
    const r = (e: string, c: string, p: number, pl: number | null, at: number | null): AttendanceRow => ({ studentId: "s", enrollmentId: e, schoolId: "A", classId: c, period: p, plannedHours: pl, attendedHours: at });
    const res = attendanceAt([r("e1", "c1", 1, 100, 75), r("e1", "c1", 2, 100, 74), r("e2", "c2", 2, 100, 0), r("e3", "c3", 1, null, null)], 2, "acumulado");
    const by = (e: string) => res.find((x) => x.enrollmentId === e)!;
    expect(by("e1").presencePct).toBe(74.5); expect(by("e1").status).toBe("alerta");
    expect(by("e2").status).toBe("nao-apurado"); // transferido sem período 1 na nova turma
    expect(by("e3").presencePct).toBeNull();
    expect(attendanceAt([r("e1", "c1", 1, 100, 75)], 1, "periodo")[0]!.status).toBe("sem-alerta");
    expect(diagnosticBand(90)).toBe("90-ou-mais"); expect(diagnosticBand(59.99)).toBe("50-a-60");
  });
  it("gráficos/comparações: escala ou matriz diferente bloqueia", () => {
    expect(canCompare({ programKey: "saeb-ideb", matrixKey: "m" }, { programKey: "simula-saeb", matrixKey: "m" }).ok).toBe(false);
  });
  it("relatório: CSV/XLSX mantêm ausência e assunto sem fonte recusa", async () => {
    const src = AA_SOURCES.find((s) => s.id === "aa-intervencoes")!;
    const res = runReport(src.definition, { params: {} }, [{ school: "A", class: null, segment: "4º", infant: "não", origin: "x", objective: "o", responsible: null, due: null, version: 1 }]);
    const csv = toCsv(res, { headerLines: ["Prefeitura"], title: "t" });
    expect(csv).toContain("não disponível"); expect(csv).not.toMatch(/;0;/);
    expect((await toXlsx(res, { headerLines: [], title: "t" })).byteLength).toBeGreaterThan(0);
    const pend = AA_SOURCES.find((s) => s.unavailable)!;
    expect(() => runReport({ ...pend.definition, dependency: pend.unavailable! }, { params: {} }, [])).toThrow(ReportError);
    expect(suppressSmallGroups([{ key: "A", n: 3 }], null).policy).toBe("sem-politica");
  });
  it("intervenção → reavaliação → encerramento com devolutiva", () => {
    const v: InterventionVersion = { id: "v1", logical_id: "p1", version: 1, school_id: "A", class_id: null, segment: "4º", is_infant: false, origin_kind: "sia-instrumento-aprovado",
      origin_ref: "ins-1", sipe_plan_version_id: "sipe-1", objective: "leitura", responsible_label: "OP", due_date: "2026-11-01", reason: null, author_user_id: "u", recorded_at: "t" };
    const e = (seq: number, kind: InterventionEvent["kind"]): InterventionEvent => ({ plan_logical_id: "p1", seq, kind, body: "b", responsible_label: null, due_date: null, progress: kind === "reavaliacao" ? "avancou" : null, reassessment_ref: null, author_user_id: "u", recorded_at: "t" });
    expect(projectInterventions([v], [e(1, "acao"), e(2, "reavaliacao")], "2026-10-11")[0]!.stage).toBe("reavaliado");
    const closed = projectInterventions([v], [e(1, "acao"), e(2, "reavaliacao"), e(3, "encerramento")], "2026-10-11")[0]!;
    expect(closed.issues).toContain("Encerrado sem devolutiva registrada.");
  });
});
