/**
 * N4.4.1 — dry-run de escolas: código Educacenso da planilha × identificador INEP canônico.
 * Pura, sem gravação. Classes: exato | ausente-no-sigem | ambiguo (código repetido) | conflito (mesmo código, nome diferente).
 * Nome é só evidência de conflito; nunca corrige o cadastro.
 */
export type SourceSchool = { code: string; name: string };
export type CanonicalId = { schoolId: string; value: string; name: string | null };
export type Outcome = "exato" | "ausente-no-sigem" | "ambiguo" | "conflito";
export type DryRunRow = { code: string; outcome: Outcome; schoolIds: string[] };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const digits = (s: string) => String(s).replace(/\D/g, "");

export function schoolCodeDryRun(source: readonly SourceSchool[], canonical: readonly CanonicalId[]): DryRunRow[] {
  const byCode = new Map<string, CanonicalId[]>();
  for (const c of canonical) { const k = digits(c.value); byCode.set(k, [...(byCode.get(k) ?? []), c]); }
  const seen = new Map<string, number>();
  for (const s of source) { const k = digits(s.code); seen.set(k, (seen.get(k) ?? 0) + 1); }
  return [...new Set(source.map((s) => digits(s.code)))].filter(Boolean).sort().map((code) => {
    const hits = byCode.get(code) ?? [];
    const ids = [...new Set(hits.map((h) => h.schoolId))].sort();
    if ((seen.get(code) ?? 0) > 1 || ids.length > 1) return { code, outcome: "ambiguo", schoolIds: ids };
    if (!ids.length) return { code, outcome: "ausente-no-sigem", schoolIds: [] };
    const src = source.find((s) => digits(s.code) === code)!;
    const nm = hits[0]!.name;
    return { code, outcome: nm && norm(nm) !== norm(src.name) ? "conflito" : "exato", schoolIds: ids };
  });
}

export function dryRunSummary(rows: readonly DryRunRow[]): Record<Outcome, number> {
  const out: Record<Outcome, number> = { exato: 0, "ausente-no-sigem": 0, ambiguo: 0, conflito: 0 };
  for (const r of rows) out[r.outcome]++;
  return out;
}
