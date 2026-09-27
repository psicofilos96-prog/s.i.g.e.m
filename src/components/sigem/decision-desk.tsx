/**
 * SIGEM — Human Interface Language, gramática "Decidir" (Rodada 6B.3.1).
 *
 * `DecisionDesk` é a Mesa de Decisão: uma superfície única — NUNCA um wizard —
 * em que quem decide vê ao mesmo tempo por que decide, sobre quais fatos,
 * quais escolhas são institucionalmente possíveis, o que cada escolha produz e
 * o que é exigido para formalizá-la.
 *
 * FRONTEIRAS DESTA PRIMITIVA (não negociáveis):
 *  1. Não conhece nenhuma decisão concreta: não existe aqui aprovar, indeferir,
 *     homologar, autorizar nem devolver. Ela recebe opções já projetadas da
 *     configuração institucional, com rótulo humano, efeitos e admissibilidade.
 *  2. Nenhum rito é universal: fundamentação textual, declaração de exercício de
 *     competência e ato institucional só aparecem quando o rito recebido os
 *     exige.
 *  3. Fato cuja existência é protegida não chega até aqui. Esta camada apenas
 *     apresenta o que já foi autorizado; ausência aparece só quando revelável.
 *  4. Falha fechada: opção inadmissível permanece não executável, com explicação
 *     humana e diagnóstico institucional disponível sob demanda.
 *  5. Não dramatiza: prazo em curso e espera legítima são informação serena.
 */
import { useId, useState, type ReactNode } from "react";
import { CircleHelp, Lock, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackNote, InstitutionalDetails, PlainFacts } from "@/components/sigem/workspace-ui";

/** Fato autorizado considerado na decisão. */
export type DecisionFactView = {
  key: string;
  label: string;
  /** Valor legível quando o fato está disponível. */
  valueLabel?: string | null;
  /** Nota de ausência — só existe quando a revelação da ausência é autorizada. */
  absenceNote?: string | null;
  /** Nível 2/3: origem, versão e proveniência do fato. */
  details?: ReactNode;
};

/** Opção decisória admissível, integralmente projetada da configuração. */
export type DecisionOptionView = {
  id: string;
  label: string;
  description?: string | null;
  /** Falso ⇒ apresentada e explicada, jamais executável (falha fechada). */
  available: boolean;
  /** Frase humana: por que esta escolha não está disponível agora. */
  unavailableReason?: string | null;
  /** O que a escolha produz, em linguagem humana, antes de qualquer clique. */
  effects: readonly string[];
  /** Nível 2/3: capacidades exigidas, efeitos declarados, executores. */
  details?: ReactNode;
};

/** Rito exigido pela configuração da decisão. Nada aqui é presumido. */
export type DecisionRitualView = {
  justification?: { label: string; hint?: string } | null;
  competenceDeclaration?: { label: string } | null;
  actNote?: string | null;
};

export type DecisionConfirmation = {
  optionId: string;
  justification: string;
  competenceDeclared: boolean;
};

