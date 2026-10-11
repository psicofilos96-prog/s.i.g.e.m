/**
 * Livro do Diário por família de modelo da rede: cálculos puros e renderização A4 fiel às folhas do modelo.
 * Recebe só o que os readers governados devolveram com a sessão de quem imprime. Ausência nunca vira
 * zero nem presença: célula sem dado imprime "—". Sem regra de resultado homologada, a impressão sai
 * como RASCUNHO com os parâmetros do modelo da rede citados, nunca como documento final.
 */
import { attendancePct, finalAverage, PASS_MARK, periodGradeFI, periodGradeFII, statusSigla, type EnrollmentStatus } from "../network-model-rules";
import { familyOf, type FamilyId, type SheetKind, type SheetSpec } from "./families";

/** Coluna do modelo à qual um instrumento pertence (declarada no instrumento, nunca inferida do título). */
export type ModelColumn = "av1" | "av2" | "iv" | "pa" | "rp" | "rf";
export const MODEL_COLUMNS: readonly { id: ModelColumn; short: string; label: string; max: number }[] = [
  { id: "av1", short: "AV1", label: "AV1 — avaliação específica", max: 30 },
  { id: "av2", short: "AV2", label: "AV2 — simulado", max: 30 },
  { id: "iv", short: "IV", label: "Instrumentos variados", max: 30 },
  { id: "pa", short: "PA", label: "Participação", max: 10 },
  { id: "rp", short: "RP", label: "Recuperação paralela", max: 60 },
  { id: "rf", short: "RF", label: "Recuperação final", max: 100 },
];
export const isModelColumn = (x: unknown): x is ModelColumn => MODEL_COLUMNS.some((c) => c.id === x);

export type BookStudent = { id: string; name: string; status: EnrollmentStatus };
export type BookPeriod = { label: string; from: string; to: string; planned: number | null };
export type AttendanceColumn = { componentId: string | null; date: string; marks: Readonly<Record<string, string>>; eligible: readonly string[] };
export type LessonContent = { componentId: string | null; date: string; content: string | null };
/** Valor de um instrumento classificado: número, ou não registrado explícito (≠ zero). */
export type GradeEntry = { componentId: string; studentId: string; column: ModelColumn; periodIndex: number | null; value: number | null; notRecorded: boolean };
export type ExperienceEntry = { periodIndex: number; studentId: string; objectiveCodes: readonly string[]; text: string | null };

export type BookInput = {
  family: FamilyId;
  header: { school: string | null; className: string | null; stage: string | null; shift: string | null; teacher: string | null; yearLabel: string | null };
  components: readonly { id: string; label: string }[];
  /** Família de componente único: componente impresso. */
  componentId: string | null;
  periods: readonly BookPeriod[];
  students: readonly BookStudent[];
  attendance: readonly AttendanceColumn[];
  lessons: readonly LessonContent[];
  grades: readonly GradeEntry[];
  experiences: readonly ExperienceEntry[];
  /** Regra de resultado homologada aplicável (Folha Final); null ⇒ rascunho pelos parâmetros do modelo. */
  rule: { label: string; passMark: number } | null;
  /** Instrumentos sem coluna do modelo declarada: aparecem como pendência, nunca somados. */
  unclassified: readonly { id: string; title: string }[];
};

type Num = number | null;
const inRange = (d: string, p: BookPeriod) => d >= p.from && d <= p.to;
const sameComp = (c: string | null, wanted: string | null) => wanted === null || c === wanted;

/** Faltas e aulas dadas de um estudante no período (componente opcional). Elegível sem marcação ⇒ desconhecido. */
export function absencesOf(i: BookInput, studentId: string, p: BookPeriod, componentId: string | null, monthOf?: string) {
  let given = 0, absences = 0, unknown = false;
  for (const a of i.attendance) {
    if (!inRange(a.date, p) || !sameComp(a.componentId, componentId) || (monthOf && a.date.slice(0, 7) !== monthOf)) continue;
    const eligible = a.eligible.includes(studentId) || studentId in a.marks;
    if (!eligible) continue;
    const m = a.marks[studentId];
    if (m === "Ausente") { given++; absences++; } else if (m === "Presente") given++; else unknown = true;
  }
  return { given, absences: unknown ? null : absences, rawAbsences: absences, unknown };
}

/** Aulas dadas no período = colunas de chamada registradas (modelo: COUNTA dos dias). */
export const lessonsGiven = (i: BookInput, p: BookPeriod, componentId: string | null, month?: string) =>
  i.attendance.filter((a) => inRange(a.date, p) && sameComp(a.componentId, componentId) && (!month || a.date.slice(0, 7) === month)).length;

export type GradeCells = Record<ModelColumn, Num> & { total: Num; note: Num; warnings: string[]; notRecorded: ModelColumn[] };

