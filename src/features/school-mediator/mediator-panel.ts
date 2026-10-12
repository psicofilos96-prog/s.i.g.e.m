/**
 * PERFIL MEDIADOR — LOTE 03 Meu Painel e Minha Agenda (núcleo puro).
 * Compõe só fontes canônicas já lidas: estudantes por `inclusion_my_mediated_students`,
 * grade por `class_schedule_at`, efeito do dia pelo calendário oficial, eventos dos
 * módulos donos (NEI, Orientação, formação). Nenhum calendário paralelo; nenhum campo
 * clínico chega ao painel; fonte não lida = "não disponível", nunca zero.
 */
export interface MediatedStudent { mediation_logical_id: string; school_id: string; student_id: string; student_name: string; class_id: string | null; valid_from: string; valid_to: string | null }
export interface ScheduleBlock { classId: string; weekday: number; start: string; end: string; shift: string | null; component: string | null }
export type DayEffect = "letivo" | "nao-letivo" | "suspenso" | "indeterminado";
export type EventKind = "reuniao" | "formacao" | "atividade" | "orientacao" | "solicitacao";
export interface OwnedEvent { id: string; kind: EventKind; date: string; start: string | null; title: string; owner: string; studentId: string | null; href: string }

type Src<T> = T | null; // null = fonte não lida/negada

const CLINICAL = /\b(cid|laudo|diagn[oó]stic|f\d{2}(\.\d)?|transtorno|defici[eê]ncia|medica[cç])/i;

export function safeTitle(t: string): string { return CLINICAL.test(t) ? "Item restrito ao NEI" : t; }

export interface PanelInput {
  date: string; students: Src<MediatedStudent[]>; blocks: Src<ScheduleBlock[]>; dayEffect: Src<DayEffect>;
  events: Src<OwnedEvent[]>; guidanceCount: Src<number>; pendingRecords: Src<number>; openRequests: Src<number>;
}
export type Count = { state: "disponivel"; value: number } | { state: "nao-disponivel" };
const count = (n: number | null): Count => (n === null ? { state: "nao-disponivel" } : { state: "disponivel", value: n });

export function buildPanel(p: PanelInput) {
  const students = p.students ?? [];
  const schools = [...new Set(students.map((s) => s.school_id))].sort();
  const classIds = new Set(students.map((s) => s.class_id).filter((c): c is string => !!c));
  const studentIds = new Set(students.map((s) => s.student_id));
  const shifts = p.blocks === null ? null : [...new Set(p.blocks.filter((b) => classIds.has(b.classId) && b.shift).map((b) => b.shift!))].sort();
  return {
    studentsState: p.students === null ? "nao-disponivel" as const : students.length === 0 ? "nenhum" as const : "disponivel" as const,
    students: students.map((s) => ({ id: s.student_id, name: s.student_name, classId: s.class_id, schoolId: s.school_id, until: s.valid_to })),
    schools, shifts,
    guidance: count(p.guidanceCount), pendingRecords: count(p.pendingRecords), openRequests: count(p.openRequests),
    events: p.events === null ? null : p.events.filter((e) => e.studentId === null || studentIds.has(e.studentId)).map((e) => ({ ...e, title: safeTitle(e.title) })),
    quickActions: quickActions(students.length > 0),
  };
}

export function quickActions(hasStudents: boolean) {
  return [
    { id: "abrir-acompanhamento", label: "Abrir acompanhamento", href: "/inclusao/nei/ficha", enabled: hasStudents },
    { id: "registrar-apoio", label: "Registrar apoio", href: "/inclusao/nei/ficha", enabled: hasStudents },
    { id: "registrar-ocorrencia", label: "Registrar ocorrência", href: "/inclusao/nei/protocolos", enabled: hasStudents },
    { id: "consultar-orientacao", label: "Consultar orientação", href: "/inclusao", enabled: hasStudents },
    { id: "solicitar-orientacao", label: "Solicitar orientação", href: "/inclusao/nei/apoio", enabled: hasStudents },
  ] as const;
}

const weekday = (date: string) => { const d = new Date(`${date}T12:00:00Z`).getUTCDay(); return d === 0 ? 7 : d; };

export interface AgendaItem { kind: "aula" | EventKind; date: string; start: string | null; end: string | null; title: string; classId: string | null; href: string | null; note: string | null }

/** Agenda do dia: aulas das turmas dos estudantes acompanhados × efeito oficial do dia + eventos dos donos. */
export function dayAgenda(p: { date: string; students: MediatedStudent[]; blocks: Src<ScheduleBlock[]>; dayEffect: Src<DayEffect>; events: Src<OwnedEvent[]> }):
  { items: AgendaItem[]; notices: string[] } {
  const notices: string[] = []; const items: AgendaItem[] = [];
  const live = p.students.filter((s) => s.valid_from <= p.date && (s.valid_to === null || p.date <= s.valid_to));
  const classIds = new Set(live.map((s) => s.class_id).filter((c): c is string => !!c));
  if (live.some((s) => !s.class_id)) notices.push("Há estudante acompanhado sem turma registrada na designação: horário não exibido.");
  if (p.dayEffect === null) notices.push("Calendário oficial não lido: aulas do dia não confirmadas.");
  else if (p.dayEffect !== "letivo") notices.push(p.dayEffect === "indeterminado" ? "Dia sem efeito declarado no calendário oficial." : `Dia ${p.dayEffect === "nao-letivo" ? "não letivo" : "suspenso"} no calendário oficial: sem aulas.`);
  if (p.blocks === null) notices.push("Grade da turma não lida.");
  if (p.dayEffect === "letivo" && p.blocks) {
    const wd = weekday(p.date);
    for (const b of p.blocks) if (classIds.has(b.classId) && b.weekday === wd)
      items.push({ kind: "aula", date: p.date, start: b.start, end: b.end, title: b.component ?? "Aula", classId: b.classId, href: null, note: b.shift });
  }
  if (p.events === null) notices.push("Eventos dos setores não lidos.");
  else {
    const sids = new Set(live.map((s) => s.student_id));
    for (const e of p.events) if (e.date === p.date && (e.studentId === null || sids.has(e.studentId)))
      items.push({ kind: e.kind, date: e.date, start: e.start, end: null, title: safeTitle(e.title), classId: null, href: e.href, note: e.owner });
  }
  items.sort((a, b) => (a.start ?? "99") < (b.start ?? "99") ? -1 : (a.start ?? "99") > (b.start ?? "99") ? 1 : 0);
  // conflito de horário entre aulas de turmas diferentes
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1]!, b = items[i]!;
    if (a.kind === "aula" && b.kind === "aula" && a.classId !== b.classId && a.end && b.start && b.start < a.end)
      notices.push(`Sobreposição de horário entre turmas ${a.classId} e ${b.classId} às ${b.start}.`);
  }
  return { items, notices };
}

/** Semana: sete dias a partir da segunda-feira da data. */
export function weekDates(date: string): string[] {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (weekday(date) - 1));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setUTCDate(d.getUTCDate() + i); return x.toISOString().slice(0, 10); });
}
