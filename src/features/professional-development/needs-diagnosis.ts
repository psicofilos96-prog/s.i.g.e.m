/**
 * SIGEM Desenvolvimento L04 — diagnóstico de necessidades formativas (projeção pura; banco = 0432).
 * Consolida submissões por tema/necessidade; nunca rotula pessoa: evidência é registro canônico
 * ou agregado ≥ limiar aprovado; prioridade só a declarada na consolidação, com justificativa.
 */
export type Origin = "escola" | "orientacao" | "supervisao" | "avaliacao-agregada";
export type EvidenceKind = "documento" | "registro-supervisao" | "registro-orientacao" | "resultado-agregado";
export type Priority = "alta" | "media" | "baixa";
export type EvidenceInput = Readonly<{ kind: EvidenceKind; document_version_ref?: string; record_ref?: string; instrument_ref?: string; group_size?: number; summary: string }>;
export type Submission = Readonly<{ id: string; origin: Origin; schoolId: string | null; topic: string; createdAt: string }>;
export type Consolidation = Readonly<{ submissionId: string; needId: string; priority: Priority; priorityReason: string }>;

const FORBIDDEN_KEYS = ["person_id", "student_id", "professional_id", "name", "nome", "cpf"];

/** Espelha o writer: evidência obrigatória, sem identificador pessoal, agregado só com limiar aprovado e grupo ≥ limiar. */
export function evidenceProblems(evidence: readonly EvidenceInput[], threshold: number | null): string[] {
  const p: string[] = [];
  if (evidence.length === 0) p.push("Informe ao menos uma evidência.");
  for (const e of evidence) {
    if (Object.keys(e).some((k) => FORBIDDEN_KEYS.includes(k))) p.push("Evidência não pode identificar pessoa.");
    if (e.summary.trim().length < 10) p.push("Resumo da evidência muito curto.");
    if (e.kind === "documento" && !e.document_version_ref) p.push("Evidência documental exige documento do SIGEM Documentos.");
    if ((e.kind === "registro-supervisao" || e.kind === "registro-orientacao") && !e.record_ref) p.push("Informe o registro de origem.");
    if (e.kind === "resultado-agregado") {
      if (!e.instrument_ref || e.group_size == null) p.push("Resultado agregado exige instrumento e tamanho do grupo.");
      else if (threshold == null) p.push("Limiar de agregação não aprovado: resultado de avaliação não pode ser usado.");
      else if (e.group_size < threshold) p.push(`Grupo menor que o limiar aprovado (${threshold}).`);
    }
  }
  return [...new Set(p)];
}

export interface NeedSummary {
  needId: string | null; topic: string; submissions: number; schools: number; origins: Partial<Record<Origin, number>>;
  priority: Priority | null; priorityReasons: string[]; conflictingPriorities: boolean;
}

/** Agrupa por necessidade consolidada; não consolidadas agrupam por tema normalizado e ficam sem prioridade. */
export function consolidate(subs: readonly Submission[], cons: readonly Consolidation[]): NeedSummary[] {
  const bySub = new Map(cons.map((c) => [c.submissionId, c]));
  const groups = new Map<string, { needId: string | null; topic: string; items: Submission[]; cons: Consolidation[] }>();
  for (const s of subs) {
    const c = bySub.get(s.id);
    const key = c ? `need:${c.needId}` : `topic:${s.topic.trim().toLowerCase().replace(/\s+/g, " ")}`;
    const g = groups.get(key) ?? { needId: c?.needId ?? null, topic: s.topic.trim(), items: [], cons: [] };
    g.items.push(s); if (c) g.cons.push(c); groups.set(key, g);
  }
  const rank: Priority[] = ["alta", "media", "baixa"];
  return [...groups.values()].map((g) => {
    const prios = [...new Set(g.cons.map((c) => c.priority))];
    const origins: Partial<Record<Origin, number>> = {};
    for (const s of g.items) origins[s.origin] = (origins[s.origin] ?? 0) + 1;
    return {
      needId: g.needId, topic: g.topic, submissions: g.items.length, origins,
      schools: new Set(g.items.map((s) => s.schoolId).filter(Boolean)).size,
      priority: prios.length === 0 ? null : rank.find((r) => prios.includes(r))!,
      priorityReasons: g.cons.map((c) => c.priorityReason),
      conflictingPriorities: prios.length > 1,
    };
  }).sort((a, b) => (a.needId ? 0 : 1) - (b.needId ? 0 : 1) || a.topic.localeCompare(b.topic));
}
