import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { categorize } from "@/lib/observability/governed-errors";

const DIR = join(process.cwd(), "drizzle/migrations");
const latest = new Map<string, string>();
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) {
  const s = readFileSync(join(DIR, f), "utf8");
  for (const m of s.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.([a-z0-9_]+)\(([\s\S]*?)(?:\$fn\$;|\$\$;)/g)) latest.set(m[1] ?? "", m[2] ?? "");
}
const body = (n: string) => {
  const b = latest.get(n);
  if (!b) throw new Error(`writer ausente: ${n}`);
  return b;
};

// Writers críticos com cabeça esperada: trava antes da comparação, conflito com código próprio.
const STALE_HEAD: Array<[string, string]> = [
  ["record_teaching_assignment_version_v2", "assignment:stale-head"],
  ["record_class_journey_version", "journey:stale-head"],
  ["homologate_calendar_version", "calendar-homologation:base-superseded"],
  ["record_calendar_external_profile", "calendar-external:base-superseded"],
  ["record_map_cell_adjustment", "map:stale-head"],
  ["return_statistical_map", "map:stale-head"],
  ["officialize_statistical_map", "map:stale-head"],
  ["register_capability_policy_draft_expected", "policy:stale-head"],
  ["enrollment_draft_save", "draft:stale-head"],
  ["enrollment_draft_complete", "draft:stale-head"],
  ["record_school_document_template_version", "base-superseded"],
  ["sec_allocate_core", "secretariat:active-class-exists"],
  ["secretariat_reassign_class", "base-superseded"],
];

describe("NCONC.1 — concorrência e cabeça esperada", () => {
  for (const [fn, code] of STALE_HEAD) {
    it(`${fn}: trava antes de comparar a cabeça e recusa com ${code}`, () => {
      const b = body(fn);
      const lock = b.search(/advisory_xact_lock|FOR UPDATE/);
      const check = b.indexOf(code);
      expect(lock).toBeGreaterThanOrEqual(0);
      expect(check).toBeGreaterThan(lock);
    });
  }

  it("rascunho de política serializa por política lógica (0242)", () => {
    expect(body("register_capability_policy_draft_expected")).toContain("'policy-logical:'");
  });

  it("nenhum par de travas consultivas é adquirido em ordens opostas (sem deadlock evitável)", () => {
    const pairs = new Set<string>();
    for (const b of latest.values()) {
      const seen: string[] = [];
      for (const m of b.matchAll(/advisory_xact_lock\([^;]*?'([a-z0-9-]+):/g)) { const k = m[1] ?? ""; if (!seen.includes(k)) seen.push(k); }
      for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) pairs.add(`${seen[i]}>${seen[j]}`);
    }
    const inverted = [...pairs].filter((p) => { const [a, c] = p.split(">"); return a !== c && pairs.has(`${c}>${a}`); });
    expect(inverted).toEqual([]);
  });

  it("erros de corrida do banco viram 'conflito', nunca falha técnica", () => {
    for (const msg of [
      "map:stale-head",
      "calendar:base-superseded",
      'duplicate key value violates unique constraint "capability_policies_logical_policy_id_version_key"',
      "deadlock detected",
      "secretariat:active-class-exists",
      "could not serialize access due to concurrent update",
    ]) expect(categorize(new Error(msg))).toBe("conflito");
  });
});