/** Células AV1/AV2/IV/PA/RP e nota do período pela regra da família. Vários lançamentos na mesma coluna ⇒ soma só em IV (instrumentos variados). */
export function gradeCells(i: BookInput, studentId: string, componentId: string, periodIndex: number): GradeCells {
  const out = { av1: null, av2: null, iv: null, pa: null, rp: null, rf: null, total: null, note: null, warnings: [] as string[], notRecorded: [] as ModelColumn[] } as GradeCells;
  for (const g of i.grades) {
    if (g.studentId !== studentId || g.componentId !== componentId || g.column === "rf" || g.periodIndex !== periodIndex) continue;
    if (g.notRecorded) { out.notRecorded.push(g.column); continue; }
    if (g.value === null) continue;
    const cur = out[g.column];
    if (cur !== null && g.column !== "iv") out.warnings.push(`Mais de um lançamento em ${g.column.toUpperCase()}: só o maior conta.`);
    out[g.column] = cur === null ? g.value : g.column === "iv" ? cur + g.value : Math.max(cur, g.value);
  }
  for (const c of MODEL_COLUMNS) { const v = out[c.id]; if (v !== null && v > c.max) out.warnings.push(`${c.short} acima do máximo do modelo (${c.max}).`); }
  const parts: Num[] = [out.av1, out.av2, out.iv, out.pa];
  out.total = parts.every((x) => x === null) ? null : parts.reduce<number>((a, b) => a + (b ?? 0), 0);
  const grade = familyOf(i.family).grade;
  out.note = grade === "fundamental-i" ? periodGradeFI(parts) : grade === "fundamental-ii"
    ? periodGradeFII({ av1: out.av1, av2: out.av2, instruments: out.iv, participation: out.pa, parallelRecovery: out.rp }) : null;
  return out;
}

export function finalRecovery(i: BookInput, studentId: string, componentId: string): Num {
  const v = i.grades.filter((g) => g.studentId === studentId && g.componentId === componentId && g.column === "rf" && g.value !== null).map((g) => g.value as number);
  return v.length ? Math.max(...v) : null;
}

/** Linha final do componente: notas dos PL, média, RF, faltas e resultado (rascunho sem regra homologada). */
export function finalRow(i: BookInput, s: BookStudent, componentId: string) {
  const notes = i.periods.map((_, k) => gradeCells(i, s.id, componentId, k).note);
  const absences = i.periods.map((p) => absencesOf(i, s.id, p, componentId).absences);
  const avg = finalAverage(notes);
  const rf = finalRecovery(i, s.id, componentId);
  const sigla = statusSigla(s.status);
  const pass = i.rule?.passMark ?? PASS_MARK;
  const result = sigla ? sigla.long : avg === null ? "PENDENTE" : Math.max(avg, rf ?? -Infinity) >= pass ? "APROVADO" : "REPROVADO";
  const totalAbs = absences.some((a) => a === null) ? null : absences.reduce<number>((a, b) => a + (b ?? 0), 0);
  return { notes, avg, rf, absences, totalAbs, result, draft: i.rule === null };
}

// ------------------------------------------------------------------ renderização

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const DASH = "—";
const n = (x: Num, digits = 0) => (x === null ? DASH : digits ? x.toFixed(digits).replace(".", ",") : String(Math.round(x * 100) / 100).replace(".", ","));
const pct = (x: Num) => (x === null ? DASH : `${Math.round(x * 100)}%`);
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
/** Marcação do modelo: "." presente, "F" falta, "—" sem marcação (nunca presença presumida). */
export function modelMark(m: string | undefined): string { return m === "Presente" ? "." : m === "Ausente" ? "F" : DASH; }

function monthsOf(p: BookPeriod): string[] {
  const out: string[] = []; let y = Number(p.from.slice(0, 4)), m = Number(p.from.slice(5, 7));
  const end = p.to.slice(0, 7);
  for (let k = 0; k < 13; k++) { const ym = `${y}-${String(m).padStart(2, "0")}`; out.push(ym); if (ym >= end) break; m++; if (m > 12) { m = 1; y++; } }
  return out;
}

type Ctx = { i: BookInput; emblem: string | null; issuedAt: string };
const compLabel = (i: BookInput, id: string | null) => (id ? i.components.find((c) => c.id === id)?.label ?? "Componente sem rótulo visível" : DASH);
const statusTag = (s: BookStudent) => { const g = statusSigla(s.status); return g ? ` <span class="sig">(${g.short})</span>` : ""; };

