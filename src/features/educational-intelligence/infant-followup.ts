/** Lote 16 — acompanhamento da Educação Infantil (0375). Só projeção e validação espelhada;
 * nunca nota, promoção nem retenção; adaptação AEE/NEI é texto pedagógico, nunca clínico. */
export const EI_FIELDS = [
  { key: "eu-outro-nos", label: "O eu, o outro e o nós" },
  { key: "corpo-gestos", label: "Corpo, gestos e movimentos" },
  { key: "tracos-sons", label: "Traços, sons, cores e formas" },
  { key: "escuta-fala", label: "Escuta, fala, pensamento e imaginação" },
  { key: "espacos-tempos", label: "Espaços, tempos, quantidades, relações e transformações" },
] as const;
export type EiFieldKey = (typeof EI_FIELDS)[number]["key"];
export type EiModality = "regular" | "aee" | "tec" | "outra";
export const MODALITY_LABEL: Record<EiModality, string> = { regular: "Regular", aee: "AEE/NEI", tec: "TEC", outra: "Outra modalidade" };

export type EiFollowup = { id: string; logical_id: string; version: number; school_id: string; class_id: string; student_id: string; modality: EiModality;
  field_key: EiFieldKey; objective_code: string | null; observed_on: string; observation: string; evidence: string[]; adaptation_note: string | null; family_visible: boolean; reason: string | null; recorded_at: string };

const FORBIDDEN = /(reprova|retid|retenç|retenc|promovid|promoç|promoc|\bnota\b|\bcid\b|laudo|diagnóstic)/i;
export function validateFollowup(d: { field_key: string; observation: string; adaptation_note?: string | null; objective_code?: string | null; observed_on: string }): string[] {
  const e: string[] = [];
  if (!EI_FIELDS.some((f) => f.key === d.field_key)) e.push("Campo de experiência inválido.");
  if (d.observation.trim().length < 10) e.push("Observação descritiva com pelo menos 10 caracteres.");
  if (FORBIDDEN.test(d.observation) || FORBIDDEN.test(d.adaptation_note ?? "")) e.push("Sem nota, promoção, retenção ou dado clínico (CID, laudo, diagnóstico) na Educação Infantil.");
  if (d.objective_code && !/^EI0[1-3][A-Z]{2}\d{2}$/.test(d.objective_code)) e.push("Código de objetivo BNCC inválido (ex.: EI02EO01).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.observed_on)) e.push("Data da observação obrigatória.");
  return e;
}

/** Versão vigente por registro lógico; histórico preservado. */
export function currentFollowups(rows: EiFollowup[]) {
  const m = new Map<string, EiFollowup>();
  for (const r of rows) { const c = m.get(r.logical_id); if (!c || r.version > c.version) m.set(r.logical_id, r); }
  return [...m.values()];
}

/** Desenvolvimento por campo: contagem de observações e última data; campo sem registro aparece como lacuna, nunca como zero de desempenho. */
export function developmentByField(rows: EiFollowup[], studentId: string) {
  const cur = currentFollowups(rows).filter((r) => r.student_id === studentId);
  return EI_FIELDS.map((f) => {
    const rs = cur.filter((r) => r.field_key === f.key).sort((a, b) => a.observed_on.localeCompare(b.observed_on));
    return { ...f, observations: rs.length, last: rs.at(-1)?.observed_on ?? null, gap: rs.length === 0, timeline: rs };
  });
}
