/**
 * Folha Final, Boletim e Ata de resultados no layout dos modelos da rede.
 * Projeção pura sobre `network-model-rules.ts`: nenhuma regra nova; ausência nunca vira zero
 * e o resultado fica PENDENTE quando falta nota de período, frequência ou regra.
 */
import { attendancePct, componentResult, ejaResult, finalAverage, statusSigla, type EnrollmentStatus } from "./network-model-rules";

export type Modality = "fundamental-anos-iniciais" | "fundamental-anos-finais" | "eja" | "educacao-infantil";
type Num = number | null;

export type SheetStudent = { id: string; name: string; status: EnrollmentStatus };
export type SheetCell = { periodGrades: Num[]; finalRecovery: Num; lessonsGiven: Num; absences: Num };
export type SheetInput = {
  modality: Modality;
  periods: readonly string[];
  components: readonly { id: string; label: string }[];
  students: readonly SheetStudent[];
  cells: Record<string, SheetCell | undefined>; // chave `${studentId}:${componentId}`
  /** Regra de resultado. `undefined` = laboratório (valores das planilhas). `null` = sem regra homologada aplicável ⇒ nenhum resultado. */
  rule?: ResultRule | null;
};
/** Parâmetros configurados e homologados (0289); extraídos das planilhas só como proposta. */
export type ResultRule = { id: string; label: string; passMark: number; minAttendance: number | null; sourceRef: string };
export const AWAITING_RULE = "AGUARDA REGRA";

export type SheetRow = {
  student: SheetStudent;
  components: { id: string; periodGrades: Num[]; average: Num; finalRecovery: Num; attendance: Num; result: string; missing: string[] }[];
  overall: string;
  missing: string[];
};

export const cellKey = (s: string, c: string) => `${s}:${c}`;

export function projectFinalSheet(i: SheetInput): { rows: SheetRow[]; blocked: string | null } {
  if (i.modality === "educacao-infantil")
    return { rows: [], blocked: "Educação Infantil não tem nota nem resultado numérico: o registro é o parecer descritivo por campos de experiência." };
  const rows = i.students.map((st): SheetRow => {
    const comps = i.components.map((c) => {
      const cell = i.cells[cellKey(st.id, c.id)];
      const grades = i.periods.map((_, k) => cell?.periodGrades[k] ?? null);
      const missing = grades.flatMap((g, k) => (g === null ? [`${i.periods[k]} sem nota`] : []));
      const average = finalAverage(grades);
      const attendance = attendancePct(cell?.lessonsGiven ?? null, cell?.absences ?? null);
      if (attendance === null) missing.push("frequência não informada");
      const result = i.rule === null ? (statusSigla(st.status)?.long ?? AWAITING_RULE) : componentResult(st.status, average, cell?.finalRecovery ?? null, i.rule?.passMark);
      return { id: c.id, periodGrades: grades, average, finalRecovery: cell?.finalRecovery ?? null, attendance, result, missing };
    });
    const missing = comps.flatMap((c) => c.missing.map((m) => `${i.components.find((x) => x.id === c.id)?.label}: ${m}`));
    let overall: string;
    const sig = statusSigla(st.status);
    if (sig) overall = sig.long;
    else if (i.rule === null) overall = AWAITING_RULE;
    else if (i.modality === "eja") {
      const given = comps.reduce((a, c, k) => a + (i.cells[cellKey(st.id, i.components[k]!.id)]?.lessonsGiven ?? 0), 0);
      const abs = comps.map((_, k) => i.cells[cellKey(st.id, i.components[k]!.id)]?.absences ?? null);
      const att = abs.some((x) => x === null) ? null : attendancePct(given, abs.reduce<number>((a, b) => a + (b ?? 0), 0));
      overall = ejaResult(st.status, comps, att, i.rule?.passMark, i.rule ? i.rule.minAttendance ?? Number.POSITIVE_INFINITY : undefined);
    } else overall = comps.some((c) => c.result === "PENDENTE") ? "PENDENTE" : comps.every((c) => c.result === "APROVADO") ? "APROVADO" : "REPROVADO";
    return { student: st, components: comps, overall, missing };
  });
  return { rows, blocked: null };
}

/** Ata de resultados: contagens por resultado final; pendentes são contados à parte, nunca somados como aprovados. */
export function resultMinutes(rows: readonly SheetRow[]) {
  const by: Record<string, number> = {};
  for (const r of rows) by[r.overall] = (by[r.overall] ?? 0) + 1;
  return { total: rows.length, by, canClose: rows.length > 0 && !rows.some((r) => r.overall === "PENDENTE" || r.overall === AWAITING_RULE) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (n: Num) => (n === null ? "—" : String(n));
const pct = (n: Num) => (n === null ? "—" : `${Math.round(n * 100)}%`);

/** HTML A4 paisagem com bordas vetoriais de 0,75pt (estáveis em zoom 50–200%). */
export function printFinalSheet(i: SheetInput, rows: readonly SheetRow[], header: { school: string; className: string; year: string; state?: string; verification?: string }) {
  const ruleLine = i.rule === undefined ? "Laboratório: valores de referência das planilhas da rede, sem efeito oficial" : i.rule === null ? "Sem regra de resultado homologada: resultado não emitido" : `Regra: ${i.rule.label} (aprovação ≥ ${i.rule.passMark}${i.rule.minAttendance !== null ? `; frequência ≥ ${Math.round(i.rule.minAttendance * 100)}%` : ""})`;
  const head = `<tr><th rowspan=2>Nº</th><th rowspan=2>Estudante</th>${i.components.map((c) => `<th colspan=${i.periods.length + 4}>${esc(c.label)}</th>`).join("")}<th rowspan=2>Resultado</th></tr>
<tr>${i.components.map(() => i.periods.map((p) => `<th>${esc(p)}</th>`).join("") + "<th>Méd.</th><th>R.F.</th><th>Freq.</th><th>Sit.</th>").join("")}</tr>`;
  const body = rows.map((r, k) => `<tr><td>${k + 1}</td><td class=l>${esc(r.student.name)}</td>${r.components.map((c) => c.periodGrades.map((g) => `<td>${fmt(g)}</td>`).join("") + `<td>${fmt(c.average)}</td><td>${fmt(c.finalRecovery)}</td><td>${pct(c.attendance)}</td><td>${esc(statusSigla(r.student.status)?.short ?? c.result.slice(0, 3))}</td>`).join("")}<td><b>${esc(r.overall)}</b></td></tr>`).join("");
  const m = resultMinutes(rows);
  return `<!doctype html><html><head><meta charset=utf-8><title>Folha Final</title><style>@page{size:A4 landscape;margin:10mm}body{font:9pt Arial,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:0.75pt solid #000;padding:2pt;text-align:center}td.l{text-align:left}tr{break-inside:avoid}thead{display:table-header-group}h1{font-size:12pt;margin:0}</style></head><body>
<h1>FOLHA FINAL — ${esc(header.school)}</h1><p>Turma: ${esc(header.className)} · Ano letivo: ${esc(header.year)} · ${esc(ruleLine)}${header.state ? ` · Situação: ${esc(header.state)}` : ""}</p>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
<p>Ata: ${m.total} estudantes · ${Object.entries(m.by).map(([k, v]) => `${esc(k)}: ${v}`).join(" · ")}${m.canClose ? "" : " · HÁ PENDÊNCIAS — fechamento bloqueado"}</p>
<p style="margin-top:24pt">______________________ Professor(a) &nbsp;&nbsp; ______________________ Secretário(a) &nbsp;&nbsp; ______________________ Diretor(a)</p>${header.verification ?? ""}</body></html>`;
}
