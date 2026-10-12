/**
 * Rede/Matrículas/Vagas L05 — Quadro de vagas.
 * Célula = escola × oferta × eixos (etapa/fase/turno) × período. Vagas autorizadas são
 * ledger append-only com ato e pessoa responsável (planejar → autorizar; retificar/revogar).
 * disponível = autorizadas − ocupação válida − reservas ativas, na data de referência.
 * Sem dupla contagem: estudante conta uma vez por célula; reserva convertida em ocupação
 * do mesmo estudante não conta de novo. Qualquer parcela não lida ⇒ disponível null.
 */
export interface VacancyCell { schoolId: string; offerId: string; axes: Readonly<Record<string, string>>; periodFrom: string; periodTo: string | null }
export const cellKey = (c: VacancyCell) => `${c.schoolId}|${c.offerId}|${Object.entries(c.axes).sort().map(([k, v]) => `${k}=${v}`).join(",")}|${c.periodFrom}`;

export interface VacancyEvent { cellKey: string; seq: number; kind: "planejar" | "autorizar" | "retificar" | "revogar"; quantity: number | null; actRef: string | null; personId: string; reason: string; at: string; validFrom: string; validTo: string | null }
export interface Occupancy { studentId: string; cellKey: string; allocationId: string; from: string; to: string | null }
export interface Reservation { reservationId: string; studentRef: string; cellKey: string; createdAt: string; expiresOn: string; status: "ativa" | "convertida" | "cancelada" | "expirada" }
export interface VActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[]; schoolIds: readonly string[] | "rede" }
export type VacancyCompetence = Partial<Record<VacancyEvent["kind"], string>>;

const inRange = (on: string, f: string, t: string | null) => f <= on && (t === null || on <= t);

export type VResult = { ok: true; event: VacancyEvent } | { ok: false; reason: string };
export function recordVacancyEvent(
  cell: VacancyCell, chain: readonly VacancyEvent[], kind: VacancyEvent["kind"], actor: VActor,
  input: { quantity: number | null; actRef?: string | null | undefined; reason: string; at: string; validFrom: string; validTo: string | null; expectedSeq: number; authorizedCapacityCeiling: number | null },
  comp: VacancyCompetence,
): VResult {
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) return { ok: false, reason: "Exige pessoa natural; executor técnico não autoriza vagas." };
  const cap = comp[kind];
  if (!cap) return { ok: false, reason: `Competência para "${kind}" não configurada.` };
  if (!actor.capabilities.includes(cap)) return { ok: false, reason: `Falta a capacidade ${cap}.` };
  if (actor.schoolIds !== "rede" && !actor.schoolIds.includes(cell.schoolId)) return { ok: false, reason: "Fora do escopo da escola." };
  const key = cellKey(cell);
  const mine = chain.filter((e) => e.cellKey === key);
  const last = mine.at(-1);
  if ((last?.seq ?? 0) !== input.expectedSeq) return { ok: false, reason: "Base desatualizada." };
  const s = last?.kind ?? null;
  const allowed: Record<VacancyEvent["kind"], (string | null)[]> = { planejar: [null, "planejar", "revogar"], autorizar: ["planejar"], retificar: ["autorizar", "retificar"], revogar: ["autorizar", "retificar"] };
  if (!allowed[kind].includes(s)) return { ok: false, reason: `"${kind}" não admitido após ${s ?? "nada"}.` };
  if (!input.reason.trim()) return { ok: false, reason: "Motivo obrigatório." };
  if (kind !== "planejar" && !input.actRef?.trim()) return { ok: false, reason: "Exige ato." };
  if (input.validTo && input.validTo < input.validFrom) return { ok: false, reason: "Vigência inválida." };
  const validTo = input.validTo ?? cell.periodTo;
  if (input.validFrom < cell.periodFrom || (cell.periodTo && (validTo ?? "9999") > cell.periodTo)) return { ok: false, reason: "Vigência fora do período da oferta." };
  if (kind !== "revogar") {
    if (input.quantity === null || !Number.isInteger(input.quantity) || input.quantity < 0) return { ok: false, reason: "Quantidade inválida." };
    if (kind !== "planejar") {
      if (input.authorizedCapacityCeiling === null) return { ok: false, reason: "Capacidade autorizada (L03) não lida." };
      if (input.quantity > input.authorizedCapacityCeiling) return { ok: false, reason: "Vagas excedem a capacidade autorizada." };
    }
  }
  if (kind === "autorizar" && mine.some((e) => e.kind === "planejar" && e.personId === actor.personId)) return { ok: false, reason: "Quem planejou não autoriza." };
  return { ok: true, event: { cellKey: key, seq: (last?.seq ?? 0) + 1, kind, quantity: kind === "revogar" ? null : input.quantity, actRef: input.actRef?.trim() || null, personId: actor.personId, reason: input.reason.trim(), at: input.at, validFrom: input.validFrom, validTo } };
}

