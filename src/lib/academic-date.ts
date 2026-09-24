/**
 * Data acadêmica canônica (Etapa 12B).
 *
 * Fonte de verdade interna: ISO `aaaa-mm-dd`, independente de fuso e de
 * apresentação. A formatação brasileira pertence apenas à camada de exibição.
 * Rótulos legados ("09 fev 2026") são aceitos somente na entrada, por
 * compatibilidade, e nunca devem ser gravados como fonte primária.
 */
export type IsoDate = string;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Converte ISO, "dd/mm/aaaa" ou rótulo legado "09 fev 2026" em ISO. */
export function parseAcademicDate(value: string | null | undefined): IsoDate | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (isIsoDate(text)) return text;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (br) {
    const iso = `${br[3]}-${br[2]}-${br[1]}`;
    return isIsoDate(iso) ? iso : null;
  }
  const label = /^(\d{1,2}) ([a-zç]{3})[a-zç]* (\d{4})$/.exec(text);
  if (label) {
    const month = MONTHS.indexOf(label[2]!);
    if (month < 0) return null;
    const iso = `${label[3]}-${String(month + 1).padStart(2, "0")}-${label[1]!.padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : null;
  }
  return null;
}

/** Exibição institucional curta: "09 fev 2026". */
export function formatAcademicDate(value: IsoDate | null | undefined, fallback = ""): string {
  if (!value) return fallback;
  const match = ISO.exec(value);
  if (!match) return value;
  return `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Exibição numérica: "09/02/2026". */
export function formatAcademicDateNumeric(value: IsoDate | null | undefined): string {
  const match = value ? ISO.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export function compareAcademicDates(a: IsoDate, b: IsoDate) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Diferença inclusiva em dias. */
export function daysBetween(start: IsoDate, end: IsoDate) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 864e5) + 1;
}
