/**
 * Renderizador único do marcador de um tipo de dia (grade, legenda, editor,
 * impressão). Desenha a forma em SVG a partir da simbologia configurada; não
 * conhece nenhum código de tipo.
 */
import type { CSSProperties, ReactElement } from "react";
import type { DayTypeCode } from "./calendar-types";
import {
  symbologyFor,
  validateSymbology,
  type MarkerShape,
  type MarkerSymbology,
} from "./calendar-symbology";

type ShapeProps = { fill: string; stroke: string; strokeWidth: number; dash?: string | undefined };

const common = (p: ShapeProps) => ({
  fill: p.fill,
  stroke: p.stroke,
  strokeWidth: p.strokeWidth,
  strokeDasharray: p.dash,
  vectorEffect: "non-scaling-stroke" as const,
});

/** Registro de formas: nova forma = nova entrada, sem tocar no componente. */
export const SHAPE_RENDERERS: Record<Exclude<MarkerShape, "nenhuma">, (p: ShapeProps) => ReactElement> = {
  retangulo: (p) => <rect x="0.5" y="0.5" width="99" height="99" {...common(p)} />,
  "retangulo-arredondado": (p) => <rect x="0.5" y="0.5" width="99" height="99" rx="18" ry="18" {...common(p)} />,
  circulo: (p) => <circle cx="50" cy="50" r="49" {...common(p)} />,
  elipse: (p) => <ellipse cx="50" cy="50" rx="49" ry="49" {...common(p)} />,
  triangulo: (p) => <polygon points="50,1 99,99 1,99" {...common(p)} />,
};

const dashFor = (s: MarkerSymbology["borderStyle"]) =>
  s === "dashed" ? "4 2" : s === "dotted" ? "1 2" : undefined;

export function MarkerGlyph({ symbology, text }: { symbology: MarkerSymbology; text: string }) {
  if (!text) return null;
  const s = symbology;
  const invalid = validateSymbology(s).length > 0;
  const textStyle: CSSProperties = {
    position: "relative",
    color: s.textColor,
    fontSize: s.fontSizePt ? `${s.fontSizePt}pt` : undefined,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
  };
  // Configuração inválida não é corrigida em silêncio: mostra só a sigla e sinaliza.
  if (invalid || s.shape === "nenhuma")
    return (
      <span className="cd-marcador-texto" data-symbology-invalid={invalid || undefined} style={invalid ? undefined : textStyle}>
        {text}
      </span>
    );
  const render = SHAPE_RENDERERS[s.shape];
  const size = s.sizeEm ? `${s.sizeEm}em` : undefined;
  // Triângulo precisa de espaço vertical extra para a sigla ficar dentro da forma.
  const pad = s.paddingPx ?? 0;
  const padding = s.shape === "triangulo" ? `${pad + 3}px ${pad + 4}px ${pad}px` : `0 ${pad}px`;
  return (
    <span
      className="cd-marcador"
      data-shape={s.shape}
      style={{ minWidth: size, minHeight: size, padding }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="cd-marcador-forma">
        {render({
          fill: s.fillColor ?? "transparent",
          stroke: s.borderColor ?? "transparent",
          strokeWidth: s.borderWidthPx ?? 0,
          dash: dashFor(s.borderStyle),
        })}
      </svg>
      <span style={textStyle}>{text}</span>
    </span>
  );
}

/** Marcador de um tipo de dia a partir da simbologia configurada. */
export function DayMark({
  code,
  text,
  symbology,
}: {
  code?: DayTypeCode | null | undefined;
  text: string;
  symbology?: MarkerSymbology | undefined;
}) {
  return <MarkerGlyph symbology={symbology ?? symbologyFor(code)} text={text} />;
}
