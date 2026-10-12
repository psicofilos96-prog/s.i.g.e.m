/**
 * OP por escola — LOTE 15 (reuniões pedagógicas).
 * Reunião = cadeia append-only por logicalId (agendar → reagendar/cancelar → presença → ata v1..n → encerrar).
 * Presença é registro real por participante (nunca presumida pelo convite); ata é versionada e encerrada é imutável.
 * Encaminhamentos viram tarefas na Central de tarefas existente (sourceKind "op-reuniao", dedupeKey estável);
 * a agenda operacional já lista prazos de tarefas, então nenhuma agenda paralela é criada.
 */
import { decideOpAccess, type OpDesignation } from "./op-designations";
import { dedupeKey } from "../tasks/task-model";

export const MEETING_KINDS = ["reuniao-pedagogica", "planejamento-coletivo", "acompanhamento", "intervencao", "equipe-especializada", "formacao"] as const;
export type MeetingKind = (typeof MEETING_KINDS)[number];
export type Presence = "presente" | "ausente" | "justificada";
export interface Referral { id: string; text: string; responsibleEngagementId: string | null; dueOn: string | null }
export interface Minute { version: number; agendaCovered: string[]; decisions: string[]; referrals: Referral[]; closed: boolean }

export type MeetingEvent = { id: string; logicalId: string; seq: number; actorPersonId: string; idempotencyKey: string; reason: string | null } & (
  | { kind: "agendar"; schoolId: string; meetingKind: MeetingKind; date: string; agenda: string[]; participantEngagementIds: string[] }
  | { kind: "reagendar"; date: string }
  | { kind: "cancelar" }
  | { kind: "presenca"; engagementId: string; presence: Presence }
  | { kind: "ata"; minute: Minute }
);

export interface MeetingView {
  logicalId: string; schoolId: string; meetingKind: MeetingKind; date: string; agenda: string[]; participants: string[];
  presence: Record<string, Presence | "nao-registrada">; minute: Minute | null; minuteHistory: Minute[];
  situation: "agendada" | "cancelada" | "realizada-sem-ata" | "ata-em-elaboracao" | "ata-encerrada"; authorPersonId: string;
}

const SENSITIVE = /(cid[\s-]?\d|laudo|diagn[óo]stic|advert[êe]ncia|san[çc][ãa]o|avalia[çc][ãa]o funcional|reten[çc][ãa]o|reprova)/i;

/** Projeção: cadeia inválida é recusada inteira; presença só de participante convidado e só a partir da data. */
export function projectMeetings(events: MeetingEvent[]): { list: MeetingView[]; rejected: string[] } {
  const by = new Map<string, MeetingEvent[]>();
  for (const e of events) by.set(e.logicalId, [...(by.get(e.logicalId) ?? []), e]);
  const list: MeetingView[] = []; const rejected: string[] = [];
  for (const [lid, ch] of by) {
    const s = [...ch].sort((a, b) => a.seq - b.seq);
    const head = s[0]!;
    if (!s.every((e, i) => e.seq === i + 1) || head.kind !== "agendar") { rejected.push(lid); continue; }
    const v: MeetingView = { logicalId: lid, schoolId: head.schoolId, meetingKind: head.meetingKind, date: head.date, agenda: head.agenda,
      participants: head.participantEngagementIds, presence: Object.fromEntries(head.participantEngagementIds.map((p) => [p, "nao-registrada" as const])),
      minute: null, minuteHistory: [], situation: "agendada", authorPersonId: head.actorPersonId };
    let ok = true;
    for (const e of s.slice(1)) {
      if (v.situation === "cancelada" || v.minute?.closed) { ok = false; break; }
      if (e.kind === "reagendar") { if (!e.reason?.trim() || v.minute) { ok = false; break; } v.date = e.date; }
      else if (e.kind === "cancelar") { if (!e.reason?.trim() || v.minute) { ok = false; break; } v.situation = "cancelada"; }
      else if (e.kind === "presenca") { if (!(e.engagementId in v.presence)) { ok = false; break; } v.presence[e.engagementId] = e.presence; }
      else if (e.kind === "ata") {
        if (e.minute.version !== (v.minute?.version ?? 0) + 1 || (v.minute && !e.reason?.trim())) { ok = false; break; }
        v.minute = e.minute; v.minuteHistory.push(e.minute);
      } else { ok = false; break; }
    }
    if (!ok) { rejected.push(lid); continue; }
    if (v.situation !== "cancelada") {
      const anyPresence = Object.values(v.presence).some((p) => p !== "nao-registrada");
      v.situation = v.minute ? (v.minute.closed ? "ata-encerrada" : "ata-em-elaboracao") : anyPresence ? "realizada-sem-ata" : "agendada";
    }
    list.push(v);
  }
  return { list, rejected };
}

export interface MeetingCommand {
  personNatural: boolean; personId: string; today: string; event: MeetingEvent; expectedSeq: number;
  designations: OpDesignation[]; capabilities: { id: string; scope: "escola" | "rede"; schoolId: string | null }[];
  activeEngagementsAtSchool: ReadonlySet<string>; existing: MeetingEvent[];
}
export type CommandResult = { ok: true; replay: boolean; event: MeetingEvent } | { ok: false; reasons: string[] };