function head(c: Ctx, title: string, extra = "") {
  const h = c.i.header;
  return `<div class="hd">${c.emblem ? `<img src="${esc(c.emblem)}" alt="Brasão" class="em">` : ""}<div><b>${esc(h.school ?? "Escola não disponível")}</b><br>${esc([h.stage, h.className ? `Turma ${h.className}` : null].filter(Boolean).join(" – ") || "Turma não disponível")} · Ano letivo ${esc(h.yearLabel ?? DASH)}${extra ? `<br>${extra}` : ""}</div><h2>${esc(title)}</h2></div>`;
}
const sign = (who: readonly string[], c: Ctx) => `<div class="sg">${who.map((w) => `<div><span></span>${esc(w)}${w === "Assinatura do professor" && c.i.header.teacher ? `<br><small>${esc(c.i.header.teacher)}</small>` : ""}</div>`).join("")}</div>`;
const table = (cls: string, headRows: string, body: string) => `<table class="${cls}"><thead>${headRows}</thead><tbody>${body}</tbody></table>`;
const emptyRow = (cols: number, text = "Nenhum estudante visível com o seu acesso.") => `<tr><td colspan="${cols}">${esc(text)}</td></tr>`;

function sheetCapa(c: Ctx) {
  const h = c.i.header;
  return `<div class="capa">${c.emblem ? `<img src="${esc(c.emblem)}" alt="Brasão" class="emc">` : ""}<p class="big">ANO LETIVO DE ${esc(h.yearLabel ?? DASH)}</p>
  <dl><dt>NOME DO ESTABELECIMENTO</dt><dd>${esc(h.school ?? DASH)}</dd><dt>TURMA</dt><dd>${esc(h.className ?? DASH)}</dd><dt>ANO DE ESCOLARIDADE</dt><dd>${esc(h.stage ?? DASH)}</dd><dt>TURNO</dt><dd>${esc(h.shift ?? DASH)}</dd><dt>PROFESSOR(A)</dt><dd>${esc(h.teacher ?? DASH)}</dd>${c.i.componentId ? `<dt>DISCIPLINA</dt><dd>${esc(compLabel(c.i, c.i.componentId))}</dd>` : ""}</dl></div>`;
}

function sheetFrequencia(c: Ctx, k: number, withGrades: boolean, integral = false) {
  const { i } = c; const p = i.periods[k]!; const comp = i.componentId;
  const cols = i.attendance.filter((a) => inRange(a.date, p) && sameComp(a.componentId, comp)).sort((a, b) => a.date.localeCompare(b.date));
  const months = monthsOf(p).map((m) => ({ m, n: cols.filter((x) => x.date.startsWith(m)).length })).filter((x) => x.n > 0);
  const gradeComps = withGrades ? i.components : [];
  const r1 = `<tr><th rowspan="2" scope="col">Nº</th><th rowspan="2" scope="col">NOME DO ALUNO</th>${months.map((x) => `<th colspan="${x.n}" scope="colgroup">${monthName(x.m)}</th>`).join("") || `<th rowspan="2" scope="col">Sem aulas com chamada no período</th>`}<th rowspan="2" scope="col">Total de faltas</th>${gradeComps.length ? `<th colspan="${gradeComps.length}" scope="colgroup">NOTAS</th>` : ""}</tr>`;
  const r2 = `<tr>${cols.map((x) => `<th scope="col" class="d">${x.date.slice(8, 10)}</th>`).join("")}${gradeComps.map((g) => `<th scope="col" class="v">${esc(g.label)}</th>`).join("")}</tr>`;
  const body = i.students.map((s, idx) => {
    const a = absencesOf(i, s.id, p, comp);
    return `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}${statusTag(s)}</td>${cols.map((x) => `<td class="k">${(x.eligible.includes(s.id) || s.id in x.marks) ? modelMark(x.marks[s.id]) : ""}</td>`).join("")}${months.length ? "" : "<td></td>"}<td class="k">${n(a.absences)}</td>${gradeComps.map((g) => `<td class="k">${n(gradeCells(i, s.id, g.id, k).note)}</td>`).join("")}</tr>`;
  }).join("") || emptyRow(4 + cols.length + gradeComps.length);
  const perMonth = monthsOf(p).map((m) => `<tr><td>AULAS PREVISTAS (${monthName(m)})</td><td>${DASH}</td><td>AULAS DADAS (${monthName(m)})</td><td>${lessonsGiven(i, p, comp, m)}</td></tr>`).join("");
  const contents = i.lessons.filter((l) => inRange(l.date, p) && sameComp(l.componentId, comp)).sort((a, b) => a.date.localeCompare(b.date));
  const extra = integral ? `Oficineiro: ${esc(i.header.teacher ?? DASH)} · ${esc(p.label)}` : `${withGrades ? "Áreas de conhecimento" : "Disciplina"}: ${esc(withGrades ? i.components.map((x) => x.label).join(", ") || DASH : compLabel(i, comp))} · ${esc(p.label)}`;
  return `${head(c, integral ? "FREQUÊNCIA INTEGRAL" : `${p.label.toUpperCase()} — FREQUÊNCIA`, extra)}${table("freq", r1 + r2, body)}
  <p class="lg">Legenda: "." presente · "F" falta · "—" aula sem marcação (não é presença) · T/E/MC/F situação da matrícula.</p>
  ${integral ? "" : `<table class="mini"><tbody>${perMonth}<tr><th scope="row">TOTAL DE AULAS PREVISTAS</th><td>${n(p.planned)}</td><th scope="row">TOTAL DE AULAS DADAS</th><td>${lessonsGiven(i, p, comp)}</td></tr></tbody></table>`}
  <p>Obs.: ____________________________________________ &nbsp; Data de encerramento: ____/____/______</p>${sign(integral ? ["Assinatura do oficineiro"] : ["Assinatura do professor"], c)}
  ${integral ? "" : `<h3 class="brk">LANÇAMENTO DO CONTEÚDO LECIONADO — ${esc(monthsOf(p).map(monthName).join(", "))}</h3>${table("cont", `<tr><th scope="col">DIA</th><th scope="col">CONTEÚDO</th></tr>`, contents.map((l) => `<tr><td class="k">${dm(l.date)}</td><td>${esc(l.content ?? "Registro sem conteúdo visível")}</td></tr>`).join("") || emptyRow(2, "Nenhum registro de aula concluído no período."))}${sign(["Assinatura do professor"], c)}`}`;
}

