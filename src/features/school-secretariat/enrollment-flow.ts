// Lote 03 Secretaria por unidade: ciclo da matrícula e rematrícula (núcleo puro).
// Complementa a matrícula guiada (enrollment-wizard-model) e o motor de lote (bulk-engine);
// efetivação real continua só por enrollment_draft_complete no banco.

export type EnrollmentStage = "rascunho" | "em-analise" | "complementacao" | "efetivada" | "cancelada";
export interface StageEvent { seq: number; stage: EnrollmentStage; at: string; actorPrincipalId: string; human: boolean; reason: string | null }
export type Result<T> = { ok: true; value: T } | { ok: false; code: string };

const NEXT: Record<EnrollmentStage, EnrollmentStage[]> = {
  rascunho: ["em-analise", "cancelada"],
  "em-analise": ["complementacao", "efetivada", "cancelada"],
  complementacao: ["em-analise", "cancelada"],
  efetivada: ["cancelada"],
  cancelada: [],
};

/** Cancelamento de efetivada só pelo rito permitido (desfazimento antes de efeito), com motivo. */
export function advance(events: StageEvent[], ev: Omit<StageEvent, "seq">, expectedSeq: number, opts: { cancelEffectiveAllowed: boolean }): Result<StageEvent[]> {
  const last = events.at(-1);
  if ((last?.seq ?? 0) !== expectedSeq) return { ok: false, code: "stale-base" };
  if (!ev.human) return { ok: false, code: "human-author-required" };
  const from = last?.stage ?? null;
  if (from === null ? ev.stage !== "rascunho" : !NEXT[from].includes(ev.stage)) return { ok: false, code: "invalid-transition" };
  if ((ev.stage === "cancelada" || ev.stage === "complementacao") && !ev.reason?.trim()) return { ok: false, code: "reason-required" };
  if (from === "efetivada" && ev.stage === "cancelada" && !opts.cancelEffectiveAllowed) return { ok: false, code: "cancel-not-allowed-use-movement" };
  return { ok: true, value: [...events, { ...ev, seq: expectedSeq + 1 }] };
}

// ---------- Verificações antes de efetivar ----------
export interface CheckInput {
  yearState: "em-preparacao" | "operacional" | "encerrado" | null;
  offerHomologated: boolean | null;
  positionDeclared: boolean; // etapa/ano do estudante (posição individual)
  startDate: string | null;
  conflictingActive: { schoolId: string; offerId: string }[]; // vínculos vigentes do estudante
  coexistenceAllowed: boolean | null; // política declarada
  missingDocuments: string[];
  laterRegularizationAllowed: boolean | null; // norma de regularização posterior
}
export interface CheckOutcome { blockers: string[]; pendencies: string[] }

export function checkEnrollment(c: CheckInput): CheckOutcome {
  const blockers: string[] = [];
  const pendencies: string[] = [];
  if (c.yearState == null) blockers.push("estado do ano letivo não lido");
  else if (c.yearState === "encerrado") blockers.push("ano letivo encerrado");
  if (c.offerHomologated !== true) blockers.push(c.offerHomologated == null ? "oferta não lida" : "oferta não homologada");
  if (!c.positionDeclared) blockers.push("etapa/ano do estudante não declarado");
  if (!c.startDate) blockers.push("data de início efetiva não declarada");
  if (c.conflictingActive.length && c.coexistenceAllowed !== true) blockers.push(c.coexistenceAllowed == null ? "vínculo vigente sem política de coexistência" : "vínculo vigente incompatível");
  // falta documental não recusa quando a regularização posterior é permitida
  if (c.missingDocuments.length) {
    if (c.laterRegularizationAllowed === true) pendencies.push(...c.missingDocuments.map((d) => `regularizar: ${d}`));
    else blockers.push(c.laterRegularizationAllowed == null ? "norma de regularização documental não declarada" : "documentação obrigatória ausente");
  }
  return { blockers, pendencies };
}

// ---------- Lote ----------
export interface BatchItem { key: string; check: CheckOutcome }
export function batchPreview(items: BatchItem[]) {
  const seen = new Set<string>();
  return items.map((i) => {
    if (seen.has(i.key)) return { key: i.key, status: "duplicado" as const, reasons: ["repetido no lote"] };
    seen.add(i.key);
    return i.check.blockers.length
      ? { key: i.key, status: "recusado" as const, reasons: i.check.blockers }
      : { key: i.key, status: "pronto" as const, reasons: i.check.pendencies };
  }); // nenhum item some do resultado
}

// ---------- Rematrícula ----------
export interface PriorEnrollment { enrollmentId: string; studentId: string; schoolId: string; year: string; standing: string | null; endedReason: string | null }
export interface ReenrollRule { fromStanding: string; continues: boolean }
export interface ReenrollRow { studentId: string; previousEnrollmentId: string; status: "proposta" | "excecao"; reason: string | null; idempotencyKey: string }

export function reenrollmentPreview(prior: PriorEnrollment[], schoolId: string, fromYear: string, toYear: string, rules: ReenrollRule[] | null, alreadyEnrolled: Set<string>): ReenrollRow[] {
  return prior.filter((p) => p.schoolId === schoolId && p.year === fromYear).map((p) => {
    const key = `rematricula:${schoolId}:${toYear}:${p.enrollmentId}`;
    const ex = (reason: string): ReenrollRow => ({ studentId: p.studentId, previousEnrollmentId: p.enrollmentId, status: "excecao", reason, idempotencyKey: key });
    if (alreadyEnrolled.has(p.studentId)) return ex("já matriculado no ano de destino");
    if (p.endedReason) return ex(`vínculo encerrado: ${p.endedReason}`);
    if (!rules) return ex("regra de rematrícula não homologada");
    if (p.standing == null) return ex("situação final não registrada");
    const r = rules.find((x) => x.fromStanding === p.standing);
    if (!r) return ex(`situação "${p.standing}" sem regra`);
    if (!r.continues) return ex(`situação "${p.standing}" não continua`);
    return { studentId: p.studentId, previousEnrollmentId: p.enrollmentId, status: "proposta", reason: null, idempotencyKey: key };
  });
}

/** Confirmação explícita: só itens propostos marcados por humano, com a mesma prévia; nada silencioso. */
export function confirmReenrollment(preview: ReenrollRow[], fingerprint: string, confirmed: { fingerprint: string; keys: string[]; actorPrincipalId: string; human: boolean }, done: Set<string>): Result<{ execute: ReenrollRow[]; skipped: string[] }> {
  if (!confirmed.human) return { ok: false, code: "human-confirmation-required" };
  if (confirmed.fingerprint !== fingerprint) return { ok: false, code: "preview-changed" };
  const picked = new Set(confirmed.keys);
  const execute = preview.filter((r) => r.status === "proposta" && picked.has(r.idempotencyKey) && !done.has(r.idempotencyKey));
  const skipped = preview.filter((r) => picked.has(r.idempotencyKey) && done.has(r.idempotencyKey)).map((r) => r.idempotencyKey);
  return { ok: true, value: { execute, skipped } };
}

export const previewFingerprint = (rows: ReenrollRow[]) => rows.map((r) => `${r.idempotencyKey}=${r.status}`).sort().join("|");
