/**
 * Catálogo de tipos de dia/evento — FONTE ÚNICA de identidade, significado e
 * semântica de cada tipo. `DAY_TYPES` é o catálogo inicial do modelo da
 * Supervisão; cada calendário pode redefinir esses tipos e criar novos em
 * `NetworkCalendar.dayTypeCatalog` (mesmo formato, mesmo identificador
 * permanente). Motor, seletor, grade, legenda e impressão leem
 * `dayTypesOf(cal)` — não existe lista paralela.
 *
 * Aparência (sigla exibida, forma, cores do marcador) vive em
 * calendar-symbology.ts; significado e consequência nunca derivam dela.
 */
import type {
  DayTypeCatalog,
  DayTypeCode,
  DayTypeInfo,
  DayTypeKind,
  NetworkCalendar,
} from "./calendar-types";

const t = (
  code: DayTypeCode,
  label: string,
  mark: string,
  background: string,
  foreground: string,
  countsAsSchoolDay: boolean,
  kind: DayTypeKind,
  legendOrder: number,
  showInLegend: boolean,
  extra: Partial<DayTypeInfo> = {},
): DayTypeInfo => ({
  code,
  label,
  mark,
  background,
  foreground,
  countsAsSchoolDay,
  kind,
  legendOrder,
  showInLegend,
  active: true,
  version: 1,
  native: true,
  ...extra,
});

export const DAY_TYPES: DayTypeCatalog = {
  VAZIO: t("VAZIO", "Dia letivo comum", "", "#FFFFFF", "#000000", true, "automatico", 0, false),
  FDS: t("FDS", "Sábado / Domingo", "S/D", "#C3D69B", "#000000", false, "automatico", 0, false),
  ENCONTRO: t(
    "ENCONTRO",
    "Encontro de Boas-vindas aos Profissionais da Educação - SEMED",
    "EBV",
    "#F2DCDB",
    "#000000",
    false,
    "evento",
    1,
    true,
  ),
  INICIO: t("INICIO", "Início das aulas", "I", "#4FCC22", "#000000", true, "evento", 2, true),
  FERIADO: t("FERIADO", "Feriado", "F", "#FF0000", "#000000", false, "feriado", 3, true),
  FERIAS: t("FERIAS", "Férias", "F", "#FFFF00", "#000000", false, "ferias", 4, true),
  FL: t("FL", "Feriado Letivo", "FL", "#538DD5", "#000000", true, "feriado-letivo", 5, true),
  RECESSO: t("RECESSO", "Recesso", "R", "#FFC000", "#000000", false, "recesso", 6, true),
  CC: t("CC", "Conselho de Classe", "CC", "#FFFFFF", "#000000", true, "evento", 7, true, {
    councilRole: "conselho",
  }),
  CF: t("CF", "Conselho de Classe Final", "CF", "#FFFFFF", "#000000", true, "evento", 8, true, {
    councilRole: "conselho-final",
  }),
  CENSO: t("CENSO", "Dia Nacional do Censo Escolar", "C", "#FFFFFF", "#FF0000", true, "evento", 9, true),
  RETORNO: t("RETORNO", "Retorno às aulas", "RA", "#36A874", "#000000", true, "evento", 10, true),
  TERMINO: t("TERMINO", "Término do ano letivo", "CF T", "#996633", "#FFFFFF", true, "evento", 11, true, {
    councilRole: "conselho-final",
  }),
  MESTRE: t("MESTRE", "Dia do Mestre (transferido)", "MESTRE", "#7030A0", "#FFFFFF", false, "evento", 0, false),
  PP: t("PP", "Planejamento Pedagógico / Formação", "PP", "#B8CCE4", "#000000", false, "evento", 12, true),
  PF: t("PF", "Ponto Facultativo", "PF", "#FCD5B4", "#000000", false, "feriado", 13, true),
};

/** Catálogo efetivo do calendário: modelo → redefinições/tipos do calendário. */
export function dayTypesOf(cal: Pick<NetworkCalendar, "dayTypeCatalog"> | null | undefined): DayTypeCatalog {
  const own = cal?.dayTypeCatalog;
  if (!own || Object.keys(own).length === 0) return DAY_TYPES;
  return { ...DAY_TYPES, ...own };
}

