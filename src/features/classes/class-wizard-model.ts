/**
 * N5.3.1 — modelo puro do assistente "Nova turma" (7 passos).
 * Não conhece etapa, ano ou nomenclatura: composição = posições de UM catálogo homologado
 * (uma ⇒ simples; duas ou mais ⇒ multisseriada). Nada aqui grava; o banco revalida tudo.
 */
export const CLASS_WIZARD_STEPS = [
  "Ano letivo",
  "Etapa / composição",
  "Identificação",
  "Turno e jornada",
  "Capacidade",
  "Professores",
  "Revisar e criar",
] as const;

export type CatalogPosition = { scheme: string; value: string; version: number; label: string };

export interface ClassWizardState {
  yearId: string;
  validFrom: string;
  compositionKind: "simples" | "multisseriada";
  scheme: string;
  positions: CatalogPosition[];
  name: string;
  code: string;
  shift: { value: string; version: number; label: string } | null;
  capacity: string;
  sourceRef: string;
  /** Jornada própria da turma (dias e horários declarados); vazia = não informada agora. */
  journey: JourneyInterval[];
}

export type JourneyInterval = { weekday: number; startsAt: string; endsAt: string };
export const WEEKDAY_LABEL: Record<number, string> = { 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo" };

/** Problemas da jornada declarada; nada é deduzido de carga horária. */
export function journeyProblems(j: readonly JourneyInterval[]): string[] {
  const p: string[] = [];
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const i of j) {
    const d = WEEKDAY_LABEL[i.weekday] ?? "Dia";
    if (!hhmm.test(i.startsAt) || !hhmm.test(i.endsAt)) p.push(`${d}: informe início e fim no formato 07:00.`);
    else if (i.startsAt >= i.endsAt) p.push(`${d}: o fim precisa ser depois do início.`);
  }
  const seen = new Set<string>();
  for (const i of j) { const k = `${i.weekday}-${i.startsAt}`; if (seen.has(k)) p.push(`${WEEKDAY_LABEL[i.weekday]}: horário repetido.`); seen.add(k); }
  return p;
}

/** Resumo legível: "Segunda a Sexta, 07:00–11:30" quando todos iguais; senão por dia. */
export function journeySummary(j: readonly JourneyInterval[]): string {
  if (!j.length) return "Jornada ainda não configurada";
  const sorted = [...j].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt));
  const same = sorted.every((i) => i.startsAt === sorted[0]!.startsAt && i.endsAt === sorted[0]!.endsAt);
  const days = sorted.map((i) => i.weekday);
  const contiguous = days.every((d, k) => k === 0 || d === days[k - 1]! + 1);
  if (same && contiguous && days.length > 2) return `${WEEKDAY_LABEL[days[0]!]} a ${WEEKDAY_LABEL[days[days.length - 1]!]}, ${sorted[0]!.startsAt}–${sorted[0]!.endsAt}`;
  return sorted.map((i) => `${WEEKDAY_LABEL[i.weekday]} ${i.startsAt}–${i.endsAt}`).join("; ");
}

export const emptyClassWizard = (): ClassWizardState => ({
  yearId: "", validFrom: "", compositionKind: "simples", scheme: "", positions: [], name: "", code: "", shift: null, capacity: "", sourceRef: "", journey: [],
});

/** Estados de ano que recebem turma operacional nova (o banco aplica a mesma regra). */
export const OPEN_YEAR_STATES = ["em-preparacao", "operacional"] as const;
export const yearAcceptsNewClass = (state: string | null) => !!state && (OPEN_YEAR_STATES as readonly string[]).includes(state);

export function parseCapacity(raw: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false, message: "Informe um número inteiro, ou deixe em branco se a capacidade não for conhecida." };
  const n = Number(t);
  if (n < 1) return { ok: false, message: "A capacidade precisa ser maior que zero. Se não for conhecida, deixe em branco." };
  return { ok: true, value: n };
}