/** Autorizadas vigentes na data de referência, conhecidas até `knownAt`. Planejada não conta. */
export function authorizedVacancies(chain: readonly VacancyEvent[], key: string, on: string, knownAt: string): { value: number | null; reason?: string; ref?: string } {
  const last = chain.filter((e) => e.cellKey === key && e.at <= knownAt).sort((a, b) => a.seq - b.seq).at(-1);
  if (!last || last.kind === "planejar") return { value: null, reason: "Sem vagas autorizadas." };
  if (last.kind === "revogar") return { value: null, reason: "Autorização revogada." };
  if (!inRange(on, last.validFrom, last.validTo)) return { value: null, reason: "Autorização fora da vigência na data." };
  return { value: last.quantity, ref: `${key}#${last.seq}` };
}

export interface BoardLine { cellKey: string; authorized: number | null; occupied: number | null; reserved: number | null; available: number | null; issues: string[] }

export function vacancyLine(
  key: string, on: string, knownAt: string, chain: readonly VacancyEvent[],
  occupancy: readonly Occupancy[] | null, reservations: readonly Reservation[] | null,
): BoardLine {
  const issues: string[] = [];
  const a = authorizedVacancies(chain, key, on, knownAt);
  if (a.reason) issues.push(a.reason);
  let occupied: number | null = null; let occStudents = new Set<string>();
  if (occupancy === null) issues.push("Ocupação não lida.");
  else {
    const valid = occupancy.filter((o) => o.cellKey === key && inRange(on, o.from, o.to));
    occStudents = new Set(valid.map((o) => o.studentId));
    if (occStudents.size < valid.length) issues.push(`${valid.length - occStudents.size} enturmação(ões) duplicada(s) do mesmo estudante contada(s) uma vez.`);
    occupied = occStudents.size;
  }
  let reserved: number | null = null;
  if (reservations === null) issues.push("Reservas não lidas.");
  else {
    const active = reservations.filter((r) => r.cellKey === key && r.status === "ativa" && r.createdAt <= on && on <= r.expiresOn);
    const notYetOccupying = active.filter((r) => !occStudents.has(r.studentRef));
    if (notYetOccupying.length < active.length) issues.push("Reserva de estudante já enturmado não contada de novo.");
    reserved = new Set(notYetOccupying.map((r) => r.studentRef)).size;
  }
  const available = a.value === null || occupied === null || reserved === null ? null : a.value - occupied - reserved;
  if (available !== null && available < 0) issues.push(`Excedente de ${-available}: ocupação+reservas acima das autorizadas.`);
  return { cellKey: key, authorized: a.value, occupied, reserved, available: available === null ? null : Math.max(0, available), issues };
}

/** Total só fecha se todas as linhas forem determinadas. */
export function boardTotals(lines: readonly BoardLine[]) {
  const sum = (k: "authorized" | "occupied" | "reserved" | "available") => lines.some((l) => l[k] === null) ? null : lines.reduce((s, l) => s + (l[k] as number), 0);
  return { authorized: sum("authorized"), occupied: sum("occupied"), reserved: sum("reserved"), available: sum("available"), indeterminate: lines.filter((l) => l.available === null).length };
}