/** Tipo desconhecido (removido do catálogo) nunca vira letivo nem some: fica explícito. */
export function typeInfo(types: DayTypeCatalog, code: DayTypeCode): DayTypeInfo {
  return (
    types[code] ?? {
      code,
      label: `Tipo não catalogado (${code})`,
      mark: "?",
      background: "#FFFFFF",
      foreground: "#000000",
      countsAsSchoolDay: null,
      kind: null,
      legendOrder: 999,
      showInLegend: false,
      active: false,
    }
  );
}

/** Conta como letivo apenas quando DECLARADO; ausência nunca vira letivo. */
export const countsAsSchool = (i: DayTypeInfo) => i.countsAsSchoolDay === true;

/** Precedência por natureza do tipo (menor vence). Sobrescrita é checada antes. */
export const KIND_PRIORITY: Record<DayTypeKind, number> = {
  evento: 1,
  "feriado-letivo": 2,
  feriado: 3,
  recesso: 5,
  ferias: 6,
  automatico: 8,
};
/** Feriado herdado do ano letivo: degrau próprio, entre feriado da modalidade e recesso. */
export const INHERITED_PRIORITY = 4;
export const kindPriority = (i: DayTypeInfo) => (i.kind ? KIND_PRIORITY[i.kind] : 9);

export const INEXISTENT_GRAY = "#4D4D4D";

/** Natureza e semântica declaradas? Sem isso o tipo não pode ser aplicado a datas. */
export function semanticsMissing(i: DayTypeInfo): string | null {
  if (i.kind === null || i.countsAsSchoolDay === null)
    return `O tipo "${i.label}" ainda não tem natureza e efeito sobre a contagem de dias letivos declarados. Defina-os em "Tipos de dia e eventos" antes de aplicá-lo a uma data.`;
  return null;
}

/** Tipos que a Supervisão pode aplicar no editor: ativos, não automáticos. */
export function editableTypes(types: DayTypeCatalog): DayTypeInfo[] {
  return Object.values(types)
    .filter((d) => d.kind !== "automatico" && d.active !== false)
    .sort((a, b) => a.legendOrder - b.legendOrder || a.label.localeCompare(b.label));
}

/** Compatibilidade: catálogo do modelo. Telas devem preferir `editableTypes(dayTypesOf(cal))`. */
export const EDITABLE_TYPES = editableTypes(DAY_TYPES);

/** O tipo é usado neste calendário? (impede exclusão destrutiva) */
export function typeUsage(cal: NetworkCalendar, code: DayTypeCode): number {
  return (
    cal.ranges.filter((r) => r.type === code).length +
    cal.events.filter((e) => e.type === code).length +
    cal.overrides.filter((o) => o.type === code).length +
    cal.inheritedHolidays.filter((h) => h.type === code).length
  );
}

export type DayTypeIssue = { field: keyof DayTypeInfo | "conflito"; message: string };

/** Valida sem corrigir. A identidade é o `code`; sigla repetida é conflito operacional. */
export function validateDayType(def: DayTypeInfo, types: DayTypeCatalog): DayTypeIssue[] {
  const out: DayTypeIssue[] = [];
  if (!def.label.trim()) out.push({ field: "label", message: "Informe o nome do tipo." });
  if (!(def.description ?? def.label).trim())
    out.push({ field: "description", message: "Informe o significado do tipo." });
  if (def.mark.length > 6) out.push({ field: "mark", message: "Sigla com mais de 6 caracteres." });
  const color = /^#[0-9a-fA-F]{6}$/;
  if (!color.test(def.background)) out.push({ field: "background", message: "Cor de fundo inválida." });
  if (!color.test(def.foreground)) out.push({ field: "foreground", message: "Cor do texto inválida." });
  if (def.active !== false && def.mark.trim()) {
    const clash = Object.values(types).find(
      (o) =>
        o.code !== def.code &&
        o.active !== false &&
        o.kind !== "automatico" &&
        o.mark.trim().toUpperCase() === def.mark.trim().toUpperCase() &&
        o.background.toUpperCase() === def.background.toUpperCase(),
    );
    if (clash)
      out.push({
        field: "conflito",
        message: `A sigla "${def.mark}" com o mesmo fundo já identifica "${clash.label}" — os dois tipos ficariam indistinguíveis no documento.`,
      });
  }
  return out;
}
