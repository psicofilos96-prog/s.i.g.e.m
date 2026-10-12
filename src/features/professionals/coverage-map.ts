/**
 * Gestão de Pessoas L14 — Mapa de Cobertura Docente.
 * Por escola × turma × componente: cobertura INTEGRAL / PARCIAL / AUSENTE /
 * INDETERMINADA a partir de blocos oficiais × atribuições vigentes × substituições
 * vigentes. Execução (aula ministrada) é eixo SEPARADO e vem só do Diário de
 * Classe (situação de ocorrência da aula); atribuição nunca prova aula dada.
 */

export type CoverageBlock = Readonly<{ blockId: string; schoolId: string; classId: string; componentId: string }>;
export type BlockHolder = Readonly<{ blockId: string; personId: string; source: "atribuicao" | "substituicao"; ref: string }>;
/** Situação de cada ocorrência no Diário (LOTE 04 Docente); ausência de registro ≠ não realizada. */
export type DiaryOccurrence = Readonly<{ blockId: string; date: string; situation: "Prevista" | "Realizada" | "Não realizada" | "Reposta" | "Substituída" | "Inconsistente" }>;

export type Coverage = "integral" | "parcial" | "ausente" | "indeterminada";

export type CoverageCell = Readonly<{
  schoolId: string; classId: string; componentId: string;
  blocks: number; coveredByAssignment: number; coveredBySubstitution: number; uncovered: number;
  coverage: Coverage;
  uncoveredBlockIds: readonly string[];
  holderRefs: readonly string[];
  execution: Readonly<{ diaryRead: boolean; realized: number | null; notRealized: number | null; withoutRecord: number | null }>;
}>;

export function coverageMap(
  blocks: readonly CoverageBlock[] | null, // null = grade não lida
  holders: readonly BlockHolder[] | null, // null = atribuições/substituições não lidas
  diary: readonly DiaryOccurrence[] | null, // null = Diário não lido
): CoverageCell[] | null {
  if (!blocks) return null;
  const groups = new Map<string, CoverageBlock[]>();
  for (const b of blocks) {
    const k = `${b.schoolId}|${b.classId}|${b.componentId}`;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  return [...groups.values()].map((bs) => {
    const ids = bs.map((b) => b.blockId);
    let byA = 0, byS = 0;
    const unc: string[] = [], refs: string[] = [];
    if (holders) for (const id of ids) {
      const hs = holders.filter((h) => h.blockId === id);
      const sub = hs.find((h) => h.source === "substituicao");
      const asg = hs.find((h) => h.source === "atribuicao");
      if (sub) { byS++; refs.push(sub.ref); } else if (asg) { byA++; refs.push(asg.ref); } else unc.push(id);
    }
    const covered = byA + byS;
    const coverage: Coverage = !holders ? "indeterminada" : covered === ids.length ? "integral" : covered === 0 ? "ausente" : "parcial";
    const occ = diary?.filter((o) => ids.includes(o.blockId)) ?? null;
    return {
      schoolId: bs[0]!.schoolId, classId: bs[0]!.classId, componentId: bs[0]!.componentId,
      blocks: ids.length,
      coveredByAssignment: holders ? byA : 0, coveredBySubstitution: holders ? byS : 0, uncovered: holders ? unc.length : 0,
      coverage, uncoveredBlockIds: unc, holderRefs: refs,
      execution: occ === null
        ? { diaryRead: false, realized: null, notRealized: null, withoutRecord: null }
        : {
            diaryRead: true,
            realized: occ.filter((o) => o.situation === "Realizada" || o.situation === "Reposta" || o.situation === "Substituída").length,
            notRealized: occ.filter((o) => o.situation === "Não realizada").length,
            withoutRecord: occ.filter((o) => o.situation === "Prevista" || o.situation === "Inconsistente").length,
          },
    };
  }).sort((a, b) => `${a.schoolId}${a.classId}${a.componentId}`.localeCompare(`${b.schoolId}${b.classId}${b.componentId}`));
}

/** Resumo por escola: contagens por situação de cobertura, sem taxa nem ranking. */
export function bySchool(cells: readonly CoverageCell[]) {
  const m = new Map<string, Record<Coverage, number>>();
  for (const c of cells) {
    const r = m.get(c.schoolId) ?? { integral: 0, parcial: 0, ausente: 0, indeterminada: 0 };
    r[c.coverage]++; m.set(c.schoolId, r);
  }
  return m;
}

export const COVERAGE_LABEL: Readonly<Record<Coverage, string>> = {
  integral: "Cobertura integral", parcial: "Cobertura parcial", ausente: "Sem cobertura", indeterminada: "Não verificável (atribuições não lidas)",
};
export const EXECUTION_NOTE = "Aula atribuída não é aula ministrada: a execução vem só do registro no Diário de Classe.";
