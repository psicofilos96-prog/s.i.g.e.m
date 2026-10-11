// Supervisão Escolar — Lote 01: papéis, atribuição temporal de supervisor a escola,
// compartilhamento autorizado, revogação e histórico (núcleo puro, fail-closed).
// Autorização real continua em has_capability/effective_capabilities; este núcleo só
// decide escopo por escola e data a partir de um ledger de atribuições.

export type SupervisionRole = "coordenador" | "supervisor" | "apoio" | "direcao" | "secretaria";
export type Level = "nenhum" | "consultar" | "registrar" | "conferir" | "coordenar";
const RANK: Record<Level, number> = { nenhum: 0, consultar: 1, registrar: 2, conferir: 3, coordenar: 4 };

/** Teto por papel; o papel nunca concede sozinho — exige atribuição vigente (supervisor/apoio) ou atuação na escola (direção/secretaria). */
export const ROLE_CEILING: Record<SupervisionRole, Level> = {
  coordenador: "coordenar", // distribui escolas e confere; sem atribuição própria, escopo = rede
  supervisor: "conferir",
  apoio: "registrar",
  direcao: "consultar", // vê só o que a Supervisão marcou como visível para a própria escola
  secretaria: "consultar",
};

export interface AssignmentEvent {
  seq: number; kind: "atribuir" | "compartilhar" | "revogar";
  assignmentId: string; supervisorPrincipalId: string; schoolId: string;
  from: string; to: string | null; level: Level;
  byPrincipalId: string; byRole: SupervisionRole; human: boolean; reason: string | null; at: string;
  sharedFromAssignmentId?: string | null;
}
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };

const overl = (aF: string, aT: string | null, bF: string, bT: string | null) => aF <= (bT ?? "9999-12-31") && bF <= (aT ?? "9999-12-31");

/** Estado vigente de cada atribuição é projeção do ledger; revogação encerra, nunca apaga. */
export function project(events: AssignmentEvent[]) {
  const m = new Map<string, AssignmentEvent & { revokedOn: string | null }>();
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (e.kind === "revogar") { const cur = m.get(e.assignmentId); if (cur) cur.revokedOn = e.from; }
    else m.set(e.assignmentId, { ...e, revokedOn: null });
  }
  return [...m.values()];
}

export function appendAssignment(events: AssignmentEvent[], ev: Omit<AssignmentEvent, "seq">, expectedSeq: number): Res<AssignmentEvent[]> {
  const head = events.at(-1)?.seq ?? 0;
  if (head !== expectedSeq) return { ok: false, code: "stale-base" };
  if (!ev.human) return { ok: false, code: "human-author-required" };
  if (ev.to && ev.to < ev.from) return { ok: false, code: "end-before-start" };
  const cur = project(events);
  if (ev.kind === "atribuir") {
    if (ev.byRole !== "coordenador") return { ok: false, code: "only-coordinator-assigns" };
    if (ev.byPrincipalId === ev.supervisorPrincipalId) return { ok: false, code: "self-assignment" };
    if (RANK[ev.level] > RANK[ROLE_CEILING.supervisor]) return { ok: false, code: "level-above-ceiling" };
    if (cur.some((a) => a.kind === "atribuir" && a.supervisorPrincipalId === ev.supervisorPrincipalId && a.schoolId === ev.schoolId && overl(a.from, a.revokedOn ?? a.to, ev.from, ev.to))) return { ok: false, code: "overlapping-assignment" };
  }
  if (ev.kind === "compartilhar") {
    const src = cur.find((a) => a.assignmentId === ev.sharedFromAssignmentId);
    if (!src) return { ok: false, code: "share-source-missing" };
    if (src.supervisorPrincipalId !== ev.byPrincipalId && ev.byRole !== "coordenador") return { ok: false, code: "share-not-owner" };
    if (src.schoolId !== ev.schoolId) return { ok: false, code: "share-other-school" };
    if (RANK[ev.level] > RANK[src.level]) return { ok: false, code: "share-widens-level" };
    const srcEnd = src.revokedOn ?? src.to;
    if (ev.from < src.from || (srcEnd && (!ev.to || ev.to > srcEnd))) return { ok: false, code: "share-outside-source-window" };
    if (!ev.reason?.trim()) return { ok: false, code: "reason-required" };
  }
  if (ev.kind === "revogar") {
    const a = cur.find((x) => x.assignmentId === ev.assignmentId);
    if (!a) return { ok: false, code: "unknown-assignment" };
    if (a.revokedOn) return { ok: false, code: "already-revoked" };
    if (ev.byRole !== "coordenador" && a.sharedFromAssignmentId == null) return { ok: false, code: "only-coordinator-revokes" };
    if (!ev.reason?.trim()) return { ok: false, code: "reason-required" };
  }
  let next = [...events, { ...ev, seq: head + 1 }];
  // revogar a origem derruba compartilhamentos derivados
  if (ev.kind === "revogar") {
    let s = head + 1;
    for (const d of cur.filter((x) => x.sharedFromAssignmentId === ev.assignmentId && !x.revokedOn))
      next = [...next, { ...ev, seq: ++s, assignmentId: d.assignmentId, supervisorPrincipalId: d.supervisorPrincipalId, reason: `revogação da origem: ${ev.reason}` }];
  }
  return { ok: true, value: next };
}

export interface Viewer { principalId: string; role: SupervisionRole; schoolEngagements: string[]; capabilityOk: boolean }

/** Nível efetivo na escola e data: sem capability homologada, nada; teto do papel sempre limita. */
export function accessLevel(events: AssignmentEvent[], v: Viewer, schoolId: string, on: string): Level {
  if (!v.capabilityOk) return "nenhum";
  const ceil = ROLE_CEILING[v.role];
  if (v.role === "coordenador") return ceil;
  if (v.role === "direcao" || v.role === "secretaria") return v.schoolEngagements.includes(schoolId) ? ceil : "nenhum";
  const live = project(events).filter((a) => a.supervisorPrincipalId === v.principalId && a.schoolId === schoolId && a.from <= on && (a.revokedOn == null || on < a.revokedOn) && (a.to == null || on <= a.to));
  const best = live.reduce<Level>((m, a) => (RANK[a.level] > RANK[m] ? a.level : m), "nenhum");
  return RANK[best] > RANK[ceil] ? ceil : best;
}

export function history(events: AssignmentEvent[], schoolId: string) {
  return events.filter((e) => e.schoolId === schoolId).sort((a, b) => a.seq - b.seq);
}
