import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { serviceBackupStatus } from "./backups";

const H = "a".repeat(64), X = "b".repeat(64);
const plan = { id: "p", serviceKey: "diario", version: 1, everyHours: 24, restoreTestEveryDays: 30, approved: true };
const run = { id: "r", planId: "p", endedAt: "2026-10-12T00:00:00Z", outcome: "sucesso" as const, checksum: H, personId: "exec" };
const NOW = "2026-10-12T10:00:00Z";

describe("L18 backup e restauração", () => {
  it("sem plano aprovado não afirma nada", () => {
    expect(serviceBackupStatus([{ ...plan, approved: false }], [run], [], NOW).plan).toBe("pendente-de-aprovacao");
  });
  it("backup sem teste = não testado; vencimento por periodicidade do plano", () => {
    const s = serviceBackupStatus([plan], [run], [], NOW);
    expect(s.claim.state).toBe("nao-testado");
    expect(s.overdue).toBe(false);
    expect(s.testOverdue).toBe(true);
  });
  it("verificado só com teste por outra pessoa e checksum igual", () => {
    const ok = { runId: "r", testedAt: "2026-10-12T05:00:00Z", restoredChecksum: H, outcome: "restaurado" as const, personId: "qa" };
    expect(serviceBackupStatus([plan], [run], [ok], NOW).claim.state).toBe("verificado");
    expect(serviceBackupStatus([plan], [run], [{ ...ok, personId: "exec" }], NOW).claim.state).toBe("nao-testado");
    expect(serviceBackupStatus([plan], [run], [{ ...ok, restoredChecksum: X }], NOW).claim.state).toBe("nao-testado");
  });
  it("banco: plano com fonte e aprovação ≠ autor, evidência obrigatória, executor não testa", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.startsWith("0491"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    for (const s of ["autoaprovacao", "plano-nao-aprovado", "executor-nao-testa", "evidencia-nao-juntada", "servico-fora-do-catalogo"]) expect(sql).toContain(s);
    expect(sql).toMatch(/outcome <> 'sucesso' OR checksum IS NOT NULL/);
    expect(sql.match(/FROM PUBLIC, anon/g)!.length).toBe(4);
  });
});
