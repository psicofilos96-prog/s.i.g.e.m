/**
 * CIECE Lote 11 — Fotografias históricas e consolidações (núcleo puro, nunca grava).
 * Fotografia lógica = (ano, etapa, data de referência, regra@versão, fontes com hash, knownAt, processamento)
 * + linhas de fato canônicas ordenadas + impressão digital. Reprodutível: mesma entrada ⇒ mesmo digest.
 * Revisão retroativa gera NOVA versão encadeada (supersedes); versão oficial anterior é congelada e
 * nunca reescrita. A persistência real continua em `census_snapshots` (imutável, 0166).
 */
export type FactRow = { factId: string; personId: string; enrollmentId: string; schoolId: string; classId: string | null; validFrom: string | null; validTo: string | null; version: number };
export type SourceRef = { name: string; sha256: string; knownAt: string };
export type SnapshotKey = { year: string; stageKey: string; referenceDate: string; ruleRef: string };
export type Snapshot = SnapshotKey & {
  version: number; supersedes: number | null; sources: SourceRef[]; knownAt: string; processedAt: string;
  rows: FactRow[]; counts: { pessoas: number; matriculas: number; porEscola: Record<string, number>; porTurma: Record<string, number> };
  excluded: { factId: string; reason: string }[]; digest: string; official: boolean;
};

function digestOf(s: unknown): string {
  const t = JSON.stringify(s); let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2654435761) >>> 0; }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** Só a cabeça de cada fato (maior versão) conhecida até knownAt e vigente na data entra; sem início ⇒ excluído. */
export function buildSnapshot(key: SnapshotKey, facts: (FactRow & { recordedAt: string })[], sources: SourceRef[], knownAt: string, processedAt: string, prev?: Snapshot): Snapshot {
  if (!sources.length) throw new Error("snapshot:sem-fonte");
  if (sources.some((s) => !s.sha256 || s.knownAt > knownAt)) throw new Error("snapshot:fonte-sem-hash-ou-posterior-ao-knownAt");
  const known = facts.filter((f) => f.recordedAt <= knownAt);
  const heads = new Map<string, FactRow>();
  for (const f of known) { const h = heads.get(f.factId); if (!h || f.version > h.version) heads.set(f.factId, f); }
  const rows: FactRow[] = []; const excluded: { factId: string; reason: string }[] = [];
  for (const f of [...heads.values()].sort((a, b) => a.factId.localeCompare(b.factId))) {
    if (!f.validFrom) { excluded.push({ factId: f.factId, reason: "inicio-nao-declarado" }); continue; }
    if (f.validFrom > key.referenceDate || (f.validTo !== null && f.validTo < key.referenceDate)) continue;
    const { factId, personId, enrollmentId, schoolId, classId, validFrom, validTo, version } = f;
    rows.push({ factId, personId, enrollmentId, schoolId, classId, validFrom, validTo, version });
  }
  const porEscola: Record<string, number> = {}, porTurma: Record<string, number> = {};
  const enr = new Set<string>();
  for (const r of rows) { if (!enr.has(r.enrollmentId)) { enr.add(r.enrollmentId); porEscola[r.schoolId] = (porEscola[r.schoolId] ?? 0) + 1; } if (r.classId) porTurma[r.classId] = (porTurma[r.classId] ?? 0) + 1; }
  const counts = { pessoas: new Set(rows.map((r) => r.personId)).size, matriculas: enr.size, porEscola, porTurma };
  const srcSorted = [...sources].sort((a, b) => a.name.localeCompare(b.name));
  const digest = digestOf({ key, sources: srcSorted, knownAt, rows, excluded });
  if (prev && (prev.year !== key.year || prev.stageKey !== key.stageKey || prev.referenceDate !== key.referenceDate)) throw new Error("snapshot:predecessor-de-outra-fotografia");
  return { ...key, version: prev ? prev.version + 1 : 1, supersedes: prev?.version ?? null, sources: srcSorted, knownAt, processedAt, rows, counts, excluded, digest, official: false };
}

/** Reprodução: recompõe com as mesmas entradas e exige o mesmo digest. */
export const reproduces = (s: Snapshot, rebuilt: Snapshot) => s.digest === rebuilt.digest;

/** Oficializar congela; cadeia oficial é append-only: nova versão nunca altera a anterior. */
export function officialize(chain: readonly Snapshot[], s: Snapshot): Snapshot[] {
  const last = chain.at(-1);
  if (last && s.supersedes !== last.version) throw new Error("snapshot:base-esperada-divergente");
  if (chain.some((c) => c.digest === s.digest)) throw new Error("snapshot:ja-oficializada");
  return [...chain.map((c) => Object.freeze({ ...c })), Object.freeze({ ...s, official: true })];
}

export type DiffReason = "entrada" | "saida" | "transferencia" | "mudanca-de-turma" | "correcao-tardia" | "regra-diferente" | "data-diferente";
export type DiffItem = { factId: string; reason: DiffReason; detail: string };

/** Explica divergência entre duas fotografias por fato — nunca só diferença de totais. */
export function compareSnapshots(a: Snapshot, b: Snapshot): { delta: { pessoas: number; matriculas: number }; items: DiffItem[]; context: DiffItem[] } {
  const context: DiffItem[] = [];
  if (a.ruleRef !== b.ruleRef) context.push({ factId: "*", reason: "regra-diferente", detail: `${a.ruleRef}→${b.ruleRef}` });
  if (a.referenceDate !== b.referenceDate) context.push({ factId: "*", reason: "data-diferente", detail: `${a.referenceDate}→${b.referenceDate}` });
  const ma = new Map(a.rows.map((r) => [r.factId, r])), mb = new Map(b.rows.map((r) => [r.factId, r]));
  const items: DiffItem[] = [];
  const byEnrA = new Map(a.rows.map((r) => [r.personId, r]));
  for (const [id, r] of mb) {
    const o = ma.get(id);
    if (!o) {
      const same = byEnrA.get(r.personId);
      if (same && !mb.has(same.factId) && same.schoolId !== r.schoolId) items.push({ factId: id, reason: "transferencia", detail: `${same.schoolId}→${r.schoolId}` });
      else items.push({ factId: id, reason: "entrada", detail: r.schoolId });
      continue;
    }
    if (o.version !== r.version) items.push({ factId: id, reason: "correcao-tardia", detail: `v${o.version}→v${r.version}` });
    else if (o.classId !== r.classId) items.push({ factId: id, reason: "mudanca-de-turma", detail: `${o.classId}→${r.classId}` });
  }
  const transferredFrom = new Set(items.filter((i) => i.reason === "transferencia").map((i) => mb.get(i.factId)!.personId));
  for (const [id, r] of ma) if (!mb.has(id) && !transferredFrom.has(r.personId)) items.push({ factId: id, reason: "saida", detail: r.schoolId });
  return { delta: { pessoas: b.counts.pessoas - a.counts.pessoas, matriculas: b.counts.matriculas - a.counts.matriculas }, items, context };
}
