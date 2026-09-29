/**
 * Etapa 12K — repositório do encerramento do ciclo e da turma.
 *
 * Guarda políticas configuradas e SNAPSHOTS versionados. Snapshot lavrado nunca
 * é editado: retificação e reabertura acrescentam nova versão encadeada,
 * preservando integralmente o que existia — inclusive o diagnóstico, as fontes e
 * os fatos materializados daquele momento.
 *
 * Os estados institucionais são recebidos como DADO (`institutionalState`): o
 * repositório não conhece "aberto", "encerrado" nem "em retificação".
 *
 * Sem persistência real: o contrato existe para uma persistência futura
 * append-only, onde a imutabilidade deixa de depender de congelamento em memória.
 */
import { useSyncExternalStore } from "react";
import {
  closingActorStamp,
  closingCapabilityIssues,
  closingCan,
  freezeDeep,
  missingClosingCapabilityReason,
  operationAdmissibility,
  rectificationIssues,
  type AdmissibilityDecision,
} from "./cycle-closing-governance";
import type {
  ClassCycleClosingSnapshot,
  ClosingActor,
  ClosingAuditEvent,
  ClosingDiagnosis,
  ClosingMaterializedFact,
  ClosingSourceReference,
  CycleClosingPolicy,
  InstitutionalState,
  StudentCycleClosingRecord,
} from "./cycle-closing-types";

export type ClosingStoreResult<T> = { ok: true; value: T } | { ok: false; reasons: string[] };

type State = {
  policies: CycleClosingPolicy[];
  snapshots: ClassCycleClosingSnapshot[];
};

export type ClosingPolicyAction =
  | "criar"
  | "editar"
  | "enviar-para-revisao"
  | "devolver-para-rascunho"
  | "homologar"
  | "arquivar";

export const CLOSING_POLICY_ACTION_LABEL: Record<ClosingPolicyAction, string> = {
  criar: "Política de encerramento criada",
  editar: "Política de encerramento alterada",
  "enviar-para-revisao": "Política enviada para revisão",
  "devolver-para-rascunho": "Política devolvida para rascunho",
  homologar: "Política homologada",
  arquivar: "Política arquivada",
};

const STATUS_AFTER: Record<ClosingPolicyAction, CycleClosingPolicy["status"]> = {
  criar: "rascunho",
  editar: "rascunho",
  "enviar-para-revisao": "em-revisao",
  "devolver-para-rascunho": "rascunho",
  homologar: "homologada",
  arquivar: "arquivada",
};

export const CLOSING_POLICY_CAPABILITY: Record<ClosingPolicyAction, string> = {
  criar: "configurar-encerramento",
  editar: "configurar-encerramento",
  "enviar-para-revisao": "configurar-encerramento",
  "devolver-para-rascunho": "revisar-encerramento",
  homologar: "homologar-encerramento",
  arquivar: "homologar-encerramento",
};

export const closingScopeKey = (args: { classId: string; cycleId: string }) =>
  `${args.classId}|${args.cycleId}`;

export const currentClosingSnapshot = (
  snapshots: readonly ClassCycleClosingSnapshot[],
  scope: { classId: string; cycleId: string },
) =>
  snapshots
    .filter((item) => item.classId === scope.classId && item.cycleId === scope.cycleId)
    .reduce<ClassCycleClosingSnapshot | undefined>(
      (latest, item) => (!latest || item.version > latest.version ? item : latest),
      undefined,
    );

export const closingChain = (
  snapshots: readonly ClassCycleClosingSnapshot[],
  scope: { classId: string; cycleId: string },
) =>
  snapshots
    .filter((item) => item.classId === scope.classId && item.cycleId === scope.cycleId)
    .slice()
    .sort((a, b) => a.version - b.version);

