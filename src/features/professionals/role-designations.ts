/**
 * Gestão de Pessoas L05 — Designações funcionais (direção, orientação, docência,
 * mediação, administrativas...). Tipo é rótulo aberto do catálogo de funções (L03),
 * nunca enumeração fechada. Designação = ato + vínculo + escola + vigência +
 * responsável real; situação é DERIVADA do ledger de eventos append-only.
 * Integração com acesso: a designação só gera PEDIDO de contexto de acesso, que
 * outra pessoa com competência decide pelo writer de atuação; nada é concedido aqui.
 */

export type DesignationEvent = Readonly<{
  designationId: string;
  seq: number;
  kind: "registro" | "encerramento" | "revogacao" | "retificacao";
  functionLogicalId: string;
  linkLogicalId: string;
  personId: string;
  schoolId: string | null; // null = rede
  validFrom: string;
  validUntil: string | null;
  actRef: string | null;
  reason: string | null;
  authorUserId: string | null;
  technical: boolean;
  recordedAt: string;
}>;

export type DesignationState = "vigente" | "futura" | "encerrada" | "revogada" | "ambigua";

export type DesignationRefusal =
  | "sem-autor" | "executor-tecnico" | "sem-ato" | "sem-motivo" | "seq-inesperado"
  | "intervalo-invalido" | "vinculo-de-outra-pessoa" | "vinculo-sem-lotacao-ou-exercicio-na-escola"
  | "autodesignacao" | "ja-encerrada" | "exclusiva-ocupada";

export type LinkContext = Readonly<{ linkLogicalId: string; personId: string; schoolIds: readonly string[]; authorPersonId: string | null }>;

/** Exclusividade é configuração (ex.: uma direção por escola); sem configuração, nenhuma. */
export type ExclusivityConfig = ReadonlySet<string>; // functionLogicalIds exclusivos por escola

const overlaps = (a: { validFrom: string; validUntil: string | null }, b: { validFrom: string; validUntil: string | null }) =>
  a.validFrom <= (b.validUntil ?? "9999-12-31") && b.validFrom <= (a.validUntil ?? "9999-12-31");

export function headOf(events: readonly DesignationEvent[], id: string): DesignationEvent | null {
  const es = events.filter((e) => e.designationId === id).sort((a, b) => a.seq - b.seq);
  if (es.some((e, i) => e.seq !== i + 1)) return null;
  return es[es.length - 1] ?? null;
}

export function stateOf(events: readonly DesignationEvent[], id: string, day: string, knownAt: string): DesignationState | null {
  const known = events.filter((e) => e.recordedAt <= knownAt);
  if (!known.some((e) => e.designationId === id)) return null;
  const h = headOf(known, id);
  if (!h) return "ambigua";
  if (h.kind === "revogacao") return "revogada";
  if (h.validUntil !== null && h.validUntil < day) return "encerrada";
  if (h.validFrom > day) return "futura";
  return "vigente";
}

export function checkEvent(
  e: DesignationEvent,
  history: readonly DesignationEvent[],
  link: LinkContext | null,
  exclusive: ExclusivityConfig = new Set(),
  authorPersonId: string | null = null,
): DesignationRefusal | null {
  if (e.technical) return "executor-tecnico";
  if (!e.authorUserId) return "sem-autor";
  if (!e.actRef?.trim()) return "sem-ato";
  if (e.validUntil && e.validUntil < e.validFrom) return "intervalo-invalido";
  const head = headOf(history, e.designationId);
  if (e.seq !== (head?.seq ?? 0) + 1) return "seq-inesperado";
  if (e.kind !== "registro" && !e.reason?.trim()) return "sem-motivo";
  if (head && (head.kind === "revogacao" || head.kind === "encerramento")) return "ja-encerrada";
  if (authorPersonId && authorPersonId === e.personId) return "autodesignacao";
  if (e.kind === "registro" || e.kind === "retificacao") {
    if (!link || link.linkLogicalId !== e.linkLogicalId || link.personId !== e.personId) return "vinculo-de-outra-pessoa";
    if (e.schoolId && !link.schoolIds.includes(e.schoolId)) return "vinculo-sem-lotacao-ou-exercicio-na-escola";
    if (exclusive.has(e.functionLogicalId) && e.schoolId) {
      const ids = [...new Set(history.map((h) => h.designationId))].filter((id) => id !== e.designationId);
      for (const id of ids) {
        const h = headOf(history, id);
        if (h && h.kind !== "revogacao" && h.functionLogicalId === e.functionLogicalId && h.schoolId === e.schoolId && overlaps(h, e))
          return "exclusiva-ocupada";
      }
    }
  }
  return null;
}

/** Pedido de contexto de acesso: só registro informativo para decisão humana. */
export type AccessContextRequest = Readonly<{
  designationId: string; personId: string; schoolId: string | null; functionLogicalId: string;
  validFrom: string; validUntil: string | null; status: "aguardando-decisao-competente";
  grantsCapabilities: false;
}>;

export function accessRequestFor(events: readonly DesignationEvent[], id: string, day: string, knownAt: string): AccessContextRequest | null {
  const st = stateOf(events, id, day, knownAt);
  if (st !== "vigente" && st !== "futura") return null;
  const h = headOf(events.filter((e) => e.recordedAt <= knownAt), id)!;
  return { designationId: id, personId: h.personId, schoolId: h.schoolId, functionLogicalId: h.functionLogicalId,
    validFrom: h.validFrom, validUntil: h.validUntil, status: "aguardando-decisao-competente", grantsCapabilities: false };
}

/** Atuação que sobrevive à designação encerrada/revogada é sinalizada (nunca revogada automaticamente). */
export function orphanEngagements(
  events: readonly DesignationEvent[],
  engagements: readonly { id: string; designationId: string | null; active: boolean }[],
  day: string, knownAt: string,
): string[] {
  return engagements.filter((g) => g.active && g.designationId && ["encerrada", "revogada"].includes(stateOf(events, g.designationId, day, knownAt) ?? ""))
    .map((g) => g.id);
}
