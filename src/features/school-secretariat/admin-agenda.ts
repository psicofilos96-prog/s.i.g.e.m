// SIGEM 2.0 — Lote complementar 07: agenda administrativa da Secretaria (núcleo puro).
// Só LÊ o calendário oficial (dias já resolvidos); nunca o altera. Prazo só com origem (ato normativo ou configuração autorizada).
// Tarefas reaproveitam `/tarefas` (responsável = atuação) e notificações `emit_notification_event`.

export type WindowKind = "matricula" | "rematricula" | "conferencia-documental" | "censo" | "relatorio" | "conselho" | "historicos" | "periodica";
export interface Deadline {
  id: string; kind: WindowKind; year: number; scope: { level: "rede" | "setor" | "escola"; id: string | null };
  from: string | null; to: string | null;
  origin: { type: "ato-normativo" | "configuracao-autorizada"; ref: string; authorizedBy: string } | null;
  responsibleEngagementId: string | null; escalation: { afterDays: number; toEngagementId: string } | null;
}

/** Prazo sem origem ou sem datas não entra na agenda (aparece como pendência de configuração). */
export function validDeadline(d: Deadline): { ok: true } | { ok: false; code: string } {
  if (!d.origin?.ref || !d.origin.authorizedBy) return { ok: false, code: "agenda:origin-required" };
  if (!d.from || !d.to) return { ok: false, code: "agenda:dates-not-declared" };
  if (d.from > d.to) return { ok: false, code: "agenda:range-invalid" };
  if (Number(d.from.slice(0, 4)) !== d.year && Number(d.to.slice(0, 4)) !== d.year) return { ok: false, code: "agenda:outside-year" };
  return { ok: true };
}

/** Visão: escola vê rede + setor da escola + a própria; setor vê rede + setor; rede vê tudo. Ano sempre explícito. */
export function agendaFor(all: Deadline[], viewer: { level: "rede" | "setor" | "escola"; schoolId?: string; sectorId?: string }, year: number) {
  const visible = all.filter((d) => d.year === year && validDeadline(d).ok && (
    viewer.level === "rede" || d.scope.level === "rede" ||
    (d.scope.level === "setor" && d.scope.id === viewer.sectorId) ||
    (viewer.level === "escola" && d.scope.level === "escola" && d.scope.id === viewer.schoolId)));
  const unconfigured = all.filter((d) => d.year === year && !validDeadline(d).ok).map((d) => ({ id: d.id, code: (validDeadline(d) as { code: string }).code }));
  return { visible: visible.sort((a, b) => a.from!.localeCompare(b.from!)), unconfigured };
}

/** Calendário: só informa se a janela cai em dia não letivo; nunca desloca a data oficial. */
export function calendarNote(d: Deadline, dayKind: (date: string) => "letivo" | "nao-letivo" | null) {
  const k = dayKind(d.to!);
  return k == null ? "calendário não resolvido para o último dia" : k === "nao-letivo" ? "último dia cai em dia não letivo (data mantida)" : null;
}

/** Alerta/escalonamento: só com responsável e regra declarados; sem eles ⇒ null. */
export function alertState(d: Deadline, today: string, done: boolean) {
  if (done || !d.to) return null;
  if (!d.responsibleEngagementId) return { level: "sem-responsavel" as const };
  if (today <= d.to) return { level: today >= d.from! ? "aberto" as const : "futuro" as const };
  if (!d.escalation) return { level: "vencido" as const };
  const late = Math.floor((Date.parse(today) - Date.parse(d.to)) / 86400000);
  return late >= d.escalation.afterDays ? { level: "escalonado" as const, to: d.escalation.toEngagementId } : { level: "vencido" as const };
}

/** Mudança de ano: prazos do ano anterior nunca são copiados; só sugeridos como referência sem datas. */
export function nextYearReference(prev: Deadline[], nextYear: number): Deadline[] {
  return prev.map((d) => ({ ...d, id: `${d.id}@ref${nextYear}`, year: nextYear, from: null, to: null, origin: null }));
}
