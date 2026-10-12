/**
 * PERFIL MEDIADOR — LOTE 10 Participação e autonomia (núcleo puro).
 * Observação = fato datado por contexto × atividade, com nível de apoio observado
 * naquela situação. Nunca classificação da pessoa, escore, média nem evolução global:
 * a leitura só lista observações por atividade+contexto, em ordem, revisáveis.
 */
export const CONTEXTS = ["sala", "recreio", "alimentacao", "eventos", "deslocamentos"] as const;
export type Context = (typeof CONTEXTS)[number] | string; // lista aberta: opções de interface, não limite
export const SUPPORT_LEVELS = ["sem-apoio", "apoio-pontual", "apoio-frequente", "nao-realizou", "nao-observado"] as const;
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];
export const LEVEL_LABEL: Record<SupportLevel, string> = {
  "sem-apoio": "Realizou sem apoio", "apoio-pontual": "Realizou com apoio pontual", "apoio-frequente": "Realizou com apoio frequente",
  "nao-realizou": "Não realizou", "nao-observado": "Não observado",
};

export interface Observation {
  id: string; version: number; supersedes: number | null; designationId: string; studentId: string; authorPersonId: string;
  date: string; context: Context; activity: string; level: SupportLevel; barriers: string[]; resources: string[]; note: string; reason: string | null;
}

const FORBIDDEN = /\b(escore|score|pontua[cç][aã]o|n[ií]vel (de )?(autismo|suporte [123])|grau|classifica|sempre (é|foi)|nunca (consegue|vai)|incapaz|dependente total|regrediu|evoluiu|cid|laudo|diagn[oó]stic)/i;

export function validateObservation(o: Omit<Observation, "id" | "version" | "supersedes">, ctx: { personId: string | null; technical: boolean; today: string; designation: { logicalId: string; personId: string; studentId: string; from: string; to: string | null } | null }) {
  const r: string[] = [];
  if (ctx.technical || !ctx.personId) return ["Observação exige pessoa natural."];
  const d = ctx.designation;
  if (!d || d.personId !== ctx.personId || d.logicalId !== o.designationId || d.studentId !== o.studentId || o.date < d.from || (d.to && o.date > d.to)) r.push("Sem designação vigente para este estudante na data.");
  if (o.date > ctx.today) r.push("Data futura não é registrada.");
  if (!o.context.trim()) r.push("Informe o contexto (onde aconteceu).");
  if (!o.activity.trim()) r.push("Informe a atividade observada.");
  if (!SUPPORT_LEVELS.includes(o.level)) r.push("Nível de apoio fora da lista.");
  if (o.note.length > 500) r.push("Observação com mais de 500 caracteres.");
  for (const t of [o.note, o.activity, ...o.barriers, ...o.resources]) if (FORBIDDEN.test(t)) { r.push("Descreva a situação: sem escore, classificação permanente, diagnóstico ou juízo de evolução."); break; }
  if (o.authorPersonId !== ctx.personId) r.push("Autoria deve ser de quem registra.");
  return r;
}

/** Revisão = nova versão encadeada da mesma observação, só do autor, com motivo e base esperada. */
export function revise(chain: Observation[], id: string, expectedVersion: number, changes: Partial<Pick<Observation, "level" | "note" | "barriers" | "resources" | "context" | "activity">>, personId: string, reason: string) {
  const head = chain.filter((o) => o.id === id).sort((a, b) => b.version - a.version)[0];
  if (!head) return { ok: false as const, reasons: ["Observação não encontrada."] };
  const r: string[] = [];
  if (head.version !== expectedVersion) r.push("A observação mudou desde a leitura.");
  if (head.authorPersonId !== personId) r.push("Só o autor revisa a própria observação.");
  if (reason.trim().length < 5) r.push("Revisão exige motivo.");
  const next = { ...head, ...changes, version: head.version + 1, supersedes: head.version, reason: reason.trim() };
  if (JSON.stringify({ ...head, version: 0, supersedes: 0, reason: null }) === JSON.stringify({ ...next, version: 0, supersedes: 0, reason: null })) r.push("Nada mudou.");
  for (const t of [next.note, next.activity]) if (FORBIDDEN.test(t)) r.push("Sem escore, classificação ou juízo de evolução.");
  return r.length ? { ok: false as const, reasons: r } : { ok: true as const, version: next };
}

/** Leitura: cabeças, agrupadas por atividade+contexto, em ordem cronológica. Sem total, média, tendência ou rótulo. */
export function autonomyTimeline(chain: Observation[] | null, studentId: string, window: { from: string; to: string }) {
  if (chain === null) return { state: "nao-disponivel" as const };
  const heads = new Map<string, Observation>();
  for (const o of chain) if (o.studentId === studentId) { const h = heads.get(o.id); if (!h || o.version > h.version) heads.set(o.id, o); }
  const groups = new Map<string, { activity: string; context: Context; entries: { date: string; level: string; barriers: string[]; resources: string[]; note: string; revised: boolean }[] }>();
  for (const o of [...heads.values()].filter((o) => o.date >= window.from && o.date <= window.to).sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const k = `${o.activity.trim().toLowerCase()}|${o.context}`;
    if (!groups.has(k)) groups.set(k, { activity: o.activity.trim(), context: o.context, entries: [] });
    groups.get(k)!.entries.push({ date: o.date, level: LEVEL_LABEL[o.level], barriers: o.barriers, resources: o.resources, note: o.note, revised: o.version > 1 });
  }
  return { state: "ok" as const, groups: [...groups.values()],
    notice: "Cada registro descreve uma situação observada; não classifica o estudante nem mede evolução." };
}
