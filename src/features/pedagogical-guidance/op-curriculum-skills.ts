/**
 * OP por escola — LOTE 07 (currículo e habilidades).
 * Reaproveita o catálogo/vínculo do Docente (`skill-links.ts`: ref item+edição, posição registrada, plano nunca realizado).
 * Quatro dimensões INDEPENDENTES por habilidade: prevista (plano), trabalhada (aula/atividade/intervenção realizada),
 * avaliada (avaliação aplicada) e aprendizagem demonstrada (só por critério homologado sobre resultado oficial).
 * Nenhuma dimensão implica outra; fonte não lida = null, nunca zero.
 */
import type { SkillLink, CatalogItem } from "@/features/curricular-reference/skill-links";

export interface SkillLinkCtx extends SkillLink {
  schoolId: string; classId: string; componentId: string; periodId: string | null; authorPersonId: string;
}
/** Resultado oficial por estudante × habilidade; `demonstrated` só existe se houver critério homologado. */
export interface LearningEvidence {
  itemId: string; editionId: string; classId: string; componentId: string; periodId: string | null;
  studentId: string; criterionHomologatedId: string | null; demonstrated: boolean | null;
}
export interface Filters { schoolId: string; classId?: string; componentId?: string; periodId?: string }
export interface Sources {
  plans: boolean; lessons: boolean; assessments: boolean; learning: boolean;
  catalogEditionIds: string[]; readAt: string | null;
}

export interface SkillRow {
  itemId: string; editionId: string; label: string;
  prevista: boolean | null; trabalhada: boolean | null; avaliada: boolean | null;
  /** estudantes com aprendizagem demonstrada / com evidência avaliada sob critério homologado */
  demonstrada: { demonstrated: number; assessed: number } | null;
  plannedOnly: boolean; limitations: string[];
}

const match = (f: Filters) => (x: { schoolId?: string; classId: string; componentId: string; periodId: string | null }) =>
  (x.schoolId === undefined || x.schoolId === f.schoolId) && (!f.classId || x.classId === f.classId)
  && (!f.componentId || x.componentId === f.componentId) && (!f.periodId || x.periodId === f.periodId);

export function analyzeSkills(input: {
  filters: Filters; expected: CatalogItem[]; links: SkillLinkCtx[]; evidence: LearningEvidence[]; sources: Sources;
}): { rows: SkillRow[]; limitations: string[]; blocked: string | null } {
  const { filters, sources } = input;
  if (!sources.readAt) return { rows: [], limitations: [], blocked: "Leitura sem data não vale como análise." };
  const lim: string[] = [];
  if (!sources.plans) lim.push("Planejamentos não lidos: habilidade prevista indisponível.");
  if (!sources.lessons) lim.push("Aulas/atividades não lidas: habilidade trabalhada indisponível.");
  if (!sources.assessments) lim.push("Avaliações não lidas: habilidade avaliada indisponível.");
  if (!sources.learning) lim.push("Resultados não lidos: aprendizagem demonstrada indisponível.");
  lim.push("Registro de aula indica trabalho declarado pelo professor, não prova aprendizagem.");
  const links = input.links.filter(match(filters));
  const ev = input.evidence.filter(match(filters));
  const rows = input.expected.map((it): SkillRow => {
    const mine = links.filter((l) => l.ref.itemId === it.itemId);
    const otherEdition = mine.some((l) => l.ref.editionId !== it.editionId);
    const has = (fn: (l: SkillLinkCtx) => boolean, ok: boolean) => (ok ? mine.some(fn) : null);
    const prevista = has((l) => l.target === "plano", sources.plans);
    const trabalhada = has((l) => (l.target === "aula" || l.target === "atividade" || l.target === "intervencao") && l.realized, sources.lessons);
    const avaliada = has((l) => l.target === "avaliacao" && l.realized, sources.assessments);
    const e = ev.filter((x) => x.itemId === it.itemId && x.criterionHomologatedId && x.demonstrated !== null);
    const rowLim: string[] = [];
    if (otherEdition) rowLim.push("Há registros em outra edição do catálogo; exibidos pela edição gravada.");
    if (sources.learning && ev.some((x) => x.itemId === it.itemId && !x.criterionHomologatedId)) rowLim.push("Há resultados sem critério homologado: não contam como aprendizagem.");
    const demonstrada = !sources.learning ? null : e.length === 0 ? null
      : { demonstrated: new Set(e.filter((x) => x.demonstrated).map((x) => x.studentId)).size, assessed: new Set(e.map((x) => x.studentId)).size };
    if (sources.learning && !demonstrada) rowLim.push("Sem evidência de aprendizagem sob critério homologado.");
    return {
      itemId: it.itemId, editionId: it.editionId, label: `${it.code} — ${it.description}`,
      prevista, trabalhada, avaliada, demonstrada,
      plannedOnly: prevista === true && trabalhada === false, limitations: rowLim,
    };
  });
  return { rows, limitations: lim, blocked: null };
}

/** Rótulo sóbrio: planejado nunca aparece como trabalhado; null = "não lido". */
export function dimensionLabel(v: boolean | null, yes: string): string {
  return v === null ? "Fonte não lida" : v ? yes : "Sem registro";
}

/** Catálogo previsto pela posição curricular histórica: edição vigente NA data e posição registrada na turma. */
export function expectedForPosition(catalog: (CatalogItem & { positionKeys: string[] })[], positionKeys: string[], editionValidOn: (e: string) => boolean): CatalogItem[] {
  if (positionKeys.length === 0) return []; // sem posição registrada nada é presumido
  return catalog.filter((c) => editionValidOn(c.editionId) && c.positionKeys.some((k) => positionKeys.includes(k)));
}

/** Central: só contagem de habilidades por dimensão, por escola; nunca estudante; 1–4 suprimido em demonstrada. */
export function centralSkillSummary(rows: SkillRow[]) {
  const n = (f: (r: SkillRow) => boolean | null) => rows.some((r) => f(r) === null) ? null : rows.filter((r) => f(r)).length;
  const dem = rows.reduce((s, r) => s + (r.demonstrada?.assessed ?? 0), 0);
  return {
    previstas: n((r) => r.prevista), trabalhadas: n((r) => r.trabalhada), avaliadas: n((r) => r.avaliada),
    estudantesAvaliadosSobCriterio: dem > 0 && dem < 5 ? "suprimido" : dem,
  };
}
