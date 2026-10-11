/**
 * CIECE Lote 12 — Educacenso, GPE e integrações (núcleo puro, nunca transmite nem grava).
 * Reutiliza o kernel de importação (`data-import/import-kernel.ts`: hash, idempotência, exceções,
 * compensação) e os leiautes registrados (`educacenso_layout_specs`). Formato só é "comprovado" com
 * documento-fonte com hash e leiaute do mesmo ano; GPE segue sem contrato. Transmissão oficial só com
 * recibo verificável; identificadores nunca são presumidos equivalentes entre sistemas.
 */
import { idempotencyKey } from "@/features/data-import/import-kernel";

export type FormatId = string; // "educacenso:<ano>:<etapa>" | "gpe:..." — aberto
export type FormatRecord = {
  id: FormatId; system: "educacenso" | "gpe" | string; year: string; stageKey: string | null;
  sourceDoc: { title: string; sha256: string } | null; layoutVersion: number | null;
  inepConfronted: boolean; contract: string | null; officialBlockers: string[];
};
export type FormatStatus = "comprovado" | "conferencia-apenas" | "nao-comprovado";

/** Comprovado ⇒ documento com hash + leiaute + (Educacenso: confrontado; GPE: contrato) + sem bloqueios oficiais. */
export function formatStatus(f: FormatRecord): { status: FormatStatus; reasons: string[] } {
  const r: string[] = [];
  if (!f.sourceDoc?.sha256) r.push("sem-documento-fonte");
  if (f.layoutVersion === null) r.push("sem-leiaute-registrado");
  if (f.system === "gpe" && !f.contract) r.push("sem-contrato-gpe");
  if (r.length) return { status: "nao-comprovado", reasons: r };
  if (f.system === "educacenso" && !f.inepConfronted) r.push("leiaute-nao-confrontado-com-inep");
  r.push(...f.officialBlockers);
  return { status: r.length ? "conferencia-apenas" : "comprovado", reasons: r };
}

export type Artifact = "arquivo-oficial" | "arquivo-de-conferencia" | "demonstrativo" | "relatorio-de-rejeicao";
/** O que pode ser gerado: nada para formato não comprovado; arquivo oficial só quando comprovado. */
export function allowedArtifacts(f: FormatRecord): Artifact[] {
  const s = formatStatus(f).status;
  if (s === "nao-comprovado") return [];
  return s === "comprovado" ? ["arquivo-oficial", "arquivo-de-conferencia", "demonstrativo", "relatorio-de-rejeicao"] : ["arquivo-de-conferencia", "demonstrativo", "relatorio-de-rejeicao"];
}

/** Preflight: formato + bloqueios da conferência (L09) + identificadores obrigatórios presentes. */
export function preflight(f: FormatRecord, conferenceBlocked: boolean, conferenceReasons: string[], records: { id: string; inep: string | null; year: string | null }[]) {
  const fs = formatStatus(f); const reasons = [...fs.reasons];
  if (conferenceBlocked) reasons.push(...conferenceReasons.map((x) => `conferencia:${x}`));
  const missingInep = records.filter((r) => !r.inep).map((r) => r.id);
  const wrongYear = records.filter((r) => r.year !== f.year).map((r) => r.id);
  if (missingInep.length) reasons.push(`sem-inep:${missingInep.length}`);
  if (wrongYear.length) reasons.push(`ano-divergente:${wrongYear.length}`);
  const official = fs.status === "comprovado" && !conferenceBlocked && !missingInep.length && !wrongYear.length;
  return { formatStatus: fs.status, canGenerateOfficial: official, artifacts: official ? allowedArtifacts(f) : allowedArtifacts(f).filter((a) => a !== "arquivo-oficial"), reasons, missingInep, wrongYear };
}

