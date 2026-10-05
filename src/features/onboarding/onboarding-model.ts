/**
 * Configuração inicial de escola (pura). O assistente NÃO grava fatos: cada etapa lê os readers
 * canônicos, mostra prévia/pendências e encaminha à tela canônica dona do writer. Assim não há
 * segunda lógica nem default normativo. Prontidão = checklist booleano de fatos, nunca índice.
 */

export type FactState = "sim" | "nao" | "nao-verificavel";
export type Check = Readonly<{ id: string; label: string; state: FactState; required: boolean; fix: string; detail?: string }>;

export type StepId =
  | "unidade" | "dados-institucionais" | "ano-periodos" | "oferta-turno" | "turmas" | "alunos-matriculas"
  | "alocacoes-posicoes" | "matriz" | "jornada" | "grade" | "servidores" | "regencias" | "calendario" | "prontidao-diario";

export const STEPS: readonly { id: StepId; title: string; fix: string; explain: string }[] = [
  { id: "unidade", title: "Unidade escolar", fix: "/unidades", explain: "Selecione uma unidade já cadastrada; cadastro novo só pela tela de unidades." },
  { id: "dados-institucionais", title: "Dados institucionais", fix: "/unidades", explain: "Confira nome, situação e vínculos da unidade na data." },
  { id: "ano-periodos", title: "Ano letivo e períodos", fix: "/administracao", explain: "Cada turma precisa da organização de períodos vigente." },
  { id: "oferta-turno", title: "Oferta, turno e catálogos", fix: "/turmas", explain: "Oferta e turno são fatos próprios da turma, opcionais no cadastro." },
  { id: "turmas", title: "Turmas", fix: "/turmas/nova", explain: "Turmas da unidade registradas na data." },
  { id: "alunos-matriculas", title: "Alunos e matrículas", fix: "/matriculas", explain: "Matrículas vigentes; importação governada em Importações." },
  { id: "alocacoes-posicoes", title: "Participações, alocações e posições", fix: "/enturmacoes", explain: "Turma sem aluno pode ser válida; não é pendência." },
  { id: "matriz", title: "Matriz e correspondência", fix: "/matrizes-curriculares/correspondencia", explain: "Cada turma precisa de matriz resolvida." },
  { id: "jornada", title: "Jornada", fix: "/horarios", explain: "Jornada é definida por turma." },
  { id: "grade", title: "Grade", fix: "/horarios", explain: "Sem grade não há aula prevista." },
  { id: "servidores", title: "Servidores, vínculos e atuações", fix: "/profissionais", explain: "Atuação vigente na escola." },
  { id: "regencias", title: "Regências", fix: "/turmas", explain: "Cada turma precisa de ao menos uma regência vigente." },
  { id: "calendario", title: "Calendário aplicável", fix: "/calendario-escolar", explain: "Exatamente um calendário homologado aplicável." },
  { id: "prontidao-diario", title: "Prontidão do Diário", fix: "/diario", explain: "Resumo dos fatos necessários por turma." },
];

/** Fatos lidos por turma; null = reader não pôde responder (≠ não). */
export type ClassFacts = Readonly<{
  classId: string; name: string | null;
  record: boolean | null; periodOrganization: boolean | null;
  matrix: "resolvida" | "ambigua" | "ausente" | null;
  journey: boolean | null; schedule: boolean | null; assignments: number | null;
  allocations: number | null; offering: boolean | null; shift: boolean | null;
}>;
export type SchoolFacts = Readonly<{
  schoolId: string; schoolName: string | null; validOn: string;
  enrollments: number | null; calendars: number | null; engagements: number | null;
  classes: readonly ClassFacts[] | null;
}>;

const b = (v: boolean | null): FactState => (v == null ? "nao-verificavel" : v ? "sim" : "nao");

export function classChecklist(c: ClassFacts, calendars: number | null): Check[] {
  return [
    { id: "registro", label: "Turma registrada na data", state: b(c.record), required: true, fix: `/turmas/${c.classId}` },
    { id: "periodos", label: "Organização de períodos vigente", state: b(c.periodOrganization), required: true, fix: `/turmas/${c.classId}` },
    { id: "matriz", label: "Matriz resolvida", state: c.matrix == null ? "nao-verificavel" : c.matrix === "resolvida" ? "sim" : "nao", required: true,
      fix: "/matrizes-curriculares/correspondencia", ...(c.matrix === "ambigua" ? { detail: "mais de uma matriz aplicável" } : {}) },
    { id: "jornada", label: "Jornada vigente", state: b(c.journey), required: true, fix: `/horarios/turmas/${c.classId}` },
    { id: "grade", label: "Grade vigente", state: b(c.schedule), required: true, fix: `/horarios/turmas/${c.classId}` },
    { id: "regencia", label: "Ao menos uma regência vigente", state: c.assignments == null ? "nao-verificavel" : c.assignments > 0 ? "sim" : "nao", required: true, fix: `/turmas/${c.classId}` },
    { id: "calendario", label: "Um único calendário aplicável", state: calendars == null ? "nao-verificavel" : calendars === 1 ? "sim" : "nao", required: true,
      fix: "/calendario-escolar", ...(calendars != null && calendars > 1 ? { detail: "mais de um calendário aplicável bloqueia" } : {}) },
    // Informativos: o contrato permite turma sem aluno, oferta ou turno.
    { id: "alunos", label: "Alunos alocados", state: c.allocations == null ? "nao-verificavel" : c.allocations > 0 ? "sim" : "nao", required: false, fix: "/enturmacoes" },
    { id: "oferta", label: "Oferta registrada", state: b(c.offering), required: false, fix: `/turmas/${c.classId}` },
    { id: "turno", label: "Turno registrado", state: b(c.shift), required: false, fix: `/turmas/${c.classId}` },
  ];
}

