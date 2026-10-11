/**
 * CIECE Lote 10 — Situação do Aluno e resultados (núcleo puro, nunca grava nem calcula resultado).
 * Situação vem só do registro oficial (`register_academic_standings`, 12I) e movimentação só de
 * `student_movement_events` com tipo homologado; registros docentes são evidência, nunca resultado.
 * Mapeamento situação/movimentação → categoria censitária é regra versionada por (ano, segmento):
 * EI, EF e EJA declaram seus próprios valores admitidos (ex.: EI sem aprovação/reprovação) — nada fixo aqui.
 */
export type Segment = string; // "EI" | "EF" | "EJA" | ... — aberto
export type CensusCategory = "aprovado" | "reprovado" | "abandono" | "transferido" | "concluinte" | "falecido" | "sem-movimento" | string;

export type SituationRule = {
  id: string; version: number; year: string; segment: Segment; officialSource: string | null;
  /** valor oficial (situação ou tipo de movimentação homologado) → categoria censitária */
  map: Record<string, CensusCategory>;
  /** categorias admitidas nesse segmento; fora delas = inconsistência */
  admitted: CensusCategory[];
  /** data de corte da etapa (declarada) */
  cutoff: string | null;
};

export type EnrollmentInput = {
  enrollmentId: string; segment: Segment | null; closingRecorded: boolean | null;
  standing: { value: string; version: number; actRef: string; recordedAt: string } | null;
  movements: { typeId: string; homologated: boolean; effectiveOn: string | null; ref: string }[] | null;
  teacherEvidence: { kind: "frequencia" | "nota" | "parecer"; present: boolean }[] | null;
};

export type SituationStatus = "conferida" | "pendente" | "inconsistente" | "nao-verificavel";
export type SituationResult = {
  enrollmentId: string; status: SituationStatus; category: CensusCategory | null; reasons: string[];
  evidence: string[]; ruleRef: string | null;
};

const pick = (rules: SituationRule[], year: string, seg: Segment) => {
  const c = rules.filter((r) => r.year === year && r.segment === seg);
  if (c.length === 0) return { rule: null, why: "sem-regra-do-segmento" };
  const max = Math.max(...c.map((r) => r.version));
  const top = c.filter((r) => r.version === max);
  return top.length > 1 ? { rule: null, why: "regra-ambigua" } : { rule: top[0]!, why: "" };
};

export function conferSituation(year: string, rules: SituationRule[], e: EnrollmentInput): SituationResult {
  const base = { enrollmentId: e.enrollmentId, category: null as CensusCategory | null, evidence: [] as string[], ruleRef: null as string | null };
  if (!e.segment) return { ...base, status: "nao-verificavel", reasons: ["segmento-nao-declarado"] };
  const { rule, why } = pick(rules, year, e.segment);
  if (!rule) return { ...base, status: "nao-verificavel", reasons: [why] };
  const ruleRef = `${rule.id}@${rule.version}`;
  if (!rule.officialSource || !rule.cutoff) return { ...base, ruleRef, status: "nao-verificavel", reasons: ["regra-sem-fonte-ou-data-de-corte"] };
  if (e.movements === null) return { ...base, ruleRef, status: "nao-verificavel", reasons: ["movimentacoes-nao-lidas"] };

  const reasons: string[] = []; const evidence: string[] = [];
  const valid = e.movements.filter((m) => m.homologated && m.effectiveOn && m.effectiveOn <= rule.cutoff!);
  for (const m of e.movements) {
    if (!m.homologated) reasons.push(`movimentacao-tipo-nao-homologado:${m.ref}`);
    else if (!m.effectiveOn) reasons.push(`movimentacao-sem-data:${m.ref}`);
  }
  const last = valid.sort((a, b) => a.effectiveOn!.localeCompare(b.effectiveOn!)).at(-1);
  let category: CensusCategory | null = null;
  if (last) {
    category = rule.map[last.typeId] ?? null; evidence.push(`movimentacao ${last.ref} em ${last.effectiveOn}`);
    if (!category) reasons.push(`movimentacao-sem-mapeamento:${last.typeId}`);
  } else if (e.standing) {
    category = rule.map[e.standing.value] ?? null; evidence.push(`situacao oficial v${e.standing.version} (${e.standing.actRef})`);
    if (!category) reasons.push(`situacao-sem-mapeamento:${e.standing.value}`);
  } else {
    reasons.push("sem-situacao-oficial-registrada");
  }
  if (category && !rule.admitted.includes(category)) return { ...base, ruleRef, category, evidence, status: "inconsistente", reasons: [...reasons, `categoria-nao-admitida-no-segmento:${category}`] };
  // Movimentação e situação final ao mesmo tempo: transferência/abandono não convive com aprovação.
  if (last && e.standing && category && ["transferido", "abandono", "falecido"].includes(category)) reasons.push("situacao-final-e-movimentacao-simultaneas");
  if (e.standing && e.closingRecorded === false) reasons.push("situacao-sem-fechamento-do-ciclo");
  if (e.closingRecorded === null) reasons.push("fechamento-nao-lido");
  // Evidência docente só aponta lacuna; nunca produz resultado.
  if (e.teacherEvidence) for (const t of e.teacherEvidence) if (!t.present) reasons.push(`registro-docente-ausente:${t.kind}`);
  if (reasons.includes("situacao-final-e-movimentacao-simultaneas")) return { ...base, ruleRef, category, evidence, status: "inconsistente", reasons };
  return { ...base, ruleRef, category, evidence, status: reasons.length ? "pendente" : "conferida", reasons };
}

/** Retificação: nova versão oficial substitui a anterior; histórico preservado, nunca sobrescrito. */
export type RectificationEntry = { enrollmentId: string; fromVersion: number; toVersion: number; actRef: string; reason: string };
export function rectificationHistory(prev: SituationResult[], next: SituationResult[], inputs: EnrollmentInput[]): RectificationEntry[] | { error: string } {
  const out: RectificationEntry[] = [];
  for (const n of next) {
    const p = prev.find((x) => x.enrollmentId === n.enrollmentId); if (!p || p.category === n.category) continue;
    const inp = inputs.find((i) => i.enrollmentId === n.enrollmentId);
    const prevV = Number(/v(\d+)/.exec(p.evidence.join(" "))?.[1] ?? 0);
    if (!inp?.standing && !inp?.movements?.length) return { error: `mudanca-sem-ato-oficial:${n.enrollmentId}` };
    out.push({ enrollmentId: n.enrollmentId, fromVersion: prevV, toVersion: inp?.standing?.version ?? prevV, actRef: inp?.standing?.actRef ?? inp!.movements!.at(-1)!.ref, reason: `${p.category ?? "sem"}→${n.category ?? "sem"}` });
  }
  return out;
}

/** Totais por segmento/categoria: só conferidas entram; demais listadas, nunca somadas como zero. */
export function tally(results: SituationResult[], segmentOf: (id: string) => Segment | null) {
  const by: Record<string, Record<string, number>> = {}; const excluded: Record<SituationStatus, number> = { conferida: 0, pendente: 0, inconsistente: 0, "nao-verificavel": 0 };
  for (const r of results) {
    if (r.status !== "conferida" || !r.category) { excluded[r.status]++; continue; }
    const s = segmentOf(r.enrollmentId) ?? "?"; (by[s] ??= {})[r.category] = ((by[s] ??= {})[r.category] ?? 0) + 1;
  }
  return { bySegment: by, excluded, complete: excluded.pendente + excluded.inconsistente + excluded["nao-verificavel"] === 0 };
}