export function compositionKindOf(positions: readonly CatalogPosition[]): "simples" | "multisseriada" | null {
  if (positions.length === 0) return null;
  return positions.length >= 2 ? "multisseriada" : "simples";
}

/** Problemas do passo, em linguagem cotidiana. Vazio ⇒ pode continuar. */
export function stepProblems(step: number, s: ClassWizardState, ctx: { yearState: string | null; existingNames: readonly string[] }): string[] {
  const p: string[] = [];
  if (step === 0) {
    if (!s.yearId) p.push("Escolha o ano letivo.");
    else if (!yearAcceptsNewClass(ctx.yearState)) p.push("Este ano letivo não está aberto para novas turmas.");
    if (!s.validFrom) p.push("Informe a data de início da turma.");
  }
  if (step === 1) {
    if (s.positions.length === 0) p.push("Escolha a etapa/ano da turma.");
    if (s.compositionKind === "multisseriada" && s.positions.length < 2) p.push("Turma multisseriada precisa de dois ou mais anos/etapas.");
    if (s.compositionKind === "simples" && s.positions.length > 1) p.push("Turma de uma única etapa tem apenas um ano/etapa.");
    if (new Set(s.positions.map((x) => x.scheme)).size > 1) p.push("Os anos/etapas precisam vir do mesmo catálogo.");
  }
  if (step === 2) {
    if (!s.name.trim()) p.push("Informe o nome da turma.");
    else if (ctx.existingNames.some((n) => n.trim().toLowerCase() === s.name.trim().toLowerCase())) p.push("Já existe uma turma com este nome nesta escola e ano.");
  }
  if (step === 3) p.push(...journeyProblems(s.journey));
  if (step === 4) {
    const c = parseCapacity(s.capacity);
    if (!c.ok) p.push(c.message);
  }
  return p;
}

/** Passo a corrigir para cada recusa do banco. */
const ERROR_STEP: Array<[RegExp, number, string]> = [
  [/class:year-not-open/, 0, "Este ano letivo não está aberto para novas turmas."],
  [/class:invalid-dates|academic-year-outside-bounds|academic-year-inactive|school-unavailable/, 0, "A data de início não é válida para esta escola e ano letivo."],
  [/composition:(mixed-catalogs|duplicate-position|position-not-homologated|position-required)/, 1, "A composição escolhida não é aceita pelo catálogo vigente. Revise a etapa/ano."],
  [/class:duplicate-name/, 2, "Já existe uma turma com este nome nesta escola e ano."],
  [/class:name-required/, 2, "Informe o nome da turma."],
  [/journey:/, 3, "A jornada informada não foi aceita. Revise dias e horários."],
  [/shift:/, 3, "O turno escolhido não está disponível nesta data."],
  [/capacity:/, 4, "A capacidade informada não foi aceita."],
  [/capability|school-capability-required|session:person-required/, 6, "Sua conta não tem permissão para criar turmas nesta escola."],
];

export function classCreateError(message: string): { step: number; text: string } {
  for (const [re, step, text] of ERROR_STEP) if (re.test(message)) return { step, text };
  return { step: 6, text: "Não foi possível criar a turma. Nada foi gravado; tente novamente." };
}

export function createArgs(school: string, s: ClassWizardState) {
  const cap = parseCapacity(s.capacity);
  return {
    _school: school,
    _year: s.yearId,
    _code: s.code.trim() || null,
    _name: s.name.trim(),
    _valid_from: s.validFrom,
    _valid_until: null,
    _composition: s.positions.map((x) => ({ scheme: x.scheme, value: x.value, version: x.version })),
    _shift: s.shift ? { value: s.shift.value, version: s.shift.version } : null,
    _capacity: cap.ok ? cap.value : null,
    _source_ref: s.sourceRef.trim() || null,
    _journey: s.journey.length ? s.journey.map((i) => ({ weekday: i.weekday, starts_at: i.startsAt, ends_at: i.endsAt })) : null,
  };
}
