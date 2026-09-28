/**
 * Etapa 12G — repositório do ciclo de fechamento.
 *
 * Guarda APENAS fatos do processo (estado do fluxo, eventos auditados) e as
 * versões oficiais de fechamento. Os dados acadêmicos continuam vivendo nos
 * lançamentos (12C): aqui nada é editável como pauta paralela.
 *
 * Sem persistência real: o contrato existe para uma persistência futura.
 */
import { useSyncExternalStore } from "react";
import { demonstrationStudents } from "@/features/students/students-data";
import { journeyLabClosings } from "./recovery-journey-lab";
import type { DomainResult } from "./assessment-instruments";
import {
  actorStamp,
  blocking,
  can,
  closingChain,
  closingChainIssues,
  closingScopeKey,
  CLOSING_ACTION_CAPABILITY,
  CLOSING_STAGE_AFTER,
  currentClosing,
  deliveryPendencies,
  emptyWorkflow,
  materializeResults,
  missingCapabilityReason,
  officialClosingPendencies,
  officialModel,
  transitionAllowed,
  type ClosingContext,
} from "./period-closing";
import {
  CLOSING_ACTION_LABEL,
  CLOSING_STAGE_LABEL,
  type ClosingAction,
  type ClosingActor,
  type ClosingEvent,
  type ClosingRevision,
  type ClosingScope,
  type ClosingWorkflow,
  type PeriodClosingRecord,
} from "./period-closing-types";

type State = {
  workflows: Record<string, ClosingWorkflow>;
  records: PeriodClosingRecord[];
};

export type ClosingActionInput = {
  ctx: ClosingContext;
  actor: ClosingActor;
  action: ClosingAction;
  justification?: string;
  /** Aluno atingido pela retificação pontual. */
  studentId?: string;
  /** Ator que autoriza a retificação, quando o executor não acumula a capacidade. */
  authorizer?: ClosingActor;
  now?: string;
};

