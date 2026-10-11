/**
 * TSEMED.REC — Conciliação CIECE (regras puras). Verificações chegam do banco já calculadas; aqui só se
 * derivam estado da pendência (pela impressão digital), consolidação por zona/tipo e blocos de exportação.
 * Nada apaga divergência: aprovação vale só para a impressão digital aprovada.
 */
import type { Block } from "./semed-export";

export type RecSource = Record<string, string | number | null>;
export type RecCheck = { key: string; label: string; date_a: string | null; date_b: string | null; a: number | null; b: number | null; status: string; sources: RecSource[]; fingerprint: string };
export type RecEvent = { school_id: string; check_key: string; fingerprint: string; seq: number; act: "abrir" | "retornar" | "aprovar" | "comentar"; reason: string; actor_scope: string; created_at: string };
export type RecSchool = { school_id: string; name: string | null; zona: string | null; tipo: string | null; checks: RecCheck[] };

export const REC_STATUS: Record<string, string> = {
  confere: "confere", divergente: "DIVERGENTE", "sem-dado": "sem dado informado",
  "nao-comparavel:regra-ausente": "não comparável — regra da rede não registrada",
  "nao-comparavel:datas-diferentes": "não comparável — datas de referência diferentes",
  "nao-comparavel:matriculas-sem-data": "não comparável — matrículas sem data de início",
  "nao-comparavel:sem-mapa-do-mes": "não comparável — sem Mapa declarado do mês",
  "nao-comparavel:turmas-sem-ano-etapa": "não comparável — turmas sem ano/etapa",
};
export const statusText = (s: string) => REC_STATUS[s] ?? s;
export type Bucket = "confere" | "divergente" | "nao-comparavel" | "sem-dado";
export const bucketOf = (s: string): Bucket => (s === "confere" || s === "divergente" || s === "sem-dado" ? s : "nao-comparavel");

export type PendingState = "sem-pendencia" | "aberta" | "retornada" | "aprovada" | "reaberta";
export const PENDING_LABEL: Record<PendingState, string> = { "sem-pendencia": "—", aberta: "pendência aberta", retornada: "retornada à escola (corrigir na fonte)", aprovada: "aprovada com justificativa", reaberta: "reaberta: valores mudaram após o último ato" };

/** Estado da pendência: último ato decisivo da cadeia; se a impressão digital mudou, reabre (nunca some). */
export function pendingState(c: RecCheck, events: readonly RecEvent[]): PendingState {
  const chain = events.filter((e) => e.check_key === c.key && e.act !== "comentar").sort((a, b) => a.seq - b.seq);
  const last = chain.at(-1);
  if (!last) return "sem-pendencia";
  if (last.fingerprint !== c.fingerprint) return c.status === "divergente" ? "reaberta" : "sem-pendencia";
  return last.act === "abrir" ? "aberta" : last.act === "retornar" ? "retornada" : "aprovada";
}

export type Consolidated = { group: string; schools: number } & Record<Bucket, number>;
export function consolidate(rows: readonly RecSchool[], by: "zona" | "tipo" | "escola"): Consolidated[] {
  const m = new Map<string, Consolidated>();
  for (const s of rows) {
    const g = by === "escola" ? (s.name ?? s.school_id) : (s[by] ?? "não registrado no cadastro");
    const c = m.get(g) ?? { group: g, schools: 0, confere: 0, divergente: 0, "nao-comparavel": 0, "sem-dado": 0 };
    c.schools++; for (const k of s.checks) c[bucketOf(k.status)]++;
    m.set(g, c);
  }
  return [...m.values()].sort((a, b) => a.group.localeCompare(b.group, "pt-BR"));
}

const show = (v: unknown) => (v === null || v === undefined ? "—" : (v as string | number));
const srcText = (s: RecSource[]) => s.map((x) => Object.entries(x).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (k === "fonte" ? String(v) : `${k} ${v}`)).join(" ")).join(" · ");

export function schoolBlocks(s: RecSchool, events: readonly RecEvent[]): Block[] {
  return [{ title: `CONCILIAÇÃO — ${s.name ?? s.school_id} (zona ${s.zona ?? "não registrada"})`, head: ["Verificação", "Data A", "Valor A", "Data B", "Valor B", "Situação", "Pendência", "Origem"],
    body: s.checks.map((c) => [c.label, show(c.date_a), show(c.a), show(c.date_b), show(c.b), statusText(c.status), PENDING_LABEL[pendingState(c, events)], srcText(c.sources)]) },
  { title: "TRILHA DE ATOS", head: ["Verificação", "#", "Ato", "Escopo", "Quando", "Justificativa"],
    body: events.filter((e) => e.school_id === s.school_id).map((e) => [s.checks.find((c) => c.key === e.check_key)?.label ?? e.check_key, e.seq, e.act, e.actor_scope, new Date(e.created_at).toLocaleString("pt-BR"), e.reason]) }];
}
export function networkBlocks(rows: readonly RecSchool[]): Block[] {
  const t = (by: "zona" | "tipo" | "escola", title: string): Block => ({ title, head: [by === "escola" ? "Escola" : by === "zona" ? "Zona" : "Tipo (dependência)", "Escolas", "Confere", "Divergente", "Não comparável", "Sem dado"],
    body: consolidate(rows, by).map((c) => [c.group, c.schools, c.confere, c.divergente, c["nao-comparavel"], c["sem-dado"]]) });
  return [t("zona", "CONSOLIDAÇÃO POR ZONA"), t("tipo", "CONSOLIDAÇÃO POR TIPO"), t("escola", "CONSOLIDAÇÃO POR ESCOLA"),
    { title: "CONSOLIDAÇÃO POR ETAPA", head: ["Situação"], body: [["Não comparável: turmas sem ano/etapa registrados no cadastro"]] }];
}