function sheetPap(c: Ctx, k: number) {
  const { i } = c; const p = i.periods[k]!;
  const r1 = `<tr><th rowspan="2" scope="col">Nº</th><th rowspan="2" scope="col">NOME DOS ALUNOS</th>${i.components.map((g) => `<th colspan="5" scope="colgroup">${esc(g.label)}</th>`).join("") || `<th rowspan="2" scope="col">Nenhum componente com avaliação visível</th>`}</tr>`;
  const r2 = `<tr>${i.components.map(() => ["AV1", "AV2", "IV", "PA", "N"].map((x) => `<th scope="col">${x}</th>`).join("")).join("")}</tr>`;
  const body = i.students.map((s, idx) => `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}${statusTag(s)}</td>${i.components.map((g) => { const x = gradeCells(i, s.id, g.id, k); return [x.av1, x.av2, x.iv, x.pa].map((v) => `<td class="k">${n(v)}</td>`).join("") + `<td class="k b">${n(x.note)}</td>`; }).join("")}${i.components.length ? "" : "<td></td>"}</tr>`).join("") || emptyRow(3 + i.components.length * 5);
  const legend = `<ul class="lg"><li>AV1 — Avaliação I = específica (30 pontos)</li><li>AV2 — Avaliação II = simulado (30 pontos)</li><li>IV — Instrumentos variados (seminários, tarefas, pesquisas, entre outros)</li><li>PA — Participação: aspectos socioemocionais e comportamentais (10 pontos)</li><li>N = soma dos instrumentos lançados (modelo da rede, PAP!G9). Sem lançamento ⇒ "—", nunca zero.</li></ul>`;
  return `${head(c, "PLANILHA DE ACOMPANHAMENTO PEDAGÓGICO", `${esc(p.label)} · Professor: ${esc(i.header.teacher ?? DASH)}`)}${legend}${table("grid", r1 + r2, body)}<p>Orientação: ________________________________________________</p>${sign(["Assinatura do professor"], c)}`;
}

function sheetNotasPeriodo(c: Ctx, k: number) {
  const { i } = c; const p = i.periods[k]!; const comp = i.componentId!; const months = monthsOf(p);
  const given = lessonsGiven(i, p, comp);
  const r1 = `<tr><th rowspan="2" scope="col">Nº</th><th rowspan="2" scope="col">NOME</th><th colspan="${months.length}" scope="colgroup">Faltas do ${esc(p.label)}</th><th rowspan="2" scope="col">Total de faltas</th><th rowspan="2" scope="col">% Frequência</th><th colspan="6" scope="colgroup">AVALIAÇÕES</th><th rowspan="2" scope="col">NOTA FINAL DO PL (100)</th></tr>`;
  const r2 = `<tr>${months.map((m) => `<th scope="col">${monthName(m).slice(0, 3)}</th>`).join("")}<th scope="col">AV1 (30)</th><th scope="col">AV2 (30)</th><th scope="col">Instr. variados (30)</th><th scope="col">Particip. (10)</th><th scope="col">TOTAL (100)</th><th scope="col">Rec. paralela (60)</th></tr>`;
  const body = i.students.map((s, idx) => {
    const a = absencesOf(i, s.id, p, comp); const x = gradeCells(i, s.id, comp, k);
    const freq = a.absences === null ? null : attendancePct(given || null, a.absences);
    return `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}${statusTag(s)}</td>${months.map((m) => `<td class="k">${n(absencesOf(i, s.id, p, comp, m).absences)}</td>`).join("")}<td class="k">${n(a.absences)}</td><td class="k">${pct(freq)}</td>${[x.av1, x.av2, x.iv, x.pa, x.total, x.rp].map((v) => `<td class="k">${n(v)}</td>`).join("")}<td class="k b">${n(x.note)}</td></tr>`;
  }).join("") || emptyRow(10 + months.length);
  return `${head(c, `${p.label.toUpperCase()}`, `Disciplina: ${esc(compLabel(i, comp))} · Professor: ${esc(i.header.teacher ?? DASH)}`)}
  <table class="mini"><tbody><tr><th scope="row">TOTAL DE AULAS PREVISTAS</th><td>${n(p.planned)}</td><th scope="row">TOTAL DE AULAS DADAS</th><td>${given}</td></tr></tbody></table>
  ${table("grid", r1 + r2, body)}<p class="lg">Nota do PL = MAX(AV1+AV2+IV+PA; RP+IV+PA) — modelo da rede (nº PL!Q12). % frequência = ROUND((AD−faltas)/AD;2); 100% com falta = 99% (nº PL!H12).</p>
  <p>Observações: _______________________________________________</p>${sign(["Assinatura do professor"], c)}`;
}

