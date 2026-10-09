/**
 * NDIARY.FINAL.2 — as 7 impressões do Diário. Renderer especializado (o layout tabular exige),
 * puro e com escape total: recebe apenas o que os readers governados devolveram com a sessão do
 * usuário. Ausência nunca vira zero nem presença; marcação "Ausente" (valor armazenado) é exibida
 * como "Falta". O espelho final só sai com o período fechado por OP + Direção (BQ.5).
 */
import { reviewEventLabel } from "@/features/teacher-review/teacher-work-review";

export type DiaryPrintKind = "periodo" | "frequencia" | "aulas" | "planejamento" | "avaliacoes" | "espelho-final" | "sipe-sia";

export const DIARY_PRINTS: readonly { kind: DiaryPrintKind; title: string; orientation: "portrait" | "landscape" }[] = [
  { kind: "periodo", title: "Diário do período", orientation: "landscape" },
  { kind: "frequencia", title: "Frequência", orientation: "landscape" },
  { kind: "aulas", title: "Registro de aulas", orientation: "portrait" },
  { kind: "planejamento", title: "Planejamento", orientation: "portrait" },
  { kind: "avaliacoes", title: "Notas e avaliações", orientation: "landscape" },
  { kind: "espelho-final", title: "Espelho final fechado", orientation: "landscape" },
  { kind: "sipe-sia", title: "SIPE/SIA — histórico de revisão", orientation: "portrait" },
];

export type DiaryPrintData = {
  school: string | null;
  className: string | null;
  period: { label: string | null; from: string; to: string };
  students: { id: string; name: string | null }[];
  lessons: { logicalId: string; date: string; quantity: number; content: string | null; version: number }[];
  attendance: { lessonLogicalId: string; date: string; marks: Record<string, string> }[];
  plans: { title: string | null; status: string | null; from: string | null; until: string | null; version: number }[];
  assessments: { instrument: string; studentId: string; value: string | null }[];
  closing: { state: string | null; orientacaoAt: string | null; direcaoAt: string | null };
  reviews: { subject: string; event: string; at: string; comment: string | null }[];
};

const NA = "não disponível";
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const d = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : NA);
const or = (x: string | null | undefined) => (x === null || x === undefined || x === "" ? NA : x);

/** Valor armazenado → rótulo impresso. Sem marcação = "—" (nunca presença presumida). */
export function markLabel(m: string | undefined): string {
  if (m === "Presente") return "P";
  if (m === "Ausente") return "F";
  return "—";
}

/** Fechado = OP e Direção aprovaram (projeção de teacher_diary_state_at). */
export const isClosed = (c: DiaryPrintData["closing"]) => Boolean(c.orientacaoAt && c.direcaoAt);

export function attendanceTotals(data: DiaryPrintData) {
  return data.students.map((s) => {
    let p = 0, f = 0, sem = 0;
    for (const a of data.attendance) { const m = a.marks[s.id]; if (m === "Presente") p++; else if (m === "Ausente") f++; else sem++; }
    return { id: s.id, presencas: p, faltas: f, semMarcacao: sem };
  });
}

function table(head: string[], rows: string[][], caption: string) {
  return `<table><caption>${esc(caption)}</caption><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}">Nenhum registro no período.</td></tr>`
  }</tbody></table>`;
}

function frequencyTable(data: DiaryPrintData) {
  const cols = [...data.attendance].sort((a, b) => a.date.localeCompare(b.date));
  const tot = new Map(attendanceTotals(data).map((t) => [t.id, t]));
  return table(["Nº", "Estudante", ...cols.map((c) => d(c.date).slice(0, 5)), "P", "F", "Sem marcação"],
    data.students.map((s, i) => { const t = tot.get(s.id)!; return [String(i + 1), or(s.name), ...cols.map((c) => markLabel(c.marks[s.id])), String(t.presencas), String(t.faltas), String(t.semMarcacao)]; }),
    "Frequência por aula (P = presente, F = falta, — = sem marcação)");
}
const lessonsTable = (data: DiaryPrintData) => table(["Data", "Aulas", "Conteúdo ou atividade", "Versão"],
  [...data.lessons].sort((a, b) => a.date.localeCompare(b.date)).map((l) => [d(l.date), String(l.quantity), or(l.content), `v${l.version}`]), "Registros de aula concluídos");
const plansTable = (data: DiaryPrintData) => table(["Plano", "Situação", "De", "Até", "Versão"],
  data.plans.map((p) => [or(p.title), or(p.status), d(p.from), d(p.until), `v${p.version}`]), "Planejamentos");
function assessTable(data: DiaryPrintData) {
  const inst = [...new Set(data.assessments.map((a) => a.instrument))];
  const val = new Map(data.assessments.map((a) => [`${a.instrument}|${a.studentId}`, a.value]));
  return table(["Estudante", ...inst], data.students.map((s) => [or(s.name), ...inst.map((i) => or(val.get(`${i}|${s.id}`) ?? null))]), "Resultados registrados por instrumento");
}

export type PrintResult = { ok: true; html: string } | { ok: false; reason: string };

export function renderDiaryPrint(kind: DiaryPrintKind, data: DiaryPrintData, issuedAt: string): PrintResult {
  const meta = DIARY_PRINTS.find((p) => p.kind === kind);
  if (!meta) return { ok: false, reason: "Impressão não reconhecida." };
  if (kind === "espelho-final" && !isClosed(data.closing)) return { ok: false, reason: "O espelho final só é emitido depois que a Orientação Pedagógica e a Direção aprovarem o diário do período." };
  const header = `<header><h1>${esc(meta.title)}</h1><p>${esc(or(data.school))} · Turma ${esc(or(data.className))} · Período ${esc(or(data.period.label))} (${d(data.period.from)} a ${d(data.period.to)})</p></header>`;
  const closing = `<p class="st">Fechamento do período: ${isClosed(data.closing) ? `fechado — Orientação em ${d(data.closing.orientacaoAt)}, Direção em ${d(data.closing.direcaoAt)}` : "em aberto (não é documento final)"}.</p>`;
  let body = "";
  if (kind === "periodo") body = lessonsTable(data) + frequencyTable(data);
  if (kind === "frequencia") body = frequencyTable(data);
  if (kind === "aulas") body = lessonsTable(data);
  if (kind === "planejamento") body = plansTable(data);
  if (kind === "avaliacoes") body = assessTable(data);
  if (kind === "espelho-final") body = lessonsTable(data) + frequencyTable(data) + assessTable(data);
  if (kind === "sipe-sia") body = table(["Objeto", "Evento", "Data", "Comentário"], data.reviews.map((r) => [r.subject, reviewEventLabel(r.event), d(r.at), or(r.comment)]), "Histórico de revisão (SIPE/SIA)");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(meta.title)}</title><style>
@page{size:A4 ${meta.orientation};margin:12mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:8px sans-serif}}
body{font:10px/1.35 sans-serif;margin:0;overflow-wrap:anywhere}h1{font-size:15px;margin:0}table{width:100%;border-collapse:collapse;margin-top:8px;page-break-inside:auto}
tr{page-break-inside:avoid}thead{display:table-header-group}th,td{border:1px solid #444;padding:2px 3px;text-align:left}caption{text-align:left;font-weight:bold;padding:4px 0}.st{border:1px solid #444;padding:4px}
footer{margin-top:10px;font-size:8px}</style></head><body>${header}${kind === "sipe-sia" ? "" : closing}${body}<footer>Gerado em ${esc(d(issuedAt))} a partir dos registros lidos com o acesso de quem imprime. Campo sem dado aparece como "${NA}".</footer></body></html>`;
  return { ok: true, html };
}
