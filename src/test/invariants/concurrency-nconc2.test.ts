import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { categorize, } from "@/lib/observability/governed-errors";

// NCONC.2 — códigos de corrida observados nas provas transacionais (supabase/tests/nconc2_*.sql, executadas
// com rollback; resultado em docs/concorrencia-nconc2.md). Cada um precisa chegar à pessoa como "conflito".
const OBSERVED = [
  "composition:stale-head",
  "draft:stale-head",
  "draft:closed",
  "base-superseded",
  "assignment:stale-head",
  "journey:stale-head",
  "calendar-day-type:base-superseded",
  "institutional-rule:stale-head",
  "institutional-rule:already-homologated",
  "aa:stale-head",
  "concurrent-change:stu-x",
  "idempotency:key-reused",
];

describe("NCONC.2 — corrida de duas gravações", () => {
  for (const code of OBSERVED) {
    it(`${code} vira conflito (mensagem humana), nunca falha técnica`, () => {
      expect(categorize(new Error(code))).toBe("conflito");
    });
  }

  it("toda prova NCONC.2 é transacional: termina em RAISE e não tem COMMIT", () => {
    for (const f of ["nconc2_a_turma_matricula_atribuicao", "nconc2_b_avaliacao", "nconc2_c_documentos", "nconc2_d_regras", "nconc2_e_calendario"]) {
      const p = join(process.cwd(), "supabase/tests", `${f}.sql`);
      expect(existsSync(p)).toBe(true);
      const s = readFileSync(p, "utf8");
      expect(s).toMatch(/RAISE EXCEPTION 'NCONC2-[A-Z]+-(PASS|PARCIAL)/);
      expect(s).not.toMatch(/^\s*COMMIT\b/im);
    }
  });
});
