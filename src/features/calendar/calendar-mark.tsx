/**
 * Renderizador único do marcador de um tipo de dia (grade, legenda, editor,
 * impressão). Desenha a forma em SVG a partir da simbologia configurada; não
 * conhece nenhum código de tipo.
 *
 * Centralização geométrica: a sigla é posicionada no CENTRO VISUAL da forma
 * (registro `SHAPE_GEOMETRY`), com a caixa do texto aparada às métricas reais
 * da fonte (altura de maiúscula → linha de base), e não pela caixa HTML. O
 * tamanho automático do marcador vem de um molde invisível da própria sigla
 * ampliado pelo fator da forma — assim trocar a forma, a fonte ou a sigla
 * nunca exige ajuste manual de posição.
 */
import type { CSSProperties, ReactElement } from "react";
import type { DayTypeCatalog, DayTypeCode } from "./calendar-types";
import { DAY_TYPES, typeInfo } from "./calendar-catalog";
import {
  printSymbologyFor,
  symbologyFor,
  validateSymbology,
  type SymbologyDeltaMap,
  type MarkerShape,
  type MarkerSymbology,
  type SymbologyMap,
} from "./calendar-symbology";

type ShapeProps = { fill: string; stroke: string; strokeWidth: number; dash?: string | undefined };

const common = (p: ShapeProps) => ({
  fill: p.fill,
  stroke: p.stroke,
  strokeWidth: p.strokeWidth,
  strokeDasharray: p.dash,
  vectorEffect: "non-scaling-stroke" as const,
});

type DrawnShape = Exclude<MarkerShape, "nenhuma">;

/** Registro de formas: nova forma = nova entrada, sem tocar no componente. */
export const SHAPE_RENDERERS: Record<DrawnShape, (p: ShapeProps) => ReactElement> = {
  retangulo: (p) => <rect x="0.5" y="0.5" width="99" height="99" {...common(p)} />,
  "retangulo-arredondado": (p) => <rect x="0.5" y="0.5" width="99" height="99" rx="18" ry="18" {...common(p)} />,
  circulo: (p) => <circle cx="50" cy="50" r="49" {...common(p)} />,
  elipse: (p) => <ellipse cx="50" cy="50" rx="49" ry="49" {...common(p)} />,
  triangulo: (p) => <polygon points="50,1 99,99 1,99" {...common(p)} />,
};

/**
 * Geometria de cada forma, em coordenadas normalizadas da caixa (0..1):
 * - `center`: centro visual onde a sigla é centrada (triângulo = incentro);
 * - `scale`: fator do molde automático, para que a sigla caiba na forma;
 * - `square`: a forma mantém proporção 1:1 (círculo);
 * - `fits`: a caixa da sigla (w×h, frações da área útil) cabe na forma?
 */
export type ShapeGeometry = {
  center: { x: number; y: number };
  scale: number;
  square?: boolean;
  fits: (w: number, h: number) => boolean;
};

// Triângulo desenhado em (50,1) (99,99) (1,99): incentro em y ≈ 0,69.
const TRI_TOP = 0.01;
const TRI_BASE = 0.99;
const TRI_CY = 0.69;

export const SHAPE_GEOMETRY: Record<DrawnShape, ShapeGeometry> = {
  retangulo: { center: { x: 0.5, y: 0.5 }, scale: 1, fits: (w, h) => w <= 1 && h <= 1 },
  "retangulo-arredondado": {
    center: { x: 0.5, y: 0.5 },
    scale: 1.12,
    fits: (w, h) => w <= 0.92 && h <= 0.92,
  },
  // Retângulo centrado inscrito em elipse: (w/W)² + (h/H)² ≤ 1.
  circulo: { center: { x: 0.5, y: 0.5 }, scale: 1.5, square: true, fits: (w, h) => w * w + h * h <= 1 },
  elipse: { center: { x: 0.5, y: 0.5 }, scale: 1.5, fits: (w, h) => w * w + h * h <= 1 },
  triangulo: {
    center: { x: 0.5, y: TRI_CY },
    scale: 2.35,
    fits: (w, h) => {
      const a = h / 2;
      if (TRI_CY + a > TRI_BASE) return false;
      // largura disponível na borda superior da caixa da sigla
      return w <= (TRI_CY - a - TRI_TOP) / (TRI_BASE - TRI_TOP);
    },
  },
};

