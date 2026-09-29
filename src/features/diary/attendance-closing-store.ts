/**
 * Etapa 12H.1 — repositório do ciclo de fechamento da frequência.
 *
 * Guarda APENAS fatos do processo (estado do fluxo, eventos auditados) e as
 * versões oficiais imutáveis. A chamada (11C) continua sendo a única fonte dos
 * lançamentos: aqui não existe pauta paralela editável.
 *
 * Sem persistência real: o contrato existe para uma persistência futura.
 */
import { useSyncExternalStore } from "react";
import { setAttendanceEditGuard } from "./attendance";
import {
  attendanceActorStamp,
  attendanceBlocking,
  attendanceChain,
  attendanceChainIssues,
  attendanceClosingPendencies,
  attendanceDeliveryPendencies,
  attendanceEditLockReason,
  attendanceScopeKey,
  attendanceTransitionAllowed,
  canAttendance,
  currentAttendanceClosing,
  emptyAttendanceWorkflow,
  missingAttendanceCapabilityReason,
  scopeTotals,
  studentAttendanceFacts,
  ATTENDANCE_ACTION_CAPABILITY,
  ATTENDANCE_STAGE_AFTER,
  type AttendanceClosingContext,
} from "./attendance-closing";
import {
  ATTENDANCE_ACTION_LABEL,
  ATTENDANCE_STAGE_LABEL,
  type AttendanceClosingAction,
  type AttendanceClosingActor,
  type AttendanceClosingEvent,
  type AttendanceClosingRevision,
  type AttendanceClosingScope,
  type AttendanceClosingWorkflow,
  type PeriodAttendanceClosingRecord,
} from "./attendance-closing-types";

export type AttendanceStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; reasons: string[] };

type State = {
  workflows: Record<string, AttendanceClosingWorkflow>;
  records: PeriodAttendanceClosingRecord[];
};

export type AttendanceClosingActionInput = {
  ctx: AttendanceClosingContext;
  actor: AttendanceClosingActor;
  action: AttendanceClosingAction;
  justification?: string;
  studentId?: string;
  authorizer?: AttendanceClosingActor;
  now?: string;
};

