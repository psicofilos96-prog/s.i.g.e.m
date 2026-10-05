/**
 * Frente AB — trajetória e indicadores do aluno como projeção pura sobre fatos canônicos já lidos com a sessão.
 * Nada é gravado; ausência ⇒ "desconhecido" com motivo; nenhum rótulo, score ou classificação de risco.
 */
export type SourceKind = "matricula" | "alocacao" | "movimentacao" | "frequencia" | "avaliacao" | "recuperacao" | "fechamento" | "acompanhamento";
export type TrajectoryEvent = Readonly<{ kind: SourceKind; on: string; label: string; sourceRef: string; schoolId: string | null }>;

/** Linha do tempo: une eventos das fontes, ordena por data e nunca deduplica fatos de fontes diferentes. Fonte não lida vira lacuna explícita. */
export function buildTrajectory(sources: ReadonlyArray<{ kind: SourceKind; events: readonly TrajectoryEvent[] | null }>) {
  const gaps = sources.filter((s) => s.events == null).map((s) => s.kind);
  const events = sources.flatMap((s) => s.events ?? []).slice().sort((a, b) => a.on.localeCompare(b.on) || a.kind.localeCompare(b.kind));
  return { events, gaps } as const;
}

export type Indicator = Readonly<{ id: string; value: number | null; reason: string | null; sources: readonly string[] }>;

/** Frequência: só com denominador semanticamente definido (aulas com chamada registrada para o aluno). Sem chamada não é falta. */
export function attendanceIndicator(marks: readonly { lessonId: string; mark: "Presente" | "Ausente" | null }[] | null): Indicator {
  if (marks == null) return { id: "frequencia", value: null, reason: "Frequência não pôde ser lida.", sources: [] };
  const marked = marks.filter((m) => m.mark != null);
  if (marked.length === 0) return { id: "frequencia", value: null, reason: "Nenhuma chamada com marcação para o aluno; não há denominador.", sources: [] };
  const present = marked.filter((m) => m.mark === "Presente").length;
  return { id: "frequencia", value: present / marked.length, reason: `Presenças sobre ${marked.length} aula(s) com marcação; ${marks.length - marked.length} sem marcação fora do denominador.`, sources: marked.map((m) => m.lessonId) };
}

export function countIndicator(id: string, rows: readonly { ref: string }[] | null, unreadable: string): Indicator {
  return rows == null ? { id, value: null, reason: unreadable, sources: [] } : { id, value: rows.length, reason: null, sources: rows.map((r) => r.ref) };
}

/** Alerta: só por regra homologada com operador estruturado; indicador desconhecido nunca dispara. */
export type AlertRule = Readonly<{ id: string; version: number; homologated: boolean; indicatorId: string; op: "lt" | "le" | "gt" | "ge"; threshold: number; label: string }>;
export type Alert = Readonly<{ ruleId: string; ruleVersion: number; label: string; indicator: Indicator }>;

export function evaluateAlerts(indicators: readonly Indicator[], rules: readonly AlertRule[]): { alerts: Alert[]; mode: "indicadores" | "alertas" } {
  const active = rules.filter((r) => r.homologated);
  if (active.length === 0) return { alerts: [], mode: "indicadores" };
  const alerts: Alert[] = [];
  for (const r of active) {
    const ind = indicators.find((i) => i.id === r.indicatorId);
    if (!ind || ind.value == null) continue;
    const v = ind.value, t = r.threshold;
    const hit = r.op === "lt" ? v < t : r.op === "le" ? v <= t : r.op === "gt" ? v > t : v >= t;
    if (hit) alerts.push({ ruleId: r.id, ruleVersion: r.version, label: r.label, indicator: ind });
  }
  return { alerts, mode: "alertas" };
}
