/**
 * Documento A4 paisagem do Mapa DECLARADO (planilha da escola), no mesmo tema do Mapa calculado.
 * Só reorganiza os números enviados: subtotais somam apenas linhas da própria tabela, projetos ficam
 * fora do total geral e campo ausente aparece como "—", nunca como zero.
 */
import { esc, mapTheme, type MapDocumentModel } from "./map-print-theme";
import { MONTH_NAMES_LOWER } from "@/lib/format-ptbr";

type Line = { modalidade?: string | null; etapa?: string | null; turma?: string | null; alunos?: number | null; turno1?: number | null; turno2?: number | null; turno3?: number | null; integral?: number | null };
export type DeclaredDocInput = {
  headerLines: readonly string[]; schoolName: string; inep: string | null; year: number; month: number;
  movement: { previous_month_enrollment: number | null; transfers_in: number | null; new_students: number | null; transfers_out: number | null; dropouts: number | null; withdrawn_cancelled: number | null; total_ii: number | null };
  shifts: { turno1?: number | null; turno2?: number | null; turno3?: number | null; integral?: number | null; total?: number | null } | null;
  classes: readonly Line[]; projects: readonly Line[]; issues: readonly string[]; sourceFile: string;
  model?: MapDocumentModel; cover?: boolean; emblemUrl?: string | null; signatures: readonly string[]; generatedAt: string;
};

const SHIFTS = ["turno1", "turno2", "turno3", "integral"] as const;
const SHIFT_LABEL = ["1º Turno", "2º Turno", "3º Turno", "Integral"];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const show = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));
/** Soma só valores lidos; se nenhum foi lido, a soma é ausência. */
export function sumKnown(vs: readonly (number | null)[]): number | null { const k = vs.filter((x): x is number => x !== null); return k.length ? k.reduce((a, b) => a + b, 0) : null; }
const placeholder = (l: Line) => !(num(l.alunos) ?? 0) && /^[\s\-–—.]*$/.test(l.turma ?? "");

function gridTable(lines: readonly Line[], subtotalLabel: string): { html: string; totals: (number | null)[] } {
  const rows = lines.filter((l) => !placeholder(l));
  const totals = [...SHIFTS.map((k) => sumKnown(rows.map((r) => num(r[k])))), sumKnown(rows.map((r) => num(r.alunos)))];
  const body = rows.map((r) => `<tr><td>${esc(r.etapa ?? "—")}</td><td>${esc(r.turma ?? "—")}</td>${SHIFTS.map((k) => `<td class="n">${show(num(r[k]))}</td>`).join("")}<td class="n">${show(num(r.alunos))}</td></tr>`).join("");
  const html = `<table class="grid"><thead><tr><th style="width:24%">Etapa / Ano</th><th style="width:22%">Turma</th>${SHIFT_LABEL.map((s) => `<th class="n">${s}</th>`).join("")}<th class="n">Total</th></tr></thead><tbody>${body}
<tr class="sub"><td colspan="2">${esc(subtotalLabel)}</td>${totals.map((t) => `<td class="n">${show(t)}</td>`).join("")}</tr></tbody></table>`;
  return { html, totals };
}

