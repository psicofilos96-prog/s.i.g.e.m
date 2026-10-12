// SIGEM 2.0 A&A Lote 17 — Relatórios e GED do setor. Núcleo puro que reaproveita:
// gerador universal (`reports/aa-report-sources.ts` + report-engine para PDF/XLSX),
// logos de `INSTITUTIONAL_LOGOS` e assinatura/retenção do `ged-core`.
import { INSTITUTIONAL_LOGOS } from "@/features/reports/report-analytics";
import { signatureLabel, retentionAction, attachmentAllowed, type Signature } from "@/features/document-studio/ged-core";

export const REPORT_SUBJECTS = ["escola", "turma", "estudante", "componente", "habilidade", "participacao", "desempenho", "evolucao", "intervencao", "reavaliacao", "rede"] as const;
export type ReportSubject = (typeof REPORT_SUBJECTS)[number];
const NOMINAL: ReadonlySet<ReportSubject> = new Set(["estudante"]);

export type Block = { kind: "cabecalho"; logoId: string; title: string } | { kind: "tabela"; queryRef: string } | { kind: "grafico"; queryRef: string; tableRef: string } | { kind: "nota-metodologica"; text: string } | { kind: "texto"; text: string };
export type ReportTemplate = { id: string; version: number; subject: ReportSubject; blocks: Block[]; formats: ("pdf" | "xlsx")[] };

export function validateTemplate(t: ReportTemplate): string[] {
  const p: string[] = [];
  if (!REPORT_SUBJECTS.includes(t.subject)) p.push("assunto fora do catálogo");
  if (!t.formats.length || t.formats.some(f => f !== "pdf" && f !== "xlsx")) p.push("formato só PDF/XLSX");
  const tables = new Set(t.blocks.filter(b => b.kind === "tabela").map(b => (b as { queryRef: string }).queryRef));
  for (const b of t.blocks) {
    if (b.kind === "cabecalho" && !INSTITUTIONAL_LOGOS.some(l => l.id === b.logoId)) p.push("brasão fora da lista institucional");
    if (b.kind === "grafico" && !tables.has(b.tableRef)) p.push("gráfico sem tabela equivalente");
    if ((b.kind === "texto" || b.kind === "nota-metodologica") && /<[a-z/!]/i.test(b.text)) p.push("texto com HTML recusado");
    if ("rows" in (b as object) || "data" in (b as object)) p.push("modelo não guarda dados");
  }
  if (!t.blocks.some(b => b.kind === "nota-metodologica")) p.push("nota metodológica obrigatória");
  return p;
}

export function canGenerate(subject: ReportSubject, v: { capability: boolean; nominalCapability: boolean; purpose: string | null }) {
  if (!v.capability) return { ok: false, reason: "sem capability de relatórios do setor" } as const;
  if (NOMINAL.has(subject) && (!v.nominalCapability || !v.purpose?.trim())) return { ok: false, reason: "relatório nominal exige capability própria e finalidade" } as const;
  return { ok: true } as const;
}

/** Assinatura: só pela própria pessoa designada como responsável; nunca por conta técnica. */
export function sign(p: { signer: { personId: string | null; technical: boolean }; responsibleIds: readonly string[]; signature: Signature }) {
  if (p.signer.technical || !p.signer.personId) return { ok: false, reason: "conta técnica ou sem pessoa natural não assina" } as const;
  if (!p.responsibleIds.includes(p.signer.personId)) return { ok: false, reason: "assinante não é responsável designado" } as const;
  if (p.signature.personId !== p.signer.personId) return { ok: false, reason: "assinatura só em nome próprio" } as const;
  const l = signatureLabel(p.signature);
  return l.ok ? { ok: true, label: l.label } as const : { ok: false, reason: l.label } as const;
}

// GED do setor: instrumentos, matrizes, gabaritos, rubricas, atas e evidências.
export const AA_DOC_KINDS = ["instrumento", "matriz", "gabarito", "rubrica", "ata", "evidencia"] as const;
export type AaDocKind = (typeof AA_DOC_KINDS)[number];
const RESTRICTED: ReadonlySet<AaDocKind> = new Set(["gabarito", "rubrica", "evidencia"]);
export type DocVersion = { docId: string; kind: AaDocKind; version: number; sha256: string; path: string; by: string; at: string; reason: string | null };

export function addVersion(chain: DocVersion[], next: Omit<DocVersion, "version">, expectedVersion: number): { ok: true; version: DocVersion } | { ok: false; reason: string } {
  const head = chain.at(-1)?.version ?? 0;
  if (head !== expectedVersion) return { ok: false, reason: "base desatualizada" };
  if (!/^[a-f0-9]{64}$/i.test(next.sha256)) return { ok: false, reason: "hash SHA-256 obrigatório" };
  if (!attachmentAllowed(next.path) || !next.path.startsWith(`aa/${next.kind}/${next.docId}/`)) return { ok: false, reason: "arquivo fora do prefixo privado do documento" };
  if (chain.some(v => v.sha256 === next.sha256)) return { ok: false, reason: "arquivo idêntico já versionado" };
  if (chain.length && !next.reason?.trim()) return { ok: false, reason: "nova versão exige motivo" };
  if (chain.length && chain[0]!.kind !== next.kind) return { ok: false, reason: "tipo do documento é imutável" };
  return { ok: true, version: { ...next, version: head + 1 } };
}

export function canRead(kind: AaDocKind, v: { capability: boolean; keyCapability: boolean; isAuthor: boolean }) {
  if (!v.capability) return false;
  return RESTRICTED.has(kind) ? v.keyCapability || v.isAuthor : true;
}

export const aaRetention = retentionAction;
