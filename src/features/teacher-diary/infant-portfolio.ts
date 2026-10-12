/**
 * Docente LOTE 12 — Educação Infantil: portfólio e observações (núcleo puro).
 *
 * Reaproveita o existente: campos/objetivos em `curriculum-objectives-repository`,
 * experiências em `diary/infant-experiences.ts`, parecer em
 * `diary/infant-descriptive-report.ts`, acompanhamento gravado por `ei_record_followup`.
 * Aqui: registro de vivência/interação/brincadeira/portfólio versionado e a GUARDA
 * que impede nota, conceito, aprovação, reprovação ou retenção na EI.
 */
export type InfantEntryKind = "vivencia" | "interacao" | "brincadeira" | "portfolio" | "observacao";

export type InfantEntry = {
  entryId: string;
  version: number;
  supersedes?: string;
  childIds: readonly string[];
  classId: string;
  date: string;
  kind: InfantEntryKind;
  fieldIds: readonly string[]; // campos de experiência (ID canônico)
  objectiveIds: readonly string[]; // objetivos de aprendizagem (ID canônico)
  narrative: string;
  evidencePaths: readonly string[];
  shareWithFamily: boolean;
  authorId: string;
  recordedAt: string;
  reason?: string; // obrigatório a partir da v2
};

const FORBIDDEN = /\b(nota|conceito [A-E]\b|aprovad|reprovad|reten[cç][aã]o|retid[oa]|repet[eê]ncia|m[eé]dia|pontua[cç][aã]o|CID|laudo)/i;

/** EI não aceita valores numéricos nem decisões de trajetória por desempenho. */
export function infantGuard(narrative: string, extra?: { value?: unknown }): string[] {
  const e: string[] = [];
  if (extra && "value" in extra && extra.value !== undefined) e.push("Educação Infantil não recebe nota, conceito ou pontuação.");
  if (FORBIDDEN.test(narrative)) e.push("O registro da Educação Infantil é descritivo: não use nota, aprovação, reprovação, retenção nem diagnóstico.");
  return e;
}

export function validateEntry(
  e: Omit<InfantEntry, "version">,
  ctx: { myChildren: readonly string[]; knownFields: readonly string[]; knownObjectives: readonly string[]; isInfantClass: boolean },
): string[] {
  const out: string[] = [];
  if (!ctx.isInfantClass) out.push("Esta turma não é de Educação Infantil.");
  if (!e.childIds.length) out.push("Escolha ao menos uma criança.");
  if (e.childIds.some((c) => !ctx.myChildren.includes(c))) out.push("Só crianças das suas turmas.");
  if (!e.fieldIds.length) out.push("Indique ao menos um campo de experiência.");
  if (e.fieldIds.some((f) => !ctx.knownFields.includes(f))) out.push("Campo de experiência não reconhecido.");
  if (e.objectiveIds.some((o) => !ctx.knownObjectives.includes(o))) out.push("Objetivo de aprendizagem não reconhecido.");
  if (!e.narrative.trim()) out.push("Descreva o que foi observado.");
  if (e.evidencePaths.some((p) => !p.startsWith(`${e.authorId}/`))) out.push("Evidência fora da sua pasta.");
  out.push(...infantGuard(e.narrative));
  return out;
}

/** Nova versão: cabeça esperada, mesmo autor e motivo; a anterior permanece no histórico. */
export function nextEntryVersion(chain: readonly InfantEntry[], e: Omit<InfantEntry, "version">, expectedHead: number): InfantEntry {
  const mine = chain.filter((c) => c.entryId === e.entryId);
  const head = mine.reduce((m, c) => Math.max(m, c.version), 0);
  if (head !== expectedHead) throw new Error("O registro mudou antes; recarregue.");
  if (head > 0) {
    if (mine[0]!.authorId !== e.authorId) throw new Error("Só quem registrou pode corrigir.");
    if (!e.reason?.trim()) throw new Error("Informe o motivo da correção.");
  }
  return { ...e, version: head + 1, ...(head > 0 ? { supersedes: `${e.entryId}@${head}` } : {}) };
}

/** Portfólio da criança: versão vigente de cada registro, em ordem de data. */
export function childPortfolio(chain: readonly InfantEntry[], childId: string, audience: "docente" | "familia"): InfantEntry[] {
  const latest = new Map<string, InfantEntry>();
  for (const c of chain) if (c.childIds.includes(childId) && (latest.get(c.entryId)?.version ?? 0) < c.version) latest.set(c.entryId, c);
  return [...latest.values()]
    .filter((e) => audience === "docente" || e.shareWithFamily)
    .map((e) => (audience === "familia" && e.childIds.length > 1 ? { ...e, childIds: [childId] } : e)) // família não vê outras crianças
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Cobertura por campo: quantos registros por campo, sem escala nem juízo. */
export function fieldCoverage(entries: readonly InfantEntry[], fields: readonly string[]): { fieldId: string; entries: number }[] {
  return fields.map((f) => ({ fieldId: f, entries: entries.filter((e) => e.fieldIds.includes(f)).length }));
}