/** Executor estreito: idempotente, base esperada, competência da unidade; fail-closed. */
export function recordMeetingEvent(c: MeetingCommand): CommandResult {
  const replay = c.existing.find((e) => e.idempotencyKey === c.event.idempotencyKey);
  if (replay) return replay.logicalId === c.event.logicalId && replay.kind === c.event.kind ? { ok: true, replay: true, event: replay } : { ok: false, reasons: ["Chave idempotente reutilizada em outro ato."] };
  const r: string[] = [];
  const e = c.event;
  const chain = c.existing.filter((x) => x.logicalId === e.logicalId);
  if (chain.length !== c.expectedSeq || e.seq !== c.expectedSeq + 1) r.push("Base esperada divergente: outro ato foi registrado.");
  if (e.actorPersonId !== c.personId) r.push("Ato só em nome de quem o pratica.");
  const current = projectMeetings(chain).list[0];
  const schoolId = e.kind === "agendar" ? e.schoolId : current?.schoolId;
  if (!schoolId) r.push("Reunião inexistente.");
  else {
    const a = decideOpAccess({ personNatural: c.personNatural, personId: c.personId, date: c.today, schoolId, classId: null, granularity: "agregado", action: "registrar", purpose: e.kind === "agendar" && e.meetingKind === "formacao" ? "formacao" : "acompanhamento", designations: c.designations, capabilities: c.capabilities });
    if (!a.ok) r.push(a.reason);
  }
  if (e.kind === "agendar") {
    if (!(MEETING_KINDS as readonly string[]).includes(e.meetingKind)) r.push("Tipo de reunião fora do catálogo.");
    if (e.agenda.filter((x) => x.trim()).length === 0) r.push("Pauta obrigatória.");
    if (e.participantEngagementIds.length === 0) r.push("Ao menos um participante.");
    if (e.participantEngagementIds.some((p) => !c.activeEngagementsAtSchool.has(p))) r.push("Participante sem atuação vigente na escola.");
    if (e.agenda.some((x) => SENSITIVE.test(x))) r.push("Pauta não registra dado clínico nem ato funcional/disciplinar ou de trajetória.");
  } else if (current && current.authorPersonId !== c.personId && e.kind !== "presenca") r.push("Só quem agendou altera a reunião ou a ata.");
  if (e.kind === "presenca" && current && c.today < current.date) r.push("Presença só no dia da reunião ou depois.");
  if (e.kind === "ata") {
    if (current && c.today < current.date) r.push("Ata só após a reunião.");
    const m = e.minute;
    if ([...m.decisions, ...m.referrals.map((x) => x.text)].some((t) => SENSITIVE.test(t))) r.push("Ata não registra dado clínico nem ato funcional/disciplinar ou de trajetória.");
    if (m.agendaCovered.some((x) => current && !current.agenda.includes(x))) r.push("Item tratado fora da pauta.");
    for (const f of m.referrals) {
      if (!f.text.trim()) r.push("Encaminhamento sem descrição.");
      if (f.responsibleEngagementId && !c.activeEngagementsAtSchool.has(f.responsibleEngagementId)) r.push("Responsável sem atuação vigente.");
      if (m.closed && !f.responsibleEngagementId) r.push(`Encaminhamento "${f.text}" sem responsável impede encerrar a ata.`);
    }
    if (m.closed && current && Object.values(current.presence).every((p) => p === "nao-registrada")) r.push("Encerrar a ata exige presença registrada.");
  }
  if (!r.length) { const p = projectMeetings([...chain, e]); if (p.rejected.length) r.push("Ato incompatível com o estado da reunião."); }
  return r.length ? { ok: false, reasons: r } : { ok: true, replay: false, event: e };
}

/** Encaminhamentos de ata encerrada → tarefas da Central (prazo só se declarado; dedupe impede duplicata). */
export function referralTasks(m: MeetingView) {
  if (m.situation !== "ata-encerrada" || !m.minute) return [];
  return m.minute.referrals.filter((f) => f.responsibleEngagementId).map((f) => {
    const sourceRef = `${m.logicalId}:${f.id}`;
    return { schoolId: m.schoolId, title: f.text, dueOn: f.dueOn, assigneeEngagement: f.responsibleEngagementId!, sourceKind: "op-reuniao", sourceRef,
      dedupeKey: dedupeKey(m.schoolId, "op-reuniao", sourceRef, f.text, "v1") };
  });
}

/** Frequência à reunião: denominador = presença registrada; não registrada nunca vira ausência. */
export function attendanceSummary(m: MeetingView) {
  const v = Object.values(m.presence);
  const registered = v.filter((p) => p !== "nao-registrada").length;
  return { invited: v.length, registered, present: v.filter((p) => p === "presente").length, notRegistered: v.length - registered };
}

/** Central vê só contagens por tipo com supressão 1–4; participante vê só reuniões a que foi convidado. */
export function meetingsFor(viewer: { kind: "participante"; engagementId: string } | { kind: "orientador"; schoolId: string } | { kind: "central" }, list: MeetingView[]) {
  if (viewer.kind === "participante") return list.filter((m) => m.participants.includes(viewer.engagementId));
  if (viewer.kind === "orientador") return list.filter((m) => m.schoolId === viewer.schoolId);
  const out: Record<string, number | "suprimido"> = {};
  for (const k of MEETING_KINDS) { const n = list.filter((m) => m.meetingKind === k).length; out[k] = n > 0 && n < 5 ? "suprimido" : n; }
  return out;
}