/** Pronta só se TODO fato obrigatório for "sim"; não verificável nunca conta como pronto. */
export const isReady = (cs: readonly Check[]) => cs.filter((c) => c.required).every((c) => c.state === "sim");
export const pendings = (cs: readonly Check[]) => cs.filter((c) => c.required && c.state !== "sim");

export function stepStatus(step: StepId, f: SchoolFacts | null): FactState {
  if (!f) return "nao-verificavel";
  const cls = f.classes;
  const all = (pick: (c: ClassFacts) => boolean | null) => cls == null ? "nao-verificavel" : cls.length === 0 ? "nao"
    : cls.some((c) => pick(c) == null) ? "nao-verificavel" : cls.every((c) => pick(c)) ? "sim" : "nao";
  switch (step) {
    case "unidade": case "dados-institucionais": return f.schoolName ? "sim" : "nao";
    case "ano-periodos": return all((c) => c.periodOrganization);
    case "oferta-turno": return "sim"; // opcional pelo contrato; pendências aparecem só como informação
    case "turmas": return cls == null ? "nao-verificavel" : cls.length ? "sim" : "nao";
    case "alunos-matriculas": return f.enrollments == null ? "nao-verificavel" : "sim"; // zero matrículas é válido na preparação
    case "alocacoes-posicoes": return cls == null ? "nao-verificavel" : "sim";
    case "matriz": return all((c) => (c.matrix == null ? null : c.matrix === "resolvida"));
    case "jornada": return all((c) => c.journey);
    case "grade": return all((c) => c.schedule);
    case "servidores": return f.engagements == null ? "nao-verificavel" : f.engagements > 0 ? "sim" : "nao";
    case "regencias": return all((c) => (c.assignments == null ? null : c.assignments > 0));
    case "calendario": return f.calendars == null ? "nao-verificavel" : f.calendars === 1 ? "sim" : "nao";
    case "prontidao-diario": return cls == null ? "nao-verificavel" : cls.length && cls.every((c) => isReady(classChecklist(c, f.calendars))) ? "sim" : "nao";
  }
}

// ---------- Progresso retomável (sem PII: só ids) ----------
export type Progress = Readonly<{ v: 1; schoolId: string | null; step: StepId; reviewed: readonly StepId[]; updatedAt: string }>;
export const EMPTY_PROGRESS: Progress = { v: 1, schoolId: null, step: "unidade", reviewed: [], updatedAt: "" };
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
export const progressKey = (userId: string) => `sigem:configuracao-inicial:${userId}`;

export function loadProgress(kv: KV, userId: string): Progress {
  try {
    const p = JSON.parse(kv.getItem(progressKey(userId)) ?? "null");
    if (p?.v === 1 && STEPS.some((s) => s.id === p.step) && Array.isArray(p.reviewed)) return { ...EMPTY_PROGRESS, ...p, reviewed: p.reviewed.filter((r: string) => STEPS.some((s) => s.id === r)) };
  } catch { /* progresso corrompido volta ao início, sem tocar em dado */ }
  return EMPTY_PROGRESS;
}
/** Concorrência entre abas: grava só se a base lida ainda é a atual; senão devolve a mais nova. */
export function saveProgress(kv: KV, userId: string, base: Progress, next: Omit<Progress, "v" | "updatedAt">, now = new Date()): { ok: boolean; progress: Progress } {
  const current = loadProgress(kv, userId);
  if (current.updatedAt !== base.updatedAt) return { ok: false, progress: current };
  const p: Progress = { v: 1, ...next, reviewed: [...new Set(next.reviewed)], updatedAt: now.toISOString() };
  kv.setItem(progressKey(userId), JSON.stringify(p));
  return { ok: true, progress: p };
}
/** Trocar de escola zera as revisões (não os dados). */
export const selectSchool = (p: Progress, schoolId: string): Omit<Progress, "v" | "updatedAt"> =>
  p.schoolId === schoolId ? { schoolId, step: p.step, reviewed: p.reviewed } : { schoolId, step: "dados-institucionais", reviewed: ["unidade"] };
