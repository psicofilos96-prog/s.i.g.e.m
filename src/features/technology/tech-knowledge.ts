// L19 Tecnologia — biblioteca técnica e autosserviço (0492). Artigo = documento da Base de Conhecimento
// (busca e ACL pelo `kb_search`, nunca cópia); aqui só vínculos validados e retorno agregado.
export interface KbLink { id: string; docId: string; targetKind: "categoria-de-chamado" | "servico-digital"; targetKey: string; action: "vincular" | "desvincular"; personId: string; createdAt: string }
export interface KbValidation { linkId: string; personId: string }

/** Vínculos vigentes: último ato validado por pessoa ≠ autor por (doc, alvo); não validado não conta. */
export function activeLinks(links: readonly KbLink[], vals: readonly KbValidation[]) {
  const ok = (l: KbLink) => vals.some((v) => v.linkId === l.id && v.personId !== l.personId);
  const last = new Map<string, KbLink>();
  for (const l of [...links].filter(ok).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) last.set(`${l.docId}|${l.targetKind}|${l.targetKey}`, l);
  return [...last.values()].filter((l) => l.action === "vincular");
}

/** Sugestão antes de abrir chamado: só artigos vinculados e que o usuário pode ler (lista vinda do kb_search). */
export function suggestFor(target: { kind: KbLink["targetKind"]; key: string }, links: ReturnType<typeof activeLinks>, readableDocIds: ReadonlySet<string>) {
  return links.filter((l) => l.targetKind === target.kind && l.targetKey === target.key && readableDocIds.has(l.docId)).map((l) => l.docId);
}

/** Taxa de resolução só com volume mínimo DECLARADO; sem limiar, null (nunca taxa de 1 resposta). */
export function resolutionRate(s: { resolved: number; notResolved: number }, minResponses: number | null) {
  const n = s.resolved + s.notResolved;
  if (minResponses == null || n < minResponses) return null;
  return s.resolved / n;
}
