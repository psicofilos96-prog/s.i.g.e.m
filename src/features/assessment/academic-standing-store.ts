/**
 * Etapa 12I — repositório das regras de situação, deliberações e determinações.
 *
 * Guarda apenas fatos do processo: versões imutáveis, eventos auditados e
 * deliberações registradas. Determinação histórica nunca é reescrita —
 * retificação, reprocessamento e deliberação acrescentam a versão seguinte,
 * encadeada por `precedingRecordId`.
 *
 * Sem persistência real: o contrato existe para uma persistência futura.
 */
import { useSyncExternalStore } from "react";
import {
  canStanding,
  missingStandingCapabilityReason,
  standingActorStamp,
  standingRuleIssues,
  standingTransitionAllowed,
  STANDING_ACTION_CAPABILITY,
  STANDING_ACTION_LABEL,
  STANDING_STATUS_AFTER,
  type StandingRuleAction,
} from "./academic-standing-governance";
import {
  STANDING_RULE_STATUS_LABEL,
  type AcademicStandingDetermination,
  type AcademicStandingRecord,
  type AcademicStandingRuleSet,
  type InstitutionalDeliberationRecord,
  type StandingActor,
  type StandingRecordRevision,
  type StandingRecordSourceReference,
  type StandingRuleAuditAction,
  type StandingRuleAuditEvent,
} from "./academic-standing-types";

export type StandingStoreResult<T> = { ok: true; value: T } | { ok: false; reasons: string[] };

type State = {
  ruleSets: AcademicStandingRuleSet[];
  deliberations: InstitutionalDeliberationRecord[];
  records: AcademicStandingRecord[];
};

const AUDIT_ACTION: Record<StandingRuleAction, StandingRuleAuditAction> = {
  criar: "criada",
  editar: "alterada",
  "enviar-para-revisao": "enviada-para-revisao",
  "devolver-para-rascunho": "devolvida-para-rascunho",
  homologar: "homologada",
  arquivar: "arquivada",
  duplicar: "duplicada",
};

export const standingScopeKey = (args: { cycleId: string; studentId: string }) =>
  `${args.cycleId}|${args.studentId}`;

export const currentStandingRecord = (
  records: readonly AcademicStandingRecord[],
  scopeKey: string,
) =>
  records
    .filter((record) => record.scopeKey === scopeKey)
    .reduce<AcademicStandingRecord | undefined>(
      (latest, record) => (!latest || record.version > latest.version ? record : latest),
      undefined,
    );

export const standingRecordChain = (
  records: readonly AcademicStandingRecord[],
  scopeKey: string,
) =>
  records
    .filter((record) => record.scopeKey === scopeKey)
    .slice()
    .sort((a, b) => a.version - b.version);

export const standingRecordReference = (
  record: AcademicStandingRecord,
): StandingRecordSourceReference => ({
  recordId: record.id,
  recordVersion: record.version,
  scopeKey: record.scopeKey,
  ruleSetId: record.ruleSetId,
  ruleSetVersion: record.ruleSetVersion,
  materializedAt: record.determinedAt,
});

