/**
 * Simbologia dos Calendários Escolares — aparência do marcador como DADO.
 *
 * Identidade/significado do tipo de dia vivem em `DAY_TYPES` (catálogo);
 * a aparência do marcador vive aqui, associada ao tipo por código. Nenhum
 * valor visual participa de regra acadêmica, contagem ou precedência.
 *
 * A futura tela "Personalizar marcador/legenda" (B4) editará exatamente este
 * formato; até lá a configuração é o padrão do sistema abaixo.
 */
import type { DayTypeCode } from "./calendar-types";

/** Formas registradas; nova forma entra por registro no renderizador. */
export const MARKER_SHAPES = [
  "nenhuma",
  "retangulo",
  "retangulo-arredondado",
  "circulo",
  "elipse",
  "triangulo",
] as const;
export type MarkerShape = (typeof MARKER_SHAPES)[number];

/** Cor hexadecimal, "transparent" ou "currentColor" (herda o texto da célula). */
export type MarkerColor = string;

export type MarkerSymbology = {
  /** Sigla exibida na grade; ausente = sigla do tipo no catálogo. */
  text?: string | undefined;
  /** Sigla exibida na legenda quando difere da grade. */
  legendText?: string | undefined;
  shape: MarkerShape;
  fillColor?: MarkerColor | undefined;
  borderColor?: MarkerColor | undefined;
  /** Ausente = herda a cor de texto do tipo na célula/legenda. */
  textColor?: MarkerColor | undefined;
  /** Ausente = tamanho do texto ao redor. */
  fontSizePt?: number | undefined;
  fontWeight?: 400 | 700 | undefined;
  fontStyle?: "normal" | "italic" | undefined;
  borderWidthPx?: number | undefined;
  borderStyle?: "solid" | "dashed" | "dotted" | undefined;
  /** Lado mínimo do marcador em em (relativo ao texto). */
  sizeEm?: number | undefined;
  paddingPx?: number | undefined;
};

/** Limites de segurança visual (célula da grade ≈ 30px). */
export const SYMBOLOGY_LIMITS = {
  fontSizePt: { min: 4, max: 14 },
  borderWidthPx: { min: 0, max: 3 },
  sizeEm: { min: 0.8, max: 2.5 },
  paddingPx: { min: 0, max: 4 },
  textLength: { max: 6 },
} as const;

export type SymbologyIssue = { field: keyof MarkerSymbology; message: string };

const COLOR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|transparent|currentColor)$/;

/** Valida sem corrigir: valor fora do limite é apontado, nunca ajustado. */
export function validateSymbology(s: MarkerSymbology): SymbologyIssue[] {
  const issues: SymbologyIssue[] = [];
  if (!(MARKER_SHAPES as readonly string[]).includes(s.shape))
    issues.push({ field: "shape", message: `Forma não registrada: ${s.shape}` });
  for (const f of ["fillColor", "borderColor", "textColor"] as const) {
    const v = s[f];
    if (v !== undefined && !COLOR.test(v)) issues.push({ field: f, message: `Cor inválida: ${v}` });
  }
  const range = (f: "fontSizePt" | "borderWidthPx" | "sizeEm" | "paddingPx") => {
    const v = s[f];
    const { min, max } = SYMBOLOGY_LIMITS[f];
    if (v !== undefined && (!Number.isFinite(v) || v < min || v > max))
      issues.push({ field: f, message: `${f} deve estar entre ${min} e ${max}` });
  };
  range("fontSizePt");
  range("borderWidthPx");
  range("sizeEm");
  range("paddingPx");
  for (const f of ["text", "legendText"] as const) {
    const v = s[f];
    if (v !== undefined && v.length > SYMBOLOGY_LIMITS.textLength.max)
      issues.push({ field: f, message: `Sigla com mais de ${SYMBOLOGY_LIMITS.textLength.max} caracteres` });
  }
  return issues;
}

const PLAIN: MarkerSymbology = { shape: "nenhuma" };
const BOXED: MarkerSymbology = {
  shape: "retangulo",
  fillColor: "transparent",
  borderColor: "currentColor",
  borderWidthPx: 1,
  borderStyle: "solid",
  paddingPx: 1,
};

/**
 * Configuração vigente (pedido SEMED): EBV só texto; CC, CF e C em retângulo;
 * Término com sigla "T" na legenda. Tipos ausentes = somente texto.
 */
export const DEFAULT_SYMBOLOGY: Partial<Record<DayTypeCode, MarkerSymbology>> = {
  ENCONTRO: { ...PLAIN, text: "EBV" },
  CC: BOXED,
  CF: BOXED,
  CENSO: BOXED,
  TERMINO: { ...PLAIN, legendText: "T" },
};

export function symbologyFor(
  code: DayTypeCode | null | undefined,
  config: Partial<Record<DayTypeCode, MarkerSymbology>> = DEFAULT_SYMBOLOGY,
): MarkerSymbology {
  return (code && config[code]) || PLAIN;
}
