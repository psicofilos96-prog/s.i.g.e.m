// A&A Lote 12 — Saber Ler (projeções puras; o banco valida e grava).
// Eixos só pelo número 1–5; estágio de escrita é classificação própria, separada da faixa percentual;
// faixa só existe se configurada no instrumento; ausência nunca vira zero.

export type ItemResult = "acerto" | "erro" | "em-branco" | "nao-aplicado";
export type SlItem = { n: number; axis: number | null };
export type Band = { label: string; min: number; max: number | null }; // [min, max) ; max null = sem teto
export type SlInstrument = { id: string; logical_id: string; version: number; edition_year: number; grade: 1 | 2; week: number;
  items: SlItem[]; writing_stages: string[]; percent_bands: Band[] | null; source_ref: string; author_user_id: string; recorded_at: string };
export type SlHomologation = { instrument_version_id: string; decision: "homologado" | "revogado"; recorded_at: string };
export type SlEntry = { id: string; logical_id: string; version: number; instrument_version_id: string; school_id: string; class_id: string; student_id: string;
  presence: "presente" | "ausente" | "nao-registrado"; participation: "participou" | "participou-parcialmente" | "nao-participou" | null;
  item_results: Record<string, ItemResult>; writing_stage: string | null; author_user_id: string; recorded_at: string };
export type SlReview = { entry_version_id: string; decision: "conferido" | "devolvido" | "homologado"; recorded_at: string };

export const DEFAULT_WEEKS = [4, 8, 12, 16] as const;
export const axisLabel = (a: number | null) => (a == null ? "Sem eixo declarado" : `Eixo ${a}`);

export function validateInstrumentDraft(d: { week: number; grade: number; items: SlItem[]; source: string }): string[] {
  const e: string[] = [];
  if (!Number.isInteger(d.week) || d.week < 1 || d.week > 60) e.push("Semana inválida (1–60).");
  if (d.grade !== 1 && d.grade !== 2) e.push("Ano deve ser 1º ou 2º.");
  if (!d.items.length) e.push("Informe ao menos um item.");
  const ns = new Set<number>();
  for (const it of d.items) {
    if (!Number.isInteger(it.n) || it.n < 1 || ns.has(it.n)) e.push(`Item ${it.n}: número inválido ou repetido.`);
    ns.add(it.n);
    if (it.axis != null && (!Number.isInteger(it.axis) || it.axis < 1 || it.axis > 5)) e.push(`Item ${it.n}: eixo fora de 1–5.`);
  }
  if (d.source.trim().length < 3) e.push("Informe a fonte do instrumento.");
  return e;
}

export const isHomologated = (id: string, h: SlHomologation[]) =>
  h.filter((x) => x.instrument_version_id === id).sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1)).at(-1)?.decision === "homologado";

/** Percentual de acerto: denominador = acerto+erro+em-branco; "não aplicado" e itens sem registro ficam fora. */
export function score(entry: Pick<SlEntry, "presence" | "item_results">, items: SlItem[], axis?: number) {
  if (entry.presence !== "presente") return { pct: null, hits: null, counted: 0, missing: items.length };
  const pool = axis == null ? items : items.filter((i) => i.axis === axis);
  let hits = 0, counted = 0, missing = 0;
  for (const it of pool) {
    const r = entry.item_results[String(it.n)];
    if (!r) { missing++; continue; }
    if (r === "nao-aplicado") continue;
    counted++; if (r === "acerto") hits++;
  }
  return { pct: counted ? (hits / counted) * 100 : null, hits: counted ? hits : null, counted, missing };
}

/** Faixa só por configuração do instrumento; sem faixas ⇒ null (não presumido). */
export function bandOf(pct: number | null, bands: Band[] | null): string | null {
  if (pct == null || !bands?.length) return null;
  return bands.find((b) => pct >= b.min && (b.max == null || pct < b.max))?.label ?? null;
}

export type EntryState = "rascunho" | "conferido" | "devolvido" | "homologado";
export function heads(entries: SlEntry[]): SlEntry[] {
  const m = new Map<string, SlEntry>();
  for (const e of entries) { const c = m.get(e.logical_id); if (!c || c.version < e.version) m.set(e.logical_id, e); }
  return [...m.values()];
}
export function entryState(head: SlEntry, reviews: SlReview[]): EntryState {
  const last = reviews.filter((r) => r.entry_version_id === head.id).sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1)).at(-1);
  return last?.decision ?? "rascunho";
}

/** Resumo da turma/rodada: presença ≠ participação; percentuais só de presentes com itens contados. */
export function roundSummary(entries: SlEntry[], inst: SlInstrument, reviews: SlReview[]) {
  const hs = heads(entries.filter((e) => e.instrument_version_id === inst.id));
  const present = hs.filter((e) => e.presence === "presente");
  const scored = present.map((e) => score(e, inst.items).pct).filter((x): x is number => x != null);
  const axes = [1, 2, 3, 4, 5].filter((a) => inst.items.some((i) => i.axis === a)).map((a) => {
    const v = present.map((e) => score(e, inst.items, a).pct).filter((x): x is number => x != null);
    return { axis: a, n: v.length, mean: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null };
  });
  const stages = new Map<string, number>();
  for (const e of present) if (e.writing_stage) stages.set(e.writing_stage, (stages.get(e.writing_stage) ?? 0) + 1);
  const states = { rascunho: 0, conferido: 0, devolvido: 0, homologado: 0 } as Record<EntryState, number>;
  for (const h of hs) states[entryState(h, reviews)]++;
  return {
    registered: hs.length, present: present.length,
    absent: hs.filter((e) => e.presence === "ausente").length, notRecorded: hs.filter((e) => e.presence === "nao-registrado").length,
    participated: present.filter((e) => e.participation === "participou").length,
    partial: present.filter((e) => e.participation === "participou-parcialmente").length,
    notParticipated: present.filter((e) => e.participation === "nao-participou").length,
    scored: scored.length, meanPct: scored.length ? scored.reduce((s, x) => s + x, 0) / scored.length : null,
    axes, stages: [...stages].map(([stage, n]) => ({ stage, n })), states,
  };
}

/** Trajetória: uma linha por rodada (ordem ano/semana); só conta resultado homologado se `homologatedOnly`. */
export function trajectory(studentId: string, entries: SlEntry[], insts: SlInstrument[], reviews: SlReview[], homologatedOnly = true) {
  return heads(entries.filter((e) => e.student_id === studentId)).flatMap((e) => {
    const inst = insts.find((i) => i.id === e.instrument_version_id); if (!inst) return [];
    const state = entryState(e, reviews);
    if (homologatedOnly && state !== "homologado") return [];
    const s = score(e, inst.items);
    return [{ year: inst.edition_year, week: inst.week, grade: inst.grade, presence: e.presence, pct: s.pct, band: bandOf(s.pct, inst.percent_bands), stage: e.writing_stage, state }];
  }).sort((a, b) => a.year - b.year || a.week - b.week);
}
