/** A&A Lote 4 — calendário operacional: projeção pura sobre versões e eventos de situação (0367). */
export type CalItem = {
  id: string; logical_id: string; version: number; event_kind: "registro" | "reprogramacao" | "cancelamento";
  edition_year: number; start_date: string | null; end_date: string | null; date_text: string; segment: string; action: string;
  kind: string; program_key: string | null; relation: string | null; responsible: string | null; reason: string | null;
  author_user_id: string | null; executor_label: string | null; source_line: number | null; recorded_at: string;
};
export type StatusEv = { item_logical_id: string; seq: number; state: "planejado" | "em-andamento" | "concluido" | "nao-realizado"; evidence: string | null; author_user_id: string; recorded_at: string };

export type CalView = {
  current: CalItem; history: CalItem[]; statuses: StatusEv[]; state: StatusEv["state"]; seq: number;
  alert: "atrasado" | "proximo" | null; reprogrammed: boolean;
};

/** Datas valem para a edição registrada; nunca são repetidas para outro ano. */
export function projectCalendar(items: CalItem[], statuses: StatusEv[], today: string, warnDays: number, year: number): CalView[] {
  const by = new Map<string, CalItem[]>();
  for (const i of items) if (i.edition_year === year) by.set(i.logical_id, [...(by.get(i.logical_id) ?? []), i]);
  const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const limit = addDays(today, warnDays);
  return [...by.values()].map((h) => {
    const history = [...h].sort((a, b) => a.version - b.version);
    const current = history.at(-1)!;
    const st = statuses.filter((s) => s.item_logical_id === current.logical_id).sort((a, b) => a.seq - b.seq);
    const state = st.at(-1)?.state ?? "planejado";
    const closed = state === "concluido" || state === "nao-realizado" || current.event_kind === "cancelamento";
    const end = current.end_date ?? current.start_date;
    const alert = closed || !end ? null : end < today ? "atrasado" as const : (current.start_date ?? end) <= limit ? "proximo" as const : null;
    return { current, history, statuses: st, state, seq: st.at(-1)?.seq ?? 0, alert, reprogrammed: history.length > 1 };
  }).sort((a, b) => (a.current.start_date ?? "9999").localeCompare(b.current.start_date ?? "9999") || a.current.segment.localeCompare(b.current.segment));
}

export const KIND_LABEL: Record<string, string> = {
  aplicacao: "Aplicação", lancamento: "Lançamento/prazo", validacao: "Validação OP/SEMED", analise: "Análise de resultados",
  devolutiva: "Devolutiva", recuperacao: "Recuperação", formacao: "Formação", conselho: "Conselho de Classe", outro: "Outras ações",
};
