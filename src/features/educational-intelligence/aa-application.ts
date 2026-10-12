/**
 * SIGEM 2.0 — A&A Lote 06 (spec §12): aplicação e participação.
 * Núcleo puro. Elegibilidade = alocação vigente na data de referência (fonte
 * canônica de enturmação); transferência termina a elegibilidade na origem e
 * só abre no destino a partir da data efetiva. Presença nunca é presumida:
 * sem registro, o estudante fica "sem registro", nunca "participou".
 * Categorias de participação são configuração da avaliação (§12.3), não código.
 */

export type Allocation = { studentId: string; schoolId: string; classId: string; from: string; to: string | null };
export function eligibleOn(allocs: readonly Allocation[], refDate: string, scope: { schoolIds: ReadonlySet<string>; classIds?: ReadonlySet<string> }) {
  const seen = new Map<string, Allocation[]>();
  for (const a of allocs) {
    if (a.from > refDate || (a.to != null && a.to < refDate)) continue;
    if (!scope.schoolIds.has(a.schoolId) || (scope.classIds && !scope.classIds.has(a.classId))) continue;
    seen.set(a.studentId, [...(seen.get(a.studentId) ?? []), a]);
  }
  const eligible: Allocation[] = []; const ambiguous: string[] = [];
  for (const [id, xs] of seen) xs.length === 1 ? eligible.push(xs[0]!) : ambiguous.push(id);
  return { eligible, ambiguous }; // duas alocações vigentes ⇒ conferência, nunca escolha
}

export type ApplicationState = "prevista" | "iniciada" | "concluida" | "pendente";
export type ApplicationEvent = { applicationId: string; seq: number; to: ApplicationState; actorPersonId: string; at: string; reason: string | null };
const NEXT: Record<ApplicationState, ApplicationState[]> = { prevista: ["iniciada", "pendente"], iniciada: ["concluida", "pendente"], pendente: ["iniciada"], concluida: [] };
export const applicationState = (ev: readonly ApplicationEvent[], id: string): ApplicationState =>
  ev.filter((e) => e.applicationId === id).sort((a, b) => a.seq - b.seq).at(-1)?.to ?? "prevista";

export function advanceApplication(a: { events: readonly ApplicationEvent[]; applicationId: string; to: ApplicationState; actorPersonId: string | null;
  responsibles: ReadonlySet<string>; expectedSeq: number; reason: string | null; at: string }) {
  if (!a.actorPersonId) return { ok: false as const, reason: "pessoa natural obrigatória" };
  if (!a.responsibles.has(a.actorPersonId)) return { ok: false as const, reason: "só responsável designado pela aplicação" };
  const mine = a.events.filter((e) => e.applicationId === a.applicationId);
  const seq = mine.length ? Math.max(...mine.map((e) => e.seq)) : 0;
  const dup = mine.find((e) => e.seq === a.expectedSeq + 1 && e.to === a.to && e.actorPersonId === a.actorPersonId);
  if (dup) return { ok: true as const, event: dup };
  if (seq !== a.expectedSeq) return { ok: false as const, reason: "base esperada divergente" };
  const from = applicationState(a.events, a.applicationId);
  if (!NEXT[from].includes(a.to)) return { ok: false as const, reason: `transição ${from}→${a.to} não permitida` };
  if (a.to === "pendente" && !a.reason?.trim()) return { ok: false as const, reason: "motivo obrigatório para pendência" };
  return { ok: true as const, event: { applicationId: a.applicationId, seq: seq + 1, to: a.to, actorPersonId: a.actorPersonId, at: a.at, reason: a.reason } };
}