export function createAttendanceClosingStore(seed: Partial<State> = {}) {
  let state: State = { workflows: seed.workflows ?? {}, records: seed.records ?? [] };
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const fail = (...reasons: string[]): AttendanceStoreResult<never> => ({ ok: false, reasons });

  const workflow = (scope: AttendanceClosingScope): AttendanceClosingWorkflow =>
    state.workflows[attendanceScopeKey(scope)] ?? emptyAttendanceWorkflow(scope);

  function buildRecord(args: {
    ctx: AttendanceClosingContext;
    actor: AttendanceClosingActor;
    at: string;
    revision?: AttendanceClosingRevision;
  }): AttendanceStoreResult<PeriodAttendanceClosingRecord> {
    const { ctx } = args;
    if (!ctx.calendarId || !ctx.officialPeriod)
      return fail(
        "Fechamento oficial de frequência exige período de calendário escolar homologado.",
      );
    if (ctx.policy.status !== "homologada")
      return fail(
        "Fechamento oficial de frequência exige política de apuração homologada pela rede.",
      );
    const scopeKey = attendanceScopeKey(ctx.scope);
    const preceding = currentAttendanceClosing(state.records, scopeKey);
    const version = (preceding?.version ?? 0) + 1;
    const students = studentAttendanceFacts(ctx);
    return {
      ok: true,
      value: {
        id: `frq-${scopeKey.replace(/[|:]/g, "-")}-v${version}`,
        scope: ctx.scope,
        version,
        ...(preceding ? { precedingClosingId: preceding.id } : {}),
        factKind: "fatos-oficiais-de-frequencia-do-periodo",
        policyId: ctx.policy.id,
        policyVersion: ctx.policy.version,
        unitKind: ctx.policy.unitKind,
        calendarId: ctx.calendarId,
        periodLabel: ctx.period.label,
        periodStart: ctx.period.start,
        periodEnd: ctx.period.end,
        closedBy: attendanceActorStamp(args.actor, args.at),
        closedAt: args.at,
        ...(args.revision ? { revision: args.revision } : {}),
        lessonEntryIds: [
          ...new Set(
            ctx.lessons.filter((e) => e.status !== "Rascunho local").map((entry) => entry.id),
          ),
        ],
        totals: scopeTotals(ctx),
        students,
      },
    };
  }

  const api = {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot: () => state,
    workflow,
    stage: (scope: AttendanceClosingScope) => workflow(scope).stage,
    events: (scope: AttendanceClosingScope) => workflow(scope).events,
    chain: (scope: AttendanceClosingScope) =>
      attendanceChain(state.records, attendanceScopeKey(scope)),
    current: (scope: AttendanceClosingScope) =>
      currentAttendanceClosing(state.records, attendanceScopeKey(scope)),
    issues: (scope: AttendanceClosingScope) =>
      attendanceChainIssues(state.records, attendanceScopeKey(scope)),
    allRecords: () => state.records as readonly PeriodAttendanceClosingRecord[],
    /** Motivo pelo qual a chamada de um registro está travada, quando houver. */
    editLockReason: (entryId: string) => attendanceEditLockReason(state.records, entryId),
    reset: () => set({ workflows: {}, records: [] }),
    /** Espelho somente leitura do banco (modo com sessão). */
    hydrate: (next: State) => set(next),

    /** Única escrita do ciclo: capacidade + estado + pendências bloqueantes. */
    act(input: AttendanceClosingActionInput): AttendanceStoreResult<AttendanceClosingWorkflow> {
      const at = input.now ?? new Date().toISOString();
      const wf = workflow(input.ctx.scope);
      const ctx: AttendanceClosingContext = { ...input.ctx, stage: wf.stage };
      const capability = ATTENDANCE_ACTION_CAPABILITY[input.action];
      if (!canAttendance(input.actor, capability))
        return fail(missingAttendanceCapabilityReason(capability));
      if (!attendanceTransitionAllowed(input.action, wf.stage))
        return fail(
          `${ATTENDANCE_ACTION_LABEL[input.action]} não é possível com a frequência em "${ATTENDANCE_STAGE_LABEL[wf.stage]}".`,
        );

      const justification = (input.justification ?? "").trim();
      const requiresJustification =
        input.action === "devolucao-com-apontamentos" ||
        input.action === "retificacao-pontual" ||
        input.action === "reabertura-integral";
      if (requiresJustification && !justification)
        return fail("Informe a justificativa: esta operação é uma exceção formal auditada.");

      let record: PeriodAttendanceClosingRecord | undefined;
      let revision: AttendanceClosingRevision | undefined;

      if (input.action === "entrega-docente") {
        const stop = attendanceBlocking(attendanceDeliveryPendencies(ctx));
        if (stop.length) return fail(...stop.map((p) => p.message));
      }

      if (input.action === "fechamento-oficial" || input.action === "retificacao-pontual") {
        if (input.action === "retificacao-pontual") {
          const authorizer =
            input.authorizer ??
            (canAttendance(input.actor, "autorizar-retificacao-de-frequencia")
              ? input.actor
              : undefined);
          if (!authorizer || !canAttendance(authorizer, "autorizar-retificacao-de-frequencia"))
            return fail(missingAttendanceCapabilityReason("autorizar-retificacao-de-frequencia"));
          revision = {
            kind: "retificacao-pontual",
            justification,
            authorizedBy: attendanceActorStamp(authorizer, at),
            ...(input.studentId ? { studentId: input.studentId } : {}),
          };
        } else {
          const stop = attendanceBlocking(attendanceClosingPendencies(ctx));
          if (stop.length) return fail(...stop.map((p) => p.message));
        }
        const built = buildRecord({
          ctx,
          actor: input.actor,
          at,
          ...(revision ? { revision } : {}),
        });
        if (!built.ok) return built;
        record = built.value;
      }

      if (input.action === "reabertura-integral") {
        const current = currentAttendanceClosing(state.records, attendanceScopeKey(ctx.scope));
        if (!current) return fail("Não existe fechamento oficial de frequência a reabrir.");
      }

      const event: AttendanceClosingEvent = {
        at,
        action: input.action,
        actor: attendanceActorStamp(input.actor, at),
        detail: ATTENDANCE_ACTION_LABEL[input.action],
        ...(justification ? { justification } : {}),
        ...(record ? { closingId: record.id, closingVersion: record.version } : {}),
      };
      const next: AttendanceClosingWorkflow = {
        scopeKey: attendanceScopeKey(ctx.scope),
        scope: ctx.scope,
        stage: ATTENDANCE_STAGE_AFTER[input.action],
        events: [...wf.events, event],
      };
      // Versões anteriores permanecem intactas: só acrescentamos.
      set({
        workflows: { ...state.workflows, [next.scopeKey]: next },
        records: record ? [...state.records, record] : state.records,
      });
      return { ok: true, value: next };
    },
  };
  return api;
}

export type AttendanceClosingStore = ReturnType<typeof createAttendanceClosingStore>;
export const attendanceClosingStore = createAttendanceClosingStore();

/**
 * Trava institucional: chamada coberta por fechamento vigente não é sobrescrita.
 * Antes do fechamento não existe prazo arbitrário de edição.
 */
setAttendanceEditGuard((entryId) => attendanceClosingStore.editLockReason(entryId));

export function useAttendanceClosingStore(
  store: AttendanceClosingStore = attendanceClosingStore,
) {
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
