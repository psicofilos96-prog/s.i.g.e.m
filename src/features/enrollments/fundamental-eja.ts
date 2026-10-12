/**
 * Rede — L18 Ensino Fundamental (anual) e EJA (semestral).
 * Regime de período (anual/semestral) é declaração da OFERTA, nunca inferido de nome de etapa/fase.
 * Janelas de período vêm só do calendário aplicável já resolvido (períodos declarados); sem calendário
 * ou com número de períodos incompatível com o regime ⇒ bloqueado. Turma, vaga, matriz e alocação valem
 * dentro da janela do período. Passar de fase/ano NUNCA é automático: exige situação oficial registrada.
 */
export type Regime = "anual" | "semestral";
export interface OfferRegime { offerId: string; regime: Regime | null; positionKeys: readonly string[] } // etapas/fases abertas
export interface CalendarPeriod { periodId: string; from: string; to: string }
export interface ResolvedCalendar { calendarId: string; periods: readonly CalendarPeriod[] }

export type Windows = { ok: true; windows: readonly CalendarPeriod[] } | { ok: false; reason: string };
export function periodWindows(o: OfferRegime, cal: ResolvedCalendar | null): Windows {
  if (o.regime === null) return { ok: false, reason: "Regime de período não declarado na oferta." };
  if (!cal) return { ok: false, reason: "Calendário aplicável não resolvido." };
  const expected = o.regime === "anual" ? 1 : 2;
  const ps = [...cal.periods].sort((a, b) => a.from.localeCompare(b.from));
  if (ps.length !== expected) return { ok: false, reason: `Regime ${o.regime} exige ${expected} período(s) letivo(s); calendário declara ${ps.length}.` };
  for (let i = 1; i < ps.length; i++) if (ps[i]!.from <= ps[i - 1]!.to) return { ok: false, reason: "Períodos do calendário se sobrepõem." };
  return { ok: true, windows: ps };
}

export interface MatrixRef { matrixVersionId: string; positionKey: string; homologated: boolean; validFrom: string; validTo: string | null }
export interface ClassInPeriod { classId: string; offerId: string; periodId: string; positionKeys: readonly string[]; shift: string | null }

/** Turma só é válida no período se posições pertencem à oferta, turno declarado e matriz homologada cobre a janela. */
export function validateClassPeriod(c: ClassInPeriod, o: OfferRegime, w: Windows, matrices: readonly MatrixRef[]) {
  const r: string[] = [];
  if (!w.ok) return { ok: false as const, reasons: [w.reason] };
  const win = w.windows.find((p) => p.periodId === c.periodId);
  if (!win) r.push("Período da turma não pertence ao calendário aplicável.");
  if (c.offerId !== o.offerId) r.push("Turma de outra oferta.");
  if (c.shift === null) r.push("Turno não declarado.");
  for (const k of c.positionKeys) {
    if (!o.positionKeys.includes(k)) r.push(`Posição ${k} fora da oferta.`);
    if (win) {
      const m = matrices.filter((x) => x.positionKey === k && x.homologated && x.validFrom <= win.from && (x.validTo === null || win.to <= x.validTo));
      if (m.length === 0) r.push(`Sem matriz homologada cobrindo o período para ${k}.`);
      if (m.length > 1) r.push(`Matriz ambígua para ${k}.`);
    }
  }
  return r.length ? { ok: false as const, reasons: r } : { ok: true as const, window: win! };
}

/** Alocação/vaga/movimentação precisa caber na janela do período da turma. */
export function withinWindow(win: CalendarPeriod, from: string, to: string | null) {
  return from >= win.from && from <= win.to && (to === null ? false : to <= win.to);
}

/** Continuidade entre semestres/anos: só com situação oficial registrada e posição de destino declarada por ela. */
export function nextPosition(standing: { recorded: boolean; outcomePositionKey: string | null } | null) {
  if (!standing || !standing.recorded) return { ok: false as const, reason: "Situação oficial do período não registrada: sem progressão automática." };
  if (!standing.outcomePositionKey) return { ok: false as const, reason: "Situação registrada não declara posição de destino." };
  return { ok: true as const, positionKey: standing.outcomePositionKey };
}

/** Célula de vaga semestral: chave inclui o período, para não somar 1º e 2º semestres. */
export const vacancyCellKey = (schoolId: string, offerId: string, periodId: string, positionKey: string, shift: string) => `${schoolId}|${offerId}|${periodId}|${positionKey}|${shift}`;
