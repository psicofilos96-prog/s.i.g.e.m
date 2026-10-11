/**
 * SIGEM 2.0 — D: prontidão dos documentos da Secretaria. Projeção pura sobre contagens já lidas;
 * documento só é emissível se o banco o compõe (`school_document_composable_kinds`) e suas fontes existem.
 * Fonte ausente bloqueia por extenso; nunca vira zero nem campo em branco impresso.
 */
export type DocKind = "declaracao-de-matricula" | "declaracao-escolar" | "transferencia" | "historico" | "ficha-individual" | "boletim" | "ata" | "ficha-cadastral";
export type Sources = Readonly<{ composable: readonly string[]; matrices: number | null; collegialMinutes: number | null; closings: number | null; enrollmentStartsDeclared: number | null }>;

const NEEDS: Record<DocKind, readonly (keyof Omit<Sources, "composable">)[]> = {
  "declaracao-de-matricula": ["enrollmentStartsDeclared"],
  "declaracao-escolar": ["enrollmentStartsDeclared"],
  transferencia: ["enrollmentStartsDeclared", "matrices", "closings"],
  historico: ["matrices", "closings"],
  "ficha-individual": ["matrices", "closings"],
  boletim: ["matrices", "closings"],
  ata: ["collegialMinutes"],
  "ficha-cadastral": [],
};

export function documentReadiness(kind: DocKind, s: Sources) {
  const blockers: string[] = [];
  if (!s.composable.includes(kind)) blockers.push("modelo-nao-composto-pelo-banco");
  for (const k of NEEDS[kind]) {
    const v = s[k];
    if (v == null) blockers.push(`${k}:nao-lido`);
    else if (v === 0) blockers.push(`${k}:sem-registro`);
  }
  return { kind, ready: blockers.length === 0, blockers };
}

/** Impressão em lote: item bloqueado nunca some do resultado. */
export function batchPrint<T extends { id: string; ready: boolean }>(items: readonly T[]) {
  return { printable: items.filter((i) => i.ready).map((i) => i.id), refused: items.filter((i) => !i.ready).map((i) => i.id), total: items.length };
}
