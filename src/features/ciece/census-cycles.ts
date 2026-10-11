/**
 * CIECE Lote 08 — Ciclos do Censo Escolar (núcleo puro, nunca grava). Reutiliza o controle
 * anual do Educacenso (`educacenso-control.ts`, ledgers 0354) e a central de correções (L07).
 * Etapas (Matrícula Inicial ≠ Situação do Aluno) são configuração por ano: data de referência,
 * cronograma, documentos e responsáveis vêm declarados — nada é constante no código.
 * Acesso ao SIGEM NUNCA implica operação no Educacenso: só habilitação externa declarada.
 */
import type { SchoolRow, SchoolState } from "@/features/educacenso/educacenso-control";
import type { CorrectionCase } from "./correction-desk";
import { stateOf } from "./correction-desk";

export type StageConfig = {
  year: number; stageKey: string; label: string;
  /** Data oficial de referência — só se declarada com fonte. */
  referenceDate: { value: string; source: string } | null;
  schedule: { milestone: string; from: string | null; to: string | null; source: string | null }[];
  requiredDocuments: { id: string; title: string; sha256: string | null }[];
  responsibles: { role: string; engagementId: string | null }[];
};

export type StageProblem = "sem-data-de-referencia" | "data-fora-do-ano-base" | "cronograma-sem-fonte" | "documento-sem-hash" | "responsavel-nao-designado" | "etapa-duplicada";

export function validateStages(stages: StageConfig[]): { stageKey: string; year: number; problems: StageProblem[] }[] {
  const seen = new Set<string>();
  return stages.map((s) => {
    const p: StageProblem[] = []; const k = `${s.year}|${s.stageKey}`;
    if (seen.has(k)) p.push("etapa-duplicada"); seen.add(k);
    if (!s.referenceDate) p.push("sem-data-de-referencia");
    else if (!s.referenceDate.value.startsWith(`${s.year}-`)) p.push("data-fora-do-ano-base");
    if (s.schedule.some((m) => !m.source)) p.push("cronograma-sem-fonte");
    if (s.requiredDocuments.some((d) => !d.sha256)) p.push("documento-sem-hash");
    if (s.responsibles.length === 0 || s.responsibles.some((r) => !r.engagementId)) p.push("responsavel-nao-designado");
    return { stageKey: s.stageKey, year: s.year, problems: p };
  });
}

/** Etapas separadas: Situação do Aluno nunca reaproveita a fotografia da Matrícula Inicial. */
export function stagesOfYear(stages: StageConfig[], year: number) {
  const ofYear = stages.filter((s) => s.year === year);
  return { initial: ofYear.find((s) => s.stageKey === "matricula-inicial") ?? null, situation: ofYear.find((s) => s.stageKey === "situacao-do-aluno") ?? null, others: ofYear.filter((s) => !["matricula-inicial", "situacao-do-aluno"].includes(s.stageKey)) };
}

export type CheckStatus = "ok" | "pendente" | "nao-verificavel";
export type ChecklistItem = { id: string; label: string; status: CheckStatus; evidence: string };

/** Checklist por escola/etapa: derivado de fatos; fonte não lida = "nao-verificavel", nunca ok. */
export function schoolChecklist(stage: StageConfig, row: SchoolRow, cases: CorrectionCase[] | null): ChecklistItem[] {
  const open = cases?.filter((c) => c.finding.subject.includes(row.school_id) && !["encerrado", "descartado"].includes(stateOf(c)));
  const conf: SchoolState[] = ["conferida-pela-escola", "declarada-enviada-ao-inep"];
  return [
    { id: "data-referencia", label: "Data de referência declarada", status: stage.referenceDate ? "ok" : "pendente", evidence: stage.referenceDate?.source ?? "não declarada" },
    { id: "inep", label: "Escola com INEP", status: row.inep ? "ok" : "pendente", evidence: row.inep ?? "sem INEP" },
    { id: "inicio-matriculas", label: "Matrículas com início declarado", status: row.enrollments_without_start === null ? "nao-verificavel" : row.enrollments_without_start === 0 ? "ok" : "pendente", evidence: row.enrollments_without_start === null ? "fonte não lida" : `${row.enrollments_without_start} sem início` },
    { id: "pendencias", label: "Pendências CIECE encerradas", status: open === undefined ? "nao-verificavel" : open.length === 0 ? "ok" : "pendente", evidence: open === undefined ? "central não lida" : `${open.length} em aberto` },
    { id: "conferencia", label: "Conferida pela escola", status: row.head && conf.includes(row.head.state) ? "ok" : "pendente", evidence: row.head?.state ?? "não iniciada" },
    { id: "comprovante", label: "Recibo oficial importado", status: row.receipt ? "ok" : "pendente", evidence: row.receipt ? `versão ${row.receipt.version}` : "declaração da escola não é recibo" },
  ];
}

/** Pronta só com tudo ok; qualquer não verificável ⇒ "inconclusiva", nunca pronta. */
export function readiness(items: ChecklistItem[]): "pronta" | "pendente" | "inconclusiva" {
  if (items.some((i) => i.status === "pendente")) return "pendente";
  return items.some((i) => i.status === "nao-verificavel") ? "inconclusiva" : "pronta";
}

/** Habilitação no Educacenso é fato externo declarado (perfil INEP, escola, ano); login/capacidade SIGEM não basta. */
export type EducacensoOperator = { engagementId: string; schoolId: string | null; year: number; inepProfile: string; declaredBy: string; evidenceRef: string };
export function canOperateEducacenso(engagementId: string, schoolId: string, year: number, operators: EducacensoOperator[]): { ok: boolean; reason: string } {
  const m = operators.find((o) => o.engagementId === engagementId && o.year === year && (o.schoolId === null || o.schoolId === schoolId));
  if (!m) return { ok: false, reason: "sem-habilitacao-educacenso-declarada" };
  if (!m.evidenceRef) return { ok: false, reason: "habilitacao-sem-evidencia" };
  return { ok: true, reason: m.inepProfile };
}

/** Acompanhamento da rede: escolas sem evento contam como não iniciadas; nenhuma porcentagem inventada. */
export function followUp(stage: StageConfig, rows: SchoolRow[], cases: CorrectionCase[] | null) {
  const per = rows.map((r) => ({ schoolId: r.school_id, readiness: readiness(schoolChecklist(stage, r, cases)) }));
  const count = (k: string) => per.filter((p) => p.readiness === k).length;
  return { stage: stage.stageKey, total: rows.length, pronta: count("pronta"), pendente: count("pendente"), inconclusiva: count("inconclusiva"), per };
}