/**
 * A sigla cabe na forma? Recebe medidas reais (px) da caixa do marcador, da
 * sigla aparada e da espessura da borda. Nunca ajusta nada: só responde.
 */
export function shapeFits(
  shape: MarkerShape,
  box: { width: number; height: number },
  text: { width: number; height: number },
  borderPx = 0,
): boolean {
  if (shape === "nenhuma") return true;
  const g = SHAPE_GEOMETRY[shape];
  let W = box.width - 2 * borderPx;
  let H = box.height - 2 * borderPx;
  if (g.square) W = H = Math.min(W, H);
  if (W <= 0 || H <= 0) return false;
  return g.fits(text.width / W, text.height / H);
}

/** Diagnóstico do marcador já desenhado (editor e verificação visual). */
export function markerFitIssue(el: HTMLElement | null): string | null {
  if (!el) return null;
  const shape = el.getAttribute("data-shape") as MarkerShape | null;
  const sigla = el.querySelector<HTMLElement>(".cd-marcador-sigla");
  if (!shape || !sigla) return null;
  const b = el.getBoundingClientRect();
  const t = sigla.getBoundingClientRect();
  if (b.width === 0 || t.width === 0) return null;
  const border = Number(el.getAttribute("data-border") ?? 0);
  return shapeFits(shape, b, t, border)
    ? null
    : "A sigla não cabe nesta forma com as dimensões, a fonte e o espaçamento escolhidos. Aumente largura/altura ou reduza a fonte — o sistema não comprime nem corta a sigla.";
}

const dashFor = (s: MarkerSymbology["borderStyle"]) =>
  s === "dashed" ? "4 2" : s === "dotted" ? "1 2" : undefined;

