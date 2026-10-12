/**
 * PERFIL MEDIADOR — LOTE 08 Registro diário objetivo (núcleo puro).
 * Registro por designação × data: blocos atividade/apoio/barreira/estrategia/
 * participacao/ocorrencia/encaminhamento, cada um com categoria do catálogo
 * homologado + observação opcional factual. Versões append-only (correção = nova
 * versão com motivo, base esperada), chave idempotente, "Salvo" só com confirmação.
 */
export type Block = "atividade" | "apoio" | "barreira" | "estrategia" | "participacao" | "ocorrencia" | "encaminhamento";
export const BLOCKS: Block[] = ["atividade", "apoio", "barreira", "estrategia", "participacao", "ocorrencia", "encaminhamento"];
export interface CatalogValue { id: string; block: Block; label: string }
export interface Entry { block: Block; categoryId: string; note: string }
export interface Designation { logicalId: string; personId: string; studentId: string; from: string; to: string | null }
export interface RecordVersion { recordId: string; version: number; designationId: string; date: string; entries: Entry[]; authorPersonId: string; reason: string | null; supersedes: number | null; idem: string }

const CLINICAL = /\b(cid|laudo|diagn[oó]stic|f\d{2}(\.\d)?|transtorno|medica[cç]|psiqui|neurol|autis|tdah|hiperativ)/i;
/** Rótulos e inferências sobre a pessoa: incentivo a descrever o fato observado. */
const LABELS = /\b(agressiv|preguiços|mal[- ]educad|birrent|teimos|manipulador|sem limites|problem[aá]tic|não quer nada|parece que|deve ter|provavelmente)/i;

export function lint(note: string): { block: string[]; advise: string[] } {
  const b: string[] = [], a: string[] = [];
  if (note.length > 500) b.push("Observação com mais de 500 caracteres.");
  if (CLINICAL.test(note)) b.push("Sem diagnóstico, CID ou termo clínico: descreva o que foi observado.");
  if (LABELS.test(note)) a.push("Evite rótulos e suposições: descreva o fato (o que, quando, como).");
  return { block: b, advise: a };
}

export interface Draft { designationId: string; date: string; entries: Entry[]; reason?: string }
export interface Ctx { personId: string | null; technical: boolean; today: string; designations: Designation[]; catalog: CatalogValue[] | null }

export function prepare(d: Draft, ctx: Ctx, chain: RecordVersion[] | null, expectedVersion: number | null) {
  const r: string[] = []; const advise: string[] = [];
  if (ctx.technical || !ctx.personId) return { ok: false as const, reasons: ["Registro exige pessoa natural; executor técnico não é autor."], advise };
  if (ctx.catalog === null) return { ok: false as const, reasons: ["Catálogo de categorias de registro não homologado: registro indisponível."], advise };
  if (chain === null) return { ok: false as const, reasons: ["Registros do dia não lidos: releia antes de salvar."], advise };
  const des = ctx.designations.find((x) => x.logicalId === d.designationId && x.personId === ctx.personId);
  if (!des || d.date < des.from || (des.to && d.date > des.to)) r.push("Sem designação vigente na data do registro.");
  if (d.date > ctx.today) r.push("Data futura não é registrada.");
  if (!d.entries.length) r.push("Escolha ao menos uma categoria.");
  const seen = new Set<string>();
  for (const e of d.entries) {
    if (!ctx.catalog.some((c) => c.id === e.categoryId && c.block === e.block)) r.push(`Categoria fora do catálogo em ${e.block}.`);
    const k = `${e.block}:${e.categoryId}`; if (seen.has(k)) r.push(`Categoria repetida em ${e.block}.`); seen.add(k);
    const l = lint(e.note.trim()); r.push(...l.block); advise.push(...l.advise);
  }
  const mine = chain.filter((v) => v.designationId === d.designationId && v.date === d.date);
  const head = mine.reduce<RecordVersion | null>((m, v) => (!m || v.version > m.version ? v : m), null);
  if ((head?.version ?? null) !== expectedVersion) r.push("Outro registro foi salvo para este dia: releia antes de continuar.");
  if (head && head.authorPersonId !== ctx.personId) r.push("Só o autor corrige o próprio registro.");
  if (head && (!d.reason || d.reason.trim().length < 5)) r.push("Correção exige motivo.");
  const entries = d.entries.map((e) => ({ ...e, note: e.note.trim() })).sort((a, b) => (a.block + a.categoryId < b.block + b.categoryId ? -1 : 1));
  if (head && JSON.stringify(head.entries) === JSON.stringify(entries)) r.push("Nada mudou: não há nova versão.");
  if (r.length) return { ok: false as const, reasons: [...new Set(r)], advise: [...new Set(advise)] };
  const version = (head?.version ?? 0) + 1;
  const recordId = head?.recordId ?? `mdr:${d.designationId}:${d.date}`;
  return { ok: true as const, advise: [...new Set(advise)], submission: {
    recordId, version, designationId: d.designationId, date: d.date, entries, authorPersonId: ctx.personId,
    reason: head ? d.reason!.trim() : null, supersedes: head?.version ?? null, idem: idem(`${recordId}|${head?.version ?? 0}|${JSON.stringify(entries)}`),
  } satisfies RecordVersion };
}

function idem(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return `mdr:${(h >>> 0).toString(16)}`; }

/** Confirmação: só "Salvo" quando o servidor devolve a mesma chave e a versão esperada. */
export function confirmation(sent: RecordVersion, reply: unknown): "salvo" | "sem-confirmacao" | "conflito" {
  if (!reply || typeof reply !== "object") return "sem-confirmacao";
  const r = reply as { idem?: unknown; version?: unknown; error?: unknown };
  if (r.error === "conflito") return "conflito";
  return r.idem === sent.idem && r.version === sent.version ? "salvo" : "sem-confirmacao";
}

/** Histórico do dia: todas as versões, autoria e motivo preservados. */
export function dayHistory(chain: RecordVersion[], designationId: string, date: string) {
  return chain.filter((v) => v.designationId === designationId && v.date === date).sort((a, b) => b.version - a.version)
    .map((v) => ({ version: v.version, author: v.authorPersonId, reason: v.reason, entries: v.entries.length, current: false }))
    .map((v, i) => ({ ...v, current: i === 0 }));
}
