/**
 * LOTES 09/10 — validação por campo e geração determinística do arquivo de CONFERÊNCIA.
 * Usa o mesmo catálogo do parser (generateFile/checkField); valores vêm só das projeções
 * (identidade da escola), nunca de suposição. Arquivo oficial é recusado enquanto
 * officialBlockers não estiver vazio — o manifesto registra isso.
 */
import { checkField, generateFile, officialBlockers, recordSpec, type Issue, type LayoutSpec } from "./layout/layout-schema";
import type { SchoolIdentity } from "./school-identity";

export type Classified = Issue & { impeditive: boolean };
export type Manifest = {
  kind: "conferencia"; official: false; year: string; terminator: "pipe" | "sem-pipe";
  specSha256: string; inepConfronted: boolean; fileSha256: string | null;
  records: Record<string, number>; impeditive: number; alerts: number; blockers: string[]; generatedAt: string;
};

/** Registro 00 com só os campos que têm fonte; o resto fica vazio (e vira inconsistência se obrigatório). */
export function record00Values(spec: LayoutSpec, id: SchoolIdentity): string[] {
  const rec = recordSpec(spec, "00");
  if (!rec) throw new Error("registro 00 ausente no catálogo");
  const known = new Map<number, string>([[1, "00"]]);
  for (const f of id.fields) if (f.value && (f.state === "informado" || f.state === "divergente")) known.set(f.n, f.value);
  // Campos com lista de códigos só aceitam código do catálogo; texto literal da fonte não é convertido aqui.
  for (const [n, v] of known) {
    const fs = rec.fields.find((f) => f.n === n);
    if (fs?.codes && !fs.codes.truncated && fs.codes.list.length > 2 && !fs.codes.list.some((c) => c.code === v)) known.delete(n);
  }
  return rec.fields.map((f) => known.get(f.n) ?? "");
}

/** Impeditiva = erro de campo (obrigatório vazio, código/tamanho inválido); alerta = o resto. */
export function validateLines(spec: LayoutSpec, lines: { record: string; values: string[] }[]): Classified[] {
  const out: Classified[] = [];
  lines.forEach((l, i) => {
    const rec = recordSpec(spec, l.record); if (!rec) return;
    rec.fields.forEach((f, k) => {
      const v = l.values[k] ?? "";
      if (f.obligation === "condicional" && v === "") { out.push({ severity: "aviso", line: i + 1, record: l.record, field: f.n, code: "condicional-vazio", text: `${f.name}: condicional sem regra modelada — conferir`, impeditive: false }); return; }
      for (const is of checkField(rec, f, v, i + 1)) out.push({ ...is, impeditive: is.severity === "erro" });
    });
  });
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gera conferência só sem impeditivo; sempre devolve manifesto (com bloqueios oficiais). */
export async function buildConferenceFile(spec: LayoutSpec, identities: SchoolIdentity[], terminator: "pipe" | "sem-pipe", now = new Date()) {
  const sorted = [...identities].sort((a, b) => (a.inep ?? a.schoolId).localeCompare(b.inep ?? b.schoolId));
  const lines = sorted.map((id) => ({ record: "00", values: record00Values(spec, id) }));
  const issues = validateLines(spec, lines);
  const impeditive = issues.filter((i) => i.impeditive);
  const text = impeditive.length ? null : generateFile(spec, lines, { mode: "conferencia", terminator }).text;
  const manifest: Manifest = {
    kind: "conferencia", official: false, year: spec.year, terminator, specSha256: spec.source.sha256, inepConfronted: spec.source.inepConfronted,
    fileSha256: text ? await sha256Hex(text) : null, records: { "00": lines.length }, impeditive: impeditive.length,
    alerts: issues.length - impeditive.length, blockers: officialBlockers(spec).map((b) => b.code), generatedAt: now.toISOString(),
  };
  return { text, issues, manifest };
}

/** LOTE 11 — retorno do INEP: sem leiaute de retorno documentado, recusa (nunca marca aceito). */
export function parseReturnFile(_text: string): { accepted: false; reason: "leiaute-de-retorno-ausente" } {
  return { accepted: false, reason: "leiaute-de-retorno-ausente" };
}
