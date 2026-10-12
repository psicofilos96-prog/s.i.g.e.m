/**
 * SIGEM Permanência L01 — o que está liberado: sinal de permanência derivado só das fontes
 * canônicas, e contrato do executor técnico (restrito, idempotente, auditável, fail-closed).
 * O executor NUNCA abre caso, registra contato, classifica evasão nem consulta a BAE nacional:
 * só detecta e propõe; quem age é pessoa natural pelos writers do AA (aa_open_outreach_case).
 */
import type { InfrequencyRow } from "@/features/educational-intelligence/infrequency-source";
import { NATIONAL_BAE } from "./permanence-audit";

export interface HomologatedThreshold { policyId: string; version: number; maxAbsenceRate: number; minMarkedLessons: number; decisionRef: string }

export type PermanenceSignal =
  | { kind: "acima-do-limiar"; studentId: string; classId: string; rate: number; marked: number; policy: string }
  | { kind: "sem-limiar"; studentId: string; classId: string; reason: string }
  | { kind: "base-insuficiente"; studentId: string; classId: string; marked: number }
  | { kind: "dentro-do-limiar"; studentId: string; classId: string };

/** Sem limiar homologado nada vira alerta; ausência de marcação fica fora do denominador. */
export function permanenceSignals(rows: readonly InfrequencyRow[], threshold: HomologatedThreshold | null): PermanenceSignal[] {
  const acc = new Map<string, { s: string; c: string; p: number; a: number }>();
  for (const r of rows) {
    const k = `${r.student_id}|${r.class_id}`;
    const x = acc.get(k) ?? { s: r.student_id, c: r.class_id, p: 0, a: 0 };
    x.p += r.present; x.a += r.absent; acc.set(k, x);
  }
  return [...acc.values()].map(({ s, c, p, a }) => {
    if (!threshold || !threshold.decisionRef) return { kind: "sem-limiar", studentId: s, classId: c, reason: "Limiar de infrequência não homologado." } as const;
    const marked = p + a;
    if (marked < threshold.minMarkedLessons) return { kind: "base-insuficiente", studentId: s, classId: c, marked } as const;
    const rate = a / marked;
    return rate > threshold.maxAbsenceRate
      ? ({ kind: "acima-do-limiar", studentId: s, classId: c, rate, marked, policy: `${threshold.policyId}@${threshold.version}` } as const)
      : ({ kind: "dentro-do-limiar", studentId: s, classId: c } as const);
  });
}

/** Rótulos proibidos: o sistema nunca afirma evasão/abandono a partir de faltas. */
export const FORBIDDEN_INFERRED_LABELS = ["evadido", "evasao", "abandono", "abandonou"] as const;

export type ExecutorAction = "detectar-sinais" | "propor-abertura" | "abrir-caso" | "registrar-contato" | "encerrar-caso" | "classificar-evasao" | "consultar-bae-nacional";
const ALLOWED: ReadonlySet<ExecutorAction> = new Set(["detectar-sinais", "propor-abertura"]);

export interface ExecutorRequest { action: ExecutorAction; idempotencyKey: string; actor: { kind: "executor-tecnico" | "pessoa-natural"; id: string }; scopeSchoolIds: readonly string[]; targetSchoolId: string }
export interface ExecutorAudit { at: string; action: ExecutorAction; actor: string; key: string; outcome: "aceito" | "repetido" | "recusado"; reason?: string }

/** Fail-closed: lista fechada de ações, escopo explícito, chave idempotente e trilha de toda chamada. */
export function createTechnicalExecutor(now: () => string = () => new Date().toISOString()) {
  const seen = new Set<string>();
  const trail: ExecutorAudit[] = [];
  function run(req: ExecutorRequest): { ok: true; repeated: boolean; writes: [] } | { ok: false; reason: string } {
    const log = (outcome: ExecutorAudit["outcome"], reason?: string) =>
      trail.push({ at: now(), action: req.action, actor: `${req.actor.kind}:${req.actor.id}`, key: req.idempotencyKey, outcome, ...(reason ? { reason } : {}) });
    const refuse = (reason: string) => { log("recusado", reason); return { ok: false as const, reason }; };
    if (req.actor.kind !== "executor-tecnico") return refuse("executor:not-technical");
    if (!ALLOWED.has(req.action)) return refuse(req.action === "consultar-bae-nacional" ? `executor:bae-${NATIONAL_BAE.statusWhenAbsent}` : "executor:action-requires-human");
    if (!/^[A-Za-z0-9:_-]{8,128}$/.test(req.idempotencyKey)) return refuse("executor:invalid-idempotency-key");
    if (!req.scopeSchoolIds.includes(req.targetSchoolId)) return refuse("executor:out-of-scope");
    const k = `${req.action}|${req.targetSchoolId}|${req.idempotencyKey}`;
    if (seen.has(k)) { log("repetido"); return { ok: true, repeated: true, writes: [] }; }
    seen.add(k); log("aceito");
    return { ok: true, repeated: false, writes: [] };
  }
  return { run, trail: () => [...trail] };
}
