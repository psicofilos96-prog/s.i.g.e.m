/**
 * SIGEM Desenvolvimento L03 — projeção pura do painel sobre linhas já lidas com a RLS de quem vê.
 * Número só de linha observada; filtro sem fonte fica indisponível (nunca vazio silencioso).
 */
import { enrollmentStatus, seatsLeft, type EnrollmentStatus, type ParticipationEvent } from "./formation-chain";

export type ProgramRow = Readonly<{ id: string; title: string }>;
export type CourseRow = Readonly<{ id: string; programId: string }>;
export type CourseVersionRow = Readonly<{ id: string; courseId: string; version: number; title: string; hoursMinutes: number | null; minAttendancePct: number | null }>;
export type ClassRow = Readonly<{ id: string; courseVersionId: string; schoolId: string | null; label: string; seats: number | null; startsOn: string; endsOn: string }>;
export type EnrollmentRow = Readonly<{ id: string; classId: string; personId: string; functionalLinkId: string | null }>;
export type EventRow = Readonly<{ enrollmentId: string } & ParticipationEvent>;
export type CertRow = Readonly<{ enrollmentId: string; createdAt: string }>;
export type LinkRow = Readonly<{ id: string; positionId: string | null }>;

export interface HubInput {
  programs: readonly ProgramRow[]; courses: readonly CourseRow[]; versions: readonly CourseVersionRow[];
  classes: readonly ClassRow[]; enrollments: readonly EnrollmentRow[]; events: readonly EventRow[];
  certs: readonly CertRow[]; links: readonly LinkRow[] | null;
}
export interface HubFilter { year: number | null; schoolId: string | null; programId: string | null; positionId: string | null; functionId: string | null }
export const EMPTY_FILTER: HubFilter = { year: null, schoolId: null, programId: null, positionId: null, functionId: null };

/** Função exercida não é registrada na inscrição (L02): filtro indisponível, nunca presumido. */
export const FUNCTION_FILTER_UNAVAILABLE = "A inscrição não registra função exercida; filtro por função indisponível até haver fonte.";

export interface ClassView {
  id: string; label: string; courseTitle: string; programId: string | null; schoolId: string | null; startsOn: string; endsOn: string;
  seats: number | null; seatsLeft: number | null; enrolled: number; concluded: number; certified: number; byStatus: Partial<Record<EnrollmentStatus, number>>;
}
export interface HubView {
  classes: ClassView[]; catalog: { courseId: string; title: string; version: number; hoursMinutes: number | null; programTitle: string | null }[];
  totals: { classes: number; enrolled: number; concluded: number; certified: number; seatsLeft: number | null };
  agenda: { classId: string; label: string; date: string; kind: "inicio" | "fim" }[];
  options: { years: number[]; schools: string[]; programs: ProgramRow[]; positions: string[] | null };
  notes: string[];
}

export function buildHub(i: HubInput, f: HubFilter, today: string): HubView {
  const vById = new Map(i.versions.map((v) => [v.id, v]));
  const cById = new Map(i.courses.map((c) => [c.id, c]));
  const pById = new Map(i.programs.map((p) => [p.id, p]));
  const linkPos = i.links ? new Map(i.links.map((l) => [l.id, l.positionId])) : null;
  const evBy = group(i.events, (e) => e.enrollmentId);
  const certSet = new Set(i.certs.map((c) => c.enrollmentId));
  const notes: string[] = [];
  if (f.functionId) notes.push(FUNCTION_FILTER_UNAVAILABLE);
  if (f.positionId && !linkPos) notes.push("Vínculos não visíveis para sua conta; filtro por cargo indisponível.");

  const programOf = (cl: ClassRow) => { const v = vById.get(cl.courseVersionId); const c = v && cById.get(v.courseId); return c?.programId ?? null; };
  const classes = i.classes.filter((cl) =>
    (f.year == null || Number(cl.startsOn.slice(0, 4)) === f.year) &&
    (f.schoolId == null || cl.schoolId === f.schoolId) &&
    (f.programId == null || programOf(cl) === f.programId));

  const views: ClassView[] = classes.map((cl) => {
    let ens = i.enrollments.filter((e) => e.classId === cl.id);
    const all = ens.map((e) => ({ events: evBy.get(e.id) ?? [] }));
    if (f.positionId && linkPos) ens = ens.filter((e) => e.functionalLinkId != null && linkPos.get(e.functionalLinkId) === f.positionId);
    if (f.functionId) ens = [];
    const byStatus: Partial<Record<EnrollmentStatus, number>> = {};
    for (const e of ens) { const s = enrollmentStatus(evBy.get(e.id) ?? []); byStatus[s] = (byStatus[s] ?? 0) + 1; }
    return {
      id: cl.id, label: cl.label, courseTitle: vById.get(cl.courseVersionId)?.title ?? "Curso não visível", programId: programOf(cl), schoolId: cl.schoolId,
      startsOn: cl.startsOn, endsOn: cl.endsOn, seats: cl.seats, seatsLeft: seatsLeft(cl.seats, all),
      enrolled: ens.length, concluded: byStatus.concluida ?? 0, certified: ens.filter((e) => certSet.has(e.id)).length, byStatus,
    };
  });

  const latest = new Map<string, CourseVersionRow>();
  for (const v of i.versions) { const cur = latest.get(v.courseId); if (!cur || v.version > cur.version) latest.set(v.courseId, v); }
  const catalog = [...latest.values()].filter((v) => f.programId == null || cById.get(v.courseId)?.programId === f.programId)
    .map((v) => ({ courseId: v.courseId, title: v.title, version: v.version, hoursMinutes: v.hoursMinutes, programTitle: pById.get(cById.get(v.courseId)?.programId ?? "")?.title ?? null }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const agenda = views.flatMap((c) => [{ classId: c.id, label: c.label, date: c.startsOn, kind: "inicio" as const }, { classId: c.id, label: c.label, date: c.endsOn, kind: "fim" as const }])
    .filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);

  const anyUnknownSeats = views.some((v) => v.seatsLeft == null);
  return {
    classes: views, catalog, agenda, notes,
    totals: {
      classes: views.length, enrolled: sum(views, "enrolled"), concluded: sum(views, "concluded"), certified: sum(views, "certified"),
      seatsLeft: anyUnknownSeats || views.length === 0 ? null : views.reduce((a, v) => a + (v.seatsLeft ?? 0), 0),
    },
    options: {
      years: [...new Set(i.classes.map((c) => Number(c.startsOn.slice(0, 4))))].sort(),
      schools: [...new Set(i.classes.map((c) => c.schoolId).filter((s): s is string => !!s))].sort(),
      programs: [...i.programs].sort((a, b) => a.title.localeCompare(b.title)),
      positions: i.links ? [...new Set(i.links.map((l) => l.positionId).filter((p): p is string => !!p))].sort() : null,
    },
  };
}

function group<T>(xs: readonly T[], k: (x: T) => string) { const m = new Map<string, T[]>(); for (const x of xs) { const key = k(x); m.set(key, [...(m.get(key) ?? []), x]); } return m; }
const sum = (xs: readonly ClassView[], k: "enrolled" | "concluded" | "certified") => xs.reduce((a, x) => a + x[k], 0);
