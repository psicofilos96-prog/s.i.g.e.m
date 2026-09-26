/**
 * Etapa 12J — repositório de colegiados, sessões, pautas, deliberações e atas.
 *
 * Guarda somente fatos do processo. Ata encerrada nunca é editada: retificação
 * acrescenta nova versão encadeada. Deliberação não reescreve resultado
 * matemático: o dossiê preserva o que foi analisado e a decisão vive ao lado.
 *
 * Sem persistência real: o contrato existe para uma persistência futura.
 */
import { useSyncExternalStore } from "react";
import type { DeliberationBody } from "@/features/assessment/academic-standing-types";
import {
  agendaOriginIssues,
  collegialActorStamp,
  collegialCan,
  competenceIssues,
  compositionIssues,
  conductIssues,
  decisionIssues,
  missingCollegialCapabilityReason,
  quorumEvaluation,
  rationaleIssues,
  sessionNatureIssues,
  signatureIssues,
} from "./collegial-governance";
import type {
  CollegialActor,
  CollegialAuditEvent,
  CollegialBodyConfiguration,
  CollegialDeliberation,
  CollegialSession,
  MinuteSignature,
  MinuteStatement,
  SessionAgendaItem,
  SessionParticipant,
  StructuredMinute,
} from "./collegial-types";

export type CollegialStoreResult<T> = { ok: true; value: T } | { ok: false; reasons: string[] };

type State = {
  configurations: CollegialBodyConfiguration[];
  sessions: CollegialSession[];
  deliberations: CollegialDeliberation[];
  minutes: StructuredMinute[];
};

export type CollegialConfigurationAction =
  | "criar"
  | "editar"
  | "enviar-para-revisao"
  | "devolver-para-rascunho"
  | "homologar"
  | "arquivar";

export const COLLEGIAL_ACTION_LABEL: Record<CollegialConfigurationAction, string> = {
  criar: "Configuração de colegiado criada",
  editar: "Configuração de colegiado alterada",
  "enviar-para-revisao": "Configuração enviada para revisão",
  "devolver-para-rascunho": "Configuração devolvida para rascunho",
  homologar: "Configuração homologada",
  arquivar: "Configuração arquivada",
};

const STATUS_AFTER: Record<CollegialConfigurationAction, CollegialBodyConfiguration["status"]> = {
  criar: "rascunho",
  editar: "rascunho",
  "enviar-para-revisao": "em-revisao",
  "devolver-para-rascunho": "rascunho",
  homologar: "homologada",
  arquivar: "arquivada",
};

export const COLLEGIAL_ACTION_CAPABILITY: Record<CollegialConfigurationAction, string> = {
  criar: "configurar-colegiado",
  editar: "configurar-colegiado",
  "enviar-para-revisao": "configurar-colegiado",
  "devolver-para-rascunho": "revisar-colegiado",
  homologar: "homologar-colegiado",
  arquivar: "homologar-colegiado",
};

export const currentMinute = (minutes: readonly StructuredMinute[], sessionId: string) =>
  minutes
    .filter((minute) => minute.sessionId === sessionId)
    .reduce<StructuredMinute | undefined>(
      (latest, minute) => (!latest || minute.version > latest.version ? minute : latest),
      undefined,
    );

export const minuteChain = (minutes: readonly StructuredMinute[], sessionId: string) =>
  minutes
    .filter((minute) => minute.sessionId === sessionId)
    .slice()
    .sort((a, b) => a.version - b.version);

