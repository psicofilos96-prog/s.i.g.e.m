// SIGEM 2.0 — Lote complementar 05: conferência documental (núcleo puro).
// Checklist é configuração versionada por tipo de processo; exigência sem fundamento normativo vigente é só orientação.
// Documento ausente NUNCA bloqueia matrícula/acesso à educação sem base legal verificada: gera protocolo de regularização.

export interface Requirement { id: string; label: string; legalBasis: string | null; basisVerifiedOn: string | null; validFrom: string; validTo: string | null; blocksAccess: boolean }
export interface Checklist { id: string; processKind: string; version: number; homologated: boolean; requirements: Requirement[] }
export type DocStatus = "pendente" | "recebido" | "em-conferencia" | "validado";
export interface DocEvent { requirementId: string; status: DocStatus; at: string; actorPrincipalId: string; attachmentPath?: string; note?: string }

const ORDER: Record<DocStatus, DocStatus[]> = { pendente: ["recebido"], recebido: ["em-conferencia", "pendente"], "em-conferencia": ["validado", "pendente"], validado: [] };

export function applicableRequirements(c: Checklist | null, on: string): Requirement[] | null {
  if (!c?.homologated) return null;
  return c.requirements.filter((r) => r.validFrom <= on && (r.validTo == null || on <= r.validTo));
}

export function docStatus(events: DocEvent[], reqId: string): DocStatus {
  const ev = events.filter((e) => e.requirementId === reqId);
  return ev.length ? ev[ev.length - 1]!.status : "pendente";
}

/** Transição: anexo só em pasta privada da escola; validador ≠ quem recebeu; devolução a pendente exige motivo. */
export function recordDocEvent(events: DocEvent[], ev: DocEvent, schoolId: string): { ok: true; value: DocEvent[] } | { ok: false; code: string } {
  const cur = docStatus(events, ev.requirementId);
  if (!ORDER[cur].includes(ev.status)) return { ok: false, code: "doc:transition-invalid" };
  if (ev.status === "recebido" && ev.attachmentPath && !ev.attachmentPath.startsWith(`${schoolId}/`)) return { ok: false, code: "doc:attachment-out-of-scope" };
  if (ev.status === "pendente" && !ev.note?.trim()) return { ok: false, code: "doc:reason-required" };
  if (ev.status === "validado") {
    const received = [...events].reverse().find((e) => e.requirementId === ev.requirementId && e.status === "recebido");
    if (received?.actorPrincipalId === ev.actorPrincipalId) return { ok: false, code: "doc:self-validation" };
  }
  return { ok: true, value: [...events, ev] };
}

/** Bloqueio de acesso só com fundamento legal registrado E verificado; senão, matrícula segue e abre regularização. */
export function accessDecision(reqs: Requirement[] | null, events: DocEvent[], today: string) {
  if (reqs == null) return { blocked: false, regularization: [] as string[], note: "checklist não homologado: nenhuma exigência aplicada" };
  const missing = reqs.filter((r) => docStatus(events, r.id) !== "validado");
  const legalBlock = missing.filter((r) => r.blocksAccess && r.legalBasis && r.basisVerifiedOn && r.basisVerifiedOn <= today);
  return { blocked: legalBlock.length > 0, blockingBasis: legalBlock.map((r) => r.legalBasis!), regularization: missing.map((r) => r.id), note: legalBlock.length ? "bloqueio por base legal verificada" : "pendência documental não impede acesso" };
}

/** Alerta só com prazo de regularização configurado; sem prazo ⇒ null. */
export function regularizationAlert(openedOn: string, deadlineDays: number | null, today: string): "no-prazo" | "vencido" | null {
  if (deadlineDays == null) return null;
  const due = new Date(Date.parse(openedOn) + deadlineDays * 86400000).toISOString().slice(0, 10);
  return today > due ? "vencido" : "no-prazo";
}

/** Família vê só o que falta, sem anexos nem notas internas. */
export function familyView(reqs: Requirement[] | null, events: DocEvent[]) {
  return (reqs ?? []).map((r) => ({ label: r.label, status: docStatus(events, r.id) }));
}
