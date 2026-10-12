/**
 * OP por escola — LOTE 17 (formação continuada).
 * Reaproveita o núcleo de formação do DP administrativo (`professionals/continuing-education.ts`):
 * vagas, frequência, elegibilidade de certificado e horas vêm de lá — nenhuma regra paralela.
 * Aqui: oferta versionada por escopo (escola × rede), demandas, inscrição/presença como ledger,
 * avaliação e certificado só por validação autorizada (pessoa natural ≠ autor, capacidade própria).
 * Formação nunca vira titulação oficial nem avaliação funcional.
 */
import { decideOpAccess, type OpDesignation } from "./op-designations";
import { attendancePct, certificateEligibility, seatAllocation, individualHours, type Enrollment } from "../professionals/continuing-education";

export type TrainingScope = "escola" | "rede";
export const MODALITIES = ["presencial", "remota", "hibrida"] as const;
export interface TrainingSession { id: string; date: string; held: boolean }
export interface TrainingOffering {
  logicalId: string; version: number; scope: TrainingScope; ownerSchoolId: string | null;
  theme: string; objectives: string[]; audience: string; schoolIds: string[]; trainerName: string;
  modality: (typeof MODALITIES)[number]; sessions: TrainingSession[];
  hours: number | null; seats: number | null; minAttendancePct: number | null; materials: string[];
  demandIds: string[]; authorPersonId: string; reason: string | null; idempotencyKey: string;
}
export interface TrainingDemand { id: string; schoolId: string; theme: string; raisedByPersonId: string; at: string }

type Cap = { id: string; scope: "escola" | "rede"; schoolId: string | null };
export const NETWORK_TRAINING_CAP = "coordenar-formacao-rede";
export const VALIDATE_TRAINING_CAP = "validar-formacao-continuada";

/** Executor estreito da oferta: idempotente, base esperada, competência por escopo, fail-closed. */
export function recordOffering(i: { personNatural: boolean; personId: string; date: string; offering: TrainingOffering; existing: TrainingOffering[]; designations: OpDesignation[]; capabilities: Cap[]; knownDemandIds: ReadonlySet<string> }):
  { ok: true; replay: boolean; offering: TrainingOffering } | { ok: false; reasons: string[] } {
  const o = i.offering;
  const rep = i.existing.find((x) => x.idempotencyKey === o.idempotencyKey);
  if (rep) return rep.logicalId === o.logicalId ? { ok: true, replay: true, offering: rep } : { ok: false, reasons: ["Chave idempotente reutilizada."] };
  const r: string[] = [];
  if (!i.personNatural) r.push("Executor técnico não planeja formação.");
  if (o.authorPersonId !== i.personId) r.push("Versão só em nome de quem grava.");
  if (o.scope === "escola") {
    if (!o.ownerSchoolId || o.schoolIds.length !== 1 || o.schoolIds[0] !== o.ownerSchoolId) r.push("Formação da escola pertence só à própria escola.");
    else { const a = decideOpAccess({ personNatural: i.personNatural, personId: i.personId, date: i.date, schoolId: o.ownerSchoolId, classId: null, granularity: "agregado", action: "registrar", purpose: "formacao", designations: i.designations, capabilities: i.capabilities }); if (!a.ok) r.push(a.reason); }
  } else {
    if (o.ownerSchoolId !== null || o.schoolIds.length === 0) r.push("Formação da rede não pertence a uma escola e declara escolas participantes.");
    if (!i.designations.some((d) => d.personId === i.personId && d.role === "coordenacao-central-op" && d.from <= i.date && (d.to === null || i.date <= d.to))) r.push("Sem designação vigente da coordenação central.");
    if (!i.capabilities.some((c) => c.id === NETWORK_TRAINING_CAP && c.scope === "rede")) r.push("Capacidade de rede para formação não homologada.");
  }
  const chain = i.existing.filter((x) => x.logicalId === o.logicalId).sort((a, b) => a.version - b.version);
  const head = chain[chain.length - 1];
  if (o.version !== (head?.version ?? 0) + 1) r.push("Base esperada divergente.");
  if (head && (head.scope !== o.scope || head.ownerSchoolId !== o.ownerSchoolId)) r.push("Escopo é imutável.");
  if (head && !o.reason?.trim()) r.push("Nova versão exige motivo.");
  if (head && head.sessions.some((s) => s.held && !o.sessions.some((n) => n.id === s.id && n.held && n.date === s.date))) r.push("Encontro realizado não pode ser removido nem redatado.");
  if (!o.theme.trim() || o.objectives.length === 0 || !o.audience.trim() || !o.trainerName.trim()) r.push("Tema, objetivo, público e formador são obrigatórios.");
  if (!(MODALITIES as readonly string[]).includes(o.modality)) r.push("Modalidade fora do catálogo.");
  if (o.sessions.length === 0) r.push("Ao menos um encontro com data.");
  if (o.sessions.some((s) => s.held && s.date > i.date)) r.push("Encontro futuro não pode constar como realizado.");
  if (o.hours !== null && !(o.hours > 0)) r.push("Carga horária inválida.");
  if (o.demandIds.some((d) => !i.knownDemandIds.has(d))) r.push("Demanda citada inexistente.");
  if (/(avalia[çc][ãa]o funcional|est[áa]gio probat[óo]rio|san[çc][ãa]o|titula[çc][ãa]o|progress[ãa]o)/i.test(`${o.theme} ${o.objectives.join(" ")}`)) r.push("Formação não produz ato funcional nem titulação.");
  return r.length ? { ok: false, reasons: r } : { ok: true, replay: false, offering: o };
}