export function createCycleClosingStore(seed: Partial<State> = {}) {
  let state: State = { policies: seed.policies ?? [], snapshots: seed.snapshots ?? [] };
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const fail = (...reasons: string[]): ClosingStoreResult<never> => ({ ok: false, reasons });

  type LavraturaInput = {
    actor: ClosingActor;
    policy: CycleClosingPolicy;
    classId: string;
    cycleId: string;
    unitId?: string;
    academicYearId?: string;
    /** Intervalo do ciclo em ISO; opcional e independente de "ano". */
    cycleStartDate?: string;
    cycleEndDate?: string;
    diagnosis: ClosingDiagnosis;
    students: readonly StudentCycleClosingRecord[];
    sources: readonly ClosingSourceReference[];
    facts: readonly ClosingMaterializedFact[];
    /** Estado institucional resultante, declarado pela configuração. */
    institutionalState: InstitutionalState;
    actKindId: string;
    actKindLabel: string;
    justification?: string;
    note?: string;
    now?: string;
  };

  const build = (
    input: LavraturaInput,
    preceding: ClassCycleClosingSnapshot | undefined,
    at: string,
  ): ClassCycleClosingSnapshot => {
    const version = (preceding?.version ?? 0) + 1;
    const key = closingScopeKey(input).replace(/\|/g, "-");
    return freezeDeep<ClassCycleClosingSnapshot>({
      id: `enc-${key}-v${version}`,
      version,
      ...(preceding ? { precedingClosingId: preceding.id } : {}),
      classId: input.classId,
      cycleId: input.cycleId,
      ...(input.unitId ? { unitId: input.unitId } : {}),
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      ...(input.cycleStartDate ? { cycleStartDate: input.cycleStartDate } : {}),
      ...(input.cycleEndDate ? { cycleEndDate: input.cycleEndDate } : {}),
      policyId: input.policy.id,
      policyVersion: input.policy.version,
      institutionalState: input.institutionalState,
      act: {
        id: `ato-${key}-v${version}`,
        kindId: input.actKindId,
        kindLabel: input.actKindLabel,
        declaredAt: at,
        declaredBy: closingActorStamp(input.actor, at),
        ...(input.justification ? { justification: input.justification } : {}),
        ...(preceding ? { supersedesClosingId: preceding.id } : {}),
        ...(input.note ? { note: input.note } : {}),
      },
      diagnosis: input.diagnosis,
      students: input.students,
      sources: input.sources,
      facts: input.facts,
      materializedAt: at,
    });
  };

  const api = {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot: () => state,
    /** Espelho somente leitura dos encerramentos do banco (modo com sessão). */
    hydrateSnapshots: (snapshots: ClassCycleClosingSnapshot[]) => set({ ...state, snapshots }),

    policies: () => state.policies as readonly CycleClosingPolicy[],
    policy: (id: string, version?: number) =>
      state.policies
        .filter((item) => item.id === id && (version === undefined || item.version === version))
        .reduce<CycleClosingPolicy | undefined>(
          (latest, item) => (!latest || item.version > latest.version ? item : latest),
          undefined,
        ),
    snapshots: () => state.snapshots as readonly ClassCycleClosingSnapshot[],
    current: (scope: { classId: string; cycleId: string }) =>
      currentClosingSnapshot(state.snapshots, scope),
    chain: (scope: { classId: string; cycleId: string }) => closingChain(state.snapshots, scope),

    /** Estado institucional vigente; sem snapshot, vale o estado inicial recebido. */
    institutionalState: (
      scope: { classId: string; cycleId: string },
      initialState: InstitutionalState,
    ) => currentClosingSnapshot(state.snapshots, scope)?.institutionalState ?? initialState,

    /** Consulta da matriz governável para uma operação de qualquer módulo. */
    admissibility(input: {
      policy: CycleClosingPolicy;
      classId: string;
      cycleId: string;
      operationId: string;
      initialState: InstitutionalState;
    }): AdmissibilityDecision {
      return operationAdmissibility({
        ...(input.policy.admissibilityPolicy
          ? { policy: input.policy.admissibilityPolicy }
          : {}),
        operationId: input.operationId,
        institutionalState: api.institutionalState(input, input.initialState),
      });
    },

    actOnPolicy(input: {
      action: ClosingPolicyAction;
      actor: ClosingActor;
      policy: CycleClosingPolicy;
      detail?: string;
      now?: string;
    }): ClosingStoreResult<CycleClosingPolicy> {
      const at = input.now ?? new Date().toISOString();
      const capability = CLOSING_POLICY_CAPABILITY[input.action];
      if (!closingCan(input.actor, capability))
        return fail(missingClosingCapabilityReason(capability));
      const stored = state.policies.find(
        (item) => item.id === input.policy.id && item.version === input.policy.version,
      );
      if (stored && stored.status === "homologada" && input.action === "editar")
        return fail(
          "Política homologada é imutável. Alteração exige nova versão, preservando encerramentos históricos.",
        );
      const event: ClosingAuditEvent = {
        at,
        action: CLOSING_POLICY_ACTION_LABEL[input.action],
        actor: closingActorStamp(input.actor, at),
        detail: input.detail ?? CLOSING_POLICY_ACTION_LABEL[input.action],
      };
      const next: CycleClosingPolicy = {
        ...input.policy,
        status: STATUS_AFTER[input.action],
        audit: { events: [...(stored?.audit.events ?? []), event], demonstrative: true },
      };
      set({
        ...state,
        policies: stored
          ? state.policies.map((item) =>
              item.id === next.id && item.version === next.version ? next : item,
            )
          : [...state.policies, next],
      });
      return { ok: true, value: next };
    },

    /**
     * Lavra o ato de encerramento. Só avança com o diagnóstico admissível: os
     * impedimentos são devolvidos por extenso, nunca silenciados.
     */
    close(input: LavraturaInput): ClosingStoreResult<ClassCycleClosingSnapshot> {
      const at = input.now ?? new Date().toISOString();
      const reasons = closingCapabilityIssues(input.policy, input.actor);
      if (!input.diagnosis.closable) reasons.push(...input.diagnosis.impediments);
      const preceding = api.current(input);
      if (preceding && preceding.act.kindId !== "reabertura")
        reasons.push(
          "Esta turma já possui encerramento lavrado. Alteração exige rito formal de retificação ou reabertura.",
        );
      if (reasons.length) return fail(...reasons);
      const value = build(input, preceding, at);
      set({ ...state, snapshots: [...state.snapshots, value] });
      return { ok: true, value };
    },

    /** Retificação: nova versão encadeada. A anterior permanece intacta. */
    rectify(
      input: LavraturaInput & { justification: string },
    ): ClosingStoreResult<ClassCycleClosingSnapshot> {
      const at = input.now ?? new Date().toISOString();
      const preceding = api.current(input);
      if (!preceding) return fail("Não existe encerramento lavrado para retificar nesta turma.");
      const reasons = rectificationIssues(input.policy, {
        actor: input.actor,
        justification: input.justification,
      });
      if (reasons.length) return fail(...reasons);
      const value = build(input, preceding, at);
      set({ ...state, snapshots: [...state.snapshots, value] });
      return { ok: true, value };
    },

    /**
     * Reabertura: rito formal e auditado. Não apaga o encerramento anterior —
     * acrescenta versão declarando o novo estado institucional.
     */
    reopen(input: {
      actor: ClosingActor;
      policy: CycleClosingPolicy;
      classId: string;
      cycleId: string;
      justification: string;
      institutionalState: InstitutionalState;
      actKindLabel: string;
      now?: string;
    }): ClosingStoreResult<ClassCycleClosingSnapshot> {
      const at = input.now ?? new Date().toISOString();
      const preceding = api.current(input);
      if (!preceding) return fail("Não existe encerramento lavrado para reabrir nesta turma.");
      const reasons = rectificationIssues(input.policy, {
        actor: input.actor,
        justification: input.justification,
      });
      if (reasons.length) return fail(...reasons);
      const value = build(
        {
          actor: input.actor,
          policy: input.policy,
          classId: input.classId,
          cycleId: input.cycleId,
          ...(preceding.unitId ? { unitId: preceding.unitId } : {}),
          ...(preceding.academicYearId ? { academicYearId: preceding.academicYearId } : {}),
          diagnosis: preceding.diagnosis,
          students: preceding.students,
          sources: preceding.sources,
          facts: preceding.facts,
          institutionalState: input.institutionalState,
          actKindId: "reabertura",
          actKindLabel: input.actKindLabel,
          justification: input.justification,
          now: at,
        },
        preceding,
        at,
      );
      set({ ...state, snapshots: [...state.snapshots, value] });
      return { ok: true, value };
    },
  };
  return api;
}

export type CycleClosingStore = ReturnType<typeof createCycleClosingStore>;

export const cycleClosingStore = createCycleClosingStore();

export function useCycleClosingStore(store: CycleClosingStore = cycleClosingStore) {
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
