/**
 * SIGEM 2.0 — A&A Lote 04: banco de itens institucional.
 * Reaproveita a cadeia append-only do professor (`assessment_item_versions`,
 * gabarito separado em `assessment_item_keys`, writer `record_assessment_item_version_v2`).
 * Este núcleo é puro: valida, projeta, filtra e decide; nunca grava.
 * Pontuação ausente ≠ 0; direito de uso ausente bloqueia uso e cópia;
 * a visão sem gabarito é a única que sai para quem não é autor nem revisor.
 */
import { registerItemType, itemType, heads, type ItemVersion, type ItemOption } from "@/features/teacher-assessment/authoring-model";

for (const d of [
  { id: "associacao", label: "Associação de colunas", usesOptions: true, answerHint: "Pares coluna A → coluna B" },
  { id: "texto-base", label: "Texto-base (sem resposta)", usesOptions: false, answerHint: "—" },
  { id: "leitura-oral", label: "Leitura oral", usesOptions: false, answerHint: "Rubrica de leitura" },
  { id: "pratica", label: "Atividade prática", usesOptions: false, answerHint: "Rubrica de observação" },
]) if (!itemType(d.id)) registerItemType(d);

export type BankStatus = "rascunho" | "em-revisao" | "aprovado" | "devolvido" | "retirado";
export type UsageRights = { holder: string; license: string; allowsReuse: boolean; allowsAdaptation: boolean } | null;
export type RubricLevel = { level: string; descriptor: string; points: number | null };

export type BankMeta = {
  itemId: string; versionId: string; source: string | null; rights: UsageRights;
  skillRefIds: string[]; complexity: string | null; maxPoints: number | null;
  rubric: RubricLevel[] | null; attachments: { path: string; sha256: string; mime: string }[];
};

const NEEDS_KEY = new Set(["escolha", "objetiva-4", "objetiva-5", "verdadeiro-falso", "associacao", "resposta-curta"]);
const NEEDS_RUBRIC = new Set(["discursiva", "leitura-oral", "pratica"]);

/** Problemas impeditivos para enviar à revisão. Tudo por extenso; nada presumido. */
export function bankProblems(v: Pick<ItemVersion, "item_type_id" | "stem">, m: BankMeta, key: { answer: unknown } | null): string[] {
  const p: string[] = [];
  const t = itemType(v.item_type_id);
  if (!t) p.push(`tipo "${v.item_type_id}" não registrado`);
  if (!v.stem.trim()) p.push("enunciado vazio");
  if (!m.source?.trim()) p.push("fonte obrigatória");
  if (!m.rights) p.push("direitos de uso não declarados");
  if (!m.skillRefIds.length && v.item_type_id !== "texto-base") p.push("habilidade de referência obrigatória");
  if (NEEDS_KEY.has(v.item_type_id) && (key == null || key.answer == null || key.answer === "")) p.push("gabarito ausente");
  if (NEEDS_RUBRIC.has(v.item_type_id) && !m.rubric?.length) p.push("rubrica ausente");
  if (v.item_type_id !== "texto-base" && m.maxPoints == null) p.push("pontuação não definida (ausente não é zero)");
  for (const a of m.attachments) if (!/^[a-f0-9]{64}$/.test(a.sha256)) p.push(`anexo sem SHA-256 válido: ${a.path}`);
  return p;
}

export type ReviewEvent = { itemId: string; versionId: string; seq: number; to: BankStatus; actorPersonId: string; reason: string | null; at: string };
const NEXT: Record<BankStatus, BankStatus[]> = {
  rascunho: ["em-revisao"], "em-revisao": ["aprovado", "devolvido"], devolvido: ["em-revisao"], aprovado: ["retirado"], retirado: [],
};
export const statusOf = (ev: readonly ReviewEvent[], versionId: string): BankStatus =>
  ev.filter((e) => e.versionId === versionId).sort((a, b) => a.seq - b.seq).at(-1)?.to ?? "rascunho";