function sheetFinalComponente(c: Ctx) {
  const { i } = c; const comp = i.componentId!;
  const per = i.periods.map((_, k) => `${k + 1}º`);
  const planned = i.periods.map((p) => p.planned); const given = i.periods.map((p) => lessonsGiven(i, p, comp));
  const sumP = planned.some((x) => x === null) ? null : planned.reduce<number>((a, b) => a + (b ?? 0), 0);
  const r1 = `<tr><th rowspan="2" scope="col">Nº</th><th rowspan="2" scope="col">NOME</th><th colspan="${per.length}" scope="colgroup">NOTAS POR PERÍODO LETIVO</th><th rowspan="2" scope="col">MÉDIA FINAL</th><th rowspan="2" scope="col">RECUPERAÇÃO FINAL</th><th colspan="${per.length}" scope="colgroup">FALTAS POR PERÍODO LETIVO</th><th rowspan="2" scope="col">TOTAL DE FALTAS</th><th rowspan="2" scope="col">RESULTADO FINAL</th></tr>`;
  const r2 = `<tr>${per.map((x) => `<th scope="col">${x}</th>`).join("")}${per.map((x) => `<th scope="col">${x}</th>`).join("")}</tr>`;
  const body = i.students.map((s, idx) => { const r = finalRow(i, s, comp); return `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}</td>${r.notes.map((v) => `<td class="k">${n(v)}</td>`).join("")}<td class="k b">${n(r.avg)}</td><td class="k">${n(r.rf)}</td>${r.absences.map((v) => `<td class="k">${n(v)}</td>`).join("")}<td class="k">${n(r.totalAbs)}</td><td>${esc(r.result)}</td></tr>`; }).join("") || emptyRow(6 + per.length * 2);
  return `${head(c, "RESULTADO FINAL DO COMPONENTE", `Disciplina: ${esc(compLabel(i, comp))} · Professor: ${esc(i.header.teacher ?? DASH)}`)}
  <table class="mini"><thead><tr><th scope="col"></th>${per.map((x) => `<th scope="col">${x} PL</th>`).join("")}<th scope="col">TOTAL</th></tr></thead><tbody><tr><th scope="row">AULAS PREVISTAS</th>${planned.map((x) => `<td>${n(x)}</td>`).join("")}<td>${n(sumP)}</td></tr><tr><th scope="row">AULAS DADAS</th>${given.map((x) => `<td>${x}</td>`).join("")}<td>${given.reduce((a, b) => a + b, 0)}</td></tr></tbody></table>
  ${table("grid", r1 + r2, body)}<p class="lg">Média final = ROUND(média dos PL), só com todas as notas (FINAL!G8). Resultado = MAX(média; RF) ≥ ${i.rule?.passMark ?? PASS_MARK} (FINAL!N8)${i.rule ? ` — regra homologada: ${esc(i.rule.label)}` : " — prévia pelo modelo da rede, sem regra homologada"}. Siglas: T transferido, E evadido, MC matrícula cancelada, F falecido.</p>${sign(["Assinatura do professor"], c)}`;
}

function sheetFaltas(c: Ctx) {
  const { i } = c; const per = i.periods;
  const given = per.map((p) => lessonsGiven(i, p, null)); const total = given.reduce((a, b) => a + b, 0);
  const r = `<tr><th scope="col">Nº</th><th scope="col">Nome do aluno</th>${per.map((p, k) => `<th scope="col">${esc(p.label)}<br>AD: ${given[k]}</th>`).join("")}<th scope="col">Total de faltas</th><th scope="col">% Frequência</th></tr>`;
  const body = i.students.map((s, idx) => { const ab = per.map((p) => absencesOf(i, s.id, p, null).absences); const t = ab.some((x) => x === null) ? null : ab.reduce<number>((a, b) => a + (b ?? 0), 0); return `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}${statusTag(s)}</td>${ab.map((x) => `<td class="k">${n(x)}</td>`).join("")}<td class="k">${n(t)}</td><td class="k">${pct(t === null ? null : attendancePct(total || null, t))}</td></tr>`; }).join("") || emptyRow(4 + per.length);
  return `${head(c, "FALTAS DOS PERÍODOS", `Total de aulas dadas anuais: ${total}`)}${table("grid", r, body)}${sign(["Assinatura do professor"], c)}`;
}

