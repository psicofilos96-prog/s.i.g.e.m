/**
 * Gestão de Pessoas L19 — Atos administrativos de pessoal e comprovantes (GED).
 * Ato = ledger append-only (registro → publicação → retificação/revogação),
 * com autor humano, tipo de lista aberta, vigência e referência ao documento no
 * GED (`ged-core`), nunca o arquivo. Registro digital NÃO substitui ato oficial:
 * quando o tipo exige ato formal externo, sem referência oficial o registro
 * fica `aguardando-ato-oficial` e não produz efeito. Leitura passa por
 * capacidade + escopo; toda leitura/negação entra na trilha.
 */

export type ActKind = string; // lotacao, designacao, movimentacao, autorizacao, comprovante...
export type ActTypeConfig = Readonly<{ kind: ActKind; requiresOfficialAct: boolean; readCapability: string; writeCapability: string }>;

export type ActEvent = Readonly<{
  actId: string; seq: number; type: "registro" | "publicacao" | "retificacao" | "revogacao";
  kind: ActKind; subjectPersonId: string; schoolId: string | null;
  validFrom: string; validUntil: string | null;
  gedDocumentId: string | null; officialReference: string | null; // ex.: nº/data de publicação
  authorPersonId: string | null; reason: string | null; at: string;
}>;

export type Actor = Readonly<{ personId: string | null; capabilities: readonly { id: string; schoolId: string | null }[] }>;
export type AuditEntry = Readonly<{ actId: string; actorPersonId: string | null; action: "ler" | "gravar"; outcome: "permitido" | "negado"; at: string }>;

const can = (a: Actor, cap: string, schoolId: string | null) =>
  a.capabilities.some((c) => c.id === cap && (c.schoolId === null || c.schoolId === schoolId));

export function validateEvent(ev: ActEvent, history: readonly ActEvent[], types: readonly ActTypeConfig[], actor: Actor): string[] {
  const p: string[] = [];
  const t = types.find((x) => x.kind === ev.kind);
  if (!t) p.push("tipo-nao-configurado");
  if (!ev.authorPersonId || ev.authorPersonId !== actor.personId) p.push("autor-humano-ausente");
  if (t && !can(actor, t.writeCapability, ev.schoolId)) p.push("sem-capacidade");
  if (ev.authorPersonId && ev.authorPersonId === ev.subjectPersonId) p.push("autoato");
  if (ev.validUntil && ev.validUntil < ev.validFrom) p.push("vigencia-invalida");
  const own = history.filter((h) => h.actId === ev.actId);
  const expected = own.length + 1;
  if (ev.seq !== expected) p.push("sequencia-invalida");
  if (ev.type === "registro" ? own.length > 0 : own.length === 0) p.push("tipo-de-evento-invalido");
  if ((ev.type === "retificacao" || ev.type === "revogacao") && !ev.reason?.trim()) p.push("motivo-ausente");
  if (own.some((h) => h.type === "revogacao")) p.push("ato-revogado");
  if (own[0] && (own[0].kind !== ev.kind || own[0].subjectPersonId !== ev.subjectPersonId)) p.push("identidade-imutavel");
  if (ev.type === "publicacao" && t?.requiresOfficialAct && !ev.officialReference?.trim()) p.push("referencia-oficial-ausente");
  if (ev.kind === "comprovante" && !ev.gedDocumentId) p.push("documento-ged-ausente");
  return p;
}

export type ActState = Readonly<{
  actId: string; status: "registrado" | "aguardando-ato-oficial" | "publicado" | "revogado" | "ambiguo";
  producesEffect: boolean; current: ActEvent | null;
}>;

export function actState(actId: string, history: readonly ActEvent[], types: readonly ActTypeConfig[]): ActState {
  const own = history.filter((h) => h.actId === actId).sort((a, b) => a.seq - b.seq);
  if (own.length === 0 || own.some((e, i) => e.seq !== i + 1)) return { actId, status: "ambiguo", producesEffect: false, current: null };
  const last = own[own.length - 1]!;
  const t = types.find((x) => x.kind === own[0]!.kind);
  if (!t) return { actId, status: "ambiguo", producesEffect: false, current: last };
  if (last.type === "revogacao") return { actId, status: "revogado", producesEffect: false, current: last };
  const published = own.some((e) => e.type === "publicacao" && (!t.requiresOfficialAct || !!e.officialReference));
  if (t.requiresOfficialAct && !published) return { actId, status: "aguardando-ato-oficial", producesEffect: false, current: last };
  return { actId, status: published ? "publicado" : "registrado", producesEffect: true, current: last };
}

export function effectiveOn(state: ActState, day: string): boolean {
  const c = state.current;
  return !!c && state.producesEffect && c.validFrom <= day && (c.validUntil === null || c.validUntil >= day);
}

/** Leitura com controle de acesso e trilha; negado não revela conteúdo. */
export function readAct(actId: string, history: readonly ActEvent[], types: readonly ActTypeConfig[], actor: Actor, at: string, trail: AuditEntry[]) {
  const own = history.filter((h) => h.actId === actId);
  const first = own[0];
  const t = first && types.find((x) => x.kind === first.kind);
  const ok = !!t && can(actor, t.readCapability, first!.schoolId);
  trail.push({ actId, actorPersonId: actor.personId, action: "ler", outcome: ok ? "permitido" : "negado", at });
  if (!ok) return null; // inexistente e negado parecem iguais
  return { state: actState(actId, history, types), history: [...own].sort((a, b) => a.seq - b.seq) };
}

export const DIGITAL_RECORD_NOTICE = "Registro digital no SIGEM. Não substitui ato oficial legalmente exigido.";
