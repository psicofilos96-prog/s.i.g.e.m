/**
 * SIGEM — Human Interface Language, gramática "Acompanhar" (Rodada 6B.3.2).
 *
 * Follow-up Workspace: superfícies de acompanhamento longitudinal de pessoas.
 * Não é wizard (Secretaria) nem mesa de decisão (Direção): aqui a pergunta é
 * "quem requer atenção, o que aconteceu, o que combinamos e quando retornamos?".
 *
 * FRONTEIRAS DESTAS PRIMITIVAS (não negociáveis):
 *  1. A pessoa é o sujeito visual. Nada aqui rotula, pontua, classifica ou
 *     colore o estudante: o sinal é um acontecimento em seu percurso.
 *  2. Nenhuma ação é conhecida por nome: as primitivas recebem ações já
 *     projetadas da configuração, com rótulo, admissibilidade e explicação.
 *  3. Nenhuma prioridade é inventada. Quando existe motivo institucional
 *     (retorno combinado, prazo de política), ele aparece por extenso.
 *  4. Ausência é apresentada com serenidade e nunca como avaliação positiva.
 *  5. Falha fechada: ação indisponível permanece visível, explicada e inerte.
 */
import { type ReactNode } from "react";
import { CalendarClock, HeartHandshake, Lock, MessageSquare, UserRound } from "lucide-react";
import { ActionDisclosure, InstitutionalDetails, PlainFacts } from "@/components/sigem/workspace-ui";

/** Ação projetada da configuração — a primitiva não conhece nenhum verbo. */
export type FollowUpActionView = {
  id: string;
  label: string;
  available: boolean;
  unavailableReason?: string | null;
  details?: ReactNode;
  onAct?: () => void;
};

