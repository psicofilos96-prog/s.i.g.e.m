import type { InstitutionalMatrixApplicability, InstitutionalMatrixItem } from "./curricular-matrix-source";

/**
 * NCURR.2 — o que cada tela consumidora consegue tirar desta versão da matriz.
 * Projeção pura sobre itens/aplicabilidade já lidos pelos readers canônicos:
 * não lê turmas, não resolve matriz para turma e não infere etapa, turno ou carga.
 */
export type ConsumerId = "turmas" | "diario" | "horarios" | "avaliacao";
export type ConsumerReadiness = { id: ConsumerId; title: string; state: "pronto" | "incompleto"; reasons: string[] };

export function applicabilitySummary(app: readonly InstitutionalMatrixApplicability[]) {
  const years = app.filter((a) => a.dimension === "ano-letivo").length;
  const schools = app.filter((a) => a.dimension === "escola").length;
  const schemes = [...new Set(app.flatMap((a) => (a.dimension === "atributo" ? [a.schemeId] : [])))].sort();
  return { years, schools, schemes };
}

export function matrixIntegration(
  items: readonly InstitutionalMatrixItem[],
  app: readonly InstitutionalMatrixApplicability[],
  homologated: boolean | null,
): ConsumerReadiness[] {
  const s = applicabilitySummary(app);
  const components = items.filter((i) => i.reference.kind === "componente").length;
  const withoutLoad = items.filter((i) => i.load === null).length;
  const h = homologated === true ? [] : [homologated === null ? "Situação de homologação não lida." : "Versão ainda não homologada."];
  const turmas = [...h];
  if (s.years === 0) turmas.push("Nenhum ano letivo declarado na aplicabilidade.");
  if (s.schools === 0 && s.schemes.length === 0) turmas.push("Nenhuma escola ou atributo (etapa, turno…) declarado; a turma não é alcançada.");
  const comp = components === 0 ? ["Nenhum componente curricular entre os itens."] : [];
  const horarios = [...h, ...comp];
  if (items.length > 0 && withoutLoad > 0) horarios.push(`${withoutLoad} item(ns) sem carga registrada: aulas previstas não calculáveis para eles.`);
  const mk = (id: ConsumerId, title: string, reasons: string[]): ConsumerReadiness =>
    ({ id, title, state: reasons.length === 0 ? "pronto" : "incompleto", reasons });
  return [
    mk("turmas", "Turmas", turmas),
    mk("diario", "Diário", [...h, ...comp]),
    mk("horarios", "Horários", horarios),
    mk("avaliacao", "Avaliação", [...h, ...comp]),
  ];
}
