/**
 * Boletim por aluno/período e em lote, ficha individual e amostra de rendimento (R2).
 * Projeções puras sobre lançamentos já lidos com a sessão; saem pelo report-engine
 * (bordas vetoriais), A4 retrato ou paisagem. Resultado oficial só com perfil liberado.
 */
import { toPrintableHtml, type Branding, type ReportResult, type CellValue } from "@/features/reports/report-engine";
import { acceptsGrades, officialResultGate, type StageProfile } from "./stage-engine";

export type Entry = { studentId: string; periodId: string; componentId: string; grade: number | null; absences: number | null; skills?: string | null };
export type Student = { id: string; name: string };

const v = (x: number | null | undefined): CellValue => (x === null || x === undefined ? null : x);

export function bulletinFor(student: Student, profile: StageProfile, periods: readonly { id: string; label: string }[], components: readonly { id: string; label: string }[], entries: readonly Entry[]): ReportResult {
  const grades = acceptsGrades(profile);
  const mine = entries.filter((e) => e.studentId === student.id);
  const columns = [{ id: "c", label: "Componente", kind: "text" as const }, ...periods.flatMap((p) => grades
    ? [{ id: `${p.id}:n`, label: `${p.label} · nota`, kind: "number" as const }, { id: `${p.id}:f`, label: `${p.label} · faltas`, kind: "number" as const }]
    : [{ id: `${p.id}:h`, label: `${p.label} · habilidades`, kind: "text" as const }, { id: `${p.id}:f`, label: `${p.label} · faltas`, kind: "number" as const }])];
  const rows = components.map((c) => [c.label, ...periods.flatMap((p) => {
    const e = mine.find((x) => x.componentId === c.id && x.periodId === p.id);
    return grades ? [v(e?.grade), v(e?.absences)] : [e?.skills ?? null, v(e?.absences)];
  })]);
  const gate = officialResultGate(profile);
  return { definitionId: "boletim-aluno", definitionVersion: 1, params: { aluno: student.name, perfil: `${profile.id}@${profile.version}`, resultado: gate.state === "liberado" ? "oficial" : `bloqueado: ${gate.missing.join(", ")}` }, columns, rows, groups: null, generatedAt: new Date(0).toISOString(), mode: "sync" };
}

export const bulletinBatch = (students: readonly Student[], ...rest: Parameters<typeof bulletinFor> extends [Student, ...infer R] ? R : never) => students.map((s) => bulletinFor(s, ...rest));

export function printBulletin(r: ReportResult, branding: Branding, orientation: "portrait" | "landscape" = "landscape") {
  const html = toPrintableHtml(r, branding, [`Aluno: ${r.params["aluno"]}`, `Resultado: ${r.params["resultado"]}`]);
  return orientation === "landscape" ? html.replace("@page{size:A4;", "@page{size:A4 landscape;") : html;
}

/** Amostra de rendimento: distribuição de notas lançadas; ausência fica fora e é contada à parte. */
export function performanceSample(entries: readonly Entry[], bands: readonly { label: string; min: number; max: number }[]) {
  const graded = entries.filter((e) => e.grade !== null);
  return { notInformed: entries.length - graded.length, bands: bands.map((b) => ({ label: b.label, count: graded.filter((e) => e.grade! >= b.min && e.grade! <= b.max).length })) };
}
