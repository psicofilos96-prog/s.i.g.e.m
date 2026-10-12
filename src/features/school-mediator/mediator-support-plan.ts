/**
 * PERFIL MEDIADOR — LOTE 06 Plano Integrado de Apoio Escolar (núcleo puro).
 * Não existe plano próprio do mediador: o plano é a cadeia canônica de planos do NEI
 * (PEI/PAEE, versões append-only — NEI.3). O mediador lê só a parte operacional
 * marcada para mediação da versão vigente, registra observação e solicita revisão;
 * nunca grava versão nem decide.
 */
export type PlanStatus = "rascunho" | "em-revisao" | "concluido";
export type PlanSection = "objetivo" | "barreira" | "estrategia" | "recurso" | "responsavel" | "clinico" | "avaliacao-especializada";
export interface PlanItem { id: string; section: PlanSection; text: string; forMediation: boolean; responsibleLabel: string | null; until: string | null }
export interface PlanVersion {
  planId: string; kind: "PEI" | "PAEE"; version: number; status: PlanStatus; studentId: string; schoolId: string;
  validFrom: string; validTo: string | null; reason: string; authorPersonId: string; items: PlanItem[];
  decisions: { by: string; role: string; at: string; text: string }[];
}

/** Seções que o mediador pode ver (operacionais). Clínico/avaliação especializada nunca. */
export const MEDIATOR_SECTIONS: PlanSection[] = ["objetivo", "barreira", "estrategia", "recurso", "responsavel"];
const CLINICAL = /\b(cid|laudo|diagn[oó]stic|f\d{2}(\.\d)?|transtorno|medica[cç]|psiqui|neurol)/i;

export interface MediatorCtx { personId: string; studentIds: string[]; date: string }

/** Versão vigente = maior versão concluída cuja vigência cobre a data; nunca rascunho. */
export function currentPlan(versions: PlanVersion[], planId: string, date: string): PlanVersion | null {
  const v = versions.filter((x) => x.planId === planId && x.status === "concluido" && x.validFrom <= date && (!x.validTo || date <= x.validTo))
    .sort((a, b) => b.version - a.version);
  return v[0] ?? null;
}

export function mediatorPlanView(versions: PlanVersion[] | null, planId: string, ctx: MediatorCtx) {
  if (versions === null) return { state: "nao-disponivel" as const };
  const p = currentPlan(versions, planId, ctx.date);
  if (!p) return { state: "sem-plano-vigente" as const };
  if (!ctx.studentIds.includes(p.studentId)) return { state: "sem-designacao" as const };
  const items = p.items
    .filter((i) => i.forMediation && MEDIATOR_SECTIONS.includes(i.section) && (!i.until || ctx.date <= i.until))
    .map((i) => ({ id: i.id, section: i.section, text: CLINICAL.test(i.text) ? null : i.text, withheld: CLINICAL.test(i.text), responsibleLabel: i.responsibleLabel }));
  return { state: "ok" as const, planId: p.planId, kind: p.kind, version: p.version, validFrom: p.validFrom, validTo: p.validTo,
    items, decisions: p.decisions.map((d) => ({ role: d.role, at: d.at })) /* sem texto da decisão especializada */ };
}

export type MediatorPlanAct =
  | { kind: "observacao"; planId: string; version: number; itemId: string | null; text: string }
  | { kind: "pedido-revisao"; planId: string; version: number; itemId: string | null; text: string };

/** Ação que o mediador NÃO pode: qualquer gravação de versão do plano. */
export function canWritePlanVersion(_ctx: MediatorCtx): false { return false; }

export function validateMediatorAct(a: MediatorPlanAct, versions: PlanVersion[] | null, ctx: MediatorCtx, seen: { key: string }[]) {
  const r: string[] = [];
  if (versions === null) return { ok: false as const, reasons: ["Plano do NEI não lido: ação indisponível."] };
  const v = mediatorPlanView(versions, a.planId, ctx);
  if (v.state !== "ok") r.push("Sem plano vigente visível para este estudante.");
  else {
    if (v.version !== a.version) r.push("O plano mudou desde a leitura: releia antes de enviar.");
    if (a.itemId && !v.items.some((i) => i.id === a.itemId)) r.push("Item não visível à mediação.");
  }
  const t = a.text.trim();
  if (t.length < 10) r.push(a.kind === "pedido-revisao" ? "Descreva o motivo do pedido de revisão." : "Observação vazia.");
  if (t.length > 1000) r.push("Texto com mais de 1000 caracteres.");
  if (CLINICAL.test(t)) r.push("Registro objetivo: sem diagnóstico, CID ou termo clínico.");
  const key = idemKey(a, ctx.personId);
  if (seen.some((s) => s.key === key)) r.push("Envio repetido: já registrado.");
  if (r.length) return { ok: false as const, reasons: r };
  return { ok: true as const, event: { ...a, text: t, authorPersonId: ctx.personId, idempotencyKey: key, effectOnPlan: "nenhum" as const } };
}

export function idemKey(a: MediatorPlanAct, personId: string): string {
  const s = `${a.kind}|${a.planId}|${a.version}|${a.itemId ?? ""}|${personId}|${a.text.trim()}`;
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `mpa:${(h >>> 0).toString(16)}`;
}
