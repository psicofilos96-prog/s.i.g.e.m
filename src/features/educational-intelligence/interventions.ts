/** A&A Lote 6 — integração pedagógica: projeção pura sobre planos de intervenção (0369). Nunca grava, nunca decide promoção/retenção. */
export type InterventionVersion = {
  id: string; logical_id: string; version: number; school_id: string; class_id: string | null; segment: string; is_infant: boolean;
  origin_kind: "sia-instrumento-aprovado" | "avaliacao-externa" | "frequencia-diario" | "rendimento-diario" | "diagnostico-registrado";
  origin_ref: string; sipe_plan_version_id: string | null; objective: string; responsible_label: string | null; due_date: string | null;
  reason: string | null; author_user_id: string; recorded_at: string;
};
export type InterventionEvent = {
  plan_logical_id: string; seq: number; kind: "acao" | "evidencia" | "devolutiva" | "progresso" | "reavaliacao" | "encerramento";
  body: string; responsible_label: string | null; due_date: string | null;
  progress: "nao-avaliado" | "sem-avanco" | "avanco-parcial" | "avancou" | null; reassessment_ref: string | null;
  author_user_id: string; recorded_at: string;
};

export type Stage = "planejado" | "em-execucao" | "aguardando-reavaliacao" | "reavaliado" | "encerrado";
export type InterventionView = {
  current: InterventionVersion; history: InterventionVersion[]; events: InterventionEvent[]; seq: number;
  stage: Stage; lastProgress: InterventionEvent["progress"]; overdue: string[]; issues: string[];
};

export const ORIGIN_LABEL: Record<InterventionVersion["origin_kind"], string> = {
  "sia-instrumento-aprovado": "Prova SIA aprovada pela OP",
  "avaliacao-externa": "Avaliação externa / programa",
  "frequencia-diario": "Frequência do Diário",
  "rendimento-diario": "Rendimento do Diário",
  "diagnostico-registrado": "Diagnóstico registrado",
};
export const STAGE_LABEL: Record<Stage, string> = {
  planejado: "Planejado", "em-execucao": "Em execução", "aguardando-reavaliacao": "Aguardando reavaliação", reavaliado: "Reavaliado", encerrado: "Encerrado",
};

/** Frases que o módulo jamais emite: decisão de promoção/retenção não pertence à intervenção. */
const DECISION_WORDS = /\b(reprova|retid|retenç|retenc|promovid|promoç|promoc|aprovad[oa] para)/i;

export function projectInterventions(versions: InterventionVersion[], events: InterventionEvent[], today: string): InterventionView[] {
  const by = new Map<string, InterventionVersion[]>();
  for (const v of versions) by.set(v.logical_id, [...(by.get(v.logical_id) ?? []), v]);
  return [...by.values()].map((h) => {
    const history = [...h].sort((a, b) => a.version - b.version);
    const current = history.at(-1)!;
    const ev = events.filter((e) => e.plan_logical_id === current.logical_id).sort((a, b) => a.seq - b.seq);
    const has = (k: InterventionEvent["kind"]) => ev.some((e) => e.kind === k);
    const lastProg = [...ev].reverse().find((e) => e.kind === "progresso" || e.kind === "reavaliacao");
    let stage: Stage = "planejado";
    if (has("encerramento")) stage = "encerrado";
    else if (has("reavaliacao")) stage = "reavaliado";
    else if (has("acao") && current.due_date && current.due_date < today) stage = "aguardando-reavaliacao";
    else if (has("acao")) stage = "em-execucao";
    const overdue: string[] = [];
    if (stage !== "encerrado") {
      if (current.due_date && current.due_date < today && !has("reavaliacao")) overdue.push(`Prazo do plano (${current.due_date}) vencido sem reavaliação registrada.`);
      for (const e of ev) if (e.kind === "acao" && e.due_date && e.due_date < today) {
        const later = ev.some((x) => x.seq > e.seq && (x.kind === "evidencia" || x.kind === "progresso"));
        if (!later) overdue.push(`Ação #${e.seq} com prazo ${e.due_date} sem evidência ou progresso posterior.`);
      }
    }
    const issues: string[] = [];
    if (!current.responsible_label && !ev.some((e) => e.responsible_label)) issues.push("Responsável não informado.");
    if (current.is_infant && [current.objective, ...ev.map((e) => e.body)].some((t) => DECISION_WORDS.test(t)))
      issues.push("Educação Infantil: texto menciona promoção/retenção; a intervenção não decide trajetória.");
    if (has("encerramento") && !has("devolutiva")) issues.push("Encerrado sem devolutiva registrada.");
    return { current, history, events: ev, seq: ev.at(-1)?.seq ?? 0, stage, lastProgress: lastProg?.progress ?? null, overdue, issues };
  }).sort((a, b) => a.current.recorded_at < b.current.recorded_at ? 1 : -1);
}

/** Validação de entrada antes do RPC (o banco revalida). */
export function validateNewIntervention(i: { school_id: string; segment: string; origin_kind: string; origin_ref: string; objective: string }): string[] {
  const e: string[] = [];
  if (!i.school_id.trim()) e.push("Escola obrigatória.");
  if (!i.segment.trim()) e.push("Etapa/segmento obrigatório.");
  if (!(i.origin_kind in ORIGIN_LABEL)) e.push("Origem inválida.");
  if (!i.origin_ref.trim()) e.push("Referência da origem obrigatória (ex.: versão da prova, edição, período).");
  if (i.objective.trim().length < 5) e.push("Objetivo com pelo menos 5 caracteres.");
  return e;
}

/** Consolidado por escola só de planos visíveis à sessão; nada vira zero para escola sem leitura. */
export function summarizeBySchool(views: InterventionView[]): { school_id: string; total: number; byStage: Record<Stage, number>; overdue: number }[] {
  const m = new Map<string, InterventionView[]>();
  for (const v of views) m.set(v.current.school_id, [...(m.get(v.current.school_id) ?? []), v]);
  return [...m.entries()].map(([school_id, vs]) => {
    const byStage = { planejado: 0, "em-execucao": 0, "aguardando-reavaliacao": 0, reavaliado: 0, encerrado: 0 } as Record<Stage, number>;
    for (const v of vs) byStage[v.stage]++;
    return { school_id, total: vs.length, byStage, overdue: vs.filter((v) => v.overdue.length > 0).length };
  });
}
