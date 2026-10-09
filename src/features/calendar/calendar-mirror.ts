/**
 * Espelho Regular → EJA Fase I (decisão do usuário, 2026-10-08): são o mesmo calendário com
 * nomes diferentes. Toda alteração de conteúdo do Regular é repetida no EJA Fase I do mesmo ano.
 * Mutações por ID são traduzidas pelo conteúdo equivalente (data/tipo, ordem do período);
 * título e textos do documento NÃO são espelhados, porque os nomes diferem.
 */
import type { CalendarMutation } from "./calendar-governance";
import type { NetworkCalendar } from "./calendar-types";

export const MIRROR_PAIRS: ReadonlyArray<{ from: string; to: string }> = [{ from: "regular", to: "eja-fase-1" }];

export function mirrorTargets(source: NetworkCalendar, all: readonly NetworkCalendar[]): NetworkCalendar[] {
  const tos = MIRROR_PAIRS.filter((p) => p.from === source.modality).map((p) => p.to);
  return all.filter((c) => c.id !== source.id && c.academicYearId === source.academicYearId && tos.includes(c.modality));
}

/** Traduz a mutação para o calendário espelho; null = não se aplica (ex.: título). */
export function translateMutation(m: CalendarMutation, source: NetworkCalendar, target: NetworkCalendar): CalendarMutation | null {
  const periodByOrder = (id: string) => {
    const p = source.periods.find((x) => x.id === id);
    return p ? target.periods.find((x) => x.order === p.order) ?? null : null;
  };
  switch (m.kind) {
    case "definir-dia": case "restaurar-dia-letivo": case "aplicar-faixa": case "adicionar-evento":
    case "adicionar-periodo": case "salvar-tipo": case "remover-tipo":
      return m;
    case "remover-faixa": {
      const r = source.ranges.find((x) => x.id === m.id);
      const t = r && target.ranges.find((x) => x.type === r.type && x.start === r.start && x.end === r.end);
      return t ? { kind: "remover-faixa", id: t.id } : null;
    }
    case "remover-evento": case "editar-evento": {
      const e = source.events.find((x) => x.id === m.id);
      const t = e && target.events.find((x) => x.date === e.date && x.type === e.type);
      return t ? { ...m, id: t.id } : null;
    }
    case "salvar-periodo": {
      const t = periodByOrder(m.period.id);
      return t ? { kind: "salvar-periodo", period: { ...m.period, id: t.id, ...(m.period.groupId ? {} : {}) } } : null;
    }
    case "remover-periodo": case "mover-periodo": {
      const t = periodByOrder(m.id);
      return t ? { ...m, id: t.id } : null;
    }
    default:
      return null;
  }
}

/**
 * Espelho integral do CONTEÚDO (dias, faixas, eventos, períodos, regras, legenda, tipos, simbologia):
 * o alvo passa a ser igual à fonte; identidade, título, situação, textos/assinaturas do documento
 * e trilha do alvo são preservados. Alvo homologado/arquivado nunca é alterado.
 */
export function mirrorContent(source: NetworkCalendar, target: NetworkCalendar): NetworkCalendar {
  if (target.status === "homologado" || target.status === "arquivado") return target;
  // Períodos e grupos mantêm os IDs do ALVO (pela ordem): o banco vincula período por ID,
  // e IDs do Regular criariam períodos duplicados no EJA Fase I e o salvamento seria recusado.
  const srcGroups = source.periodGroups ?? [];
  const tgtGroups = target.periodGroups ?? [];
  const groupId = new Map<string, string>();
  srcGroups.forEach((g, i) => groupId.set(g.id, tgtGroups[i]?.id ?? `${target.id}-grupo-${i + 1}`));
  const tgtByOrder = new Map(target.periods.map((p) => [p.order, p.id]));
  const used = new Set<string>();
  const periods = source.periods.map((p) => {
    let id = tgtByOrder.get(p.order);
    if (!id || used.has(id)) id = `${target.id}-periodo-${p.order}`;
    used.add(id);
    return { ...p, id, ...(p.groupId ? { groupId: groupId.get(p.groupId) ?? p.groupId } : {}) };
  });
  const periodGroups = srcGroups.map((g) => ({ ...g, id: groupId.get(g.id)! }));
  return {
    ...target,
    ranges: source.ranges,
    events: source.events,
    periods,
    periodGroups: (source.periodGroups ? periodGroups : source.periodGroups) as NetworkCalendar["periodGroups"],
    overrides: source.overrides,
    inheritedHolidays: source.inheritedHolidays,
    rules: source.rules,
    legendHidden: source.legendHidden,
    customLegend: source.customLegend,
    symbology: source.symbology,
    symbologyPrint: source.symbologyPrint,
    dayTypeCatalog: source.dayTypeCatalog,
    dayTypeHistory: source.dayTypeHistory,
    councilRevision: source.councilRevision,
  };
}

const CONTENT_KEYS = ["ranges", "events", "periods", "periodGroups", "overrides", "inheritedHolidays", "rules", "legendHidden", "customLegend", "symbology", "symbologyPrint", "dayTypeCatalog"] as const;
export function mirrorDiffers(source: NetworkCalendar, target: NetworkCalendar): boolean {
  // Compara com o resultado exato do espelho (inclui IDs de período do alvo).
  const next = mirrorContent(source, target);
  if (next === target) return false;
  return CONTENT_KEYS.some((k) => JSON.stringify(next[k] ?? null) !== JSON.stringify(target[k] ?? null));
}