function sheetFaPeriodo(c: Ctx, k: number) {
  const { i } = c; const p = i.periods[k]!;
  const codes = [...new Set(i.experiences.filter((e) => e.periodIndex === k).flatMap((e) => e.objectiveCodes))].sort();
  const r = `<tr><th scope="col">Nº</th><th scope="col">Nome do aluno</th>${codes.map((x) => `<th scope="col" class="v">${esc(x)}</th>`).join("") || `<th scope="col">Objetivos</th>`}</tr>`;
  const body = i.students.map((s, idx) => { const e = i.experiences.find((x) => x.periodIndex === k && x.studentId === s.id); return `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}${statusTag(s)}</td>${codes.map((x) => `<td class="k">${e?.objectiveCodes.includes(x) ? "X" : ""}</td>`).join("") || `<td>${e ? "Parecer sem objetivo citado" : "Sem parecer registrado"}</td>`}</tr>`; }).join("") || emptyRow(3);
  return `${head(c, `FICHA DE ACOMPANHAMENTO — ${esc(p.label.toUpperCase())}`, "Campos de experiência: O eu, o outro e o nós · Corpo, gestos e movimentos · Traços, sons, cores e formas · Escuta, fala, pensamento e imaginação · Espaços, tempos, quantidades, relações e transformações")}${table("grid", r, body)}<p class="lg">"X" = objetivo citado no parecer descritivo registrado do período. Sem nota (modelo FA - nº PL).</p>${sign(["Assinatura do professor"], c)}`;
}

function sheetFaFicha(c: Ctx) {
  const { i } = c;
  if (!i.students.length) return `${head(c, "FICHA DE ACOMPANHAMENTO E AVALIAÇÃO DO DESENVOLVIMENTO")}<p>Nenhum estudante visível com o seu acesso.</p>`;
  return i.students.map((s, idx) => {
    const per = i.periods.map((_, k) => i.experiences.find((e) => e.periodIndex === k && e.studentId === s.id) ?? null);
    const codes = [...new Set(per.flatMap((e) => e?.objectiveCodes ?? []))].sort();
    return `<section class="${idx ? "brk" : ""}">${head(c, "FICHA DE ACOMPANHAMENTO E AVALIAÇÃO DO DESENVOLVIMENTO", `Aluno(a): <b>${esc(s.name)}</b> · Turno: ${esc(i.header.shift ?? DASH)}`)}
    ${table("grid", `<tr><th scope="col">Aspectos observados (objetivo)</th>${i.periods.map((_, k) => `<th scope="col">${k + 1}º P</th>`).join("")}</tr>`, codes.map((x) => `<tr><td>${esc(x)}</td>${per.map((e) => `<td class="k">${e?.objectiveCodes.includes(x) ? "X" : ""}</td>`).join("")}</tr>`).join("") || emptyRow(1 + i.periods.length, "Nenhum objetivo citado nos pareceres registrados."))}
    ${per.map((e, k) => `<p><b>${k + 1}º período — parecer:</b> ${esc(e?.text ?? "não registrado")}</p>`).join("")}${sign(["Professor(a)", "Coordenação/Orientação"], c)}</section>`;
  }).join("");
}

function sheetObservacoes(c: Ctx) {
  const { i } = c;
  const body = i.students.map((s, idx) => `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}</td><td class="obs"></td></tr>`).join("") || emptyRow(3);
  return `${head(c, "OBSERVAÇÕES")}${table("grid", `<tr><th scope="col">Nº</th><th scope="col">Nome</th><th scope="col">Observação para a ficha individual do aluno</th></tr>`, body)}<p class="lg">Folha para preenchimento: o SIGEM não tem fonte de observação individual além do parecer da EI.</p>${sign(["Assinatura do professor"], c)}`;
}