export function DecisionDesk({
  title,
  personLine,
  arrivalReason,
  requirementNote,
  timingLine,
  facts,
  factsOmissionNote,
  options,
  ritual,
  blockedNote,
  provenance,
  confirmedSlot,
  onConfirm,
}: {
  title: string;
  personLine?: string | null;
  /** Por que este assunto chegou a quem decide. */
  arrivalReason: string;
  /** Qual regra institucional exige a decisão. */
  requirementNote: string;
  /** Datas e prazos declarados, sem dramatização. */
  timingLine?: string | null;
  facts: readonly DecisionFactView[];
  /** Nota genérica de omissão, apenas quando a política a autoriza. */
  factsOmissionNote?: string | null;
  options: readonly DecisionOptionView[];
  ritual: DecisionRitualView;
  /** Explicação quando nenhuma opção é admissível neste momento. */
  blockedNote?: string | null;
  provenance?: ReactNode;
  /** Conteúdo de continuidade exibido depois de a decisão ser registrada. */
  confirmedSlot?: ReactNode;
  onConfirm?: (confirmation: DecisionConfirmation) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [declared, setDeclared] = useState(false);
  const justificationId = useId();
  const declarationId = useId();

  const selected = options.find((option) => option.id === selectedId) ?? null;
  const justificationRequired = Boolean(ritual.justification);
  const declarationRequired = Boolean(ritual.competenceDeclaration);
  const justificationMissing = justificationRequired && justification.trim().length < 10;
  const declarationMissing = declarationRequired && !declared;
  const canConfirm =
    selected !== null && selected.available && !justificationMissing && !declarationMissing;

  if (confirmedSlot) {
    return <div className="calm-stack gap-5">{confirmedSlot}</div>;
  }

  const missingForConfirm: string[] = [];
  if (!selected) missingForConfirm.push("escolher uma das alternativas");
  if (justificationMissing) missingForConfirm.push("escrever a fundamentação exigida");
  if (declarationMissing) missingForConfirm.push("confirmar a declaração exigida");

  return (
    <div className="calm-stack gap-6">
      <header className="min-w-0">
        {personLine ? (
          <p className="text-base font-semibold text-foreground [overflow-wrap:anywhere]">
            {personLine}
          </p>
        ) : null}
        <h2 className="font-display text-xl font-semibold text-foreground [overflow-wrap:anywhere]">
          {title}
        </h2>
        {timingLine ? (
          <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {timingLine}
          </p>
        ) : null}
      </header>

      <section className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">Por que isso chegou até você</h3>
        <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {arrivalReason}
        </p>
        <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {requirementNote}
        </p>
      </section>

      <section className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">
          Em quais fatos você está se baseando
        </h3>
        {facts.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhum fato foi projetado para você nesta decisão.
          </p>
        ) : (
          <ul className="calm-stack mt-2 gap-3">
            {facts.map((fact) => (
              <li key={fact.key} className="surface-quiet min-w-0 p-3">
                <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                  {fact.label}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {fact.valueLabel
                    ? fact.valueLabel
                    : (fact.absenceNote ?? "Informação ainda não disponível.")}
                </p>
                {fact.details ? (
                  <div className="mt-1.5">
                    <InstitutionalDetails summary="Origem deste fato">
                      {fact.details}
                    </InstitutionalDetails>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {factsOmissionNote ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="[overflow-wrap:anywhere]">{factsOmissionNote}</span>
          </p>
        ) : null}
      </section>

      <section className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">
          O que você pode decidir e o que acontece em cada escolha
        </h3>
        {blockedNote ? (
          <div className="mt-2">
            <FeedbackNote tone="impedimento" title="Nenhuma alternativa está disponível agora">
              <p className="[overflow-wrap:anywhere]">{blockedNote}</p>
            </FeedbackNote>
          </div>
        ) : null}
        {options.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            A configuração deste assunto não declarou nenhuma alternativa: nada pode ser
            decidido aqui.
          </p>
        ) : (
          <ul
            className="calm-stack mt-2 gap-3"
            role="radiogroup"
            aria-label="Alternativas desta decisão"
          >
            {options.map((option) => {
              const active = option.id === selectedId;
              return (
                <li key={option.id} className="min-w-0">
                  <div
                    className={
                      active
                        ? "rounded-xl border-2 border-primary bg-card p-4"
                        : "rounded-xl border border-border bg-card p-4"
                    }
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!option.available}
                      onClick={() => setSelectedId(option.id)}
                      className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed"
                    >
                      <span
                        aria-hidden="true"
                        className={
                          active
                            ? "mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 border-primary"
                            : "mt-1 size-5 shrink-0 rounded-full border-2 border-border"
                        }
                      >
                        {active ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="mt-0.5 block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </button>

                    {option.effects.length > 0 ? (
                      <div className="mt-3 pl-8">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Se você escolher esta alternativa
                        </p>
                        <ul className="mt-1 calm-stack gap-1">
                          {option.effects.map((effect) => (
                            <li
                              key={effect}
                              className="text-sm text-muted-foreground [overflow-wrap:anywhere]"
                            >
                              {effect}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {!option.available ? (
                      <div className="mt-3 pl-8">
                        <OptionImpediment
                          reason={option.unavailableReason}
                          details={option.details}
                        />
                      </div>
                    ) : option.details ? (
                      <div className="mt-3 pl-8">
                        <InstitutionalDetails summary="Ver base institucional desta alternativa">
                          {option.details}
                        </InstitutionalDetails>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {ritual.justification || ritual.competenceDeclaration || ritual.actNote ? (
        <section className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            O que este assunto exige para ser formalizado
          </h3>
          <div className="calm-stack mt-2 gap-4">
            {ritual.actNote ? (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <ScrollText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="[overflow-wrap:anywhere]">{ritual.actNote}</span>
              </p>
            ) : null}
            {ritual.justification ? (
              <div className="min-w-0">
                <Label htmlFor={justificationId}>{ritual.justification.label}</Label>
                {ritual.justification.hint ? (
                  <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {ritual.justification.hint}
                  </p>
                ) : null}
                <Textarea
                  id={justificationId}
                  className="mt-1.5 min-h-24"
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                />
              </div>
            ) : null}
            {ritual.competenceDeclaration ? (
              <label htmlFor={declarationId} className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  id={declarationId}
                  checked={declared}
                  onCheckedChange={() => setDeclared((value) => !value)}
                />
                <span className="[overflow-wrap:anywhere]">
                  {ritual.competenceDeclaration.label}
                </span>
              </label>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className="calm-stack gap-2 border-t border-border/70 pt-4">
        {missingForConfirm.length > 0 && !blockedNote ? (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            Para concluir, falta {missingForConfirm.join("; ")}.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="min-h-11"
            disabled={!canConfirm}
            onClick={() =>
              selected && onConfirm
                ? onConfirm({
                    optionId: selected.id,
                    justification: justification.trim(),
                    competenceDeclared: declared,
                  })
                : undefined
            }
          >
            {selected ? selected.label : "Registrar a decisão"}
          </Button>
        </div>
        {provenance ? (
          <InstitutionalDetails summary="Registro institucional, versões e auditoria">
            {provenance}
          </InstitutionalDetails>
        ) : null}
      </footer>
    </div>
  );
}

function OptionImpediment({
  reason,
  details,
}: {
  reason?: string | null | undefined;
  details?: ReactNode | undefined;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md tone-surface-impediment px-2.5 py-1 text-xs font-semibold">
          <Lock className="size-3.5" aria-hidden="true" />
          Não disponível para você agora
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 px-2 text-xs"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
          Por que não posso escolher isso?
        </Button>
      </div>
      {open ? (
        <div id={panelId} className="mt-2 rounded-lg tone-surface-impediment p-3 text-sm">
          <p className="[overflow-wrap:anywhere]">
            {reason ?? "Esta alternativa não está liberada para você neste momento."}
          </p>
          {details ? (
            <div className="mt-2 border-t border-current/15 pt-2 text-xs opacity-90">
              {details}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Lista de pares usada nos níveis 2 e 3 da Mesa. */
export function DecisionProvenanceFacts({
  items,
}: {
  items: ReadonlyArray<{ term: string; detail: ReactNode }>;
}) {
  return <PlainFacts items={items} />;
}