export function MarkerGlyph({ symbology, text }: { symbology: MarkerSymbology; text: string }) {
  if (!text) return null;
  const s = symbology;
  const invalid = validateSymbology(s).length > 0;
  const font: CSSProperties = {
    fontSize: s.fontSizePt ? `${s.fontSizePt}pt` : undefined,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
  };
  const textStyle: CSSProperties = { position: "relative", color: s.textColor, ...font };
  // Configuração inválida não é corrigida em silêncio: mostra só a sigla e sinaliza.
  if (invalid || s.shape === "nenhuma")
    return (
      <span className="cd-marcador-texto" data-symbology-invalid={invalid || undefined} style={invalid ? undefined : textStyle}>
        {text}
      </span>
    );
  const render = SHAPE_RENDERERS[s.shape];
  const g = SHAPE_GEOMETRY[s.shape];
  const pad = s.paddingPx ?? 0;
  const border = s.borderWidthPx ?? 0;
  return (
    <span
      className="cd-marcador"
      data-shape={s.shape}
      data-border={border}
      style={{
        ...font,
        width: s.widthPx ? `${s.widthPx}px` : undefined,
        height: s.heightPx ? `${s.heightPx}px` : undefined,
        padding: `${pad + border}px`,
        aspectRatio: g.square && !(s.widthPx && s.heightPx) ? "1 / 1" : undefined,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio={g.square ? "xMidYMid meet" : "none"}
        aria-hidden
        className="cd-marcador-forma"
      >
        {render({
          fill: s.fillColor ?? "transparent",
          stroke: s.borderColor ?? "transparent",
          strokeWidth: border,
          dash: dashFor(s.borderStyle),
        })}
      </svg>
      <span
        className="cd-marcador-sigla"
        style={{
          ...textStyle,
          position: "absolute",
          left: `${g.center.x * 100}%`,
          top: `${g.center.y * 100}%`,
        }}
      >
        {text}
      </span>
      {/* Molde invisível: dá ao marcador o tamanho necessário para a sigla caber na forma. */}
      <span
        className="cd-marcador-molde"
        aria-hidden
        data-sigla={text}
        style={{ fontSize: `${g.scale}em` }}
      />
    </span>
  );
}

/**
 * Representação textual por extenso (ex.: "Férias"): mesmo tipo, outra
 * aparência. Centrada na área destinada a ela; nunca comprimida em silêncio.
 */
export function TextGlyph({ symbology: s, text }: { symbology: MarkerSymbology; text: string }) {
  if (!text) return null;
  const invalid = validateSymbology(s).length > 0;
  const bw = s.borderWidthPx ?? 0;
  const style: CSSProperties = invalid
    ? {}
    : {
        display: "inline-block",
        fontFamily: s.fontFamily,
        fontSize: s.fontSizePt ? `${s.fontSizePt}pt` : undefined,
        fontWeight: s.fontWeight,
        fontStyle: s.fontStyle,
        textDecoration: s.underline ? "underline" : undefined,
        textAlign: s.textAlign ?? "center",
        letterSpacing: s.letterSpacingPt !== undefined ? `${s.letterSpacingPt}pt` : undefined,
        color: s.textColor,
        backgroundColor: s.fillColor,
        border: bw > 0 ? `${bw}px ${s.borderStyle ?? "solid"} ${s.borderColor ?? "currentColor"}` : undefined,
        padding: s.paddingPx !== undefined ? `${s.paddingPx}px` : undefined,
        minWidth: s.widthPx ? `${s.widthPx}px` : undefined,
        minHeight: s.heightPx ? `${s.heightPx}px` : undefined,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      };
  return (
    <span className="cd-marcador-extenso" data-representation="texto" data-symbology-invalid={invalid || undefined} style={style}>
      {text}
    </span>
  );
}

/** Um tipo, conforme o modo de representação configurado. */
function Glyph({ s, code, text, types }: { s: MarkerSymbology; code?: DayTypeCode | null | undefined; text: string; types: DayTypeCatalog }) {
  if (s.representation === "texto") {
    const full = s.fullText ?? (code ? typeInfo(types, code).label : text);
    return <TextGlyph symbology={s} text={full} />;
  }
  return <MarkerGlyph symbology={s} text={text} />;
}

/**
 * Marcador de um tipo de dia a partir da simbologia (personalização do
 * calendário → padrão do sistema). Usado por editor, legenda, célula,
 * documento e impressão.
 */
export function DayMark({
  code,
  text,
  symbology,
  overrides,
  printOverrides,
  where = "grade",
  types = DAY_TYPES,
  extra,
}: {
  code?: DayTypeCode | null | undefined;
  text: string;
  /** Aparência explícita (pré-visualização do editor). */
  symbology?: MarkerSymbology | undefined;
  overrides?: SymbologyMap | undefined;
  /** Delta de impressão; quando existe, a folha A4 usa a variante própria. */
  printOverrides?: SymbologyDeltaMap | undefined;
  where?: "grade" | "legenda";
  types?: DayTypeCatalog | undefined;
  /** Outros eventos coexistentes na data (registros distintos, ordem declarada). */
  extra?: DayTypeCode[] | undefined;
}) {
  const screen = symbology ?? symbologyFor(code, overrides);
  const print = symbology ? null : printSymbologyFor(code, overrides, printOverrides);
  const one = (s: MarkerSymbology, delta: SymbologyDeltaMap | undefined) => {
    const own = where === "legenda" ? (s.legendText ?? s.text ?? text) : (s.text ?? text);
    const legendMarker = where === "legenda" ? { ...s, representation: "marcador" as const } : s;
    const list = where === "grade" ? [...(s.companions ?? []), ...(extra ?? [])] : [];
    const main = <Glyph s={legendMarker} code={code} text={own} types={types} />;
    if (list.length === 0) return main;
    return (
      <span className="cd-marcadores">
        {list.map((c, i) => {
          const cs = (delta ? printSymbologyFor(c, overrides, delta) : null) ?? symbologyFor(c, overrides);
          return <Glyph key={`${c}-${i}`} s={cs} code={c} text={cs.text ?? typeInfo(types, c).mark} types={types} />;
        })}
        {main}
      </span>
    );
  };
  if (!print) return one(screen, undefined);
  return (
    <>
      <span className="cd-so-tela">{one(screen, undefined)}</span>
      <span className="cd-so-a4">{one(print, printOverrides)}</span>
    </>
  );
}
