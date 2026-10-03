/**
 * Instantes PostgreSQL (timestamptz) estritos, com precisão de microssegundos.
 * Compartilhado por fontes institucionais (calendário B4.6, horário B4.5) sem que uma feature importe outra.
 */
const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|([+-])(\d{2})(?::?(\d{2}))?)$/;

const daysIn = (y: number, m: number) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;

/**
 * Instante ISO/PostgreSQL estrito → microssegundos UTC desde a época (BigInt), ou null se inválido.
 * Aceita "T" ou espaço, frações de 1 a 6 dígitos e offset Z/±hh/±hhmm/±hh:mm. Componentes são
 * validados ANTES de normalizar (2026-02-30 é rejeitado). 24:00:00 só vale com minutos, segundos e fração zero.
 */
export function instantMicros(v: unknown): bigint | null {
  if (typeof v !== "string") return null;
  const m = INSTANT_RE.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number) as [number, number, number, number, number];
  const s = m[6] === undefined ? 0 : Number(m[6]);
  const frac = m[7] ?? "";
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null;
  if (mi > 59 || s > 59) return null;
  if (h > 24 || (h === 24 && (mi !== 0 || s !== 0 || /[1-9]/.test(frac)))) return null;
  let offMin = 0;
  if (m[8] !== "Z") {
    const oh = Number(m[10]);
    const om = m[11] === undefined ? 0 : Number(m[11]);
    if (oh > 15 || om > 59) return null;
    offMin = (m[9] === "-" ? -1 : 1) * (oh * 60 + om);
  }
  const base = new Date(0);
  base.setUTCFullYear(y, mo - 1, d);
  base.setUTCHours(0, 0, 0, 0);
  const dayMs = BigInt(base.getTime());
  const micros = BigInt(frac.padEnd(6, "0") || "0");
  return dayMs * 1000n + BigInt(((h * 60 + mi) * 60 + s) - offMin * 60) * 1_000_000n + micros;
}

/** Instante válido com fuso explícito (componentes conferidos; precisão até microssegundos). */
export function isKnownAt(v: unknown): v is string {
  return instantMicros(v) !== null;
}


/** Mesmo instante UTC com precisão de microssegundos; qualquer lado inválido ⇒ false. */
export function sameInstant(a: unknown, b: unknown): boolean {
  const x = instantMicros(a); const y = instantMicros(b);
  return x !== null && y !== null && x === y;
}
