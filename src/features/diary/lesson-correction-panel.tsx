/**
 * Etapa 6D.2.3 — Retificação do Registro de Aula (correção focal).
 *
 * Três momentos: registro oficial vigente → alterar apenas os fatos admitidos
 * → conferência da diferença e registro da correção.
 *
 * Invariantes desta superfície:
 * - A interface não inventa exigência: justificativa e demais requisitos só
 *   aparecem quando a regra homologada os projeta (`requiredRitual`).
 * - Sem alteração efetiva não há nova versão: a conferência fica indisponível.
 * - A conferência mostra apenas os aspectos que mudaram.
 * - A correção parte SEMPRE da versão vigente da cadeia.
 * - `shared`/`individual` nunca aparecem: a escolha é dita em linguagem docente.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, History, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  lessonFactsDelta,
  lessonHistory,
  LESSON_CHANGE_ASPECTS,
  type LessonFacts,
  type LessonRecordVersion,
} from "./lesson-versions";
import {
  lessonCorrectionProfile,
  lessonCorrectionSubmissionIssues,
  lessonEntryFacts,
  lessonOfficialClosingFor,
  lessonVersionStore,
  projectLessonCorrection,
  useLessonVersionChain,
} from "./lesson-correction-config";
import { mergeIndividualContent, splitSharedContent, type MergeChoice } from "./lesson-workspace";
import type { LessonEntry, PlanningRelation } from "./lesson-records";

const RELATIONS: PlanningRelation[] = [
  "Não informado",
  "Conforme o planejado",
  "Adaptado do planejado",
  "Diferente do planejado",
  "Sem planejamento prévio",
];

const ASPECT_LABEL: Record<string, string> = {
  [LESSON_CHANGE_ASPECTS.content]: "O que foi trabalhado",
  [LESSON_CHANGE_ASPECTS.contentMode]: "Forma de registro das aulas",
  [LESSON_CHANGE_ASPECTS.blocks]: "Aulas incluídas no registro",
  [LESSON_CHANGE_ASPECTS.quantity]: "Quantidade de aulas",
  [LESSON_CHANGE_ASPECTS.planningRelation]: "Relação com o planejamento",
  [LESSON_CHANGE_ASPECTS.complements]: "Detalhes pedagógicos",
  [LESSON_CHANGE_ASPECTS.schedule]: "Registro fora do horário previsto",
};

const COMPLEMENTS = [
  ["objectives", "Objetivos"],
  ["skills", "Habilidades curriculares"],
  ["strategies", "Estratégias e recursos"],
  ["groupings", "Agrupamentos"],
  ["observations", "Observações pedagógicas"],
] as const;

function lessonLabel(index: number, total: number) {
  return total > 1 ? `${index + 1}ª aula deste registro` : "Aula";
}

function contentLines(facts: LessonFacts): { label: string; text: string }[] {
  if (facts.contentMode === "shared")
    return [
      {
        label: facts.blockIds.length > 1 ? "Um registro para as aulas" : "Registro da aula",
        text: facts.contents["shared"]?.trim() ?? "",
      },
    ];
  return facts.blockIds.map((id, index) => ({
    label: lessonLabel(index, facts.blockIds.length),
    text: facts.contents[id]?.trim() ?? "",
  }));
}

function describeAspect(facts: LessonFacts, aspect: string): string {
  if (aspect === LESSON_CHANGE_ASPECTS.content)
    return (
      contentLines(facts)
        .map((line) => (facts.contentMode === "shared" ? line.text : `${line.label}: ${line.text}`))
        .filter(Boolean)
        .join("\n") || "Sem conteúdo informado"
    );
  if (aspect === LESSON_CHANGE_ASPECTS.contentMode)
    return facts.contentMode === "shared"
      ? "Um registro para as aulas"
      : "Um registro para cada aula";
  if (aspect === LESSON_CHANGE_ASPECTS.planningRelation) return facts.planningRelation;
  if (aspect === LESSON_CHANGE_ASPECTS.complements) {
    const filled = COMPLEMENTS.filter(([field]) => facts[field]?.trim()).map(
      ([field, label]) => `${label}: ${facts[field]}`,
    );
    return filled.length ? filled.join("\n") : "Nenhum detalhe informado";
  }
  if (aspect === LESSON_CHANGE_ASPECTS.blocks)
    return `${facts.blockIds.length} aula(s) no registro`;
  if (aspect === LESSON_CHANGE_ASPECTS.quantity) return `${facts.quantity} aula(s)`;
  if (aspect === LESSON_CHANGE_ASPECTS.schedule)
    return facts.extraordinary
      ? `${facts.extraordinaryStart}–${facts.extraordinaryEnd} · ${facts.justification}`
      : "Dentro do horário previsto";
  return "—";
}

export type LessonCorrectionPanelProps = {
  entry: LessonEntry;
  /** Perfil que está operando (capacidades declaradas, nunca cargo presumido). */
  profileId?: string;
};

