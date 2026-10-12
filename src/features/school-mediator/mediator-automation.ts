/**
 * LOTE 18 — UX móvel, confiabilidade e automações do Mediador.
 * Automação só: preencher contexto autorizado, lembrar registros/reuniões,
 * avisar orientação nova e montar relatório a partir de registros.
 * Nunca produz diagnóstico, avaliação técnica ou decisão.
 */

/** Únicos tipos de saída que uma automação pode gerar. */
export const AUTOMATION_KINDS = ["preencher-contexto", "lembrete-registro", "lembrete-reuniao", "aviso-orientacao", "relatorio-de-registros"] as const;
export type AutomationKind = (typeof AUTOMATION_KINDS)[number];

const FORBIDDEN = /\b(diagn[oó]stic|progn[oó]stic|laudo|cid[- ]?\d|transtorno|defici[eê]ncia (leve|moderada|grave)|evolu[cç][aã]o (boa|ruim|positiva|negativa)|regrediu|melhorou|piorou|deve ser|recomenda-se|decid|aprovad|reprovad|apto|inapto|escore|n[ií]vel de risco)/i;

/** Barreira final: toda saída automática passa aqui; tipo fora da lista ou texto avaliativo é recusado. */
export function guardAutomationOutput(kind: string, text: string): { ok: boolean; reason: string } {
  if (!(AUTOMATION_KINDS as readonly string[]).includes(kind)) return { ok: false, reason: "Automação não permitida para o mediador." };
  if (FORBIDDEN.test(text)) return { ok: false, reason: "Automação não produz diagnóstico, avaliação técnica nem decisão." };
  return { ok: true, reason: "" };
}

/** Contexto autorizado: só campos já liberados pela ficha minimizada. */
export const CONTEXT_FIELDS = ["schoolName", "className", "shift", "date", "designationId"] as const;
export function prefillContext(authorized: Record<string, unknown> | null): Record<string, string> {
  if (!authorized) return {};
  const out: Record<string, string> = {};
  for (const k of CONTEXT_FIELDS) { const v = authorized[k]; if (typeof v === "string" && v) out[k] = v; }
  return out;
}

export interface Reminder { kind: "lembrete-registro" | "lembrete-reuniao"; designationId: string; date: string; text: string }

/** Lembrete de registro: só dia letivo lido, designação vigente e sem registro salvo. Fonte não lida ⇒ nenhum lembrete. */
export function recordReminders(p: {
  date: string; schoolDayOn: boolean | null; activeDesignations: string[] | null; savedFor: string[] | null;
}): Reminder[] {
  if (p.schoolDayOn !== true || !p.activeDesignations || !p.savedFor) return [];
  return p.activeDesignations.filter((d) => !p.savedFor!.includes(d))
    .map((d) => ({ kind: "lembrete-registro", designationId: d, date: p.date, text: "Registro do dia ainda não salvo." }));
}

export function meetingReminders(meetings: { id: string; date: string; title: string; designationId: string }[] | null, today: string, windowDays: number | null): Reminder[] {
  if (!meetings || windowDays === null || windowDays < 0) return [];
  const limit = addDays(today, windowDays);
  return meetings.filter((m) => m.date >= today && m.date <= limit)
    .map((m) => ({ kind: "lembrete-reuniao", designationId: m.designationId, date: m.date, text: `Reunião: ${m.title}` }));
}

/** Aviso de orientação: só versões publicadas sem ciência da própria pessoa. Idempotente pela chave. */
export function guidanceNotices(published: { logicalId: string; version: number; studentId: string }[], acknowledged: Set<string>) {
  return published.filter((g) => !acknowledged.has(`${g.logicalId}:${g.version}`))
    .map((g) => ({ kind: "aviso-orientacao" as const, idempotencyKey: `orient:${g.logicalId}:${g.version}`, studentId: g.studentId, text: "Há orientação nova ou alterada para ler." }));
}

/** Relatório automático: só contagem do que foi lido; fonte não lida ⇒ bloqueio, nunca zero; sem interpretação. */
export function reportFromRecords(records: { block: string }[] | null) {
  if (records === null) return { ok: false as const, reason: "Registros não lidos: relatório não gerado." };
  const counts: Record<string, number> = {};
  for (const r of records) counts[r.block] = (counts[r.block] ?? 0) + 1;
  return { ok: true as const, counts, note: "Contagem de registros; não é avaliação do estudante." };
}

/** Estado de salvamento honesto: "Salvo" só com chave e versão confirmadas pelo servidor. */
export type SaveState = { status: "rascunho" | "enviando" | "salvo" | "erro" | "conflito"; message: string };
export function saveStateFrom(r: { sent: boolean; response?: { key?: string; version?: number; error?: string; conflict?: boolean } | null }): SaveState {
  if (!r.sent) return { status: "rascunho", message: "Rascunho neste aparelho, ainda não salvo." };
  const x = r.response;
  if (!x) return { status: "enviando", message: "Enviando… não feche a tela." };
  if (x.conflict) return { status: "conflito", message: "Outra versão foi salva antes. Revise antes de enviar." };
  if (x.error) return { status: "erro", message: "Não foi salvo. O rascunho foi mantido." };
  if (x.key && typeof x.version === "number") return { status: "salvo", message: `Salvo (versão ${x.version}).` };
  return { status: "erro", message: "Resposta sem confirmação: considere não salvo." };
}

/** Rascunho recuperável: só da mesma conta e designação, dentro da validade; caso contrário descartado. */
export function recoverDraft(raw: string | null, accountId: string, designationId: string, now: number, maxAgeMs: number) {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { accountId?: string; designationId?: string; savedAt?: number; body?: unknown };
    if (d.accountId !== accountId || d.designationId !== designationId) return null;
    if (typeof d.savedAt !== "number" || now - d.savedAt > maxAgeMs) return null;
    return d.body ?? null;
  } catch { return null; }
}

/** Filtros da lista de registros (estudante, bloco, período); sem filtro ⇒ tudo, ordem estável por data desc. */
export function filterRecords<T extends { studentId: string; block: string; date: string; id: string }>(rows: T[], f: { studentId?: string; block?: string; from?: string; to?: string }) {
  return rows.filter((r) => (!f.studentId || r.studentId === f.studentId) && (!f.block || r.block === f.block)
    && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
