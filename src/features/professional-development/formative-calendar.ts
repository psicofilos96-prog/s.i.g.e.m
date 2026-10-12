/**
 * SIGEM Desenvolvimento L09 — calendário formativo (projeção pura; banco = 0437).
 * Encontro = versões append-only; alteração e cancelamento são versões novas com motivo.
 * Calendário letivo e grade escolar são só LIDOS para sinalizar choques; nada aqui grava neles.
 */
export type MeetingVersion = Readonly<{ meetingId: string; classId: string; version: number; status: "agendado" | "cancelado";
  on: string; starts: string; ends: string; location: string; trainerEngagements: readonly string[]; reason: string | null }>;
/** Dia lido do calendário escolar homologado aplicável; ausente = não lido. */
export type SchoolDay = Readonly<{ on: string; schoolDay: boolean; label: string }>;
/** Bloco da grade oficial de um participante (class_schedule_at) ou turno de jornada registrado. */
export type CommitmentBlock = Readonly<{ personId: string; weekday: number; starts: string; ends: string; source: "grade" | "jornada" }>;

export type Finding = Readonly<{ meetingId: string; kind: "dia-letivo" | "calendario-nao-lido" | "choque-com-grade" | "formador-em-dois-encontros" | "jornada"; detail: string }>;

/** Versão vigente por encontro; cadeia com lacuna fica ambígua e não aparece. */
export function currentMeetings(versions: readonly MeetingVersion[]) {
  const by = new Map<string, MeetingVersion[]>();
  for (const v of versions) by.set(v.meetingId, [...(by.get(v.meetingId) ?? []), v]);
  const current: MeetingVersion[] = []; const ambiguous: string[] = [];
  for (const [id, vs] of by) {
    const s = [...vs].sort((a, b) => a.version - b.version);
    if (s.some((v, i) => v.version !== i + 1)) { ambiguous.push(id); continue; }
    current.push(s[s.length - 1]!);
  }
  return { current: current.sort((a, b) => (a.on + a.starts).localeCompare(b.on + b.starts)), ambiguous };
}

const overlap = (a1: string, a2: string, b1: string, b2: string) => a1 < b2 && b1 < a2;
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Sinaliza choques; nunca move encontro nem altera calendário/grade. Participante sem grade lida não prova ausência de choque. */
export function calendarFindings(meetings: readonly MeetingVersion[], days: readonly SchoolDay[] | null,
  participants: ReadonlyMap<string, readonly string[]>, commitments: readonly CommitmentBlock[]): Finding[] {
  const out: Finding[] = [];
  const active = meetings.filter((m) => m.status === "agendado");
  const dayMap = new Map((days ?? []).map((d) => [d.on, d]));
  for (const m of active) {
    const d = dayMap.get(m.on);
    if (days == null || !d) out.push({ meetingId: m.meetingId, kind: "calendario-nao-lido", detail: `Calendário escolar não lido para ${m.on}.` });
    else if (d.schoolDay) out.push({ meetingId: m.meetingId, kind: "dia-letivo", detail: `${m.on} é dia letivo (${d.label}).` });
    for (const person of participants.get(m.classId) ?? []) {
      for (const c of commitments) if (c.personId === person && c.weekday === weekday(m.on) && overlap(m.starts, m.ends, c.starts, c.ends))
        out.push({ meetingId: m.meetingId, kind: c.source === "grade" ? "choque-com-grade" : "jornada", detail: `Participante com ${c.source} ${c.starts}–${c.ends}.` });
    }
  }
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i]!, b = active[j]!;
    if (a.on === b.on && overlap(a.starts, a.ends, b.starts, b.ends)) {
      const shared = a.trainerEngagements.filter((t) => b.trainerEngagements.includes(t));
      if (shared.length) out.push({ meetingId: b.meetingId, kind: "formador-em-dois-encontros", detail: `Formador também no encontro ${a.meetingId}.` });
    }
  }
  return out;
}

/** Aviso nasce no banco (outbox); sem regra de entrega configurada fica pendente, nunca "enviado". */
export function noticeState(hasDeliveryRule: boolean, dispatched: boolean): "pendente-sem-regra" | "aguardando-envio" | "entregue-a-camada" {
  return !hasDeliveryRule ? "pendente-sem-regra" : dispatched ? "entregue-a-camada" : "aguardando-envio";
}

export function meetingProblems(m: { on: string; starts: string; ends: string; location: string; trainers: number; version: number; reason: string },
  period: { startsOn: string; endsOn: string }): string[] {
  const p: string[] = [];
  if (m.on < period.startsOn || m.on > period.endsOn) p.push("Encontro fora do período da turma.");
  if (m.ends <= m.starts) p.push("Horário final deve ser depois do inicial.");
  if (m.location.trim().length < 3) p.push("Informe o local.");
  if (m.trainers < 1) p.push("Informe ao menos um formador.");
  if (m.version >= 1 && m.reason.trim().length < 10) p.push("Alteração exige motivo (10+ caracteres).");
  return p;
}