export function createCollegialStore(seed: Partial<State> = {}) {
  let state: State = {
    configurations: seed.configurations ?? [],
    sessions: seed.sessions ?? [],
    deliberations: seed.deliberations ?? [],
    minutes: seed.minutes ?? [],
  };
  const listeners = new Set<() => void>();
  const set = (next: State) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const fail = (...reasons: string[]): CollegialStoreResult<never> => ({ ok: false, reasons });

  const event = (
    action: CollegialConfigurationAction,
    actor: CollegialActor,
    at: string,
    detail?: string,
  ): CollegialAuditEvent => ({
    at,
    action: COLLEGIAL_ACTION_LABEL[action],
    actor: collegialActorStamp(actor, at),
    detail: detail ?? COLLEGIAL_ACTION_LABEL[action],
  });

  const api = {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot: () => state,

    configurations: () => state.configurations as readonly CollegialBodyConfiguration[],
    configuration: (id: string, version?: number) =>
      state.configurations
        .filter((item) => item.id === id && (version === undefined || item.version === version))
        .reduce<CollegialBodyConfiguration | undefined>(
          (latest, item) => (!latest || item.version > latest.version ? item : latest),
          undefined,
        ),
    sessions: (filter: { classId?: string; cycleId?: string; bodyId?: string } = {}) =>
      state.sessions.filter(
        (session) =>
          (!filter.classId || session.scope.classId === filter.classId) &&
          (!filter.cycleId || session.scope.cycleId === filter.cycleId) &&
          (!filter.bodyId || session.bodyId === filter.bodyId),
      ) as readonly CollegialSession[],
    session: (id: string) => state.sessions.find((session) => session.id === id),
    deliberationsOf: (sessionId: string) =>
      state.deliberations.filter(
        (deliberation) => deliberation.sessionId === sessionId,
      ) as readonly CollegialDeliberation[],
    deliberationsForStudent: (studentId: string) =>
      state.deliberations.filter(
        (deliberation) => deliberation.studentId === studentId,
      ) as readonly CollegialDeliberation[],
    minutes: () => state.minutes as readonly StructuredMinute[],
    currentMinute: (sessionId: string) => currentMinute(state.minutes, sessionId),
    minuteChain: (sessionId: string) => minuteChain(state.minutes, sessionId),

    /** Governança da configuração do colegiado. Homologada torna-se imutável. */
    actOnConfiguration(input: {
      action: CollegialConfigurationAction;
      actor: CollegialActor;
      configuration: CollegialBodyConfiguration;
      detail?: string;
      now?: string;
    }): CollegialStoreResult<CollegialBodyConfiguration> {
      const at = input.now ?? new Date().toISOString();
      const capability = COLLEGIAL_ACTION_CAPABILITY[input.action];
      if (!collegialCan(input.actor, capability))
        return fail(missingCollegialCapabilityReason(capability));
      const stored = state.configurations.find(
        (item) => item.id === input.configuration.id && item.version === input.configuration.version,
      );
      if (stored && stored.status === "homologada" && input.action === "editar")
        return fail(
          "Configuração homologada é imutável. Alteração exige nova versão, preservando sessões e atas históricas.",
        );

      const next: CollegialBodyConfiguration = {
        ...input.configuration,
        status: STATUS_AFTER[input.action],
        audit: {
          events: [...(stored?.audit.events ?? []), event(input.action, input.actor, at, input.detail)],
          demonstrative: true,
        },
      };
      set({
        ...state,
        configurations: stored
          ? state.configurations.map((item) =>
              item.id === next.id && item.version === next.version ? next : item,
            )
          : [...state.configurations, next],
      });
      return { ok: true, value: next };
    },

    /** Abre (agenda) a sessão. Composição e quórum só são exigidos ao encerrar a ata. */
    openSession(input: {
      actor: CollegialActor;
      session: Omit<CollegialSession, "createdBy" | "state"> & {
        state?: CollegialSession["state"];
      };
      now?: string;
    }): CollegialStoreResult<CollegialSession> {
      const at = input.now ?? new Date().toISOString();
      const configuration = api.configuration(
        input.session.bodyId,
        input.session.bodyConfigurationVersion,
      );
      if (!configuration)
        return fail(
          "Não há configuração cadastrada para este colegiado na versão informada. A sessão não existe sem a configuração que a governa.",
        );
      const reasons = [
        ...conductIssues(configuration, input.actor),
        ...sessionNatureIssues(configuration, input.session.natureId),
      ];
      if (reasons.length) return fail(...reasons);
      const session: CollegialSession = {
        ...input.session,
        state: input.session.state ?? "agendada",
        createdBy: collegialActorStamp(input.actor, at),
      };
      set({ ...state, sessions: [...state.sessions, session] });
      return { ok: true, value: session };
    },

    /** Presenças e ausências da sessão, enquanto a ata não estiver encerrada. */
    setParticipants(input: {
      actor: CollegialActor;
      sessionId: string;
      participants: readonly SessionParticipant[];
    }): CollegialStoreResult<CollegialSession> {
      const session = api.session(input.sessionId);
      if (!session) return fail("Sessão não encontrada.");
      if (session.state === "concluida")
        return fail("Sessão concluída com ata encerrada: a composição registrada é imutável.");
      const configuration = api.configuration(session.bodyId, session.bodyConfigurationVersion);
      if (!configuration) return fail("Configuração do colegiado não encontrada.");
      const reasons = conductIssues(configuration, input.actor);
      if (reasons.length) return fail(...reasons);
      const next: CollegialSession = {
        ...session,
        participants: input.participants,
        state: session.state === "agendada" ? "em-andamento" : session.state,
      };
      set({
        ...state,
        sessions: state.sessions.map((item) => (item.id === next.id ? next : item)),
      });
      return { ok: true, value: next };
    },

    /**
     * Inclui item de pauta. Pauta pode ser institucional (sem estudante) ou
     * tratar de um caso; provocação formal passa pela governança configurada.
     */
    addAgendaItem(input: {
      actor: CollegialActor;
      sessionId: string;
      item: SessionAgendaItem;
    }): CollegialStoreResult<CollegialSession> {
      const session = api.session(input.sessionId);
      if (!session) return fail("Sessão não encontrada.");
      if (session.state === "concluida")
        return fail("Sessão concluída com ata encerrada: a pauta registrada é imutável.");
      const configuration = api.configuration(session.bodyId, session.bodyConfigurationVersion);
      if (!configuration) return fail("Configuração do colegiado não encontrada.");
      const reasons = agendaOriginIssues(configuration, { item: input.item, actor: input.actor });
      if (reasons.length) return fail(...reasons);
      const next: CollegialSession = {
        ...session,
        agenda: [...session.agenda, input.item],
        state: session.state === "agendada" ? "em-andamento" : session.state,
      };
      set({
        ...state,
        sessions: state.sessions.map((item) => (item.id === next.id ? next : item)),
      });
      return { ok: true, value: next };
    },

    /**
     * Registra a deliberação de um item de pauta. A competência é verificada
     * contra o órgão declarado na regra de situação homologada (12I): sem ela,
     * nenhuma situação acadêmica é produzida.
     */
    registerDeliberation(input: {
      actor: CollegialActor;
      sessionId: string;
      deliberation: Omit<CollegialDeliberation, "actor" | "at" | "id" | "sessionId"> & {
        id?: string;
      };
      /** Órgão da regra homologada, quando a decisão produzir situação. */
      body?: DeliberationBody;
      now?: string;
    }): CollegialStoreResult<CollegialDeliberation> {
      const at = input.now ?? new Date().toISOString();
      const session = api.session(input.sessionId);
      if (!session) return fail("Sessão não encontrada.");
      if (session.state === "concluida")
        return fail("Sessão concluída com ata encerrada: novas deliberações exigem nova sessão.");
      const configuration = api.configuration(session.bodyId, session.bodyConfigurationVersion);
      if (!configuration) return fail("Configuração do colegiado não encontrada.");
      const item = session.agenda.find((entry) => entry.id === input.deliberation.agendaItemId);
      if (!item) return fail("Item de pauta não encontrado nesta sessão.");

      const reasons = [
        ...conductIssues(configuration, input.actor),
        ...rationaleIssues(input.deliberation.rationale),
        ...decisionIssues(configuration, {
          ...(input.deliberation.votes ? { votes: input.deliberation.votes } : {}),
          ...(input.deliberation.decisionMethodId
            ? { decisionMethodId: input.deliberation.decisionMethodId }
            : {}),
        }),
      ];
      if (input.deliberation.decision.standingId)
        reasons.push(
          ...competenceIssues({
            ...(input.body ? { body: input.body } : {}),
            competenceId: input.deliberation.competenceId,
            standingId: input.deliberation.decision.standingId,
          }),
        );
      if (reasons.length) return fail(...reasons);

      const deliberation: CollegialDeliberation = {
        ...input.deliberation,
        id: input.deliberation.id ?? `del-${input.sessionId}-${item.id}-${at}`,
        sessionId: input.sessionId,
        actor: collegialActorStamp(input.actor, at),
        at,
      };
      set({ ...state, deliberations: [...state.deliberations, deliberation] });
      return { ok: true, value: deliberation };
    },

    /**
     * Encerra a ata estruturada. Aqui — e só aqui — a composição, o quórum e as
     * assinaturas exigidos pela configuração são verificados.
     */
    closeMinute(input: {
      actor: CollegialActor;
      sessionId: string;
      statements?: readonly MinuteStatement[];
      signatures?: readonly MinuteSignature[];
      documentRefs?: readonly string[];
      note?: string;
      now?: string;
    }): CollegialStoreResult<StructuredMinute> {
      const at = input.now ?? new Date().toISOString();
      const session = api.session(input.sessionId);
      if (!session) return fail("Sessão não encontrada.");
      if (session.state === "concluida")
        return fail(
          "Esta sessão já possui ata encerrada. Ata encerrada é imutável: correção gera termo de retificação.",
        );
      const configuration = api.configuration(session.bodyId, session.bodyConfigurationVersion);
      if (!configuration) return fail("Configuração do colegiado não encontrada.");

      const signatures = input.signatures ?? [];
      const reasons = [
        ...conductIssues(configuration, input.actor),
        ...compositionIssues(configuration, session.participants),
        ...signatureIssues(configuration, { signatures, participants: session.participants }),
      ];
      const quorum = quorumEvaluation(configuration, session.participants);
      if (quorum.satisfied === false) reasons.push(quorum.reason);
      if (reasons.length) return fail(...reasons);

      const minute: StructuredMinute = {
        id: `ata-${session.id}-v1`,
        sessionId: session.id,
        version: 1,
        bodyId: session.bodyId,
        bodyConfigurationVersion: session.bodyConfigurationVersion,
        natureId: session.natureId,
        openedAt: session.openedAt ?? session.scheduledFor,
        closedAt: at,
        participants: session.participants,
        agenda: session.agenda,
        deliberations: api.deliberationsOf(session.id),
        statements: input.statements ?? [],
        signatures,
        quorum,
        closedBy: collegialActorStamp(input.actor, at),
        ...(input.documentRefs ? { documentRefs: input.documentRefs } : {}),
        ...(input.note ? { note: input.note } : {}),
      };
      set({
        ...state,
        minutes: [...state.minutes, minute],
        sessions: state.sessions.map((item) =>
          item.id === session.id ? { ...item, state: "concluida", closedAt: at } : item,
        ),
      });
      return { ok: true, value: minute };
    },

    /**
     * Termo de retificação: nova versão da ata, encadeada. A versão anterior
     * permanece integralmente preservada — nada é sobrescrito.
     */
    rectifyMinute(input: {
      actor: CollegialActor;
      sessionId: string;
      justification: string;
      changes?: Partial<
        Pick<StructuredMinute, "statements" | "signatures" | "documentRefs" | "note">
      >;
      now?: string;
    }): CollegialStoreResult<StructuredMinute> {
      const at = input.now ?? new Date().toISOString();
      const previous = api.currentMinute(input.sessionId);
      if (!previous) return fail("Não existe ata encerrada para retificar nesta sessão.");
      const configuration = api.configuration(previous.bodyId, previous.bodyConfigurationVersion);
      if (!configuration) return fail("Configuração do colegiado não encontrada.");
      const reasons = conductIssues(configuration, input.actor);
      if (!input.justification.trim())
        reasons.push(
          "Informe a justificativa da retificação: a correção de ata é exceção formal auditada.",
        );
      if (reasons.length) return fail(...reasons);

      const minute: StructuredMinute = {
        ...previous,
        ...input.changes,
        id: `ata-${previous.sessionId}-v${previous.version + 1}`,
        version: previous.version + 1,
        precedingMinuteId: previous.id,
        closedAt: at,
        closedBy: collegialActorStamp(input.actor, at),
        rectification: {
          justification: input.justification,
          authorizedBy: collegialActorStamp(input.actor, at),
          supersedesMinuteId: previous.id,
        },
      };
      set({ ...state, minutes: [...state.minutes, minute] });
      return { ok: true, value: minute };
    },
  };
  return api;
}

export type CollegialStore = ReturnType<typeof createCollegialStore>;

export const collegialStore = createCollegialStore();

export function useCollegialStore(store: CollegialStore = collegialStore) {
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return store;
}
