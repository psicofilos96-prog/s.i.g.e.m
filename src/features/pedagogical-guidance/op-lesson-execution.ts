/**
 * OP por escola — LOTE 08 (aulas e execução curricular).
 * Reaproveita a situação da aula do Docente (`diary/lesson-occurrence.ts`: lessonSituation sobre grade
 * publicada + versão vigente + atos) e os vínculos de habilidade (`skill-links.ts`). Nada é copiado:
 * o painel é projeção somente leitura. Ausência de registro = pendência de conferência, NUNCA "não ministrada".
 * A OP não registra nem retifica aula: retificação é do professor pela cadeia de versões do Diário.
 */
import type { LessonSituationView, PlannedLesson } from "@/features/diary/lesson-occurrence";

export interface LessonRow {
  planned: PlannedLesson; view: LessonSituationView; schoolId: string; periodId: string | null;
  /** fatos do registro vigente (só se lido); conteúdo é do professor, exibido sem edição */
  record: { contents: string[]; skillItemIds: string[]; evidenceRefs: string[] } | null;
}
export interface PlanSkillWindow { classId: string; componentId: string; from: string; to: string; skillItemIds: string[]; planVersionId: string }
export interface PanelSources { schedule: boolean; diary: boolean; plans: boolean; readAt: string | null }
export interface PanelFilters { schoolId: string; classId?: string; componentId?: string; from: string; to: string }

export type Pending = { slotKey: string; date: string; classId: string; componentId: string; kind: "conferir-registro" | "conferir-inconsistencia"; note: string };
export type Divergence = { slotKey: string; kind: "habilidade-planejada-nao-registrada" | "habilidade-registrada-fora-do-plano" | "sem-plano-no-periodo"; itemIds: string[]; planVersionId: string | null };

export function lessonPanel(input: { filters: PanelFilters; rows: LessonRow[]; plans: PlanSkillWindow[]; sources: PanelSources; today: string }) {
  const { filters: f, sources: s } = input;
  if (!s.readAt) return { blocked: "Leitura sem data não vale como painel.", counts: null, pending: [], divergences: [], limitations: [] };
  if (!s.schedule) return { blocked: "Grade publicada não lida: sem grade nada é previsto e nada é pendente.", counts: null, pending: [], divergences: [], limitations: [] };
  const lim: string[] = ["Aula registrada é declaração do professor; realizada conforme evidência exige referência anexada ao registro."];
  if (!s.diary) lim.push("Diário não lido: registros e realizadas indisponíveis.");
  if (!s.plans) lim.push("Planejamentos não lidos: divergências plano × diário indisponíveis.");
  const rows = input.rows.filter((r) => r.schoolId === f.schoolId && (!f.classId || r.planned.classId === f.classId)
    && (!f.componentId || r.planned.componentId === f.componentId) && r.planned.date >= f.from && r.planned.date <= f.to);
  const done = (r: LessonRow) => ["Realizada", "Substituída", "Reposta"].includes(r.view.situation);
  const counts = {
    previstas: rows.length,
    registradas: s.diary ? rows.filter(done).length : null,
    comEvidencia: s.diary ? rows.filter((r) => done(r) && (r.record?.evidenceRefs.length ?? 0) > 0).length : null,
    naoRealizadasDeclaradas: s.diary ? rows.filter((r) => r.view.situation === "Não realizada").length : null,
    retificadas: s.diary ? rows.filter((r) => r.view.rectified).length : null,
    // só aulas já passadas viram pendência; futuras continuam previstas
    pendentesDeConferencia: s.diary ? rows.filter((r) => r.planned.date < input.today && r.view.situation === "Prevista").length : null,
    inconsistentes: s.diary ? rows.filter((r) => r.view.situation === "Inconsistente").length : null,
  };
  const pending: Pending[] = !s.diary ? [] : rows.flatMap((r): Pending[] => {
    const base = { slotKey: r.planned.slotKey, date: r.planned.date, classId: r.planned.classId, componentId: r.planned.componentId };
    if (r.view.situation === "Prevista" && r.planned.date < input.today)
      return [{ ...base, kind: "conferir-registro", note: "Sem registro concluído no Diário. Conferir com o professor; isto não afirma que a aula não foi ministrada." }];
    if (r.view.situation === "Inconsistente") return [{ ...base, kind: "conferir-inconsistencia", note: r.view.notes.join(" ") }];
    return [];
  });
  const divergences: Divergence[] = !(s.diary && s.plans) ? [] : rows.filter((r) => done(r) && r.record).flatMap((r): Divergence[] => {
    const p = input.plans.filter((x) => x.classId === r.planned.classId && x.componentId === r.planned.componentId && x.from <= r.planned.date && r.planned.date <= x.to);
    if (p.length === 0) return [{ slotKey: r.planned.slotKey, kind: "sem-plano-no-periodo", itemIds: [], planVersionId: null }];
    const planned = new Set(p.flatMap((x) => x.skillItemIds));
    const extra = r.record!.skillItemIds.filter((i) => !planned.has(i));
    return extra.length ? [{ slotKey: r.planned.slotKey, kind: "habilidade-registrada-fora-do-plano", itemIds: extra, planVersionId: p[0]!.planVersionId }] : [];
  });
  // habilidade planejada sem nenhum registro na janela inteira (só se a janela já terminou)
  if (s.diary && s.plans) for (const p of input.plans) {
    if (p.to >= input.today || p.to > f.to || p.from < f.from) continue;
    const rec = new Set(rows.filter((r) => r.planned.classId === p.classId && r.planned.componentId === p.componentId && r.record).flatMap((r) => r.record!.skillItemIds));
    const miss = p.skillItemIds.filter((i) => !rec.has(i));
    if (miss.length) divergences.push({ slotKey: `${p.classId}:${p.componentId}:${p.from}..${p.to}`, kind: "habilidade-planejada-nao-registrada", itemIds: miss, planVersionId: p.planVersionId });
  }
  return { blocked: null, counts, pending, divergences, limitations: lim };
}

/** Ação da OP sobre a aula: só conferência/comentário; registrar ou retificar é do professor. */
export function opLessonAction(kind: "conferir" | "comentar" | "registrar" | "retificar" | "declarar-nao-realizada"): { ok: boolean; reason: string } {
  if (kind === "conferir" || kind === "comentar") return { ok: true, reason: "" };
  return { ok: false, reason: "Registro, retificação e declaração de não realização pertencem ao professor pelo Diário, com autoria e motivo." };
}

/** Central: só contagens por escola; nenhum conteúdo, nome ou estudante. */
export function centralLessonCounts(c: ReturnType<typeof lessonPanel>["counts"]) {
  return c ? { previstas: c.previstas, registradas: c.registradas, pendentesDeConferencia: c.pendentesDeConferencia } : null;
}
