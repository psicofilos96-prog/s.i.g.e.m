/**
 * SIGEM Permanência — Lote 02: monitoramento de frequência sobre a chamada OFICIAL do Diário.
 * Projeção pura (nada é gravado). Entradas já lidas pelos readers canônicos:
 * aulas previstas (grade), marcações vigentes (attendance_record_versions), dias do
 * calendário aplicável e vigência da enturmação. Regras:
 * - aula fora da vigência ou em dia não letivo/indeterminado fica fora (listada, não contada);
 * - aula sem lançamento NÃO é falta nem presença: sai do denominador e interrompe a sequência;
 * - nenhum resultado afirma abandono/evasão; tendência só com base mínima nas duas janelas.
 */
export type Mark = "presente" | "ausente";
export type DayKind = "letivo" | "nao-letivo" | "indeterminado";
export interface Lesson { lessonId: string; date: string }
export interface Window { from: string; to: string | null }
export interface MonitoringInput {
  lessons: readonly Lesson[];
  marks: ReadonlyMap<string, Mark>; // lessonId → marcação da versão vigente
  calendar: ReadonlyMap<string, DayKind> | null; // null = calendário não lido
  enrollment: Window | null; // null = vigência não lida
  asOf: string;
}

export type Exclusion = "fora-da-vigencia" | "dia-nao-letivo" | "dia-indeterminado" | "futura";
export interface Monitoring {
  status: "ok" | "sem-calendario" | "sem-vigencia";
  considered: number; marked: number; present: number; absent: number; unmarked: number;
  rate: number | null; // faltas / aulas com lançamento
  consecutiveAbsences: number; // sequência atual, só lançamentos contíguos
  longestConsecutive: number;
  streakInterruptedByMissingRecord: boolean;
  excluded: Record<Exclusion, number>;
  lastMarkedDate: string | null;
}

const inWindow = (d: string, w: Window) => d >= w.from && (w.to === null || d <= w.to);

export function monitorAttendance(i: MonitoringInput): Monitoring {
  const excluded: Record<Exclusion, number> = { "fora-da-vigencia": 0, "dia-nao-letivo": 0, "dia-indeterminado": 0, futura: 0 };
  const empty = (status: Monitoring["status"]): Monitoring => ({ status, considered: 0, marked: 0, present: 0, absent: 0, unmarked: 0, rate: null,
    consecutiveAbsences: 0, longestConsecutive: 0, streakInterruptedByMissingRecord: false, excluded, lastMarkedDate: null });
  if (!i.calendar) return empty("sem-calendario");
  if (!i.enrollment) return empty("sem-vigencia");

  const ordered = [...i.lessons].sort((a, b) => a.date.localeCompare(b.date) || a.lessonId.localeCompare(b.lessonId));
  let present = 0, absent = 0, unmarked = 0, run = 0, longest = 0, interrupted = false, last: string | null = null, considered = 0;
  for (const l of ordered) {
    if (l.date > i.asOf) { excluded.futura++; continue; }
    if (!inWindow(l.date, i.enrollment)) { excluded["fora-da-vigencia"]++; continue; }
    const day = i.calendar.get(l.date) ?? "indeterminado";
    if (day === "nao-letivo") { excluded["dia-nao-letivo"]++; continue; }
    if (day === "indeterminado") { excluded["dia-indeterminado"]++; continue; }
    considered++;
    const m = i.marks.get(l.lessonId);
    if (!m) { unmarked++; if (run > 0) interrupted = true; run = 0; continue; }
    last = l.date;
    if (m === "ausente") { absent++; run++; interrupted = false; longest = Math.max(longest, run); }
    else { present++; run = 0; interrupted = false; }
  }
  const marked = present + absent;
  return { status: "ok", considered, marked, present, absent, unmarked, rate: marked > 0 ? absent / marked : null,
    consecutiveAbsences: run, longestConsecutive: longest, streakInterruptedByMissingRecord: interrupted, excluded, lastMarkedDate: last };
}

export type Trend = { kind: "indeterminada"; reason: string } | { kind: "piora" | "melhora" | "estavel"; previous: number; recent: number; delta: number };

/** Tendência = taxa da janela recente × janela anterior; base mínima e tolerância são parâmetros declarados (sem padrão no código). */
export function attendanceTrend(previous: Monitoring, recent: Monitoring, params: { minMarkedPerWindow: number; tolerance: number } | null): Trend {
  if (!params) return { kind: "indeterminada", reason: "Parâmetros de tendência não configurados." };
  if (previous.status !== "ok" || recent.status !== "ok") return { kind: "indeterminada", reason: "Calendário ou vigência não lidos." };
  if (previous.marked < params.minMarkedPerWindow || recent.marked < params.minMarkedPerWindow || previous.rate === null || recent.rate === null)
    return { kind: "indeterminada", reason: "Lançamentos insuficientes em uma das janelas." };
  const delta = recent.rate - previous.rate;
  const kind = Math.abs(delta) <= params.tolerance ? "estavel" : delta > 0 ? "piora" : "melhora";
  return { kind, previous: previous.rate, recent: recent.rate, delta };
}

/** Texto para a tela: nunca afirma abandono; lacuna de lançamento é dita como tal. */
export function monitoringNotes(m: Monitoring): string[] {
  if (m.status === "sem-calendario") return ["Calendário aplicável não lido: frequência não calculada."];
  if (m.status === "sem-vigencia") return ["Vigência da enturmação não lida: frequência não calculada."];
  const n: string[] = [];
  if (m.marked === 0) n.push("Nenhuma aula com lançamento no período: taxa não calculada.");
  if (m.unmarked > 0) n.push(`${m.unmarked} aula(s) sem lançamento: não contam como falta nem presença.`);
  if (m.streakInterruptedByMissingRecord) n.push("Sequência de faltas interrompida por aula sem lançamento.");
  if (m.excluded["dia-indeterminado"] > 0) n.push(`${m.excluded["dia-indeterminado"]} aula(s) em dia sem definição no calendário ficaram fora.`);
  n.push("Faltas indicam necessidade de acompanhamento, nunca abandono ou evasão.");
  return n;
}
