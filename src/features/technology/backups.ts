// L18 Tecnologia — backup, execução e teste de restauração (0491). Afirmação final usa a regra única
// `backupClaim` (observabilidade): só "verificado" com restauração testada e checksum conferido.
import { backupClaim } from "@/lib/observability/admin-health";

export interface Plan { id: string; serviceKey: string; version: number; everyHours: number; restoreTestEveryDays: number | null; approved: boolean }
export interface Run { id: string; planId: string; endedAt: string; outcome: "sucesso" | "parcial" | "falha"; checksum: string | null; personId: string }
export interface RestoreTest { runId: string; testedAt: string; restoredChecksum: string | null; outcome: "restaurado" | "falha"; personId: string }

export function serviceBackupStatus(plans: readonly Plan[], runs: readonly Run[], tests: readonly RestoreTest[], now: string) {
  const plan = [...plans].sort((a, b) => b.version - a.version)[0];
  if (!plan || !plan.approved) return { plan: plan ? "pendente-de-aprovacao" : "sem-plano", claim: backupClaim(null), overdue: null, testOverdue: null };
  const own = runs.filter((r) => r.planId === plan.id && r.outcome !== "falha").sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  const last = own[0];
  // Teste válido: pessoa ≠ executor, restaurado e checksum igual ao do backup.
  const valid = (t: RestoreTest, r: Run) => t.personId !== r.personId && t.outcome === "restaurado" && !!r.checksum && t.restoredChecksum === r.checksum;
  const lastTest = own.flatMap((r) => tests.filter((t) => t.runId === r.id).map((t) => ({ t, ok: valid(t, r) })))
    .sort((a, b) => b.t.testedAt.localeCompare(a.t.testedAt))[0];
  const claim = backupClaim(last ? { provider: plan.serviceKey, takenAt: last.endedAt, restoreTestedAt: lastTest?.ok ? lastTest.t.testedAt : null, checksumMatched: lastTest ? lastTest.ok : null } : null);
  const hrs = (a: string) => (Date.parse(now) - Date.parse(a)) / 3_600_000;
  return {
    plan: "aprovado",
    claim,
    overdue: last ? hrs(last.endedAt) > plan.everyHours : true,
    testOverdue: plan.restoreTestEveryDays == null ? null : !lastTest?.ok || hrs(lastTest.t.testedAt) > plan.restoreTestEveryDays * 24,
  };
}