export function LessonCorrectionPanel({ entry, profileId }: LessonCorrectionPanelProps) {
  const seedFacts = useMemo(() => lessonEntryFacts(entry), [entry]);
  const seedAt = `${entry.date}T12:00:00.000Z`;
  const versions = useLessonVersionChain(entry.id, seedFacts, seedAt);
  const closing = lessonOfficialClosingFor(entry.date);
  const agentProfileId = profileId ?? "perfil-docente";
  const profile = lessonCorrectionProfile(agentProfileId);
  const { projection, base } = projectLessonCorrection({
    versions,
    logicalRecordId: entry.id,
    agentProfileId,
    ...(closing ? { officialClosing: closing } : {}),
  });

  const [step, setStep] = useState<"vigente" | "alterar" | "conferir">("vigente");
  const [draft, setDraft] = useState<LessonFacts | null>(null);
  const [justification, setJustification] = useState("");
  const [satisfied, setSatisfied] = useState<string[]>([]);
  const [mergeOptions, setMergeOptions] = useState<string[] | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const current = base;
  const admits = (aspect: string) => projection.admissibleChanges.includes(aspect);
  const delta = current && draft ? lessonFactsDelta(current.facts, draft) : [];
  const lines = lessonHistory(versions, entry.id);

  const start = () => {
    if (!current) return;
    setDraft({ ...current.facts, contents: { ...current.facts.contents } });
    setJustification("");
    setSatisfied([]);
    setIssues([]);
    setFeedback(null);
    setStep("alterar");
  };

  const cancel = () => {
    setDraft(null);
    setMergeOptions(null);
    setIssues([]);
    setStep("vigente");
  };

  const setContent = (key: string, text: string) =>
    setDraft((value) =>
      value ? { ...value, contents: { ...value.contents, [key]: text } } : value,
    );

  const separate = () =>
    setDraft((value) => (value ? splitSharedContent(value, value.blockIds) : value));

  const unify = (choice?: MergeChoice) =>
    setDraft((value) => {
      if (!value) return value;
      const result = mergeIndividualContent(value, value.blockIds, choice);
      if (result.options) {
        setMergeOptions(result.options);
        return value;
      }
      setMergeOptions(null);
      return result.value ?? value;
    });

  const register = () => {
    if (!draft) return;
    const attempt = lessonVersionStore.rectify({
      logicalRecordId: entry.id,
      seedFacts,
      seedAt,
      agentProfileId,
      submission: {
        facts: draft,
        ...(justification.trim() ? { justification } : {}),
        satisfiedRequirementCodes: satisfied,
      },
      ...(closing ? { officialClosing: closing } : {}),
    });
    if (!attempt.registered) {
      setIssues([...attempt.issues]);
      return;
    }
    setDraft(null);
    setIssues([]);
    setStep("vigente");
    setFeedback(
      "Correção registrada. O registro anterior foi preservado no histórico e continua consultável.",
    );
  };

  const submissionIssues =
    draft && current
      ? lessonCorrectionSubmissionIssues(projection, current, {
          facts: draft,
          ...(justification.trim() ? { justification } : {}),
          satisfiedRequirementCodes: satisfied,
        })
      : [];

  return (
    <section className="surface-panel space-y-4 p-4" aria-label="Correção do registro de aula">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Registro oficial vigente
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatAcademicDate(entry.date)} · {entry.className} · {entry.field}
          </p>
        </div>
        <StatusBadge tone="neutral">
          {current && current.version > 1
            ? `Versão ${current.version} · já corrigido antes`
            : "Primeira versão registrada"}
        </StatusBadge>
      </header>

      {feedback ? (
        <p role="status" className="text-sm text-foreground">
          {feedback}
        </p>
      ) : null}

      {step === "vigente" ? (
        <>
          <dl className="space-y-3">
            {contentLines(current?.facts ?? seedFacts).map((line) => (
              <div key={line.label}>
                <dt className="text-xs font-medium text-muted-foreground">{line.label}</dt>
                <dd className="whitespace-pre-line text-sm text-foreground">
                  {line.text || "Sem conteúdo informado"}
                </dd>
              </div>
            ))}
          </dl>

          {projection.canCorrect ? (
            <Button type="button" className="min-h-11" onClick={start}>
              <PenLine /> Corrigir registro
            </Button>
          ) : (
            <StatePanel
              tone="warning"
              title="Por que não posso corrigir este registro agora?"
              description={
                projection.disclosableReasons.length
                  ? projection.disclosableReasons.map((item) => item.message).join(" ")
                  : "A correção deste registro não é admissível neste momento."
              }
              action={
                <div className="space-y-2 text-sm">
                <p className="font-medium text-foreground">
                  O que teria de acontecer para ser possível?
                </p>
                {projection.requiredCapabilities.length ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {projection.requiredCapabilities.map((capability) => (
                      <li key={capability}>
                        Alguém com a capacidade institucional “{capability}” precisa realizar a
                        correção. Quem está operando agora: {profile.label}.
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    É necessária regra homologada que discipline a correção deste registro.
                  </p>
                )}
                {projection.consultedClosing ? (
                  <p className="text-xs text-muted-foreground">
                    Contexto consultado: fechamento oficial do período{" "}
                    {projection.consultedClosing.periodLabel}.
                  </p>
                ) : null}
                </div>
              }
            />
          )}
        </>
      ) : null}

      {step === "alterar" && draft && current ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            O que precisa ser corrigido neste registro?
          </h3>

          {admits(LESSON_CHANGE_ASPECTS.content) ? (
            draft.contentMode === "individual" ? (
              <div className="space-y-3">
                {draft.blockIds.map((id, index) => (
                  <label key={id} className="block">
                    <span className="mb-1 block text-sm font-medium text-foreground">
                      {lessonLabel(index, draft.blockIds.length)}
                    </span>
                    <Textarea
                      rows={4}
                      value={draft.contents[id] ?? ""}
                      onChange={(event) => setContent(id, event.target.value)}
                      aria-label={`O que foi trabalhado na ${lessonLabel(index, draft.blockIds.length)}?`}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">
                  O que foi trabalhado nesta aula?
                </span>
                <Textarea
                  rows={5}
                  value={draft.contents["shared"] ?? ""}
                  onChange={(event) => setContent("shared", event.target.value)}
                  aria-label="O que foi trabalhado nesta aula?"
                  className="text-base leading-relaxed"
                />
              </label>
            )
          ) : null}

          {admits(LESSON_CHANGE_ASPECTS.contentMode) && draft.blockIds.length > 1 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Forma de registro</p>
              {draft.contentMode === "shared" ? (
                <Button type="button" variant="outline" size="sm" onClick={separate}>
                  Passar a um registro para cada aula
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => unify()}>
                  Voltar a um registro para as duas aulas
                </Button>
              )}
              {mergeOptions ? (
                <div
                  role="group"
                  aria-label="Unificar os registros"
                  className="rounded-md border border-border bg-muted/40 p-3"
                >
                  <p className="text-sm text-foreground">
                    As aulas têm textos diferentes. O que deseja preservar no registro único?
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => unify({ kind: "join" })}
                    >
                      Manter os dois textos, um após o outro
                    </Button>
                    {mergeOptions.map((text) => (
                      <Button
                        key={text}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal py-2 text-left"
                        onClick={() => unify({ kind: "keep", text })}
                      >
                        Manter apenas: “{text}”
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMergeOptions(null)}
                    >
                      Continuar separado
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {admits(LESSON_CHANGE_ASPECTS.planningRelation) ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Relação com o planejamento
              </span>
              <select
                aria-label="Relação com o planejamento"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.planningRelation}
                onChange={(event) =>
                  setDraft((value) =>
                    value
                      ? { ...value, planningRelation: event.target.value as PlanningRelation }
                      : value,
                  )
                }
              >
                {RELATIONS.map((relation) => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {admits(LESSON_CHANGE_ASPECTS.complements) ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Detalhes pedagógicos continuam opcionais.
              </p>
              {COMPLEMENTS.map(([field, label]) => (
                <label key={field} className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                  <Input
                    value={draft[field]}
                    onChange={(event) =>
                      setDraft((value) =>
                        value ? { ...value, [field]: event.target.value } : value,
                      )
                    }
                    aria-label={label}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="min-h-11"
              disabled={delta.length === 0}
              onClick={() => setStep("conferir")}
            >
              Conferir correção <ArrowRight />
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={cancel}>
              Cancelar
            </Button>
            <p role="status" className="text-sm text-muted-foreground">
              {delta.length === 0
                ? "Nenhuma alteração para registrar."
                : `${delta.length} alteração(ões) em relação ao registro vigente.`}
            </p>
          </div>
        </div>
      ) : null}

      {step === "conferir" && draft && current ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Confira o que vai mudar</h3>
          <ul className="space-y-3">
            {delta.map((aspect) => (
              <li key={aspect} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  {ASPECT_LABEL[aspect] ?? aspect}
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Antes</p>
                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                      {describeAspect(current.facts, aspect)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Depois</p>
                    <p className="whitespace-pre-line text-sm text-foreground">
                      {describeAspect(draft, aspect)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {projection.requiredRitual.length ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
              {projection.requiredRitual.map((requirement) =>
                requirement.code === "justificativa" ? (
                  <label key={requirement.code} className="block">
                    <span className="mb-1 block text-sm font-medium text-foreground">
                      {requirement.label}
                    </span>
                    <Textarea
                      rows={3}
                      value={justification}
                      onChange={(event) => setJustification(event.target.value)}
                      aria-label={requirement.label}
                    />
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="px-0"
                      aria-expanded={whyOpen}
                      onClick={() => setWhyOpen((open) => !open)}
                    >
                      Por que é pedida?
                    </Button>
                    {whyOpen ? (
                      <span className="block text-xs text-muted-foreground">
                        {requirement.provenance}
                        {projection.appliedPolicy
                          ? ` Regra aplicada: ${projection.appliedPolicy.label} (versão ${projection.appliedPolicy.version}).`
                          : ""}
                      </span>
                    ) : null}
                  </label>
                ) : (
                  <label key={requirement.code} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={satisfied.includes(requirement.code)}
                      onChange={(event) =>
                        setSatisfied((list) =>
                          event.target.checked
                            ? [...list, requirement.code]
                            : list.filter((item) => item !== requirement.code),
                        )
                      }
                      aria-label={requirement.label}
                    />
                    <span>
                      <span className="block text-foreground">{requirement.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {requirement.provenance}
                      </span>
                    </span>
                  </label>
                ),
              )}
            </div>
          ) : null}

          {issues.length ? (
            <StatePanel
              tone="warning"
              title="A correção não foi registrada"
              description={issues.join(" ")}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="min-h-11"
              disabled={submissionIssues.length > 0}
              onClick={register}
            >
              Registrar correção
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setStep("alterar")}
            >
              Voltar a ajustar
            </Button>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            O registro atual não é apagado: a correção cria uma nova versão e preserva a anterior no
            histórico.
          </p>
        </div>
      ) : null}

      {lines.length > 1 ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History /> {historyOpen ? "Ocultar histórico" : "Ver histórico do registro"}
          </Button>
          {historyOpen ? (
            <ul className="mt-2 space-y-2 text-sm">
              {[...lines].reverse().map((line) => (
                <li key={line.versionId} className="rounded-md border border-border p-3">
                  <p className="text-foreground">
                    {line.current ? "Registro vigente" : "Registro anterior preservado"} · versão{" "}
                    {line.version}
                  </p>
                  {line.rectification ? (
                    <p className="text-xs text-muted-foreground">
                      Corrigido em {formatAcademicDate(line.rectification.actedAt.slice(0, 10))}
                      {line.rectification.justification
                        ? ` · ${line.rectification.justification}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Registro original da aula.</p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
