import { governError } from "@/lib/observability/governed-errors";
/**
 * Painel da escola (Orientação Pedagógica / Direção) — projeção pura de fatos canônicos já lidos com a sessão.
 * Nada é copiado nem persistido; cada número é a contagem dos registros que o compõem (drill-down).
 * Fonte que a sessão não lê ⇒ null ("não disponível"), nunca zero. Nenhuma regra de nota, frequência ou promoção.
 */

export type Source<T> = readonly T[] | null;
export type ClassRow = Readonly<{ id: string; name: string }>;
export type EnrollmentRow = Readonly<{ id: string; student_id: string; ended_on: string | null }>;
export type AllocationRow = Readonly<{ id: string; enrollment_id: string; student_id: string; class_id: string; ended_on: string | null }>;
export type ClosingRow = Readonly<{ id: string; class_id: string; period_id: string; version_number: number; closed_at: string }>;

export type PanelInput = Readonly<{
  classes: Source<ClassRow>; enrollments: Source<EnrollmentRow>; allocations: Source<AllocationRow>;
  attendanceClosings: Source<ClosingRow>; assessmentClosings: Source<ClosingRow>;
}>;

export type Measure = Readonly<{ value: number | null; records: readonly string[] }>;
const m = <T extends { id: string }>(src: Source<T>, f: (x: T) => boolean = () => true): Measure =>
  src === null ? { value: null, records: [] } : (() => { const r = src.filter(f).map((x) => x.id); return { value: r.length, records: r }; })();

export type ClassPanel = Readonly<{ classId: string; name: string; students: Measure; attendanceClosings: Measure; assessmentClosings: Measure }>;
export type Pending = Readonly<{ kind: "matricula-sem-turma" | "turma-sem-fechamento-de-frequencia" | "turma-sem-fechamento-avaliativo"; subjectId: string; label: string }>;

/** Cabeças de fechamento: versão mais alta por turma+período (não decide se está "certo"). */
const heads = (src: Source<ClosingRow>) => {
  if (!src) return null;
  const best = new Map<string, ClosingRow>();
  for (const c of src) { const k = `${c.class_id}|${c.period_id}`; const b = best.get(k); if (!b || c.version_number > b.version_number) best.set(k, c); }
  return [...best.values()];
};

export function buildPanel(i: PanelInput) {
  const active = (x: { ended_on: string | null }) => x.ended_on === null;
  const att = heads(i.attendanceClosings), asm = heads(i.assessmentClosings);
  const classes: ClassPanel[] = (i.classes ?? []).map((c) => ({
    classId: c.id, name: c.name,
    students: m(i.allocations, (a) => a.class_id === c.id && active(a)),
    attendanceClosings: m(att, (x) => x.class_id === c.id),
    assessmentClosings: m(asm, (x) => x.class_id === c.id),
  }));
  const pend: Pending[] = [];
  if (i.enrollments && i.allocations) {
    const allocated = new Set(i.allocations.filter(active).map((a) => a.enrollment_id));
    for (const e of i.enrollments.filter(active)) if (!allocated.has(e.id)) pend.push({ kind: "matricula-sem-turma", subjectId: e.student_id, label: "Matrícula vigente sem turma" });
  }
  for (const c of classes) {
    if (c.attendanceClosings.value === 0) pend.push({ kind: "turma-sem-fechamento-de-frequencia", subjectId: c.classId, label: `${c.name}: nenhum fechamento de frequência registrado` });
    if (c.assessmentClosings.value === 0) pend.push({ kind: "turma-sem-fechamento-avaliativo", subjectId: c.classId, label: `${c.name}: nenhum fechamento avaliativo registrado` });
  }
  return {
    totals: {
      classes: i.classes === null ? { value: null, records: [] } : { value: i.classes.length, records: i.classes.map((c) => c.id) },
      enrollments: m(i.enrollments, active),
      allocated: m(i.allocations, active),
    },
    classes, pending: pend,
  };
}

export const display = (v: number | null) => (v === null ? "não disponível" : String(v));

export type FollowupRecord = Readonly<{
  id: string; logical_id: string; version: number; supersedes_id: string | null; event_kind: "registro" | "retificacao" | "anulacao";
  school_id: string; subject_kind: "estudante" | "turma" | "escola"; subject_id: string; category_value_id: string;
  body: string; visibility: "autoria" | "acompanhamento-da-escola"; occurred_on: string; reason: string | null;
  author_user_id: string; recorded_at: string;
}>;

/** Registro anulado continua no histórico, mas não aparece como vigente. */
export const visibleRecords = (rs: readonly FollowupRecord[]) => rs.filter((r) => r.event_kind !== "anulacao");

/** Palavras que indicam conteúdo clínico: aviso na tela (não bloqueio, porque o banco não interpreta texto). */
const CLINICAL = /\b(cid|diagn[oó]stic|laudo|medica[cç][aã]o|rem[eé]dio|transtorno|psiqui|tdah|autis|tea\b)/i;
export const clinicalWarning = (body: string) => CLINICAL.test(body)
  ? "Este registro não é prontuário: não anote diagnóstico, laudo ou medicação. Informações de saúde seguem o fluxo próprio da escola."
  : null;

export function followupMessage(raw: string): string {
  if (raw.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  if (raw.includes("capability:registrar-acompanhamento-pedagogico")) return "Sua atuação não tem permissão para registrar acompanhamento nesta escola.";
  if (raw.includes("capability:consultar-acompanhamento-pedagogico")) return "Sua atuação não tem permissão para consultar acompanhamentos desta escola.";
  if (raw.includes("followup:category-not-homologated")) return "Escolha uma categoria aprovada no catálogo.";
  if (raw.includes("followup:subject-not-in-school")) return "Este estudante ou turma não pertence a esta escola.";
  if (raw.includes("followup:only-author-rectifies")) return "Só quem fez o registro pode corrigi-lo ou anulá-lo.";
  if (raw.includes("followup:base-superseded")) return "Este registro já foi corrigido por outra versão. Recarregue.";
  if (raw.includes("followup:already-annulled")) return "Este registro já foi anulado.";
  if (raw.includes("followup:occurred-on-invalid")) return "Informe a data do fato (não pode ser futura).";
  if (raw.includes("reason") || raw.includes("check constraint")) return "Informe o motivo da correção.";
  return governError(raw).userMessage;
}