/** Transmissão: declarada ≠ confirmada. Confirmada só com recibo importado do mesmo ano, escola e etapa. */
export type Receipt = { schoolInep: string; year: string; stageKey: string; protocol: string; sha256: string; issuedAt: string };
export function transmissionStatus(declared: { schoolInep: string; year: string; stageKey: string; protocol: string } | null, receipts: Receipt[]) {
  if (!declared) return { status: "nao-enviada" as const };
  const r = receipts.find((x) => x.schoolInep === declared.schoolInep && x.year === declared.year && x.stageKey === declared.stageKey);
  if (!r) return { status: "envio-declarado-sem-recibo" as const };
  if (r.protocol !== declared.protocol) return { status: "recibo-divergente" as const, receipt: r };
  if (!r.sha256) return { status: "envio-declarado-sem-recibo" as const };
  return { status: "recibo-verificado" as const, receipt: r };
}

/** Mapeamento de identificadores: só por chave explícita registrada; nome nunca concilia. */
export type IdSystem = "inep" | "ibge" | "interno" | "gpe";
export type IdLink = { from: { system: IdSystem; value: string; year: string }; to: { system: IdSystem; value: string; year: string }; evidence: string };
export function mapIdentifier(id: { system: IdSystem; value: string; year: string }, target: IdSystem, links: IdLink[]) {
  if (id.system === target) return { kind: "identico" as const, value: id.value };
  const m = links.filter((l) => l.from.system === id.system && l.from.value === id.value && l.from.year === id.year && l.to.system === target && l.evidence);
  if (m.length === 0) return { kind: "sem-correspondencia" as const };
  const vals = new Set(m.map((l) => `${l.to.value}|${l.to.year}`));
  if (vals.size > 1) return { kind: "ambiguo" as const, candidates: [...vals] };
  if (m[0]!.to.year !== id.year) return { kind: "ano-diferente" as const, value: m[0]!.to.value, year: m[0]!.to.year };
  return { kind: "mapeado" as const, value: m[0]!.to.value, evidence: m[0]!.evidence };
}

/** Importação: prévia com hash, idempotência, conciliação e quarentena; nada aplicado sem confirmação. */
export type IncomingRow = { locator: string; key: string; inep: string | null; internalMatches: string[] };
export type RowOutcome = "pronta" | "ja-importada" | "duplicada-no-arquivo" | "quarentena-ambigua" | "sem-correspondencia" | "rejeitada";
export function importPreview(adapter: string, version: number, sourceSha256: string, rows: IncomingRow[], alreadyApplied: ReadonlySet<string>, formatOk: boolean) {
  if (!formatOk) return { refused: "formato-nao-comprovado" as const, rows: [] };
  if (!/^[0-9a-f]{64}$/.test(sourceSha256)) return { refused: "hash-invalido" as const, rows: [] };
  const seen = new Map<string, number>(); rows.forEach((r) => seen.set(r.key, (seen.get(r.key) ?? 0) + 1));
  const out = rows.map((r) => {
    const ik = idempotencyKey(adapter, version, sourceSha256, r.key);
    let o: RowOutcome;
    if (!r.inep && !r.key) o = "rejeitada";
    else if (alreadyApplied.has(ik)) o = "ja-importada";
    else if ((seen.get(r.key) ?? 0) > 1) o = "duplicada-no-arquivo";
    else if (r.internalMatches.length > 1) o = "quarentena-ambigua";
    else if (r.internalMatches.length === 0) o = "sem-correspondencia";
    else o = "pronta";
    return { locator: r.locator, idempotencyKey: ik, outcome: o, target: o === "pronta" ? r.internalMatches[0]! : null };
  });
  return { refused: null, rows: out };
}

/** Rollback seguro: só compensação por eventos aplicados deste lote, em ordem inversa; nunca DELETE de fato. */
export function rollbackPlan(applied: { idempotencyKey: string; eventRef: string; batchSha256: string }[], batchSha256: string): string[] {
  return applied.filter((a) => a.batchSha256 === batchSha256).map((a) => `compensar:${a.eventRef}`).reverse();
}