/** Categoria configurada na avaliação. `counts` diz se entra no denominador de participação. */
export type ParticipationCategory = { id: string; label: string; participated: boolean; requiresReason: boolean; counts: boolean };
export const PARTICIPATION_PROPOSAL: readonly ParticipationCategory[] = [
  { id: "participou", label: "Participou", participated: true, requiresReason: false, counts: true },
  { id: "ausente", label: "Ausente", participated: false, requiresReason: false, counts: true },
  { id: "nao-realizada", label: "Aplicação não realizada", participated: false, requiresReason: true, counts: false },
  { id: "invalidada", label: "Aplicação invalidada", participated: false, requiresReason: true, counts: false },
  { id: "excepcional", label: "Situação excepcional", participated: false, requiresReason: true, counts: false },
]; // proposta: só vale se a configuração da avaliação for homologada

export type ParticipationEntry = { applicationId: string; studentId: string; categoryId: string; reasonCode: string | null; recordedBy: string; version: number; at: string };
const SENSITIVE = /\b(cid|laudo|diagn[oó]stic|f\d{2}(\.\d)?|tdah|autis|defici[eê]nc|medica)/i;

export function recordParticipation(a: { categories: readonly ParticipationCategory[] | null; eligibleIds: ReadonlySet<string>; prior: readonly ParticipationEntry[];
  entry: Omit<ParticipationEntry, "version">; appState: ApplicationState }) {
  if (!a.categories) return { ok: false as const, reason: "categorias de participação não homologadas para esta avaliação" };
  if (a.appState === "prevista") return { ok: false as const, reason: "aplicação não iniciada" };
  if (!a.eligibleIds.has(a.entry.studentId)) return { ok: false as const, reason: "estudante não elegível na data de referência" };
  const cat = a.categories.find((c) => c.id === a.entry.categoryId);
  if (!cat) return { ok: false as const, reason: "categoria não configurada" };
  if (cat.requiresReason && !a.entry.reasonCode?.trim()) return { ok: false as const, reason: "motivo obrigatório" };
  if (a.entry.reasonCode && SENSITIVE.test(a.entry.reasonCode)) return { ok: false as const, reason: "motivo com dado clínico recusado — use código do catálogo; dado de saúde é do NEI" };
  const prev = a.prior.filter((p) => p.applicationId === a.entry.applicationId && p.studentId === a.entry.studentId);
  const head = prev.sort((x, y) => x.version - y.version).at(-1);
  if (head && head.categoryId === a.entry.categoryId && head.reasonCode === a.entry.reasonCode) return { ok: true as const, entry: head }; // idempotente
  return { ok: true as const, entry: { ...a.entry, version: (head?.version ?? 0) + 1 } }; // correção = nova versão
}

/** Painel §12.2: sem registro ≠ ausente; taxa só com denominador > 0. */
export function participationSummary(eligible: readonly string[], entries: readonly ParticipationEntry[], categories: readonly ParticipationCategory[]) {
  const head = new Map<string, ParticipationEntry>();
  for (const e of [...entries].sort((a, b) => a.version - b.version)) head.set(e.studentId, e);
  const byCat: Record<string, number> = {}; let participated = 0, denom = 0, unregistered = 0;
  for (const s of eligible) {
    const e = head.get(s); if (!e) { unregistered++; continue; }
    const c = categories.find((x) => x.id === e.categoryId); byCat[e.categoryId] = (byCat[e.categoryId] ?? 0) + 1;
    if (c?.counts) { denom++; if (c.participated) participated++; }
  }
  return { eligible: eligible.length, unregistered, byCategory: byCat, rate: denom > 0 ? participated / denom : null };
}

/** Ocorrência/adaptação: só código de catálogo + descrição sem dado clínico. */
export function occurrenceProblems(o: { kind: string; description: string; studentId: string | null; adaptationApprovedRef: string | null; isAdaptation: boolean }) {
  const p: string[] = [];
  if (!o.kind) p.push("tipo de ocorrência obrigatório");
  if (SENSITIVE.test(o.description)) p.push("descrição com dado clínico recusada");
  if (o.isAdaptation && !o.adaptationApprovedRef) p.push("adaptação só com referência à adaptação aprovada (Lote 05)");
  return p;
}
