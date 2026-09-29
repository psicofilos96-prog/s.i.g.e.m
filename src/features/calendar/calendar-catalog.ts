/**
 * Catálogo de tipos de dia do modelo da Supervisão (espelho de `tipo_dia` da
 * especificação 2027). Cor, sigla e "conta como letivo" são atributos do tipo.
 */
import type { DayTypeCode, DayTypeInfo } from "./calendar-types";

const t = (
  code: DayTypeCode,
  label: string,
  mark: string,
  background: string,
  foreground: string,
  countsAsSchoolDay: boolean,
  kind: DayTypeInfo["kind"],
  legendOrder: number,
  showInLegend: boolean,
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
});

export const DAY_TYPES: Record<DayTypeCode, DayTypeInfo> = {
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
  CC: t("CC", "Conselho de Classe", "CC", "#FFFFFF", "#000000", true, "evento", 7, true),
  CF: t("CF", "Conselho de Classe Final", "CF", "#FFFFFF", "#000000", true, "evento", 8, true),
  CENSO: t(
    "CENSO",
    "Dia Nacional do Censo Escolar",
    "C",
    "#FFFFFF",
    "#FF0000",
    true,
    "evento",
    9,
    true,
  ),
  RETORNO: t("RETORNO", "Retorno às aulas", "RA", "#36A874", "#000000", true, "evento", 10, true),
  TERMINO: t(
    "TERMINO",
    "Término do ano letivo",
    "CF T",
    "#996633",
    "#FFFFFF",
    true,
    "evento",
    11,
    true,
  ),
  MESTRE: t(
    "MESTRE",
    "Dia do Mestre (transferido)",
    "MESTRE",
    "#7030A0",
    "#FFFFFF",
    false,
    "evento",
    0,
    false,
  ),
  PP: t(
    "PP",
    "Planejamento Pedagógico / Formação",
    "PP",
    "#B8CCE4",
    "#000000",
    false,
    "evento",
    12,
    true,
  ),
  PF: t("PF", "Ponto Facultativo", "PF", "#FCD5B4", "#000000", false, "feriado", 13, true),
};

// Aparência do marcador (sigla exibida, forma, cores) vive em calendar-symbology.ts.

/** Precedência por natureza do tipo (menor vence). Sobrescrita é checada antes. */
export const KIND_PRIORITY: Record<DayTypeInfo["kind"], number> = {
  evento: 1,
  "feriado-letivo": 2,
  feriado: 3,
  recesso: 5,
  ferias: 6,
  automatico: 8,
};
/** Feriado herdado do ano letivo: degrau próprio, entre feriado da modalidade e recesso. */
export const INHERITED_PRIORITY = 4;

export const INEXISTENT_GRAY = "#4D4D4D";

/** Tipos que a Supervisão pode aplicar no editor (automáticos ficam de fora). */
export const EDITABLE_TYPES = (Object.values(DAY_TYPES) as DayTypeInfo[]).filter(
  (d) => d.kind !== "automatico",
);