export type Transition = { ok: true; event: ReviewEvent } | { ok: false; reason: string };
export function transition(a: {
  events: readonly ReviewEvent[]; version: ItemVersion; to: BankStatus; actorPersonId: string | null;
  authorPersonId: string; capabilities: ReadonlySet<string>; problems: string[]; reason: string | null; expectedSeq: number; at: string;
}): Transition {
  if (!a.actorPersonId) return { ok: false, reason: "pessoa natural obrigatória" };
  const mine = a.events.filter((e) => e.versionId === a.version.id);
  const seq = mine.length ? Math.max(...mine.map((e) => e.seq)) : 0;
  const dup = mine.find((e) => e.seq === a.expectedSeq + 1 && e.to === a.to && e.actorPersonId === a.actorPersonId);
  if (dup) return { ok: true, event: dup }; // idempotente
  if (seq !== a.expectedSeq) return { ok: false, reason: "base esperada divergente" };
  const from = statusOf(a.events, a.version.id);
  if (!NEXT[from].includes(a.to)) return { ok: false, reason: `transição ${from}→${a.to} não permitida` };
  if (a.to === "em-revisao" && a.problems.length) return { ok: false, reason: a.problems.join("; ") };
  if (a.to === "aprovado" || a.to === "devolvido") {
    if (!a.capabilities.has("revisar-banco-de-itens")) return { ok: false, reason: "sem capacidade revisar-banco-de-itens" };
    if (a.actorPersonId === a.authorPersonId) return { ok: false, reason: "revisor deve ser distinto do autor" };
  }
  if ((a.to === "devolvido" || a.to === "retirado") && !a.reason?.trim()) return { ok: false, reason: "motivo obrigatório" };
  return { ok: true, event: { itemId: a.version.item_id, versionId: a.version.id, seq: seq + 1, to: a.to, actorPersonId: a.actorPersonId, reason: a.reason, at: a.at } };
}

/** Projeção segura: gabarito e rubrica só para autor, revisor com capacidade ou compartilhamento explícito. */
export type ItemView = { versionId: string; type: string; stem: string; options: ItemOption[]; key?: unknown; rubric?: RubricLevel[] | null };
export function viewFor(v: ItemVersion, m: BankMeta, key: { answer: unknown } | null, viewer: { userId: string; capabilities: ReadonlySet<string> }): ItemView {
  const options = Array.isArray(v.options) ? (v.options as ItemOption[]) : [];
  const base: ItemView = { versionId: v.id, type: v.item_type_id, stem: v.stem, options };
  const canSee = viewer.userId === v.author_user_id || viewer.capabilities.has("revisar-banco-de-itens") || v.key_shared;
  return canSee ? { ...base, key: key?.answer ?? null, rubric: m.rubric } : base;
}
/** Detecta gabarito escrito no enunciado ou nas alternativas (vazamento). */
export function keyLeaks(v: Pick<ItemVersion, "stem" | "options">): string[] {
  const text = [v.stem, ...(Array.isArray(v.options) ? (v.options as ItemOption[]).map((o) => o.text) : [])].join("\n");
  return /\b(gabarito|resposta\s+correta|alternativa\s+correta)\s*[:=]/i.test(text) ? ["texto contém marcação de gabarito"] : [];
}

export type ItemFilter = { text?: string; types?: string[]; skillRefId?: string; complexity?: string; status?: BankStatus[]; usableOnly?: boolean };
export function searchBank(rows: readonly ItemVersion[], meta: ReadonlyMap<string, BankMeta>, events: readonly ReviewEvent[], f: ItemFilter) {
  const q = f.text?.trim().toLocaleLowerCase("pt-BR");
  return heads(rows).filter((v) => {
    const m = meta.get(v.id); const st = statusOf(events, v.id);
    if (q && !v.stem.toLocaleLowerCase("pt-BR").includes(q)) return false;
    if (f.types?.length && !f.types.includes(v.item_type_id)) return false;
    if (f.skillRefId && !m?.skillRefIds.includes(f.skillRefId)) return false;
    if (f.complexity && m?.complexity !== f.complexity) return false;
    if (f.status?.length && !f.status.includes(st)) return false;
    if (f.usableOnly && (st !== "aprovado" || !m?.rights?.allowsReuse)) return false;
    return true;
  }).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || a.id.localeCompare(b.id));
}

/** Duplicação controlada: só com direito de adaptação; nova cadeia aponta a origem; status volta a rascunho. */
export function duplicatePlan(v: ItemVersion, m: BankMeta) {
  if (!m.rights) return { ok: false as const, reason: "direitos de uso não declarados" };
  if (!m.rights.allowsAdaptation) return { ok: false as const, reason: "licença não permite adaptação" };
  return { ok: true as const, save: { itemId: null, head: null, typeId: v.item_type_id, copiedFrom: v.id, status: "rascunho" as const } };
}

/** Histórico = cadeia de versões + eventos de revisão, em ordem; nada é reescrito. */
export function history(rows: readonly ItemVersion[], events: readonly ReviewEvent[], itemId: string) {
  const vs = rows.filter((r) => r.item_id === itemId).sort((a, b) => a.version - b.version);
  return vs.map((v) => ({ version: v.version, versionId: v.id, recordedAt: v.recorded_at, copiedFrom: v.copied_from_version_id,
    events: events.filter((e) => e.versionId === v.id).sort((a, b) => a.seq - b.seq) }));
}
