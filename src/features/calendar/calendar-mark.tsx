/** Representação única da sigla de um tipo de dia (grade, legenda, editor, impressão). */
import { DAY_TYPES } from "./calendar-catalog";
import type { DayTypeCode } from "./calendar-types";

export function DayMark({ code, text }: { code?: DayTypeCode | null | undefined; text: string }) {
  if (!text) return null;
  return code && DAY_TYPES[code]?.boxed ? <span className="cd-sigla-caixa">{text}</span> : <>{text}</>;
}
