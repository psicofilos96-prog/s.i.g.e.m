// Lote 06 Secretaria por unidade: vida escolar cronológica, frequência oficial e resultados
// por matriz histórica (núcleo puro). Leitura só do que os readers canônicos devolveram com a
// sessão (student_school_life, chamadas oficiais do Diário, resultados registrados, matriz da
// versão congelada); correções só como nova versão encadeada com autor e motivo.

export interface Episode { enrollmentId: string; schoolId: string; year: string; from: string | null; to: string | null; classId: string | null; matrixVersionId: string | null }

/** Linha cronológica por ano: início ausente fica explícito e não ordena por data presumida. */
export function chronology(episodes: Episode[]) {
  return [...episodes].sort((a, b) => a.year.localeCompare(b.year) || (a.from ?? "9999").localeCompare(b.from ?? "9999"))
    .map((e) => ({ ...e, startLabel: e.from ?? "início não declarado" }));
}

// ---------- Frequência oficial ----------
export interface OfficialCall { date: string; classId: string; componentId: string | null; present: boolean | null; official: boolean }
export interface AttendanceSummary { classes: number | null; absences: number | null; unmarked: number; rate: number | null; reason: string | null }

/** Só chamadas oficiais dentro da vigência; sem marcação não é falta; sem chamada não há denominador. */
export function officialAttendance(calls: OfficialCall[], ep: Episode): AttendanceSummary {
  if (!ep.from) return { classes: null, absences: null, unmarked: 0, rate: null, reason: "início da matrícula não declarado" };
  const inScope = calls.filter((c) => c.official && c.classId === ep.classId && c.date >= ep.from! && (ep.to == null || c.date <= ep.to));
  const marked = inScope.filter((c) => c.present !== null);
  const unmarked = inScope.length - marked.length;
  if (!marked.length) return { classes: null, absences: null, unmarked, rate: null, reason: "sem chamada oficial registrada" };
  const absences = marked.filter((c) => c.present === false).length;
  return { classes: marked.length, absences, unmarked, rate: (marked.length - absences) / marked.length, reason: null };
}

// ---------- Resultados por matriz histórica ----------
export interface MatrixItem { matrixVersionId: string; componentId: string; label: string }
export interface ResultVersion { logicalId: string; version: number; enrollmentId: string; componentId: string; value: string; officialized: boolean; authorPrincipalId: string; human: boolean; reason: string | null; supersedes: number | null }

/** Componentes vêm da versão da matriz congelada no episódio, nunca da matriz atual. */
export function resultsByHistoricalMatrix(ep: Episode, items: MatrixItem[], results: ResultVersion[]) {
  if (!ep.matrixVersionId) return { matrixKnown: false as const, rows: [] };
  const rows = items.filter((i) => i.matrixVersionId === ep.matrixVersionId).map((i) => {
    const chain = results.filter((r) => r.enrollmentId === ep.enrollmentId && r.componentId === i.componentId).sort((a, b) => a.version - b.version);
    const cur = chain.at(-1);
    return { componentId: i.componentId, label: i.label, value: cur?.officialized ? cur.value : null, state: !cur ? "não registrado" : cur.officialized ? "oficial" : "não oficializado", author: cur?.authorPrincipalId ?? null, versions: chain.length };
  });
  return { matrixKnown: true as const, rows };
}

/** Correção = nova versão sobre a cabeça esperada, autor humano e motivo; autoria anterior preservada. */
export function correctResult(chain: ResultVersion[], next: { value: string; authorPrincipalId: string; human: boolean; reason: string }, expectedVersion: number): { ok: true; value: ResultVersion[] } | { ok: false; code: string } {
  const head = [...chain].sort((a, b) => a.version - b.version).at(-1);
  if (!head) return { ok: false, code: "nothing-to-correct" };
  if (head.version !== expectedVersion) return { ok: false, code: "stale-base" };
  if (!next.human) return { ok: false, code: "human-author-required" };
  if (!next.reason.trim()) return { ok: false, code: "reason-required" };
  if (next.value === head.value) return { ok: false, code: "no-change" };
  return { ok: true, value: [...chain, { ...head, version: head.version + 1, value: next.value, authorPrincipalId: next.authorPrincipalId, human: true, reason: next.reason, supersedes: head.version, officialized: false }] };
}
