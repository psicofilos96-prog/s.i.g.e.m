import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// NSTUDENT.1 — após remanejamento/transferência/saída, nenhuma leitura de "aluno na turma/escola"
// pode aceitar enturmação já encerrada. Confere a ÚLTIMA definição de cada função nas migrations.
const DIR = join(process.cwd(), "drizzle/migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
function lastDefinition(name: string): string {
  let body = "";
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), "utf8");
    const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(([\\s\\S]*?)END \\$function\\$`, "g");
    for (const m of sql.matchAll(re)) body = m[0];
  }
  return body;
}

describe("NSTUDENT.1 — leituras de enturmação respeitam o término", () => {
  for (const fn of ["record_attendance_occurrence", "record_student_card", "year_preparation_summary"]) {
    it(`${fn} considera término e versão substituída`, () => {
      const body = lastDefinition(fn);
      expect(body).not.toBe("");
      expect(body).toContain("b3_allocation_ended_on");
      expect(body).toMatch(/supersedes_id = (e|ep)\.id/);
    });
  }
});
