/**
 * Lote 08 Supervisão — não conformidades e planos de adequação.
 * Ledger append-only por caso (seq esperado, autor humano). Estado é projeção dos eventos.
 * Observação NUNCA é irregularidade: só "confirmada" por pessoa com nível conferir/coordenar,
 * distinta de quem observou, com norma referenciada. Encerramento exige verificação ou motivo.
 * Prioridade só de catálogo configurado (sem catálogo ⇒ null). Nada grava no banco.
 */
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };

export type NcState = "observada" | "em-analise" | "confirmada" | "descartada" | "em-esclarecimento" | "em-providencia" | "em-verificacao" | "regularizada" | "encerrada";
export type NcKind = "observar" | "analisar" | "confirmar" | "descartar" | "solicitar-esclarecimento" | "manifestar" | "iniciar-providencias" | "solicitar-verificacao" | "verificar" | "encerrar" | "reabrir";

const NEXT: Record<NcKind, { from: NcState[] | null; to: NcState }> = {
  observar: { from: null, to: "observada" },
  analisar: { from: ["observada"], to: "em-analise" },
  confirmar: { from: ["em-analise", "em-esclarecimento"], to: "confirmada" },
  descartar: { from: ["em-analise", "em-esclarecimento"], to: "descartada" },
  "solicitar-esclarecimento": { from: ["em-analise", "confirmada"], to: "em-esclarecimento" },
  manifestar: { from: ["em-esclarecimento"], to: "em-esclarecimento" },
  "iniciar-providencias": { from: ["confirmada"], to: "em-providencia" },
  "solicitar-verificacao": { from: ["em-providencia"], to: "em-verificacao" },
  verificar: { from: ["em-verificacao"], to: "regularizada" },
  encerrar: { from: ["confirmada", "em-providencia", "em-verificacao", "regularizada"], to: "encerrada" },
  reabrir: { from: ["regularizada", "encerrada", "descartada"], to: "em-analise" },
};

export interface NcEvent {
  seq: number; caseId: string; kind: NcKind; principalId: string; isHuman: boolean;
  level: "consultar" | "registrar" | "conferir" | "coordenar"; side: "supervisao" | "escola";
  at: string; reason: string | null;
  // só no "observar":
  schoolId?: string; area?: string; normRef?: string | null; evidencePaths?: string[];
  priority?: string | null; responsible?: string | null; dueOn?: string | null;
  verifiedOk?: boolean; // só em "verificar"
}

export function project(events: NcEvent[]) {
  let state: NcState | null = null; const manifestations: NcEvent[] = [];
  for (const e of events) { state = NEXT[e.kind].to; if (e.kind === "manifestar") manifestations.push(e); }
  const first = events[0];
  return { state, first, manifestations, reopenings: events.filter((e) => e.kind === "reabrir").length };
}

export function appendNc(events: NcEvent[], ev: Omit<NcEvent, "seq">, expectedSeq: number, priorities: string[] | null): Res<NcEvent[]> {
  if (!ev.isHuman) return { ok: false, code: "autor-nao-humano" };
  if (events.length !== expectedSeq) return { ok: false, code: "base-alterada" };
  const { state, first } = project(events);
  const rule = NEXT[ev.kind];
  if (rule.from === null ? state !== null : !state || !rule.from.includes(state)) return { ok: false, code: "transicao-invalida" };
  const needsReason: NcKind[] = ["descartar", "encerrar", "reabrir", "solicitar-esclarecimento", "manifestar"];
  if (needsReason.includes(ev.kind) && !ev.reason?.trim()) return { ok: false, code: "motivo-obrigatorio" };
  if (ev.kind === "manifestar") { if (ev.side !== "escola") return { ok: false, code: "manifestacao-so-da-escola" }; }
  else if (ev.side !== "supervisao") return { ok: false, code: "ato-da-supervisao" };
  if (ev.kind === "observar") {
    if (ev.level === "consultar") return { ok: false, code: "sem-competencia" };
    if (!ev.schoolId || !ev.area) return { ok: false, code: "escola-e-area-obrigatorias" };
    if ((ev.evidencePaths ?? []).some((p) => !p.startsWith(`supervisao/${ev.schoolId}/`))) return { ok: false, code: "evidencia-fora-do-caminho-privado" };
    if (ev.priority != null && !(priorities ?? []).includes(ev.priority)) return { ok: false, code: "prioridade-nao-configurada" };
  }
  if (ev.kind === "confirmar" || ev.kind === "verificar" || ev.kind === "descartar") {
    if (ev.level !== "conferir" && ev.level !== "coordenar") return { ok: false, code: "sem-competencia" };
    if (first && ev.principalId === first.principalId) return { ok: false, code: "confirmador-igual-ao-observador" };
  }
  if (ev.kind === "confirmar" && !first?.normRef?.trim()) return { ok: false, code: "sem-norma-referenciada" };
  if (ev.kind === "verificar" && ev.verifiedOk !== true) return { ok: false, code: "verificacao-sem-resultado-positivo" };
  if (ev.kind === "encerrar" && state !== "regularizada" && !ev.reason?.trim()) return { ok: false, code: "motivo-obrigatorio" };
  return { ok: true, value: [...events, { ...ev, seq: events.length }] };
}

/** Reincidência: mesma escola+área com caso anterior regularizado/encerrado; só sinaliza. */
export function recurrence(cases: NcEvent[][], schoolId: string, area: string) {
  return cases.filter((c) => c[0]?.schoolId === schoolId && c[0]?.area === area && ["regularizada", "encerrada"].includes(project(c).state ?? "")).map((c) => c[0]!.caseId);
}

// ---------- Plano de adequação (versionado) ----------
export interface PlanAction { id: string; description: string; resources: string | null; responsible: string | null; dueOn: string | null; evidencePaths: string[]; done: boolean }
export interface PlanVersion { version: number; caseId: string; authorId: string; isHuman: boolean; reason: string | null; actions: PlanAction[]; finalCheck: { by: string; ok: boolean; at: string } | null }

export function versionPlan(chain: PlanVersion[], next: Omit<PlanVersion, "version">, expectedVersion: number, caseState: NcState | null): Res<PlanVersion[]> {
  if (!next.isHuman) return { ok: false, code: "autor-nao-humano" };
  if (caseState !== "confirmada" && caseState !== "em-providencia" && caseState !== "em-analise") return { ok: false, code: "caso-sem-plano" };
  if (chain.length !== expectedVersion) return { ok: false, code: "base-alterada" };
  if (chain.length && !next.reason?.trim()) return { ok: false, code: "motivo-obrigatorio" };
  if (!next.actions.length) return { ok: false, code: "plano-sem-acao" };
  if (next.finalCheck && next.finalCheck.by === next.authorId) return { ok: false, code: "verificador-igual-ao-autor" };
  if (next.finalCheck?.ok && next.actions.some((a) => !a.done || !a.evidencePaths.length)) return { ok: false, code: "acao-sem-evidencia" };
  return { ok: true, value: [...chain, { ...next, version: chain.length + 1 }] };
}

export function planGaps(p: PlanVersion, today: string) {
  return p.actions.flatMap((a) => [
    ...(a.responsible ? [] : [{ action: a.id, gap: "sem responsável" }]),
    ...(a.dueOn ? [] : [{ action: a.id, gap: "sem prazo" }]),
    ...(a.dueOn && !a.done && a.dueOn < today ? [{ action: a.id, gap: "prazo vencido" }] : []),
  ]);
}
