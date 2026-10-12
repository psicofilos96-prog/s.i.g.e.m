/**
 * SIGEM Desenvolvimento L07 — catálogo de cursos (projeção pura; banco = 0435).
 * Código é do curso (imutável); ementa, conteúdos, modalidade, avaliação, critério e pré-requisitos são da versão.
 * Turma aponta para a versão em que nasceu, então oferta antiga nunca muda quando o curso ganha versão nova.
 */
export type CatalogVersion = Readonly<{
  id: string; courseId: string; version: number; code: string; title: string;
  minutes: number | null; minAttendancePct: number | null;
  syllabus: string | null; contents: readonly string[]; modality: string | null;
  assessment: string | null; completionCriteria: string | null;
  prerequisiteCourseIds: readonly string[]; approved: boolean;
}>;
export type Draft = Readonly<{
  courseId: string | null; code: string; existingCode: string | null; title: string; minutes: number | null;
  minAttendancePct: number | null; syllabus: string; contents: readonly string[]; modality: string;
  assessment: string; completionCriteria: string; prerequisiteCourseIds: readonly string[]; reason: string; expectedVersion: number;
}>;

const CODE = /^[A-Z0-9][A-Z0-9.-]{1,29}$/;

/** Espelha o writer `record_dev_catalog_course_version`; a tela só antecipa a recusa. */
export function draftProblems(d: Draft): string[] {
  const p: string[] = [];
  const code = d.code.trim().toUpperCase();
  if (!CODE.test(code)) p.push("Código: 2 a 30 caracteres (letras maiúsculas, números, ponto ou hífen).");
  if (d.existingCode && d.existingCode !== code) p.push("O código do curso não muda entre versões.");
  if (d.title.trim().length < 5) p.push("Título com ao menos 5 caracteres.");
  if (d.minutes == null || d.minutes <= 0) p.push("Informe a carga horária.");
  if (d.minAttendancePct == null || d.minAttendancePct < 0 || d.minAttendancePct > 100) p.push("Informe a frequência mínima (0 a 100%).");
  if (d.syllabus.trim().length < 20) p.push("Ementa com ao menos 20 caracteres.");
  if (!d.contents.some((c) => c.trim())) p.push("Informe ao menos um conteúdo.");
  if (d.modality.trim().length < 3) p.push("Informe a modalidade.");
  if (d.assessment.trim().length < 10) p.push("Descreva a avaliação.");
  if (d.completionCriteria.trim().length < 10) p.push("Descreva o critério de conclusão.");
  if (d.courseId && d.prerequisiteCourseIds.includes(d.courseId)) p.push("O curso não pode ser pré-requisito de si mesmo.");
  if (d.expectedVersion >= 1 && d.reason.trim().length < 10) p.push("Nova versão exige motivo (10+ caracteres).");
  return p;
}

/** Versão vigente do catálogo = maior versão; só ela é ofertável, e só se aprovada. */
export function catalogEntries(versions: readonly CatalogVersion[]) {
  const by = new Map<string, CatalogVersion[]>();
  for (const v of versions) by.set(v.courseId, [...(by.get(v.courseId) ?? []), v]);
  return [...by.values()].map((vs) => {
    const sorted = [...vs].sort((a, b) => a.version - b.version);
    const current = sorted[sorted.length - 1]!;
    return { courseId: current.courseId, code: current.code, current, history: sorted,
      offerable: current.approved && current.syllabus != null,
      legacyWithoutCatalog: current.syllabus == null };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

/** Diferenças entre duas versões, campo a campo (para revisão). */
export function versionDiff(a: CatalogVersion, b: CatalogVersion): string[] {
  const fields: (keyof CatalogVersion)[] = ["title", "minutes", "minAttendancePct", "syllabus", "modality", "assessment", "completionCriteria"];
  const out = fields.filter((f) => a[f] !== b[f]).map(String);
  if (a.contents.join("\u0000") !== b.contents.join("\u0000")) out.push("contents");
  if ([...a.prerequisiteCourseIds].sort().join() !== [...b.prerequisiteCourseIds].sort().join()) out.push("prerequisiteCourseIds");
  return out;
}

/** Pré-requisitos atendidos só por conclusão registrada; sem pré-requisito = atendido. */
export function prerequisitesMet(v: CatalogVersion, concludedCourses: ReadonlySet<string>) {
  const missing = v.prerequisiteCourseIds.filter((c) => !concludedCourses.has(c));
  return { met: missing.length === 0, missing };
}