export function createPeriodClosingStore(seed: Partial<State> = {}) {
  let state: State = {
    workflows: seed.workflows ?? {},
    records: seed.records ?? [],
  };
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const fail = (...reasons: string[]): DomainResult<never> => ({ ok: false, reasons });

  const workflow = (scope: ClosingScope): ClosingWorkflow =>
    state.workflows[closingScopeKey(scope)] ?? emptyWorkflow(scope);

  function buildRecord(args: {
    ctx: ClosingContext;
    actor: ClosingActor;
    at: string;
    revision?: ClosingRevision;
  }): DomainResult<PeriodClosingRecord> {
    const { ctx } = args;
    const model = officialModel(ctx);
    if (!model || !ctx.rule || !ctx.calendarId)
      return fail(
        "Fechamento oficial exige calendário homologado e regra avaliativa homologada aplicável.",
      );
    const scopeKey = closingScopeKey(ctx.scope);
    const preceding = currentClosing(state.records, scopeKey);
    const version = (preceding?.version ?? 0) + 1;
    return {
      ok: true,
      value: {
        id: `fec-${scopeKey.replace(/\|/g, "-")}-v${version}`,
        scope: ctx.scope,
        version,
        ...(preceding ? { precedingClosingId: preceding.id } : {}),
        resultKind: "resultado-consolidado-oficial-do-periodo",
        ruleId: ctx.rule.id,
        ruleVersion: ctx.rule.version,
        calendarId: ctx.calendarId,
        configurationId: ctx.configuration.id,
        ...(ctx.configuration.version !== undefined
          ? { configurationVersion: ctx.configuration.version }
          : {}),
        closedBy: actorStamp(args.actor, args.at),
        closedAt: args.at,
        ...(args.revision ? { revision: args.revision } : {}),
        // Resultado MATERIALIZADO pelo motor a partir dos lançamentos canônicos.
        results: materializeResults(ctx, model),
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
    stage: (scope: ClosingScope) => workflow(scope).stage,
    events: (scope: ClosingScope) => workflow(scope).events,
    chain: (scope: ClosingScope) => closingChain(state.records, closingScopeKey(scope)),
    current: (scope: ClosingScope) => currentClosing(state.records, closingScopeKey(scope)),
    issues: (scope: ClosingScope) => closingChainIssues(state.records, closingScopeKey(scope)),
    allRecords: () => state.records as readonly PeriodClosingRecord[],

    /** Única escrita do ciclo. Capacidade + estado + pendências bloqueantes. */
    act(input: ClosingActionInput): DomainResult<ClosingWorkflow> {
      const at = input.now ?? new Date().toISOString();
      const wf = workflow(input.ctx.scope);
      const ctx: ClosingContext = { ...input.ctx, stage: wf.stage, events: wf.events };
      const capability = CLOSING_ACTION_CAPABILITY[input.action];
      if (!can(input.actor, capability)) return fail(missingCapabilityReason(capability));
      if (!transitionAllowed(input.action, wf.stage))
        return fail(
          `${CLOSING_ACTION_LABEL[input.action]} não é possível com o período em "${CLOSING_STAGE_LABEL[wf.stage]}".`,
        );

      const justification = (input.justification ?? "").trim();
      const requiresJustification =
        input.action === "devolucao-com-apontamentos" ||
        input.action === "retificacao-pontual" ||
        input.action === "reabertura-integral";
      if (requiresJustification && !justification)
        return fail("Informe a justificativa: esta operação é uma exceção formal auditada.");

      let record: PeriodClosingRecord | undefined;
      let revision: ClosingRevision | undefined;

      if (input.action === "entrega-docente") {
        const stop = blocking(deliveryPendencies(ctx, input.actor));
        if (stop.length) return fail(...stop.map((p) => p.message));
      }

      if (input.action === "fechamento-oficial" || input.action === "retificacao-pontual") {
        if (input.action === "retificacao-pontual") {
          const authorizer =
            input.authorizer ??
            (can(input.actor, "autorizar-retificacao-pos-fechamento") ? input.actor : undefined);
          if (!authorizer || !can(authorizer, "autorizar-retificacao-pos-fechamento"))
            return fail(missingCapabilityReason("autorizar-retificacao-pos-fechamento"));
          revision = {
            kind: "retificacao-pontual",
            justification,
            authorizedBy: actorStamp(authorizer, at),
            ...(input.studentId ? { studentId: input.studentId } : {}),
          };
        } else {
          const stop = blocking(officialClosingPendencies(ctx, input.actor));
          if (stop.length) return fail(...stop.map((p) => p.message));
        }
        const built = buildRecord({ ctx, actor: input.actor, at, ...(revision ? { revision } : {}) });
        if (!built.ok) return built;
        record = built.value;
      }

      if (input.action === "reabertura-integral") {
        const current = currentClosing(state.records, closingScopeKey(ctx.scope));
        if (!current) return fail("Não existe fechamento oficial a reabrir.");
      }

      const event: ClosingEvent = {
        at,
        action: input.action,
        actor: actorStamp(input.actor, at),
        detail: CLOSING_ACTION_LABEL[input.action],
        ...(justification ? { justification } : {}),
        ...(record ? { closingId: record.id, closingVersion: record.version } : {}),
      };
      const next: ClosingWorkflow = {
        scopeKey: closingScopeKey(ctx.scope),
        scope: ctx.scope,
        stage: CLOSING_STAGE_AFTER[input.action],
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

export type PeriodClosingStore = ReturnType<typeof createPeriodClosingStore>;
// 6D.3.5.7 — fechamentos FICTÍCIOS da jornada de laboratório (turma tur-001).
export const periodClosingStore = createPeriodClosingStore({
  records: journeyLabClosings(demonstrationStudents.map((s) => s.id)),
});

export function usePeriodClosingStore(store: PeriodClosingStore = periodClosingStore) {
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