function sheetLivroPeriodo(c: Ctx, k: number) {
  const { i } = c; const p = i.periods[k]!;
  const ad = i.components.map((g) => lessonsGiven(i, p, g.id)); const totalAd = lessonsGiven(i, p, null);
  const r1 = `<tr><th rowspan="2" scope="col">Nº</th><th rowspan="2" scope="col">Nome do aluno</th>${i.components.map((g, x) => `<th colspan="2" scope="colgroup">${esc(g.label)}<br>AD: ${ad[x]}</th>`).join("")}<th rowspan="2" scope="col">Faltas do período</th><th rowspan="2" scope="col">% Freq</th></tr>`;
  const r2 = `<tr>${i.components.map(() => `<th scope="col">N</th><th scope="col">F</th>`).join("")}</tr>`;
  const notes = i.components.map(() => [] as number[]);
  const body = i.students.map((s, idx) => {
    const tot = absencesOf(i, s.id, p, null).absences;
    return `<tr><td class="k">${idx + 1}</td><td class="nm">${esc(s.name)}${statusTag(s)}</td>${i.components.map((g, x) => { const v = gradeCells(i, s.id, g.id, k).note; if (v !== null) notes[x]!.push(v); return `<td class="k b">${n(v)}</td><td class="k">${n(absencesOf(i, s.id, p, g.id).absences)}</td>`; }).join("")}<td class="k">${n(tot)}</td><td class="k">${pct(tot === null ? null : attendancePct(totalAd || null, tot))}</td></tr>`;
  }).join("") || emptyRow(4 + i.components.length * 2);
  const avg = `<tr><th scope="row" colspan="2">MÉDIA DA TURMA POR DISCIPLINA</th>${notes.map((v) => `<td class="k" colspan="2">${v.length ? n(v.reduce((a, b) => a + b, 0) / v.length, 1) : DASH}</td>`).join("")}<td colspan="2"></td></tr>`;
  return `${head(c, `${esc(p.label.toUpperCase())} / ${esc(i.header.yearLabel ?? "")}`)}${table("grid", r1 + r2, body + avg)}<p class="lg">Média da turma = média das notas presentes (estudante sem nota não conta como zero).</p>${sign(["Assinatura do professor"], c)}`;
}

function sheetAnexo(c: Ctx, k: number) {
  const { i } = c; const p = i.periods[k]!;
  const rows = monthsOf(p).map((m) => { const cont = i.lessons.filter((l) => l.date.startsWith(m) && inRange(l.date, p)).sort((a, b) => a.date.localeCompare(b.date)); return `<tr><th scope="row">${monthName(m)}</th><td class="k">${DASH}</td><td class="k">${lessonsGiven(i, p, null, m)}</td><td>${cont.map((l) => `${dm(l.date)} ${esc(l.content ?? "")}`).join("; ") || "Sem registro de aula no mês."}</td></tr>`; }).join("");
  return `${head(c, `ANEXO — ${esc(p.label.toUpperCase())}`)}${table("grid", `<tr><th scope="col">Mês</th><th scope="col">AP</th><th scope="col">AD</th><th scope="col">Observações e conteúdos registrados</th></tr>`, rows)}<p class="lg">AP = aulas previstas (sem fonte na grade, "—"); AD = aulas com chamada registrada.</p>${sign(["Assinatura do professor"], c)}`;
}

/** Folhas emitidas pela Folha Final: a impressão aponta para lá, nunca recalcula com outra fonte. */
const delegated = (s: SheetSpec, c: Ctx) => `${head(c, s.title.toUpperCase())}<p class="st">Este documento é emitido em Diário › Folha Final, com a mesma fonte, a regra homologada e os atos de conferência e homologação (hash do conteúdo). Não é reimpresso aqui para não existir segunda versão.</p>`;

export type BookSheet = { spec: SheetSpec; periodIndex: number | null; html: string };

export function renderSheets(i: BookInput, opts: { kinds?: readonly SheetKind[] | undefined; emblem?: string | null; issuedAt: string }): BookSheet[] {
  const fam = familyOf(i.family); const c: Ctx = { i, emblem: opts.emblem ?? null, issuedAt: opts.issuedAt };
  const out: BookSheet[] = [];
  for (const spec of fam.sheets) {
    if (opts.kinds && !opts.kinds.includes(spec.kind)) continue;
    const ks = spec.perPeriod ? i.periods.map((_, k) => k) : [null];
    for (const k of ks) {
      let html = "";
      if (spec.emittedBy === "folha-final") html = delegated(spec, c);
      else if (spec.kind === "capa") html = sheetCapa(c);
      else if (spec.kind === "frequencia") html = sheetFrequencia(c, k!, fam.id === "fundamental-i" || fam.id === "eja-i-v");
      else if (spec.kind === "frequencia-integral") html = sheetFrequencia(c, k!, false, true);
      else if (spec.kind === "pap") html = sheetPap(c, k!);
      else if (spec.kind === "notas-periodo") html = i.componentId ? sheetNotasPeriodo(c, k!) : `<p class="st">Escolha o componente para emitir as notas do período.</p>`;
      else if (spec.kind === "final-componente") html = i.componentId ? sheetFinalComponente(c) : `<p class="st">Escolha o componente para emitir o resultado final.</p>`;
      else if (spec.kind === "faltas") html = sheetFaltas(c);
      else if (spec.kind === "fa-periodo") html = sheetFaPeriodo(c, k!);
      else if (spec.kind === "fa-ficha") html = sheetFaFicha(c);
      else if (spec.kind === "observacoes") html = sheetObservacoes(c);
      else if (spec.kind === "livro-periodo") html = sheetLivroPeriodo(c, k!);
      else if (spec.kind === "anexo-mensal") html = sheetAnexo(c, k!);
      out.push({ spec, periodIndex: k, html });
    }
  }
  return out;
}

