/**
 * N5.3.2 — Projeção pura da composição da turma (class_composition_at) cruzada com a posição curricular
 * individual de cada estudante (allocation_curricular_positions_at, B3.3). Consumida pela Secretaria,
 * Mapa Estrutura III e Diário. Nunca infere a posição pela turma: sem posição válida ⇒ "não registrada".
 */
export type PositionRef = { scheme: string; value: string; version?: number };
export type StudentPositionRow = { studentId: string; axes: PositionRef[] | null };

export const POSITION_NOT_RECORDED = "Posição curricular não registrada";

const key = (p: PositionRef) => `${p.scheme}::${p.value}`;

/** "1º ano", "1º ano e 2º ano", "1º ano, 2º ano e 3º ano" — a partir dos rótulos homologados, sem abreviar norma. */
export function compositionPhrase(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export type CompositionBreakdown = {
  /** Estudantes únicos na turma (nunca soma de subtotais). */
  total: number;
  rows: { key: string; position: PositionRef; count: number }[];
  notRecorded: number;
  /** Posição de cada estudante: chave da composição ou null quando não registrada/ambígua/fora da composição. */
  byStudent: Map<string, string | null>;
};

export function compositionBreakdown(positions: readonly PositionRef[], students: readonly StudentPositionRow[]): CompositionBreakdown {
  const keys = new Set(positions.map(key));
  const byStudent = new Map<string, string | null>();
  for (const s of students) {
    if (byStudent.has(s.studentId) && byStudent.get(s.studentId) !== null) continue;
    const hits = [...new Set((s.axes ?? []).map(key).filter((k) => keys.has(k)))];
    byStudent.set(s.studentId, hits.length === 1 ? hits[0]! : null);
  }
  const counts = new Map<string, number>();
  for (const v of byStudent.values()) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return {
    total: byStudent.size,
    rows: positions.map((p) => ({ key: key(p), position: p, count: counts.get(key(p)) ?? 0 })),
    notRecorded: [...byStudent.values()].filter((v) => v === null).length,
    byStudent,
  };
}

export const positionKey = key;
