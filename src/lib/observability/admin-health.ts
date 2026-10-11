/**
 * Lote 12 (Expansão) — Centro de Administração e Evolução: núcleo puro sobre `/diagnostico`.
 * Status só de verificação executada; backup só com evidência de restauração testada;
 * operador técnico ≠ pessoa; segredo nunca lido, só metadados de rotação.
 */

export type Check = Readonly<{ module: string; ranAt: string | null; ok: boolean | null }>;
export type ModuleStatus = "ok" | "falha" | "nao-verificado" | "verificacao-antiga";

/** Sem verificação recente nunca é "ok". */
export function moduleStatus(c: Check, now: string, maxAgeMinutes: number): ModuleStatus {
  if (c.ranAt == null || c.ok == null) return "nao-verificado";
  if ((Date.parse(now) - Date.parse(c.ranAt)) / 60_000 > maxAgeMinutes) return "verificacao-antiga";
  return c.ok ? "ok" : "falha";
}

/** Backup: só se afirma com restauração testada, com hash conferido e data. */
export type BackupEvidence = Readonly<{ takenAt: string | null; restoreTestedAt: string | null; checksumMatched: boolean | null; provider: string | null }>;
export function backupClaim(e: BackupEvidence | null) {
  if (!e || !e.provider || !e.takenAt) return { state: "sem-evidencia" as const, text: "Não há evidência de backup registrada." };
  if (!e.restoreTestedAt || e.checksumMatched !== true) return { state: "nao-testado" as const, text: `Backup informado em ${e.takenAt}, restauração não testada.` };
  return { state: "verificado" as const, text: `Restauração testada em ${e.restoreTestedAt} com conferência de integridade.` };
}

/** Ator: natureza explícita; operador técnico nunca recebe capability humana nem bypass geral. */
export type Actor = Readonly<{ id: string; nature: "pessoa-natural" | "orgao-institucional" | "operador-tecnico"; capabilities: readonly string[] }>;
const HUMAN_ONLY = /homolog|oficializ|aprov|assin|conced|revog|decid/i;
export function actorIssues(a: Actor): string[] {
  const out: string[] = [];
  if (a.nature === "operador-tecnico") {
    for (const c of a.capabilities) if (HUMAN_ONLY.test(c)) out.push(`capacidade-humana:${c}`);
    if (a.capabilities.includes("*")) out.push("curinga");
  }
  return out;
}

/** Segredos: só nome e data de rotação; prazo só configurado. */
export function secretRotation(s: { name: string; rotatedAt: string | null }, maxDays: number | null, today: string) {
  if (maxDays == null) return { name: s.name, state: "sem-politica" as const };
  if (s.rotatedAt == null) return { name: s.name, state: "sem-registro" as const };
  const age = (Date.parse(today) - Date.parse(s.rotatedAt)) / 86_400_000;
  return { name: s.name, state: age > maxDays ? "vencido" as const : "em-dia" as const };
}

/** Alertas: só sobre falhas observadas, deduplicados por módulo. */
export function alertsFrom(statuses: readonly { module: string; status: ModuleStatus }[]) {
  return [...new Set(statuses.filter((s) => s.status === "falha" || s.status === "verificacao-antiga").map((s) => s.module))].sort();
}