/** Problemas que tornam a impressão rascunho/incompleta, ditos por extenso. */
export function bookIssues(i: BookInput): string[] {
  const out: string[] = [];
  const fam = familyOf(i.family);
  if (!i.periods.length) out.push("Nenhum período letivo informado.");
  for (const p of i.periods) if (!p.from || !p.to || p.from > p.to) out.push(`Período "${p.label}" com datas inválidas.`);
  if (fam.singleComponent && fam.id === "componente-fii-eja" && !i.componentId) out.push("Escolha o componente do diário.");
  if (fam.grade !== "sem-nota" && i.rule === null) out.push("Sem regra de resultado homologada: resultados saem como prévia pelo modelo da rede (rascunho).");
  if (i.unclassified.length) out.push(`${i.unclassified.length} instrumento(s) sem coluna do modelo declarada não entram na nota do período.`);
  const unknown = i.students.some((s) => i.periods.some((p) => absencesOf(i, s.id, p, i.componentId).unknown));
  if (unknown) out.push("Há aulas com estudante sem marcação: as faltas desse estudante ficam \"—\" (desconhecidas), nunca presença.");
  return out;
}

export function renderBook(i: BookInput, opts: { kinds?: readonly SheetKind[] | undefined; emblem?: string | null; issuedAt: string }): string {
  const sheets = renderSheets(i, opts);
  const issues = bookIssues(i);
  const draft = issues.length > 0;
  const fam = familyOf(i.family);
  const banner = draft ? `<div class="st"><b>Rascunho.</b> ${issues.map(esc).join(" ")}</div>` : "";
  const body = sheets.map((s, idx) => `<section class="sheet ${s.spec.orientation === "landscape" ? "land" : "port"}" data-sheet="${s.spec.kind}">${draft ? `<div class="wm" aria-hidden="true">RASCUNHO</div>` : ""}${idx === 0 ? banner : ""}${s.html}<footer class="ft">${esc(fam.label)} · folha do modelo "${esc(s.spec.source.replace("nº", s.periodIndex === null ? "nº" : `${s.periodIndex + 1}º`))}" · gerado em ${esc(opts.issuedAt.slice(0, 10).split("-").reverse().join("/"))} com o acesso de quem imprime${draft ? " · RASCUNHO, não é documento final" : ""}</footer></section>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(`${fam.label} — ${i.header.className ?? "turma"}`)}</title><style>
@page{size:A4 portrait;margin:10mm}@page port{size:A4 portrait;margin:10mm}@page land{size:A4 landscape;margin:8mm}
body{font:9px/1.25 Arial,Helvetica,sans-serif;margin:0;color:#000}.sheet{position:relative;page-break-after:always}.sheet:last-child{page-break-after:auto}.port{page:port}.land{page:land}
.hd{display:flex;align-items:center;gap:8px;border-bottom:1.5px solid #000;padding-bottom:3px;margin-bottom:4px}.hd h2{margin-left:auto;font-size:11px;text-align:right}.em{height:34px}
.capa{text-align:center;padding-top:30mm}.emc{height:90px}.capa .big{font-size:20px;font-weight:bold;margin:12mm 0}.capa dl{display:grid;grid-template-columns:1fr;gap:2mm;max-width:150mm;margin:0 auto;text-align:left}.capa dt{font-size:8px;border-top:1px solid #000;padding-top:1mm}.capa dd{margin:0 0 4mm;font-size:13px;font-weight:bold}
table{border-collapse:collapse;width:100%;margin:3px 0}th,td{border:.6px solid #000;padding:1px 2px;vertical-align:middle}th{background:#e8e8e8;font-weight:bold;text-align:center}thead{display:table-header-group}tr{page-break-inside:avoid}
.freq{font-size:7px}.freq td.k,.freq th.d{width:3.2mm;padding:0;text-align:center}.nm{white-space:nowrap;min-width:45mm}.k{text-align:center;white-space:nowrap}.b{font-weight:bold}.v{writing-mode:vertical-rl;transform:rotate(180deg);height:22mm;font-size:7px}
.mini{width:auto;font-size:8px}.cont td:first-child{width:12mm}.obs{height:9mm;min-width:120mm}.lg{font-size:7.5px;margin:2px 0}.sig{font-size:7px}.st{border:1px solid #000;padding:4px}
.sg{display:flex;gap:16mm;justify-content:center;margin-top:8mm}.sg div{text-align:center;font-size:8px}.sg span{display:block;width:65mm;border-top:1px solid #000;margin-bottom:1mm}
.brk{page-break-before:always}h3{font-size:10px;margin:4px 0}.ft{font-size:7px;margin-top:4px;color:#333}
.wm{position:absolute;top:40%;left:0;right:0;text-align:center;font-size:60px;color:rgba(0,0,0,.07);transform:rotate(-20deg);pointer-events:none}
</style></head><body>${body || banner}</body></html>`;
}