/** Presença: só em encontro realizado, por quem conduz (autor da oferta), de inscrito confirmado; nunca presumida. */
export interface PresenceMark { offeringId: string; sessionId: string; personId: string; present: boolean; markedBy: string }
export function participation(o: TrainingOffering, enrollments: Enrollment[], marks: PresenceMark[]) {
  const seats = seatAllocation({ id: o.logicalId, seats: o.seats, hours: o.hours, minAttendancePct: o.minAttendancePct }, enrollments);
  if (!seats.ok) return { ok: false as const, reason: "Vagas não configuradas: inscrição não é confirmada." };
  const valid = marks.filter((m) => m.offeringId === o.logicalId && m.markedBy === o.authorPersonId && seats.confirmed.includes(m.personId) && o.sessions.some((s) => s.id === m.sessionId && s.held));
  return { ok: true as const, confirmed: seats.confirmed, waitlist: seats.waitlist, people: seats.confirmed.map((p) => {
    const pct = attendancePct(o.sessions.map((s) => ({ held: s.held, present: valid.find((m) => m.sessionId === s.id && m.personId === p)?.present ?? null })));
    return { personId: p, attendancePct: pct, eligibility: certificateEligibility({ id: o.logicalId, seats: o.seats, hours: o.hours, minAttendancePct: o.minAttendancePct }, pct) };
  }) };
}

/** Avaliação e certificado só por validação autorizada: pessoa natural, ≠ autor da oferta, capacidade no escopo. */
export function validateCertificate(i: { personNatural: boolean; validatorPersonId: string; offering: TrainingOffering; capabilities: Cap[]; eligible: { ok: boolean }; participantPersonId: string }) {
  const o = i.offering;
  if (!i.personNatural) return { ok: false as const, reason: "Executor técnico nunca valida certificado." };
  if (i.validatorPersonId === o.authorPersonId || i.validatorPersonId === i.participantPersonId) return { ok: false as const, reason: "Quem planeja ou participa não valida." };
  const hasCap = i.capabilities.some((c) => c.id === VALIDATE_TRAINING_CAP && (o.scope === "rede" ? c.scope === "rede" : c.scope === "escola" && c.schoolId === o.ownerSchoolId));
  if (!hasCap) return { ok: false as const, reason: "Validação sem capacidade homologada no escopo da formação." };
  if (!i.eligible.ok) return { ok: false as const, reason: "Participante não elegível pelas regras configuradas." };
  return { ok: true as const, certificate: { offeringId: o.logicalId, version: o.version, personId: i.participantPersonId, hours: o.hours!, validatedBy: i.validatorPersonId, kind: "interno" as const } };
}

/** Horas por pessoa: só certificados validados (reuso de individualHours); nada vira titulação. */
export const hoursOf = (certs: { hours: number }[]) => individualHours(certs.map((c) => ({ kind: "interno" as const, hours: c.hours, recognized: true })));

/** Demandas: atendida só quando citada por oferta com encontro realizado; nunca presumida. */
export function demandStatus(d: TrainingDemand[], offerings: TrainingOffering[]) {
  return d.map((x) => {
    const linked = offerings.filter((o) => o.demandIds.includes(x.id));
    return { ...x, status: linked.length === 0 ? "aberta" : linked.some((o) => o.sessions.some((s) => s.held)) ? "atendida-com-execucao" : "planejada" };
  });
}

/** Visões: escola vê as próprias + as da rede em que participa; central vê as da rede e contagem suprimida das escolares. */
export function trainingsFor(v: { kind: "escola"; schoolId: string } | { kind: "central" }, list: TrainingOffering[]) {
  if (v.kind === "escola") return { visible: list.filter((o) => o.ownerSchoolId === v.schoolId || (o.scope === "rede" && o.schoolIds.includes(v.schoolId))), schoolCount: null };
  const n = list.filter((o) => o.scope === "escola").length;
  return { visible: list.filter((o) => o.scope === "rede"), schoolCount: n > 0 && n < 5 ? ("suprimido" as const) : n };
}