export function renderDeclaredMapDocument(d: DeclaredDocInput): string {
  const comp = `${MONTH_NAMES_LOWER[d.month - 1] ?? d.month}/${d.year}`;
  const t = mapTheme({ model: d.model, cover: d.cover, emblemUrl: d.emblemUrl, headerLines: d.headerLines, schoolName: d.schoolName, competence: comp, signatures: d.signatures.length });
  const m = d.movement;
  const mov = [["Matrícula do mês anterior", m.previous_month_enrollment], ["Transferências recebidas", m.transfers_in], ["Alunos novos", m.new_students], ["Transferências expedidas", m.transfers_out], ["Evadidos", m.dropouts], ["Desistentes / cancelados", m.withdrawn_cancelled], ["Total de matrículas", m.total_ii]] as const;
  const byMod = new Map<string, Line[]>();
  for (const c of d.classes) { const k = (c.modalidade ?? "Modalidade não informada").trim(); byMod.set(k, [...(byMod.get(k) ?? []), c]); }
  const mods = [...byMod.entries()].map(([k, ls]) => ({ k, ...gridTable(ls, `Subtotal ${k.toLowerCase()}`) }));
  const geral = SHIFTS.map((_, i) => sumKnown(mods.map((x) => x.totals[i] ?? null))).concat([sumKnown(mods.map((x) => x.totals[4] ?? null))]);
  const proj = d.projects.filter((p) => !placeholder(p));
  const sh = d.shifts ?? {};
  const empty = (what: string) => `<p class="empty">A planilha declarada não traz ${what}. Esta relação sai do SIGEM quando houver registro.</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Mapa Estatístico ${esc(d.schoolName)} ${esc(comp)}</title><style>${t.css}</style></head><body>
${t.coverHtml}${t.runHead}
<section>${t.h2("I — Identificação da Unidade")}<dl><div><dt>Nome da escola: </dt><dd>${esc(d.schoolName)}</dd></div><div><dt>Código INEP: </dt><dd>${esc(d.inep ?? "não informado")}</dd></div><div><dt>Competência: </dt><dd>${esc(comp)}</dd></div></dl>
<p class="note">Mapa declarado pela escola (planilha "${esc(d.sourceFile)}"). Declaração documental: não é apuração do SIGEM nem mapa homologado.</p></section>
<section>${t.h2("II — Movimentação Estatística")}<table><thead><tr><th>Indicador</th><th class="n">Quantidade</th><th>Observação</th></tr></thead><tbody>${mov.map(([l, v]) => `<tr><td>${l}</td><td class="n">${show(num(v))}</td><td></td></tr>`).join("")}</tbody></table>
<table class="grid"><thead><tr><th>Total de alunos na escola</th>${SHIFT_LABEL.map((s) => `<th class="n">${s}</th>`).join("")}<th class="n">Total</th></tr></thead><tbody><tr><td>Declarado</td>${SHIFTS.map((k) => `<td class="n">${show(num(sh[k]))}</td>`).join("")}<td class="n">${show(num(sh.total))}</td></tr></tbody></table></section>
<section>${t.h2("III — Matrícula por Etapa / Turno")}${mods.length === 0 ? empty("turmas") : mods.map((x) => `<h3>${esc(x.k)}</h3>${x.html}`).join("")}
${mods.length ? `<table class="grid"><thead><tr><th style="width:46%">Total geral da matrícula regular</th>${SHIFT_LABEL.map((s) => `<th class="n">${s}</th>`).join("")}<th class="n">Total</th></tr></thead><tbody><tr class="sub"><td>Soma das tabelas acima</td>${geral.map((g) => `<td class="n">${show(g)}</td>`).join("")}</tr></tbody></table>` : ""}
<h3>Projetos e atendimentos</h3>${proj.length ? gridTable(proj, "Total em projetos (fora do total geral)").html : `<p class="empty">Nenhum projeto declarado.</p>`}
<p class="note">Estudantes em projetos e atendimentos complementares não entram no total geral de matrículas, para não contar a mesma pessoa duas vezes.</p></section>
<section>${t.h2("IV — Relação de Entrada e Saída de Alunos")}${empty("a relação nominal de entradas e saídas")}</section>
<section>${t.h2("V — Relação de Pessoal e/ou Alteração")}${empty("a relação de pessoal")}</section>
<section>${t.h2("VI — Visitas Recebidas")}${empty("as visitas recebidas")}</section>
${d.issues.length ? `<section>${t.h2("Ressalvas da conferência")}<ul>${d.issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>` : ""}
<section class="final">${t.h2("Assinaturas")}${t.signatures(d.signatures)}</section>
<footer>Documento gerado pelo SIGEM em ${esc(d.generatedAt)} a partir da planilha declarada pela escola, preservada como enviada. Assinaturas são manuais; o SIGEM não insere assinatura digital.</footer>
</body></html>`;
}
