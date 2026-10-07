/**
 * N5.3 — Vagas e Livro de Matrícula: projeções puras das leituras canônicas
 * (`secretariat_class_vacancies_at`, `secretariat_enrollment_book_at`). Nenhuma segunda fonte.
 * Capacidade ausente nunca vira zero; a ordem do Livro NÃO é numeração oficial (NUMERAÇÃO_OFICIAL_PENDENTE).
 */
import type { ReportDefinition } from "@/features/reports/report-engine";

export type VacancyState = "ha-vaga" | "lotada" | "capacidade-nao-informada";
export type VacancyRow = { class_id: string; name: string; shift_label: string | null; capacity: number | null; occupancy: number; available: number | null; vacancy_state: VacancyState };
export type BookRow = { entry_order: number; enrollment_id: string; student_name: string | null; institutional_number: string | null; opened_on: string | null;
  class_label: string | null; situation: "ativa" | "encerrada"; ended_on: string | null; end_reason: string | null; recorded_at: string };

export const VACANCY_LABEL: Record<VacancyState, string> = { "ha-vaga": "Há vaga", lotada: "Lotada", "capacidade-nao-informada": "Capacidade não informada" };

/** Recalcula o estado a partir dos números; capacidade nula ⇒ "não informada", nunca lotada nem zero. */
export function vacancyState(capacity: number | null, occupancy: number): VacancyState {
  if (capacity == null) return "capacidade-nao-informada";
  return occupancy >= capacity ? "lotada" : "ha-vaga";
}

export function vacancySummary(rows: readonly VacancyRow[]) {
  const known = rows.filter((r) => r.capacity != null);
  return {
    classes: rows.length,
    full: rows.filter((r) => r.vacancy_state === "lotada").length,
    unknownCapacity: rows.length - known.length,
    // Vagas somadas só das turmas com capacidade informada; se nenhuma tem, não há número.
    availableKnown: known.length ? known.reduce((s, r) => s + (r.available ?? 0), 0) : null,
  };
}

export type BookFilter = { text?: string; classLabel?: string; situation?: "" | "ativa" | "encerrada" };
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export function filterBook(rows: readonly BookRow[], f: BookFilter): BookRow[] {
  const t = f.text ? norm(f.text.trim()) : "";
  return rows.filter((r) => (!f.situation || r.situation === f.situation)
    && (!f.classLabel || r.class_label === f.classLabel)
    && (!t || norm(r.student_name ?? "").includes(t) || (r.institutional_number ?? "").includes(t)));
}

export const ENROLLMENT_BOOK_REPORT: ReportDefinition = {
  id: "livro-de-matricula", version: 1, title: "Livro de Matrícula",
  description: "Matrículas da escola no ano letivo, na ordem cronológica de registro. A ordem não é numeração oficial.",
  source: "secretariat_enrollment_book_at", params: [],
  columns: [
    { id: "ordem", label: "Ordem de registro", kind: "number" },
    { id: "estudante", label: "Estudante", kind: "text" },
    { id: "codigo", label: "Código SIGEM", kind: "text" },
    { id: "data", label: "Data da matrícula", kind: "date" },
    { id: "turma", label: "Turma", kind: "text" },
    { id: "situacao", label: "Situação", kind: "text" },
    { id: "encerramento", label: "Encerramento", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 20000,
};

const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);
export function bookReportRows(rows: readonly BookRow[]) {
  return rows.map((r) => ({
    ordem: r.entry_order, estudante: r.student_name, codigo: r.institutional_number, data: br(r.opened_on),
    turma: r.class_label ?? "Sem turma", situacao: r.situation === "ativa" ? "Ativa" : "Encerrada",
    encerramento: r.situation === "encerrada" ? [br(r.ended_on), r.end_reason].filter(Boolean).join(" — ") || null : null,
  }));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** PDF do Livro: documento A4 dedicado (impressão do navegador), sem barra lateral, páginas numeradas, tudo escapado.
 * Sem modelo oficial homologado de assinaturas: não inventa campos jurídicos. */
export function bookPrintHtml(ctx: { school: string; inep: string | null; year: string; knownAt: string; header?: readonly string[] }, rows: readonly BookRow[]): string {
  const body = bookReportRows(rows).map((r) => `<tr><td class="n">${r.ordem}</td><td>${esc(r.estudante ?? "não disponível")}</td><td>${esc(r.codigo ?? "não disponível")}</td>
<td>${esc(r.data ?? "não disponível")}</td><td>${esc(r.turma)}</td><td>${esc(r.situacao)}</td><td>${esc(r.encerramento ?? "")}</td></tr>`).join("\n");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Livro de Matrícula — ${esc(ctx.school)} — ${esc(ctx.year)}</title>
<style>@page{size: A4 portrait;margin:14mm 12mm 16mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:9px serif}}
body{font-family:serif;font-size:10px;color:#000;margin:0}header{text-align:center;margin-bottom:8px}h1{font-size:14px;margin:4px 0}
table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid}
th,td{border:1px solid #444;padding:3px;text-align:left;overflow-wrap:anywhere;vertical-align:top}th{background:#eee}td.n{text-align:right}
col.c1{width:7%}col.c2{width:27%}col.c3{width:12%}col.c4{width:11%}col.c5{width:13%}col.c6{width:9%}col.c7{width:21%}
.foot{margin-top:8px;font-size:9px}</style></head><body>
<header>${(ctx.header ?? []).map((l) => `<div>${esc(l)}</div>`).join("")}<h1>LIVRO DE MATRÍCULA</h1>
<div>${esc(ctx.school)}${ctx.inep ? ` — INEP ${esc(ctx.inep)}` : ""}</div><div>Ano letivo ${esc(ctx.year)} · posição em ${esc(ctx.knownAt)}</div></header>
<table><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"></colgroup>
<thead><tr><th>Ordem</th><th>Estudante</th><th>Código SIGEM</th><th>Data</th><th>Turma</th><th>Situação</th><th>Encerramento</th></tr></thead>
<tbody>${body || `<tr><td colspan="7">Nenhuma matrícula encontrada.</td></tr>`}</tbody></table>
<p class="foot">Ordem cronológica de registro no SIGEM; não é numeração oficial do Livro (regra de numeração ainda não definida pela rede). Total: ${rows.length} matrícula(s).</p>
</body></html>`;
}
