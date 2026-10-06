// AW — verificações de integridade puras. Só detectam; nunca corrigem nem gravam.
export type Finding = Readonly<{ check: string; key: string; detail: string }>;

export type VersionRow = Readonly<{ id: string; logicalId: string; version: number; supersedesId?: string | null; validFrom?: string | null; validTo?: string | null }>;

/** Cadeia versionada: versões 1..n sem lacuna/duplicata, predecessor existente, um único head, vigência possível. */
export function checkVersionChains(rows: readonly VersionRow[]): Finding[] {
  const out: Finding[] = [];
  const ids = new Set(rows.map((r) => r.id));
  const superseded = new Set(rows.map((r) => r.supersedesId).filter((x): x is string => !!x));
  const byLogical = new Map<string, VersionRow[]>();
  for (const r of rows) byLogical.set(r.logicalId, [...(byLogical.get(r.logicalId) ?? []), r]);
  for (const [key, list] of byLogical) {
    const vs = list.map((r) => r.version).sort((a, b) => a - b);
    if (new Set(vs).size !== vs.length) out.push({ check: "versao-duplicada", key, detail: "Duas versões com o mesmo número." });
    else if (vs.some((v, i) => v !== i + 1)) out.push({ check: "lacuna-de-versao", key, detail: "Sequência de versões não é contínua a partir de 1." });
    const heads = list.filter((r) => !superseded.has(r.id));
    if (heads.length !== 1) out.push({ check: "head-ambiguo", key, detail: `${heads.length} versões vigentes na cadeia.` });
  }
  for (const r of rows) {
    if (r.supersedesId && !ids.has(r.supersedesId)) out.push({ check: "predecessor-orfao", key: r.logicalId, detail: "Versão aponta para predecessor inexistente." });
    if (r.validFrom && r.validTo && r.validTo < r.validFrom) out.push({ check: "vigencia-impossivel", key: r.logicalId, detail: "Fim de vigência anterior ao início." });
  }
  return out;
}

/** Referências: todo filho aponta para um pai existente. */
export function checkOrphans(check: string, childRefs: readonly { key: string; parentId: string }[], parentIds: ReadonlySet<string>): Finding[] {
  return childRefs.filter((c) => !parentIds.has(c.parentId)).map((c) => ({ check, key: c.key, detail: "Referência a registro inexistente." }));
}

/** Snapshot: impressão digital recalculada deve coincidir com a gravada. */
export async function checkFingerprint(key: string, content: string, storedSha256: string): Promise<Finding[]> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === storedSha256 ? [] : [{ check: "fingerprint-divergente", key, detail: "Conteúdo do snapshot não confere com a impressão digital." }];
}

/** Drift: migrations esperadas × registradas no manifesto congelado. Ausente, extra ou hash diferente = falha visível. */
export function checkMigrationDrift(expected: Readonly<Record<string, string>>, actual: Readonly<Record<string, string>>): Finding[] {
  const out: Finding[] = [];
  for (const [f, h] of Object.entries(expected)) {
    if (!(f in actual)) out.push({ check: "migration-ausente", key: f, detail: "Esperada e não encontrada." });
    else if (actual[f] !== h) out.push({ check: "migration-alterada", key: f, detail: "Conteúdo difere do congelado (migration histórica é imutável)." });
  }
  for (const f of Object.keys(actual)) if (!(f in expected)) out.push({ check: "migration-nao-congelada", key: f, detail: "Nova migration fora do manifesto." });
  return out;
}

export const PLATFORM_BACKUP_RESTORE = "PLATFORM_BACKUP_RESTORE_VALIDATION_PENDING" as const;
