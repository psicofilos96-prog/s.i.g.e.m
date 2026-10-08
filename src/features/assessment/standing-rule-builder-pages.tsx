/**
 * Área institucional das regras de situação acadêmica.
 *
 * A tela não conhece norma alguma: ela oferece o cadastro visual das
 * capacidades do motor (situações, parâmetros, órgãos, critérios, operadores,
 * composições, escopos e consequências), o diagnóstico do que falta e a
 * simulação com dados fictícios. Regra homologada é imutável; alteração
 * posterior gera nova versão.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CirclePlus,
  FlaskConical,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  AGGREGATION_OPERATOR_LABEL,
  COMPARISON_OPERATOR_LABEL,
  STANDING_ORIGIN_LABEL,
  STANDING_RULE_STATUS_LABEL,
  type AcademicStandingRuleSet,
  type AggregationOperator,
  type ComparisonOperator,
  type Consequence,
  type CriterionNode,
  type StandingRuleStep,
  type StandingValue,
} from "./academic-standing-types";
import { STANDING_FACT_CATALOG } from "./academic-standing-facts";
import { standingDemonstrationActor } from "./academic-standing-governance";
import { useAcademicStandingStore } from "./academic-standing-store";
import {
  demonstrationStandingRuleSets,
  networkStandingDraftRuleSets,
} from "./academic-standing-fixtures";
import { networkStandingRuleDrafts } from "./academic-standing-network-rules";
import {
  BUILDER_DIAGNOSTIC_LABEL,
  CONSEQUENCE_KIND_LABEL,
  LOGIC_LABEL,
  builderDiagnostics,
  builderId,
  describeRuleSet,
  diagnosticsBlockHomologation,
  mapNodeTree,
  newComparisonNode,
  newCompositionNode,
  newStep,
  reorderSteps,
  simulateStandingRuleSet,
  type BuilderDiagnostic,
  type SimulationScopeInput,
} from "./standing-rule-builder";
import { countLabel } from "@/lib/format-ptbr";

const BUILDER_NOTE =
  "Toda regra é dado configurado, versionado e homologado — nunca código. O motor só executa primitivas: comparar, agregar, compor com E/OU/NÃO e produzir a consequência declarada. Enquanto não houver homologação, nenhuma situação acadêmica é determinada.";

export const catalogRuleSets = (): readonly AcademicStandingRuleSet[] => [
  ...networkStandingRuleDrafts,
  ...networkStandingDraftRuleSets,
  ...demonstrationStandingRuleSets,
];

const statusTone = (status: AcademicStandingRuleSet["status"]) =>
  status === "homologada"
    ? ("success" as const)
    : status === "em-revisao"
      ? ("info" as const)
      : status === "arquivada"
        ? ("neutral" as const)
        : ("warning" as const);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground";

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <select
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// ------------------------------------------------------------------- Lista

export function StandingRuleBuilderListPage() {
  const store = useAcademicStandingStore();
  const all = [...store.ruleSets(), ...catalogRuleSets()].filter(
    (rule, index, list) =>
      list.findIndex((other) => other.id === rule.id && other.version === rule.version) === index,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regras de situação acadêmica"
        description="Cadastro institucional configurável: situações, critérios, parâmetros, composições lógicas, consequências e deliberações."
      />

      <StatePanel tone="info" title="Regra é configuração, não programação" description={BUILDER_NOTE} />

      <div className="grid gap-3">
        {all.map((rule) => {
          const diagnostics = builderDiagnostics(rule);
          const blocking = diagnosticsBlockHomologation(diagnostics);
          return (
            <article
              key={`${rule.id}@${rule.version}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold text-foreground">{rule.label}</h2>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Versão {rule.version} · {rule.steps.length} critério(s) ·{" "}
                    {rule.standings.length} situação(ões) · {rule.parameters.length} parâmetro(s)
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge tone={statusTone(rule.status)}>
                    {STANDING_RULE_STATUS_LABEL[rule.status]}
                  </StatusBadge>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/regras-de-situacao/$regraId"
                      params={{ regraId: rule.id }}
                      search={{ versao: rule.version }}
                    >
                      Abrir construtor
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {blocking.length === 0
                  ? "Estrutura completa: a regra pode seguir para revisão institucional."
                  : `${countLabel(blocking.length, "ponto", "pontos")} a resolver antes da homologação.`}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Construtor

export function StandingRuleBuilderPage({
  ruleId,
  version,
}: {
  ruleId: string;
  version?: number;
}) {
  const store = useAcademicStandingStore();
  const stored = store.ruleSet(ruleId, version);
  const initial =
    stored ??
    catalogRuleSets().find(
      (rule) => rule.id === ruleId && (version === undefined || rule.version === version),
    );

  const [draft, setDraft] = useState<AcademicStandingRuleSet | undefined>(initial);
  const [messages, setMessages] = useState<readonly string[]>([]);

  if (!draft)
    return (
      <StatePanel
        tone="warning"
        title="Regra não encontrada"
        description="A regra de situação informada não está cadastrada."
      />
    );

  const diagnostics = builderDiagnostics(draft);
  const blocking = diagnosticsBlockHomologation(diagnostics);
  const readOnly = draft.status === "homologada" || draft.status === "arquivada";
  const actor = standingDemonstrationActor("perfil-normativo");
  const lines = describeRuleSet(draft);

  const patch = (next: Partial<AcademicStandingRuleSet>) =>
    setDraft((current) => (current ? { ...current, ...next } : current));

  const act = (action: "criar" | "editar" | "enviar-para-revisao" | "homologar" | "duplicar") => {
    const exists = store.ruleSet(draft.id, draft.version);
    const result = store.act({
      action: action === "editar" && !exists ? "criar" : action,
      actor,
      ruleSet: draft,
    });
    if (!result.ok) {
      setMessages(result.reasons);
      return;
    }
    setDraft(result.value);
    setMessages([
      action === "duplicar"
        ? `Nova versão ${result.value.version} criada em rascunho. A versão anterior permanece intacta.`
        : "Alteração registrada com auditoria.",
    ]);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={draft.label}
        description={draft.description ?? ""}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/regras-de-situacao">
              <ArrowLeft /> Todas as regras
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusTone(draft.status)}>
          {STANDING_RULE_STATUS_LABEL[draft.status]}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">Versão {draft.version}</span>
        {!readOnly && (
          <>
            <Button size="sm" onClick={() => act("editar")}>
              Salvar rascunho
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={blocking.length > 0}
              onClick={() => act("enviar-para-revisao")}
            >
              Enviar para revisão
            </Button>
          </>
        )}
        {draft.status === "em-revisao" && (
          <Button size="sm" disabled={blocking.length > 0} onClick={() => act("homologar")}>
            Homologar
          </Button>
        )}
        {readOnly && (
          <Button size="sm" variant="outline" onClick={() => act("duplicar")}>
            <CirclePlus /> Criar nova versão
          </Button>
        )}
      </div>

      {readOnly && (
        <StatePanel
          tone="info"
          title="Regra imutável"
          description="Regra homologada ou arquivada não é editada. Alteração posterior gera nova versão, com vigência própria, sem reescrever determinações históricas."
        />
      )}

      {messages.length > 0 && (
        <StatePanel tone="warning" title="Retorno da governança" description={messages.join(" ")} />
      )}

      {draft.note && <StatePanel tone="info" title="Observação da regra" description={draft.note} />}

      <DiagnosticsPanel diagnostics={diagnostics} />

      <section className="space-y-3">
        <SectionHeader title="Leitura da regra em linguagem natural" />
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum critério cadastrado ainda.</p>
        ) : (
          <ol className="space-y-2">
            {lines.map((line, index) => (
              <li key={index} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                {line}
              </li>
            ))}
          </ol>
        )}
      </section>

      <StandingsSection draft={draft} readOnly={readOnly} patch={patch} />
      <ParametersSection draft={draft} readOnly={readOnly} patch={patch} />
      <BodiesSection draft={draft} readOnly={readOnly} patch={patch} />
      <StepsSection draft={draft} readOnly={readOnly} patch={patch} />
      <SimulationSection draft={draft} />
      <AuditSection draft={draft} />
    </div>
  );
}

// --------------------------------------------------------------- Diagnóstico

function DiagnosticsPanel({ diagnostics }: { diagnostics: readonly BuilderDiagnostic[] }) {
  const groups: BuilderDiagnostic["severity"][] = [
    "inconsistencia",
    "capacidade-nao-suportada",
    "pendente",
    "completo",
  ];
  return (
    <section className="space-y-3">
      <SectionHeader title="Diagnóstico da regra em elaboração" />
      <div className="grid gap-3">
        {groups.map((severity) => {
          const items = diagnostics.filter((item) => item.severity === severity);
          if (items.length === 0) return null;
          return (
            <div
              key={severity}
              className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm"
            >
              <p className="flex items-center gap-2 font-medium text-foreground">
                {severity === "completo" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
                {BUILDER_DIAGNOSTIC_LABEL[severity]}
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {items.map((item) => (
                  <li key={item.id}>{item.message}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Nada é presumido para completar regra incompleta: cada ponto acima permanece em aberto até a
        governança decidir.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- Situações

type PatchFn = (next: Partial<AcademicStandingRuleSet>) => void;

function StandingsSection({
  draft,
  readOnly,
  patch,
}: {
  draft: AcademicStandingRuleSet;
  readOnly: boolean;
  patch: PatchFn;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Situações acadêmicas cadastradas"
        description="Lista extensível. Cada situação tem identificador estável, rótulo, origem e efeitos declarados."
      />
      <div className="grid gap-3">
        {draft.standings.map((standing, index) => (
          <div key={standing.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Código">
                <Input
                  value={standing.code}
                  disabled={readOnly}
                  onChange={(event) =>
                    patch({
                      standings: draft.standings.map((item, position) =>
                        position === index ? { ...item, code: event.target.value } : item,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Rótulo">
                <Input
                  value={standing.label}
                  disabled={readOnly}
                  onChange={(event) =>
                    patch({
                      standings: draft.standings.map((item, position) =>
                        position === index ? { ...item, label: event.target.value } : item,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Origem institucional">
                <Select
                  value={standing.origin ?? "determinacao-por-regra"}
                  onChange={(value) =>
                    !readOnly &&
                    patch({
                      standings: draft.standings.map((item, position) =>
                        position === index ? { ...item, origin: value } : item,
                      ),
                    })
                  }
                  options={Object.entries(STANDING_ORIGIN_LABEL).map(([value, label]) => ({
                    value: value as keyof typeof STANDING_ORIGIN_LABEL,
                    label,
                  }))}
                />
              </Field>
            </div>
            <Field label="Descrição">
              <Textarea
                className="mt-2"
                value={standing.description}
                disabled={readOnly}
                onChange={(event) =>
                  patch({
                    standings: draft.standings.map((item, position) =>
                      position === index ? { ...item, description: event.target.value } : item,
                    ),
                  })
                }
              />
            </Field>
            {standing.documentaryEvidence && (
              <p className="mt-2 text-xs text-muted-foreground">
                Comprovação documental: {standing.documentaryEvidence}
              </p>
            )}
            {!readOnly && (
              <Button
                className="mt-2"
                size="sm"
                variant="ghost"
                onClick={() =>
                  patch({ standings: draft.standings.filter((item) => item.id !== standing.id) })
                }
              >
                <Trash2 /> Remover situação
              </Button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            patch({
              standings: [
                ...draft.standings,
                {
                  id: builderId("sit"),
                  code: "NOVA",
                  label: "Nova situação",
                  description: "Situação cadastrada pela governança.",
                  origin: "determinacao-por-regra",
                  properties: {},
                  effects: [],
                },
              ],
            })
          }
        >
          <Plus /> Cadastrar situação
        </Button>
      )}
    </section>
  );
}

// --------------------------------------------------------------- Parâmetros

const parseValue = (raw: string): StandingValue | undefined => {
  const text = raw.trim();
  if (!text) return undefined;
  if (text === "sim") return true;
  if (text === "não") return false;
  const numeric = Number(text.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : text;
};

const showValue = (value?: StandingValue) =>
  value === undefined
    ? ""
    : typeof value === "number"
      ? String(value).replace(".", ",")
      : typeof value === "boolean"
        ? value
          ? "sim"
          : "não"
        : value;

function ParametersSection({
  draft,
  readOnly,
  patch,
}: {
  draft: AcademicStandingRuleSet;
  readOnly: boolean;
  patch: PatchFn;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Parâmetros e valores"
        description="Patamares, limites e referências são dados editáveis desta regra, nunca constantes do sistema."
      />
      <div className="grid gap-3">
        {draft.parameters.map((parameter, index) => (
          <div
            key={parameter.id}
            className="grid gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:grid-cols-4"
          >
            <Field label="Nome">
              <Input
                value={parameter.label}
                disabled={readOnly}
                onChange={(event) =>
                  patch({
                    parameters: draft.parameters.map((item, position) =>
                      position === index ? { ...item, label: event.target.value } : item,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Unidade">
              <Input
                value={parameter.unit ?? ""}
                disabled={readOnly}
                onChange={(event) =>
                  patch({
                    parameters: draft.parameters.map((item, position) =>
                      position === index ? { ...item, unit: event.target.value } : item,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Valor">
              <Input
                value={showValue(parameter.value)}
                disabled={readOnly}
                placeholder="sem valor cadastrado"
                onChange={(event) =>
                  patch({
                    parameters: draft.parameters.map((item, position) =>
                      position === index
                        ? (() => {
                            const parsed = parseValue(event.target.value);
                            const { value: _previous, ...rest } = item;
                            return parsed === undefined ? rest : { ...rest, value: parsed };
                          })()
                        : item,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Observação">
              <Input
                value={parameter.note ?? ""}
                disabled={readOnly}
                onChange={(event) =>
                  patch({
                    parameters: draft.parameters.map((item, position) =>
                      position === index ? { ...item, note: event.target.value } : item,
                    ),
                  })
                }
              />
            </Field>
            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  patch({ parameters: draft.parameters.filter((item) => item.id !== parameter.id) })
                }
              >
                <Trash2 /> Remover
              </Button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            patch({
              parameters: [
                ...draft.parameters,
                { id: builderId("par"), label: "Novo parâmetro", unit: "" },
              ],
            })
          }
        >
          <Plus /> Cadastrar parâmetro
        </Button>
      )}
    </section>
  );
}

// ------------------------------------------------------ Órgãos deliberativos

function BodiesSection({
  draft,
  readOnly,
  patch,
}: {
  draft: AcademicStandingRuleSet;
  readOnly: boolean;
  patch: PatchFn;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Órgãos deliberativos e competências"
        description="A competência de cada colegiado é declarada pela regra. O sistema não presume o que um colegiado pode ou não decidir."
      />
      {draft.bodies.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum órgão deliberativo cadastrado nesta regra.
        </p>
      )}
      <div className="grid gap-3">
        {draft.bodies.map((body, index) => (
          <div key={body.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <Field label="Órgão">
              <Input
                value={body.label}
                disabled={readOnly}
                onChange={(event) =>
                  patch({
                    bodies: draft.bodies.map((item, position) =>
                      position === index ? { ...item, label: event.target.value } : item,
                    ),
                  })
                }
              />
            </Field>
            <ul className="mt-2 space-y-2">
              {body.competences.map((competence, competenceIndex) => (
                <li key={competence.id}>
                  <Field label="Competência declarada">
                    <Input
                      value={competence.label}
                      disabled={readOnly}
                      onChange={(event) =>
                        patch({
                          bodies: draft.bodies.map((item, position) =>
                            position === index
                              ? {
                                  ...item,
                                  competences: item.competences.map((entry, entryIndex) =>
                                    entryIndex === competenceIndex
                                      ? { ...entry, label: event.target.value }
                                      : entry,
                                  ),
                                }
                              : item,
                          ),
                        })
                      }
                    />
                  </Field>
                </li>
              ))}
            </ul>
            {!readOnly && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      bodies: draft.bodies.map((item, position) =>
                        position === index
                          ? {
                              ...item,
                              competences: [
                                ...item.competences,
                                { id: builderId("cmp"), label: "Nova competência" },
                              ],
                            }
                          : item,
                      ),
                    })
                  }
                >
                  <Plus /> Competência
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => patch({ bodies: draft.bodies.filter((item) => item.id !== body.id) })}
                >
                  <Trash2 /> Remover órgão
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            patch({
              bodies: [
                ...draft.bodies,
                { id: builderId("org"), label: "Novo órgão deliberativo", competences: [] },
              ],
            })
          }
        >
          <Plus /> Cadastrar órgão
        </Button>
      )}
    </section>
  );
}

// ----------------------------------------------------------------- Critérios

function StepsSection({
  draft,
  readOnly,
  patch,
}: {
  draft: AcademicStandingRuleSet;
  readOnly: boolean;
  patch: PatchFn;
}) {
  const ordered = [...draft.steps].sort((a, b) => a.order - b.order);
  const updateStep = (stepId: string, next: Partial<StandingRuleStep>) =>
    patch({ steps: draft.steps.map((step) => (step.id === stepId ? { ...step, ...next } : step)) });

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Critérios e ordem de avaliação"
        description="Cada critério é: SE fato, operador e valor, combinados por E/OU/NÃO, ENTÃO consequência configurada. A ordem é declarada pela regra."
      />
      <div className="grid gap-3">
        {ordered.map((step) => (
          <div key={step.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Field label={`Critério ${step.order}`}>
                <Input
                  value={step.label}
                  disabled={readOnly}
                  onChange={(event) => updateStep(step.id, { label: event.target.value })}
                />
              </Field>
              {!readOnly && (
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Subir critério"
                    onClick={() => patch({ steps: reorderSteps(draft.steps, step.id, -1) })}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Descer critério"
                    onClick={() => patch({ steps: reorderSteps(draft.steps, step.id, 1) })}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remover critério"
                    onClick={() =>
                      patch({ steps: draft.steps.filter((item) => item.id !== step.id) })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Se
            </p>
            <NodeEditor
              node={step.when}
              draft={draft}
              readOnly={readOnly}
              onChange={(next) => updateStep(step.id, { when: next })}
            />

            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Então
            </p>
            <ConsequenceEditor
              consequence={step.consequence}
              draft={draft}
              readOnly={readOnly}
              onChange={(consequence) => updateStep(step.id, { consequence })}
            />

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={step.stopsOnMatch}
                disabled={readOnly}
                onChange={(event) => updateStep(step.id, { stopsOnMatch: event.target.checked })}
              />
              Encerrar a avaliação quando este critério se verificar
            </label>
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => patch({ steps: [...draft.steps, newStep(ordered.length + 1)] })}
        >
          <Plus /> Acrescentar critério
        </Button>
      )}
    </section>
  );
}

function NodeEditor({
  node,
  draft,
  readOnly,
  onChange,
  depth = 0,
}: {
  node: CriterionNode;
  draft: AcademicStandingRuleSet;
  readOnly: boolean;
  onChange: (node: CriterionNode) => void;
  depth?: number;
}) {
  const replace = (nodeId: string, fn: (current: CriterionNode) => CriterionNode | null) => {
    const next = mapNodeTree(node, nodeId, fn);
    if (next) onChange(next);
  };

  if (node.kind === "composicao")
    return (
      <div
        className="mt-2 space-y-2 rounded-lg border border-dashed border-border p-3"
        style={{ marginLeft: depth * 8 }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Field label="Grupo lógico">
            <Select
              value={node.logic}
              onChange={(logic) => !readOnly && replace(node.id, (current) => ({ ...current, logic }) as CriterionNode)}
              options={Object.entries(LOGIC_LABEL).map(([value, label]) => ({
                value: value as "e" | "ou" | "nao",
                label,
              }))}
            />
          </Field>
          {!readOnly && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  replace(node.id, (current) =>
                    current.kind === "composicao"
                      ? { ...current, children: [...current.children, newComparisonNode()] }
                      : current,
                  )
                }
              >
                <Plus /> Condição
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  replace(node.id, (current) =>
                    current.kind === "composicao"
                      ? { ...current, children: [...current.children, newCompositionNode("ou")] }
                      : current,
                  )
                }
              >
                <Plus /> Subgrupo
              </Button>
            </>
          )}
        </div>
        {node.children.map((child) => (
          <div key={child.id} className="space-y-1">
            <NodeEditor
              node={child}
              draft={draft}
              readOnly={readOnly}
              depth={depth + 1}
              onChange={(next) => replace(child.id, () => next)}
            />
            {!readOnly && (
              <Button size="sm" variant="ghost" onClick={() => replace(child.id, () => null)}>
                <Trash2 /> Remover condição
              </Button>
            )}
          </div>
        ))}
      </div>
    );

  const comparison = node;
  const set = (next: Partial<Extract<CriterionNode, { kind: "comparacao" }>>) =>
    onChange({ ...comparison, ...next });

  return (
    <div
      className="mt-2 grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2"
      style={{ marginLeft: depth * 8 }}
    >
      <Field label="Fato">
        <Select
          value={comparison.fact.factId}
          onChange={(factId) => !readOnly && set({ fact: { ...comparison.fact, factId } })}
          options={STANDING_FACT_CATALOG.map((definition) => ({
            value: definition.id,
            label: definition.label,
          }))}
        />
      </Field>
      <Field label="Escopo de apuração">
        <Input
          value={comparison.fact.scope?.kind ?? ""}
          disabled={readOnly}
          placeholder="ciclo, componente-curricular, turma…"
          onChange={(event) =>
            set({ fact: { ...comparison.fact, scope: { kind: event.target.value } } })
          }
        />
      </Field>
      <Field label="Agregação (opcional)">
        <Select
          value={comparison.aggregation?.operator ?? "sem-agregacao"}
          onChange={(value) => {
            if (readOnly) return;
            if (value === "sem-agregacao") {
              const { aggregation: _ignored, ...rest } = comparison;
              onChange(rest as CriterionNode);
              return;
            }
            set({
              aggregation: {
                operator: value as AggregationOperator,
                ...(comparison.aggregation?.where ? { where: comparison.aggregation.where } : {}),
              },
            });
          }}
          options={[
            { value: "sem-agregacao", label: "sem agregação (fato único)" },
            ...Object.entries(AGGREGATION_OPERATOR_LABEL).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
      </Field>
      <Field label="Operador">
        <Select
          value={comparison.operator}
          onChange={(operator) => !readOnly && set({ operator: operator as ComparisonOperator })}
          options={Object.entries(COMPARISON_OPERATOR_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </Field>
      <Field label="Comparar com">
        <Select
          value={comparison.parameter.kind}
          onChange={(kind) => {
            if (readOnly) return;
            if (kind === "parametro")
              set({
                parameter: {
                  kind: "parametro",
                  parameterId: draft.parameters[0]?.id ?? "",
                },
              });
            else if (kind === "literal") set({ parameter: { kind: "literal", value: 0 } });
            else set({ parameter: { kind: "sem-parametro" } });
          }}
          options={[
            { value: "parametro", label: "parâmetro cadastrado da regra" },
            { value: "literal", label: "valor fixo informado na regra" },
            { value: "sem-parametro", label: "sem valor de comparação" },
          ]}
        />
      </Field>
      {comparison.parameter.kind === "parametro" && (
        <Field label="Parâmetro">
          <Select
            value={comparison.parameter.parameterId}
            onChange={(parameterId) =>
              !readOnly && set({ parameter: { kind: "parametro", parameterId } })
            }
            options={draft.parameters.map((parameter) => ({
              value: parameter.id,
              label: `${parameter.label} (${showValue(parameter.value) || "sem valor"})`,
            }))}
          />
        </Field>
      )}
      {comparison.parameter.kind === "literal" && (
        <Field label="Valor fixo">
          <Input
            value={showValue(comparison.parameter.value)}
            disabled={readOnly}
            onChange={(event) =>
              set({ parameter: { kind: "literal", value: parseValue(event.target.value) ?? 0 } })
            }
          />
        </Field>
      )}
      {comparison.aggregation?.where && (
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">
            Considerando apenas os escopos em que:
          </p>
          <NodeEditor
            node={comparison.aggregation.where}
            draft={draft}
            readOnly={readOnly}
            depth={depth + 1}
            onChange={(where) =>
              set({ aggregation: { operator: comparison.aggregation!.operator, where } })
            }
          />
        </div>
      )}
      {comparison.aggregation && !comparison.aggregation.where && !readOnly && (
        <Button
          size="sm"
          variant="outline"
          className="sm:col-span-2"
          onClick={() =>
            set({
              aggregation: {
                operator: comparison.aggregation!.operator,
                where: newComparisonNode(),
              },
            })
          }
        >
          <Plus /> Filtrar escopos considerados
        </Button>
      )}
    </div>
  );
}

function ConsequenceEditor({
  consequence,
  draft,
  readOnly,
  onChange,
}: {
  consequence: Consequence;
  draft: AcademicStandingRuleSet;
  readOnly: boolean;
  onChange: (consequence: Consequence) => void;
}) {
  return (
    <div className="mt-2 grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
      <Field label="Consequência">
        <Select
          value={consequence.kind}
          onChange={(kind) => {
            if (readOnly) return;
            if (kind === "atribuir-situacao")
              onChange({
                kind: "atribuir-situacao",
                standingId: draft.standings[0]?.id ?? "",
              });
            else if (kind === "encaminhar-para-deliberacao")
              onChange({
                kind: "encaminhar-para-deliberacao",
                bodyId: draft.bodies[0]?.id ?? "",
                competenceId: draft.bodies[0]?.competences[0]?.id ?? "",
              });
            else if (kind === "registrar-pendencia")
              onChange({
                kind: "registrar-pendencia",
                pendencyId: builderId("pen"),
                message: "",
              });
            else onChange({ kind: "prosseguir" });
          }}
          options={Object.entries(CONSEQUENCE_KIND_LABEL).map(([value, label]) => ({
            value: value as Consequence["kind"],
            label,
          }))}
        />
      </Field>
      {consequence.kind === "atribuir-situacao" && (
        <Field label="Situação atribuída">
          <Select
            value={consequence.standingId}
            onChange={(standingId) => !readOnly && onChange({ ...consequence, standingId })}
            options={draft.standings.map((standing) => ({
              value: standing.id,
              label: standing.label,
            }))}
          />
        </Field>
      )}
      {consequence.kind === "encaminhar-para-deliberacao" && (
        <>
          <Field label="Órgão deliberativo">
            <Select
              value={consequence.bodyId}
              onChange={(bodyId) => !readOnly && onChange({ ...consequence, bodyId })}
              options={draft.bodies.map((body) => ({ value: body.id, label: body.label }))}
            />
          </Field>
          <Field label="Competência exercida">
            <Select
              value={consequence.competenceId}
              onChange={(competenceId) => !readOnly && onChange({ ...consequence, competenceId })}
              options={(
                draft.bodies.find((body) => body.id === consequence.bodyId)?.competences ?? []
              ).map((competence) => ({ value: competence.id, label: competence.label }))}
            />
          </Field>
        </>
      )}
      {consequence.kind === "registrar-pendencia" && (
        <Field label="Mensagem da pendência">
          <Textarea
            value={consequence.message}
            disabled={readOnly}
            onChange={(event) => onChange({ ...consequence, message: event.target.value })}
          />
        </Field>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Simulação

function SimulationSection({ draft }: { draft: AcademicStandingRuleSet }) {
  const usedFacts = useMemo(() => {
    const ids = new Set<string>();
    const walk = (node: CriterionNode) => {
      if (node.kind === "composicao") node.children.forEach(walk);
      else {
        ids.add(node.fact.factId);
        if (node.aggregation?.where) walk(node.aggregation.where);
      }
    };
    draft.steps.forEach((step) => walk(step.when));
    return [...ids];
  }, [draft]);

  const [scopes, setScopes] = useState<SimulationScopeInput[]>([
    { scope: { kind: "ciclo" }, label: "Ciclo", values: {} },
  ]);
  const [result, setResult] = useState<ReturnType<typeof simulateStandingRuleSet> | null>(null);

  const run = () =>
    setResult(
      simulateStandingRuleSet({
        ruleSet: draft,
        cycle: { id: "ciclo-simulado", kindId: "simulado", academicYearId: draft.scope.academicYearId },
        studentLabel: "Percurso fictício",
        scopes,
      }),
    );

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Simulação com dados fictícios"
        description="Informe valores fictícios e veja o caminho que a regra percorreria. A simulação não homologa, não registra e não determina situação de aluno algum."
      />

      <div className="grid gap-3">
        {scopes.map((scopeInput, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Escopo">
                <Input
                  value={scopeInput.scope.kind}
                  onChange={(event) =>
                    setScopes((current) =>
                      current.map((item, position) =>
                        position === index
                          ? { ...item, scope: { ...item.scope, kind: event.target.value } }
                          : item,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Identificador do escopo (opcional)">
                <Input
                  value={scopeInput.scope.id ?? ""}
                  onChange={(event) =>
                    setScopes((current) =>
                      current.map((item, position) =>
                        position === index
                          ? {
                              ...item,
                              scope: {
                                kind: item.scope.kind,
                                ...(event.target.value ? { id: event.target.value } : {}),
                              },
                            }
                          : item,
                      ),
                    )
                  }
                />
              </Field>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {usedFacts.map((factId) => {
                const definition = STANDING_FACT_CATALOG.find((item) => item.id === factId);
                const raw = scopeInput.values[factId];
                return (
                  <Field key={factId} label={definition?.label ?? factId}>
                    <Input
                      value={raw === null || raw === undefined ? "" : showValue(raw)}
                      placeholder="em branco = fato indisponível"
                      onChange={(event) =>
                        setScopes((current) =>
                          current.map((item, position) => {
                            if (position !== index) return item;
                            const parsed = parseValue(event.target.value);
                            return {
                              ...item,
                              values: { ...item.values, [factId]: parsed ?? null },
                            };
                          }),
                        )
                      }
                    />
                  </Field>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setScopes((current) => current.filter((_, position) => position !== index))}
            >
              <Trash2 /> Remover escopo
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setScopes((current) => [
              ...current,
              { scope: { kind: "componente-curricular", id: `comp-${current.length + 1}` }, values: {} },
            ])
          }
        >
          <Plus /> Acrescentar escopo fictício
        </Button>
        <Button size="sm" onClick={run}>
          <FlaskConical /> Simular
        </Button>
      </div>

      {result && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
          <p className="text-sm font-medium text-foreground">
            Desfecho da simulação:{" "}
            {result.determination.standing?.label ??
              result.determination.pendencies[0]?.message ??
              "nenhuma situação atribuída"}
          </p>
          <ol className="space-y-1 text-sm text-muted-foreground">
            {result.path.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
          {result.determination.reasons.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {result.determination.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Resultado de simulação, sem valor institucional.
          </p>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ Auditoria

function AuditSection({ draft }: { draft: AcademicStandingRuleSet }) {
  return (
    <section className="space-y-3">
      <SectionHeader title="Auditoria da regra" />
      <ol className="space-y-2">
        {draft.audit.events.map((event, index) => (
          <li key={index} className="rounded-lg border border-border bg-card p-3 text-sm shadow-sm">
            <p className="font-medium text-foreground">{event.action}</p>
            <p className="text-muted-foreground">{event.detail}</p>
            <p className="text-xs text-muted-foreground">
              {formatAcademicDate(event.at.slice(0, 10))} · {event.actor.actorName} ({event.actor.profileLabel})
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
