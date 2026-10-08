/**
 * NHOR.4 — documento imprimível (PDF pelo navegador) da grade por turma, profissional ou escola.
 * Só transcreve blocos lidos e conflitos factuais; nada é calculado como carga normativa.
 * Layout segue NDOC.2: A4, quebra de texto longo, cabeçalho de tabela repetido, sem interface do app.
 */
import { WEEKDAY_LABEL } from "@/features/student-life/class-journey-source";
import { formatAcademicDate } from "@/lib/academic-date";
import { CROSS_CLASS_TEXT, NO_CROSS_CLASS_TEXT, type CrossClassConflict, type Registered } from "./teacher-cross-class-conflicts";

export type PrintScope = "turma" | "profissional" | "escola";
export type PrintRow = { className: string; weekday: number; startsAt: string; endsAt: string; block: string; responsibles: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const day = (n: number) => WEEKDAY_LABEL[n] ?? "Dia não reconhecido";

export function rowsOf(schedules: readonly Registered[], className: (id: string) => string, nameOf: (engagementId: string) => string | undefined, onlyEngagements?: ReadonlySet<string>): PrintRow[] {
  const rows: PrintRow[] = [];
  for (const s of schedules) for (const d of s.days) for (const b of d.blocks) {
    if (onlyEngagements && !b.engagementIds.some((e) => onlyEngagements.has(e))) continue;
    rows.push({
      className: className(s.classId), weekday: d.weekday, startsAt: b.startsAt, endsAt: b.endsAt,
      block: b.componentName ?? b.nature?.label ?? b.blockKey,
      responsibles: b.engagementIds.length ? b.engagementIds.map((e) => nameOf(e) ?? "Responsável sem nome legível").join("; ") : "Sem responsável registrado",
    });
  }
  return rows.sort((x, y) => x.weekday - y.weekday || x.startsAt.localeCompare(y.startsAt) || x.className.localeCompare(y.className));
}

export function schedulePrintHtml(input: {
  scope: PrintScope; subject: string; validOn: string; rows: readonly PrintRow[];
  conflicts: readonly CrossClassConflict[]; className: (id: string) => string; personName: (id: string) => string;
  coverage: string | null;
}): string {
  const title = { turma: "Grade da turma", profissional: "Horário do profissional", escola: "Grades da escola" }[input.scope];
  const body = input.rows.length
    ? input.rows.map((r) => `<tr><td>${esc(r.className)}</td><td>${esc(day(r.weekday))}</td><td>${esc(r.startsAt)}–${esc(r.endsAt)}</td><td>${esc(r.block)}</td><td>${esc(r.responsibles)}</td></tr>`).join("")
    : `<tr><td colspan="5">Grade não registrada.</td></tr>`;
  const conf = input.conflicts.length
    ? `<p class="alert">${esc(CROSS_CLASS_TEXT)}</p><ul>${input.conflicts.map((c) => `<li>${esc(input.personName(c.personId))} · ${esc(day(c.weekday))} ${esc(c.overlapStart)}–${esc(c.overlapEnd)}: ${esc(input.className(c.a.classId))} e ${esc(input.className(c.b.classId))}</li>`).join("")}</ul>`
    : `<p>${esc(NO_CROSS_CLASS_TEXT)}</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)} — ${esc(input.subject)}</title><style>
@page{size: A4;margin:14mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px serif}}body{font:11px/1.4 system-ui,sans-serif;color:#111;margin:0;overflow-wrap:anywhere}
h1{font-size:15px;margin:0 0 4px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #999;padding:3px 4px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
thead{display:table-header-group}tr{break-inside:avoid}.alert{font-weight:600}.note{color:#444}
</style></head><body><h1>${esc(title)} — ${esc(input.subject)}</h1><p class="note">Situação em ${esc(formatAcademicDate(input.validOn))}. Somente blocos registrados; não é carga horária normativa nem aula prevista.</p>
<h2 style="font-size:12px">Conflitos entre turmas</h2>${conf}${input.coverage ? `<p class="note">${esc(input.coverage)}</p>` : ""}
<table><colgroup><col style="width:18%"><col style="width:12%"><col style="width:12%"><col style="width:23%"><col style="width:35%"></colgroup><thead><tr><th>Turma</th><th>Dia</th><th>Horário</th><th>Bloco</th><th>Responsáveis</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function openSchedulePrint(html: string) {
  const w = window.open("", "_blank"); if (!w) return;
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
