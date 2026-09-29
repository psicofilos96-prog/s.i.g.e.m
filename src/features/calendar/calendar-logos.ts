/**
 * Logos/imagens institucionais do documento como elementos visuais
 * configuráveis (lista aberta, ordenável). Cabeçalho continua sendo bloco; as
 * logos são posicionadas dentro dele. Impressão herda tudo e só grava delta
 * em `document.layout.print.logos[id]` (ativo com `print.separate`).
 */
import type { IdentityKind } from "@/features/identity/identity-store";

export type LogoSource =
  | { kind: "identity"; identityKind: IdentityKind }
  | { kind: "asset"; assetId: string }
  | { kind: "none" };

export type LogoPosition = "esquerda" | "centro" | "direita" | "personalizada";
export type LogoUnit = "mm" | "px";
export type LogoFit = "contain" | "cover" | "fill";
export type LogoAnchor = "center" | "left" | "right" | "top" | "bottom";

export type CalendarLogo = {
  /** Identidade do elemento na composição (nunca o arquivo). */
  id: string;
  label: string;
  source: LogoSource;
  /** Imagem padrão do modelo, para "Restaurar imagem padrão". */
  defaultSource?: LogoSource | undefined;
  visible: boolean;
  position: LogoPosition;
  unit: LogoUnit;
  width?: number | undefined;
  height?: number | undefined;
  keepRatio: boolean;
  /** Proporção largura/altura da imagem escolhida (para manter proporção). */
  aspect?: number | undefined;
  minWidth?: number | undefined;
  maxWidth?: number | undefined;
  /** Posição personalizada, a partir do canto superior esquerdo do cabeçalho. */
  x?: number | undefined;
  y?: number | undefined;
  marginTopPt?: number | undefined;
  marginBottomPt?: number | undefined;
  marginLeftPt?: number | undefined;
  marginRightPt?: number | undefined;
  /** Distância em relação aos textos/outros elementos. */
  gapPt?: number | undefined;
  alignH?: "start" | "center" | "end" | undefined;
  alignV?: "start" | "center" | "end" | undefined;
  fit: LogoFit;
  anchor?: LogoAnchor | undefined;
  opacity?: number | undefined;
};

export const LOGO_LIMITS = {
  mm: { min: 3, max: 120 },
  px: { min: 10, max: 450 },
  marginPt: { min: 0, max: 60 },
  offset: { mm: 200, px: 760 },
} as const;

/** Composição do modelo: brasão à esquerda, Secretaria à direita. */
export const DEFAULT_LOGOS: CalendarLogo[] = [
  {
    id: "logo-brasao",
    label: "Brasão do Município",
    source: { kind: "identity", identityKind: "municipal-coat-of-arms" },
    defaultSource: { kind: "identity", identityKind: "municipal-coat-of-arms" },
    visible: true,
    position: "esquerda",
    unit: "px",
    keepRatio: true,
    fit: "contain",
  },
  {
    id: "logo-secretaria",
    label: "Logo da Secretaria Municipal de Educação",
    source: { kind: "identity", identityKind: "education-department-logo" },
    defaultSource: { kind: "identity", identityKind: "education-department-logo" },
    visible: true,
    position: "direita",
    unit: "px",
    keepRatio: true,
    fit: "contain",
  },
];

export const logosOf = (layout: { logos?: CalendarLogo[] | undefined } | undefined) =>
  layout?.logos ?? DEFAULT_LOGOS;

/** Logo efetiva na impressão: geral + delta. */
export function printLogo(logo: CalendarLogo, delta: Partial<CalendarLogo> | undefined): CalendarLogo {
  if (!delta) return logo;
  const d = Object.fromEntries(Object.entries(delta).filter(([, v]) => v !== undefined));
  return { ...logo, ...d } as CalendarLogo;
}

/** Só o que difere vira sobrescrita de impressão. */
export function logoDelta(base: CalendarLogo, next: CalendarLogo): Partial<CalendarLogo> | undefined {
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(next)]) as Set<keyof CalendarLogo>)
    if (JSON.stringify(base[k]) !== JSON.stringify(next[k])) out[k] = next[k] ?? null;
  return Object.keys(out).length ? (out as Partial<CalendarLogo>) : undefined;
}

/** Manter proporção: a outra dimensão é calculada, nunca deformada. */
export function resize(logo: CalendarLogo, dim: "width" | "height", value: number | undefined): CalendarLogo {
  const next = { ...logo, [dim]: value };
  if (logo.keepRatio && logo.aspect && value !== undefined) {
    if (dim === "width") next.height = round(value / logo.aspect);
    else next.width = round(value * logo.aspect);
  }
  return next;
}
const round = (v: number) => Math.round(v * 10) / 10;

export type LogoIssue = { logoId: string; message: string };

export function validateLogos(logos: CalendarLogo[]): LogoIssue[] {
  const out: LogoIssue[] = [];
  const ids = new Set<string>();
  for (const l of logos) {
    if (ids.has(l.id)) out.push({ logoId: l.id, message: "Identificador de logo duplicado." });
    ids.add(l.id);
    const lim = LOGO_LIMITS[l.unit];
    for (const [name, v] of [["Largura", l.width], ["Altura", l.height]] as const)
      if (v !== undefined && (!Number.isFinite(v) || v < lim.min || v > lim.max))
        out.push({ logoId: l.id, message: `${name} de "${l.label}" deve estar entre ${lim.min} e ${lim.max} ${l.unit}.` });
    if (l.minWidth !== undefined && l.maxWidth !== undefined && l.minWidth > l.maxWidth)
      out.push({ logoId: l.id, message: `"${l.label}": largura mínima maior que a máxima.` });
    if (l.width !== undefined && l.minWidth !== undefined && l.width < l.minWidth)
      out.push({ logoId: l.id, message: `"${l.label}": largura abaixo do mínimo definido.` });
    if (l.width !== undefined && l.maxWidth !== undefined && l.width > l.maxWidth)
      out.push({ logoId: l.id, message: `"${l.label}": largura acima do máximo definido.` });
    if (l.opacity !== undefined && (l.opacity < 0.1 || l.opacity > 1))
      out.push({ logoId: l.id, message: `"${l.label}": opacidade deve estar entre 10% e 100%.` });
  }
  return out;
}