function ActionList({ actions }: { actions: readonly FollowUpActionView[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-start gap-2">
      {actions.map((action, index) => (
        <ActionDisclosure
          key={action.id}
          label={action.label}
          available={action.available}
          reason={action.unavailableReason ?? undefined}
          details={action.details}
          onAct={action.onAct}
          secondary={index > 0}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------- sinal como acontecimento do percurso */

export type ObservedFactView = {
  key: string;
  text: string;
  absence?: boolean;
  details?: ReactNode;
};

/**
 * Acontecimento observado no percurso de uma pessoa. O nome vem primeiro; o
 * fato material vem depois, em frase neutra; nenhum selo de gravidade existe.
 */
export function AttentionSignalCard({
  personName,
  contextLine,
  observedOnLine,
  observedFacts,
  stateLine,
  timingLine,
  redactionNote,
  actions,
  provenance,
}: {
  personName: string;
  /** Turma, etapa ou outro contexto declarado — nunca um juízo. */
  contextLine?: string | null;
  observedOnLine: string;
  observedFacts: readonly ObservedFactView[];
  stateLine?: string | null;
  timingLine?: string | null;
  redactionNote?: string | null;
  actions: readonly FollowUpActionView[];
  provenance?: ReactNode;
}) {
  return (
    <article className="work-object work-object-hover px-3 py-4">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl tone-surface-neutral">
          <UserRound className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            {personName}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {contextLine ? `${contextLine} · ` : ""}
            {observedOnLine}
          </p>
        </div>
      </header>

      <ul className="mt-3 calm-stack gap-2">
        {observedFacts.map((fact) => (
          <li key={fact.key} className="min-w-0">
            <p className="text-sm text-foreground [overflow-wrap:anywhere]">{fact.text}</p>
            {fact.details ? (
              <div className="mt-1">
                <InstitutionalDetails summary="De onde vem esta informação">
                  {fact.details}
                </InstitutionalDetails>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {stateLine ? (
        <p className="mt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">{stateLine}</p>
      ) : null}
      {timingLine ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {timingLine}
        </p>
      ) : null}
      {redactionNote ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {redactionNote}
        </p>
      ) : null}

      <ActionList actions={actions} />

      {provenance ? (
        <div className="mt-2">
          <InstitutionalDetails summary="Base institucional deste registro">
            {provenance}
          </InstitutionalDetails>
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------- acompanhamento em curso */

export function FollowUpCaseCard({
  personLine,
  openingLine,
  stateLine,
  timingLine,
  objectiveLine,
  responsibleLine,
  redactionNote,
  actions,
  provenance,
  primarySlot,
}: {
  /** Pessoas acompanhadas — o caso pode ter mais de um sujeito. */
  personLine: string;
  openingLine: string;
  stateLine: string;
  timingLine?: string | null;
  /** Objetivo combinado, quando há plano registrado. */
  objectiveLine?: string | null;
  /** Quem responde pelo acompanhamento, somente quando declarado. */
  responsibleLine?: string | null;
  redactionNote?: string | null;
  actions: readonly FollowUpActionView[];
  provenance?: ReactNode;
  primarySlot?: ReactNode;
}) {
  return (
    <article className="work-object work-object-hover px-3 py-4">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl tone-surface-neutral">
          <HeartHandshake className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            {personLine}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {openingLine}
          </p>
        </div>
        {primarySlot ? (
          <div className="flex w-full items-center sm:w-auto sm:self-center">{primarySlot}</div>
        ) : null}
      </header>

      <p className="mt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">{stateLine}</p>
      {objectiveLine ? (
        <p className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">{objectiveLine}</p>
      ) : null}
      {responsibleLine ? (
        <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {responsibleLine}
        </p>
      ) : null}
      {timingLine ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {timingLine}
        </p>
      ) : null}
      {redactionNote ? (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {redactionNote}
        </p>
      ) : null}

      <ActionList actions={actions} />

      {provenance ? (
        <div className="mt-2">
          <InstitutionalDetails summary="Base institucional deste acompanhamento">
            {provenance}
          </InstitutionalDetails>
        </div>
      ) : null}
    </article>
  );
}

/* ----------------------------------------------------- combinados do acompanhamento */

export type PactItem = {
  key: string;
  objective: string;
  actionLabel?: string | null;
  returnLine?: string | null;
};

/**
 * "Combinados atuais": o que foi acordado, quem participa e quando retornar.
 * Ausência de plano é legítima e dita com serenidade, nunca como pendência.
 */
export function PedagogicalPactCard({
  versionLine,
  items,
  participantsLine,
  emptyNote,
  provenance,
  actions,
}: {
  versionLine?: string | null;
  items: readonly PactItem[];
  participantsLine?: string | null;
  /** Frase serena para quando não há combinados registrados. */
  emptyNote: string;
  provenance?: ReactNode;
  actions?: readonly FollowUpActionView[];
}) {
  return (
    <section className="surface-quiet p-4">
      <h3 className="font-display text-base font-semibold text-foreground">Combinados atuais</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{emptyNote}</p>
      ) : (
        <>
          {versionLine ? (
            <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {versionLine}
            </p>
          ) : null}
          <ul className="mt-3 calm-stack gap-3">
            {items.map((item) => (
              <li key={item.key} className="min-w-0 border-l-2 border-border pl-3">
                <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                  {item.objective}
                </p>
                {item.actionLabel ? (
                  <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {item.actionLabel}
                  </p>
                ) : null}
                {item.returnLine ? (
                  <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {item.returnLine}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {participantsLine ? (
        <p className="mt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {participantsLine}
        </p>
      ) : null}
      {actions && actions.length > 0 ? <ActionList actions={actions} /> : null}
      {provenance ? (
        <div className="mt-2">
          <InstitutionalDetails summary="Versões e autoria deste plano">
            {provenance}
          </InstitutionalDetails>
        </div>
      ) : null}
    </section>
  );
}

/* --------------------------------------------------- quem pode ser contatado */

export type AuthorizedContact = {
  key: string;
  /** Nome humano quando declarado; sem rótulo, a pessoa é descrita com cuidado. */
  personLabel?: string | null;
  authorizationLine: string;
  authorized: boolean;
  validityLine: string;
  details?: ReactNode;
};

/**
 * Explica a autorização de contato como capacidade contextual e temporal.
 * Nenhum selo permanente é aplicado a um familiar.
 */
export function AuthorizedContactList({
  contacts,
  emptyNote,
}: {
  contacts: readonly AuthorizedContact[];
  emptyNote: string;
}) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{emptyNote}</p>
    );
  }
  return (
    <ul className="calm-stack gap-3">
      {contacts.map((contact) => (
        <li key={contact.key} className="min-w-0">
          <p className="flex items-start gap-1.5 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {contact.personLabel ?? "Pessoa registrada no prontuário do estudante"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {contact.authorizationLine}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {contact.validityLine}
          </p>
          {contact.details ? (
            <div className="mt-1">
              <InstitutionalDetails summary="Em que se baseia esta autorização">
                {contact.details}
              </InstitutionalDetails>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------- percurso no tempo */

export type TimelineEntry = {
  key: string;
  dateLine: string;
  title: string;
  detail?: string | null;
  details?: ReactNode;
};

/**
 * Percurso em ordem cronológica. É PROJEÇÃO: cada entrada referencia o registro
 * canônico que a originou e nada é armazenado por esta camada.
 */
export function PedagogicalTimeline({
  entries,
  emptyNote,
}: {
  entries: readonly TimelineEntry[];
  emptyNote: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{emptyNote}</p>;
  }
  return (
    <ol className="calm-stack gap-4 border-l-2 border-border pl-4">
      {entries.map((entry) => (
        <li key={entry.key} className="relative min-w-0">
          <span
            className="absolute -left-[1.3rem] top-1.5 size-2.5 rounded-full bg-border"
            aria-hidden="true"
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {entry.dateLine}
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
            {entry.title}
          </p>
          {entry.detail ? (
            <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {entry.detail}
            </p>
          ) : null}
          {entry.details ? (
            <div className="mt-1">
              <InstitutionalDetails summary="Registro de origem">
                {entry.details}
              </InstitutionalDetails>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Reexportado para conveniência das telas que compõem proveniência. */
export { PlainFacts };
