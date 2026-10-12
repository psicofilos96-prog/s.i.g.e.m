/**
 * Docente LOTE 09 — Atividades e biblioteca de materiais (núcleo puro).
 *
 * Atividade pertence a uma regência vigente (turma × componente × docente) e usa
 * habilidades só por ref canônica (skill-links). Materiais são versões append-only;
 * compartilhamento é concessão explícita: docente só com atuação vigente na mesma
 * escola; família só da turma da atividade e com licença que permita. Anexos só por
 * caminho no prefixo do próprio autor.
 */
export type ActivityKind = string; // exercício, projeto, pesquisa, prática, trabalho, recuperação... (aberto)

export type ActivityDraft = {
  kind: ActivityKind;
  title: string;
  classId: string;
  assignmentId: string;
  skillRefs: readonly { itemId: string; editionId: string }[];
  assignedOn: string;
  dueOn: string;
  instructions: string;
  criteria: readonly { label: string; weight: number | null }[]; // peso ausente ≠ 0
  attachments: readonly string[]; // caminhos de storage
  recoveryOf?: string | null; // atividade de recuperação referencia a original
};

export function validateActivity(
  a: ActivityDraft,
  ctx: { authorId: string; assignment: { id: string; classId: string; start: string; end?: string | null } | null; knownKinds: readonly string[] },
): string[] {
  const e: string[] = [];
  if (!ctx.assignment || ctx.assignment.id !== a.assignmentId || ctx.assignment.classId !== a.classId) e.push("Você não tem atribuição nesta turma.");
  else if (a.assignedOn < ctx.assignment.start || (ctx.assignment.end && a.dueOn > ctx.assignment.end)) e.push("As datas devem caber na sua atribuição.");
  if (!ctx.knownKinds.includes(a.kind)) e.push(`Tipo "${a.kind}" não está cadastrado.`);
  if (!a.title.trim()) e.push("Informe o título.");
  if (!a.instructions.trim()) e.push("Escreva as instruções para os estudantes.");
  if (a.dueOn < a.assignedOn) e.push("O prazo não pode ser antes da data de entrega da atividade.");
  if (a.criteria.some((c) => !c.label.trim())) e.push("Todo critério precisa de descrição.");
  if (a.criteria.some((c) => c.weight !== null && c.weight < 0)) e.push("Peso de critério não pode ser negativo.");
  if (a.attachments.some((p) => !p.startsWith(`${ctx.authorId}/`))) e.push("Anexo fora da sua pasta não é aceito.");
  if (a.kind === "recuperação" && !a.recoveryOf) e.push("Recuperação deve indicar a atividade original.");
  return e;
}

// ---------- Biblioteca ----------
export type License = "uso-interno" | "cc-by" | "cc-by-sa" | "cc-by-nc" | "dominio-publico" | "desconhecida";
export type MaterialVersion = {
  materialId: string; version: number; authorId: string; schoolId: string;
  title: string; folder: string; tags: readonly string[]; license: License; filePath: string; createdAt: string;
};
export type ShareGrant =
  | { materialId: string; to: "docente"; personId: string; grantedBy: string; at: string; revokedAt?: string }
  | { materialId: string; to: "familias"; classId: string; grantedBy: string; at: string; revokedAt?: string };

export function nextVersion(chain: readonly MaterialVersion[], v: Omit<MaterialVersion, "version">, expectedHead: number): MaterialVersion {
  const head = chain.filter((c) => c.materialId === v.materialId).reduce((m, c) => Math.max(m, c.version), 0);
  if (head !== expectedHead) throw new Error("O material foi alterado por outra versão; recarregue.");
  if (head > 0 && chain.find((c) => c.materialId === v.materialId)!.authorId !== v.authorId) throw new Error("Só a autora ou o autor cria novas versões.");
  if (!v.filePath.startsWith(`${v.authorId}/`)) throw new Error("Arquivo fora da sua pasta.");
  return { ...v, version: head + 1 };
}

export const currentVersion = (chain: readonly MaterialVersion[], id: string) =>
  chain.filter((c) => c.materialId === id).sort((a, b) => b.version - a.version)[0];

export function searchLibrary(chain: readonly MaterialVersion[], q: { text?: string; folder?: string; tag?: string }): MaterialVersion[] {
  const n = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ids = [...new Set(chain.map((c) => c.materialId))];
  return ids
    .map((id) => currentVersion(chain, id)!)
    .filter((m) => (!q.folder || m.folder === q.folder) && (!q.tag || m.tags.includes(q.tag)))
    .filter((m) => !q.text || n(q.text).split(/\s+/).every((w) => n(`${m.title} ${m.tags.join(" ")}`).includes(w)))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function canGrant(
  m: MaterialVersion,
  g: ShareGrant,
  ctx: { colleaguesInSchool: readonly string[]; myClasses: readonly string[] },
): { ok: boolean; reason?: string } {
  if (g.grantedBy !== m.authorId) return { ok: false, reason: "Só quem criou o material pode compartilhá-lo." };
  if (g.to === "docente") {
    if (!ctx.colleaguesInSchool.includes(g.personId)) return { ok: false, reason: "A pessoa não tem atuação vigente na sua escola." };
    return { ok: true };
  }
  if (!ctx.myClasses.includes(g.classId)) return { ok: false, reason: "Você só compartilha com famílias das suas turmas." };
  if (m.license === "desconhecida" || m.license === "uso-interno") return { ok: false, reason: "A licença do material não permite enviar às famílias." };
  return { ok: true };
}

/** Quem pode ler: autor; docente com concessão ativa; família de turma com concessão ativa. */
export function canRead(m: MaterialVersion, grants: readonly ShareGrant[], who: { personId: string; familyClassIds?: readonly string[] }): boolean {
  if (who.personId === m.authorId) return true;
  return grants.some((g) => g.materialId === m.materialId && !g.revokedAt &&
    (g.to === "docente" ? g.personId === who.personId : (who.familyClassIds ?? []).includes(g.classId)));
}