export function createAcademicStandingStore(seed: Partial<State> = {}) {
  let state: State = {
    ruleSets: seed.ruleSets ?? [],
    deliberations: seed.deliberations ?? [],
    records: seed.records ?? [],
  };
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const fail = (...reasons: string[]): StandingStoreResult<never> => ({ ok: false, reasons });

  const event = (
    action: StandingRuleAction,
    actor: StandingActor,
    at: string,
    detail?: string,
  ): StandingRuleAuditEvent => ({
    at,
    action: AUDIT_ACTION[action],
    actor: standingActorStamp(actor, at),
    detail: detail ?? STANDING_ACTION_LABEL[action],
  });

  const api = {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot: () => state,
    ruleSets: () => state.ruleSets as readonly AcademicStandingRuleSet[],
    ruleSet: (id: string, version?: number) =>
      state.ruleSets.find(
        (rule) => rule.id === id && (version === undefined || rule.version === version),
      ),
    /** Regras homologadas aplicáveis ao ciclo recebido, já resolvido. */
    homologatedFor: (cycle: { kindId: string; academicYearId: string }) =>
      state.ruleSets.filter(
        (rule) =>
          rule.status === "homologada" &&
          rule.scope.academicYearId === cycle.academicYearId &&
          (!rule.scope.cycleKindIds || rule.scope.cycleKindIds.includes(cycle.kindId)),
      ),
    deliberations: () => state.deliberations as readonly InstitutionalDeliberationRecord[],
    deliberationFor: (scopeKey: string) =>
      state.deliberations
        .filter((record) => record.scopeKey === scopeKey)
        .reduce<InstitutionalDeliberationRecord | undefined>(
          (latest, record) => (!latest || record.at > latest.at ? record : latest),
          undefined,
        ),
    records: () => state.records as readonly AcademicStandingRecord[],
    current: (scopeKey: string) => currentStandingRecord(state.records, scopeKey),
    chain: (scopeKey: string) => standingRecordChain(state.records, scopeKey),
    /** Espelho somente leitura das versões oficiais lidas do Cloud. */
    hydrateRecords: (records: readonly AcademicStandingRecord[]) => set({ ...state, records: [...records] }),
    reset: () => set({ ruleSets: [], deliberations: [], records: [] }),

    /** Governança da regra: capacidade + transição + imutabilidade após homologar. */
    act(input: {
      action: StandingRuleAction;
      actor: StandingActor;
      ruleSet: AcademicStandingRuleSet;
      detail?: string;
      now?: string;
    }): StandingStoreResult<AcademicStandingRuleSet> {
      const at = input.now ?? new Date().toISOString();
      const capability = STANDING_ACTION_CAPABILITY[input.action];
      if (!canStanding(input.actor, capability))
        return fail(missingStandingCapabilityReason(capability));

      const stored = state.ruleSets.find(
        (rule) => rule.id === input.ruleSet.id && rule.version === input.ruleSet.version,
      );
      const status = stored?.status ?? "rascunho";

      if (input.action !== "criar" && !stored)
        return fail("A regra informada não está cadastrada.");
      if (input.action === "criar" && stored)
        return fail("Já existe uma regra cadastrada com este identificador e versão.");
      if (!standingTransitionAllowed(input.action, status))
        return fail(
          `${STANDING_ACTION_LABEL[input.action]} não é possível com a regra em "${STANDING_RULE_STATUS_LABEL[status]}".`,
        );
      if (input.action === "editar" && stored && stored.status !== "rascunho")
        return fail("Regra homologada é imutável: crie uma nova versão.");

      if (input.action === "homologar") {
        const issues = standingRuleIssues(input.ruleSet);
        if (issues.length) return fail(...issues);
      }

      if (input.action === "duplicar") {
        const versions = state.ruleSets.filter((rule) => rule.id === input.ruleSet.id);
        const next: AcademicStandingRuleSet = {
          ...input.ruleSet,
          version: Math.max(...versions.map((rule) => rule.version), input.ruleSet.version) + 1,
          status: "rascunho",
          supersedesId: `${input.ruleSet.id}@${input.ruleSet.version}`,
          audit: {
            events: [event(input.action, input.actor, at, input.detail)],
            demonstrative: true,
          },
        };
        set({ ...state, ruleSets: [...state.ruleSets, next] });
        return { ok: true, value: next };
      }

      const next: AcademicStandingRuleSet = {
        ...input.ruleSet,
        status: STANDING_STATUS_AFTER[input.action],
        audit: {
          ...input.ruleSet.audit,
          events: [...(stored?.audit.events ?? []), event(input.action, input.actor, at, input.detail)],
          ...(input.action === "homologar"
            ? { homologatedBy: standingActorStamp(input.actor, at) }
            : {}),
          demonstrative: true,
        },
      };
      set({
        ...state,
        ruleSets: stored
          ? state.ruleSets.map((rule) =>
              rule.id === next.id && rule.version === next.version ? next : rule,
            )
          : [...state.ruleSets, next],
      });
      return { ok: true, value: next };
    },


    /**
     * Registra a determinação como versão imutável. Só determinação com regra
     * homologada é registrada; estados operacionais não geram versão.
     */
    register(input: {
      actor: StandingActor;
      determination: AcademicStandingDetermination;
      revision?: Omit<StandingRecordRevision, "authorizedBy">;
      authorizer?: StandingActor;
      now?: string;
    }): StandingStoreResult<AcademicStandingRecord> {
      const at = input.now ?? new Date().toISOString();
      const determination = input.determination;
      if (!determination.ruleSetId || determination.ruleSetVersion === undefined)
        return fail(
          "Sem regra de situação homologada não existe determinação a registrar. Nenhuma situação é presumida.",
        );
      if (determination.operationalState !== "situacao-determinada")
        return fail(
          "Apenas determinação concluída é registrada. Estados operacionais não produzem versão oficial.",
        );

      const scopeKey = standingScopeKey({
        cycleId: determination.cycleId,
        studentId: determination.studentId,
      });
      const preceding = currentStandingRecord(state.records, scopeKey);

      if (preceding && !input.revision)
        return fail(
          "Já existe determinação vigente para este percurso. Alteração exige retificação ou reprocessamento justificado.",
        );

      let revision: StandingRecordRevision | undefined;
      if (input.revision) {
        if (!input.revision.justification.trim())
          return fail("Informe a justificativa: esta operação é uma exceção formal auditada.");
        const capability =
          input.revision.kind === "reprocessamento" ? "reprocessar-situacao" : "deliberar-situacao";
        const authorizer =
          input.authorizer ?? (canStanding(input.actor, capability) ? input.actor : undefined);
        if (!authorizer || !canStanding(authorizer, capability))
          return fail(missingStandingCapabilityReason(capability));
        revision = {
          kind: input.revision.kind,
          justification: input.revision.justification,
          authorizedBy: standingActorStamp(authorizer, at),
        };
      }

      const version = (preceding?.version ?? 0) + 1;
      const record: AcademicStandingRecord = {
        id: `sit-${scopeKey.replace(/[|:]/g, "-")}-v${version}`,
        scopeKey,
        version,
        ...(preceding ? { precedingRecordId: preceding.id } : {}),
        factKind: "situacao-academica-do-ciclo",
        cycleId: determination.cycleId,
        cycleKindId: determination.cycleKindId,
        academicYearId: determination.academicYearId,
        studentId: determination.studentId,
        ruleSetId: determination.ruleSetId,
        ruleSetVersion: determination.ruleSetVersion,
        standingId: determination.standingId,
        operationalState: determination.operationalState,
        determinedBy: standingActorStamp(input.actor, at),
        determinedAt: at,
        ...(revision ? { revision } : {}),
        ...(determination.deliberation ? { deliberationId: determination.deliberation.id } : {}),
        ...(determination.deliberation?.minuteSource
          ? { deliberationSource: { ...determination.deliberation.minuteSource } }
          : {}),
        steps: determination.steps,
        facts: determination.facts,
        pendencies: determination.pendencies,
      };
      // Versões anteriores permanecem intactas: só acrescentamos.
      set({ ...state, records: [...state.records, record] });
      return { ok: true, value: record };
    },
  };
  return api;
}

export type AcademicStandingStore = ReturnType<typeof createAcademicStandingStore>;

export const academicStandingStore = createAcademicStandingStore();

export function useAcademicStandingStore(store: AcademicStandingStore = academicStandingStore) {
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
