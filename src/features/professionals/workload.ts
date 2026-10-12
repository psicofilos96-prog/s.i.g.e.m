/**
 * Gestão de Pessoas L06 — Jornadas e cargas com validação dimensional.
 * Unidades: "hora-relogio" (60 min) e "hora-aula" (duração depende de etapa/modalidade
 * e só existe por regra configurada e homologada). Nunca se soma unidades diferentes
 * sem conversão declarada; regra ausente ⇒ resultado null com motivo, nunca zero.
 */

export type Unit = "hora-relogio" | "hora-aula";
export type Qty = Readonly<{ value: number; unit: Unit; context: string | null }>; // context = etapa/modalidade da hora-aula

export type Category = "contratual" | "exercicio" | "regencia" | "extraclasse" | "designacao" | "atribuida";

export type DurationRule = Readonly<{ id: string; context: string; minutesPerClassHour: number; validFrom: string; validUntil: string | null; homologated: boolean }>;

/** Regra municipal parametrizada (ex.: fração mínima de extraclasse). Sem homologação ⇒ não aplicada. */
export type MunicipalRule = Readonly<{ id: string; kind: "extraclasse-minimo"; fraction: number; validFrom: string; validUntil: string | null; homologated: boolean }>;

export type DimError = "unidade-incompativel" | "sem-regra-de-duracao" | "regra-ambigua" | "contexto-ausente" | "valor-invalido";
export type R<T> = { ok: true; value: T } | { ok: false; error: DimError };

const active = (r: { validFrom: string; validUntil: string | null; homologated: boolean }, d: string) =>
  r.homologated && r.validFrom <= d && (r.validUntil === null || r.validUntil >= d);

export function qty(value: number, unit: Unit, context: string | null = null): R<Qty> {
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "valor-invalido" };
  if (unit === "hora-aula" && !context) return { ok: false, error: "contexto-ausente" };
  return { ok: true, value: { value, unit, context: unit === "hora-aula" ? context : null } };
}

export function durationFor(context: string, day: string, rules: readonly DurationRule[]): R<number> {
  const rs = rules.filter((r) => r.context === context && active(r, day));
  if (rs.length === 0) return { ok: false, error: "sem-regra-de-duracao" };
  if (rs.length > 1) return { ok: false, error: "regra-ambigua" };
  return { ok: true, value: rs[0]!.minutesPerClassHour };
}

/** Converte para minutos (base dimensional comum); hora-aula só com regra. */
export function toMinutes(q: Qty, day: string, rules: readonly DurationRule[]): R<number> {
  if (q.unit === "hora-relogio") return { ok: true, value: q.value * 60 };
  const d = durationFor(q.context!, day, rules);
  return d.ok ? { ok: true, value: q.value * d.value } : d;
}

/** Soma só mesma unidade E mesmo contexto; para misturar, converta explicitamente. */
export function addSame(a: Qty, b: Qty): R<Qty> {
  if (a.unit !== b.unit || a.context !== b.context) return { ok: false, error: "unidade-incompativel" };
  return { ok: true, value: { ...a, value: a.value + b.value } };
}

export function sumMinutes(qs: readonly Qty[], day: string, rules: readonly DurationRule[]): R<number> {
  let total = 0;
  for (const q of qs) { const m = toMinutes(q, day, rules); if (!m.ok) return m; total += m.value; }
  return { ok: true, value: total };
}

export type Workload = Readonly<Partial<Record<Category, readonly Qty[]>>>;

export type Balance = Readonly<{
  minutes: Readonly<Record<Category, number | null>>;
  disponivel: number | null; // contratual − atribuída − designação, em minutos
  extraclasseMinimo: number | null;
  extraclasseAtendido: boolean | null;
  pendencias: readonly string[];
}>;

/** Cada categoria fica separada; ausente = null. Disponível só com contratual e atribuída conhecidas. */
export function balance(w: Workload, day: string, rules: readonly DurationRule[], municipal: readonly MunicipalRule[]): Balance {
  const cats: Category[] = ["contratual", "exercicio", "regencia", "extraclasse", "designacao", "atribuida"];
  const pend: string[] = [];
  const minutes = {} as Record<Category, number | null>;
  for (const c of cats) {
    const qs = w[c];
    if (!qs) { minutes[c] = null; continue; }
    const s = sumMinutes(qs, day, rules);
    if (s.ok) minutes[c] = s.value; else { minutes[c] = null; pend.push(`${c}: ${s.error}`); }
  }
  const disponivel = minutes.contratual !== null && minutes.atribuida !== null
    ? minutes.contratual - minutes.atribuida - (minutes.designacao ?? 0) : null;
  if (disponivel !== null && disponivel < 0) pend.push("atribuição excede a jornada contratual");
  const mr = municipal.filter((r) => r.kind === "extraclasse-minimo" && active(r, day));
  let extraclasseMinimo: number | null = null;
  if (mr.length > 1) pend.push("regra de extraclasse ambígua");
  else if (mr.length === 1 && minutes.contratual !== null) extraclasseMinimo = minutes.contratual * mr[0]!.fraction;
  else if (mr.length === 0) pend.push("sem regra municipal homologada de extraclasse");
  const extraclasseAtendido = extraclasseMinimo !== null && minutes.extraclasse !== null ? minutes.extraclasse >= extraclasseMinimo : null;
  return { minutes, disponivel, extraclasseMinimo, extraclasseAtendido, pendencias: pend };
}
