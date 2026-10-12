/**
 * Organização da Rede L23 — GED de editais, atos, critérios e decisões.
 * Ledger append-only de versões: cada versão tem autor (pessoa natural),
 * instante, hash do conteúdo e base esperada (última versão). Revogação é
 * evento, nada é apagado. Executor técnico nunca grava. Autor de decisão
 * não pode ser o mesmo que publicou o critério que ela aplica (segregação).
 */
export type GedKind = "edital" | "ato" | "criterio" | "decisao";
export type GedVersion = Readonly<{
  docId: string; version: number; kind: GedKind; title: string; contentHash: string;
  authorPersonId: string | null; authorIsTechnical: boolean; recordedAt: string;
  validFrom: string | null; appliesCriterionDocId?: string | null;
  event: "publicacao" | "retificacao" | "revogacao"; justification: string | null;
}>;

export function validateGedVersion(v: GedVersion, ledger: readonly GedVersion[]): string[] {
  const errs: string[] = [];
  const hist = ledger.filter((x) => x.docId === v.docId);
  const last = hist.reduce((m, x) => Math.max(m, x.version), 0);
  if (!v.authorPersonId || v.authorIsTechnical) errs.push("autoria exige pessoa natural; executor técnico não grava");
  if (v.version !== last + 1) errs.push(`versão esperada ${last + 1}`);
  if (!/^[a-f0-9]{64}$/.test(v.contentHash)) errs.push("hash SHA-256 do conteúdo ausente");
  if (hist.length && hist[0]?.kind !== v.kind) errs.push("tipo do documento não muda");
  if (!hist.length && v.event !== "publicacao") errs.push("primeira versão deve ser publicação");
  if (hist.some((x) => x.event === "revogacao")) errs.push("documento revogado não recebe nova versão");
  if (v.event !== "publicacao" && !v.justification?.trim()) errs.push("retificação/revogação exige justificativa");
  if (v.kind === "decisao") {
    const crit = ledger.filter((x) => x.docId === v.appliesCriterionDocId && x.kind === "criterio");
    if (!crit.length) errs.push("decisão deve citar critério registrado");
    else if (crit.some((c) => c.authorPersonId === v.authorPersonId)) errs.push("autor da decisão não pode ser autor do critério");
  }
  return errs;
}

export function appendGed(v: GedVersion, ledger: readonly GedVersion[]): readonly GedVersion[] {
  const errs = validateGedVersion(v, ledger);
  if (errs.length) throw new Error(`ged:refused:${errs.join("; ")}`);
  return [...ledger, v];
}

export function gedHistory(docId: string, ledger: readonly GedVersion[]) {
  return ledger.filter((x) => x.docId === docId).sort((a, b) => a.version - b.version)
    .map((x) => ({ version: x.version, event: x.event, author: x.authorPersonId, at: x.recordedAt, hash: x.contentHash, justification: x.justification }));
}

/** Versão vigente na data; revogado ⇒ null. */
export function gedCurrent(docId: string, ledger: readonly GedVersion[], day: string, knownAt: string): GedVersion | null {
  const hist = ledger.filter((x) => x.docId === docId && x.recordedAt <= knownAt).sort((a, b) => a.version - b.version);
  if (!hist.length || hist.some((x) => x.event === "revogacao")) return null;
  const last = hist[hist.length - 1];
  if (!last) return null;
  return last.validFrom && last.validFrom <= day ? last : null;
}
