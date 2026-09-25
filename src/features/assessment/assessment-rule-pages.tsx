/**
 * Etapa 12F — telas da regra avaliativa institucional.
 * - Supervisão: cadastra, valida, revisa, homologa, duplica, arquiva, simula.
 * - Escola/professor: consultam a regra homologada; nenhuma edição.
 *
 * A interface nunca decide capacidade por si: consulta `ruleCapabilities`.
 */
import { useMemo, useState, type ReactNode } from "react";
import { DateInput } from "@/components/sigem/date-input";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CopyPlus,
  FlaskConical,
  GitCompare,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import {
  academicYears,
  getStageReference,
  stageReferences,
} from "@/features/academic/academic-structure";
import { useNetworkCalendars, calendarRepository } from "@/features/calendar/calendar-store";
import { formatAcademicDate } from "@/lib/academic-date";
import { instrumentTypes } from "./assessment-fixtures";
import {
  RULE_PROFILES,
  RULE_PROFILE_LABEL as PROFILE_LABEL,
  type RuleProfile,
} from "./assessment-rule-view";
import {
  RULE_STATUS_LABEL,
  ruleCapabilities,
  type Clearable,
  type RuleMutation,
  type RuleTransition,
} from "./assessment-rule-governance";
import { assessmentRuleActors } from "./assessment-rule-fixtures";
import { assessmentRuleRepository, useAssessmentRules } from "./assessment-rule-store";
import {
  aggregationLabel,
  compareRules,
  describeRule,
  simulateRule,
} from "./assessment-rule-preview";
import { validateRule, type RuleValidation } from "./assessment-rule-validation";
import { RULE_INCOMPLETE_NOTICE } from "./assessment-rule-pending";
import {
  RECOVERY_PREVALENCE_LABEL,
  ROUNDING_POINT_LABEL,
  SUPERVISION_RECOVERY_PREVALENCES,
  type AssessmentRuleStatus,
  type InstitutionalAssessmentRule,
  type RecoveryPrevalence,
  type RecoveryRule,
} from "./assessment-rule-types";
import type { AggregationRule, RoundingMode, RoundingPoint } from "./assessment-composition-types";

const actorFor = (profile: RuleProfile) => assessmentRuleActors[profile];

const STATUS_TONE: Record<AssessmentRuleStatus, "success" | "warning" | "info" | "neutral"> = {
  rascunho: "info",
  "em-revisao": "warning",
  homologada: "success",
  arquivada: "neutral",
};

const selectCls = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm";
const inputCls = selectCls;

const AGGREGATIONS: AggregationRule["kind"][] = [
  "soma",
  "media-simples",
  "media-ponderada",
  "maior-valor",
  "ultimo-valor",
];
const ROUNDING_MODES: RoundingMode[] = [
  "sem-arredondamento",
  "meio-acima",
  "meio-par",
  "truncar",
  "passo",
];
const ROUNDING_POINTS: RoundingPoint[] = [
  "instrumento",
  "categoria",
  "periodo",
  "componente",
  "anual",
];
/**
 * Curadoria de INTERFACE: a Supervisão só escolhe formas com finalidade
 * pedagógica/normativa reconhecida. O domínio continua capaz de representar as
 * demais (ver RECOVERY_PREVALENCE_LABEL), caso a norma da rede mude.
 */
const PREVALENCES = SUPERVISION_RECOVERY_PREVALENCES;

/** Evita exibir vazio como se fosse um valor configurado. */
const show = (value: string | number | boolean) =>
  value === "" ? "não definido" : value === true ? "sim" : value === false ? "não" : String(value);

function ProfileSwitch({
  profile,
  to,
  params,
}: {
  profile: RuleProfile;
  to: string;
  params?: Record<string, string>;
}) {
  return (
    <nav aria-label="Perfil de demonstração" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Ver como:</span>
      {RULE_PROFILES.map((p) => (
        <Link
          key={p}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          to={to as any}
          params={params as never}
          search={{ perfil: p } as never}
          aria-current={p === profile ? "true" : undefined}
          className={cn(
            "rounded-md border px-2.5 py-1 font-medium",
            p === profile
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-foreground hover:bg-muted",
          )}
        >
          {PROFILE_LABEL[p]}
        </Link>
      ))}
      <span className="text-xs text-muted-foreground">
        Sem autenticação real — permissões definitivas dependem do backend.
      </span>
    </nav>
  );
}

function Section({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="min-w-0 border-t border-border/70 pt-4">
      <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {aside && <div className="flex flex-wrap gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function useRuleValidation(rule: InstitutionalAssessmentRule): RuleValidation {
  return useMemo(
    () =>
      validateRule(rule, {
        calendar: calendarRepository.get(rule.scope.calendarId),
        instrumentTypeIds: instrumentTypes.map((t) => t.id),
      }),
    [rule],
  );
}

/**
 * Definições que a rede ainda não decidiu. Não são erros da regra: são lacunas
 * normativas. Nenhuma delas é preenchida pelo sistema.
 */
function PendingDefinitionsPanel({ validation }: { validation: RuleValidation }) {
  if (validation.pending.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma definição normativa pendente registrada nesta regra.
      </p>
    );
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-foreground">
        {validation.requiredPending.length > 0
          ? `${validation.requiredPending.length} definição(ões) obrigatória(s) pendente(s): a regra não pode ir para revisão nem ser homologada.`
          : "Pendências registradas não impedem o avanço desta regra."}
      </p>
      <ul className="space-y-1.5" aria-label="Definições pendentes">
        {validation.pending.map((item) => (
          <li key={item.code} className="flex min-w-0 items-start gap-2">
            <StatusBadge tone={item.required ? "warning" : "neutral"}>
              {item.required ? "Obrigatória" : "Opcional"}
            </StatusBadge>
            <span className="min-w-0 break-words">
              <span className="font-medium text-foreground">{item.label}</span> — {item.detail}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Ausência de informação permanece ausência: nada aqui é convertido em configuração
        provisória.
      </p>
    </div>
  );
}

function ValidationPanel({ validation }: { validation: RuleValidation }) {
  return (
    <div className="space-y-2 text-sm">
      {validation.requiredPending.length > 0 && (
        <p className="break-words font-medium text-foreground">{RULE_INCOMPLETE_NOTICE}</p>
      )}
      <p className="font-medium text-foreground">
        {validation.errors.length === 0
          ? "Nenhuma inconsistência bloqueante."
          : `${validation.errors.length} inconsistência(s) impedem revisão e homologação.`}
      </p>
      <ul className="space-y-1.5" aria-label="Erros e avisos da regra">
        {validation.errors.map((issue) => (
          <li key={issue.code + issue.message} className="flex min-w-0 items-start gap-2">
            <StatusBadge tone="danger">Erro</StatusBadge>
            <span className="min-w-0 break-words">{issue.message}</span>
          </li>
        ))}
        {validation.warnings.map((issue) => (
          <li key={issue.code + issue.message} className="flex min-w-0 items-start gap-2">
            <StatusBadge tone="warning">Aviso</StatusBadge>
            <span className="min-w-0 break-words">{issue.message}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Avisos não bloqueiam: o sistema nunca preenche por conta própria uma decisão pedagógica.
      </p>
    </div>
  );
}

function RuleSummary({ rule }: { rule: InstitutionalAssessmentRule }) {
  const stageLabels = rule.scope.stageIds
    .map((id) => getStageReference(id)?.label ?? id)
    .join(", ");
  const calendar = calendarRepository.get(rule.scope.calendarId);
  return (
    <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      {[
        ["Estado", RULE_STATUS_LABEL[rule.status]],
        ["Versão", `v${rule.version}`],
        [
          "Ano letivo",
          academicYears.find((y) => y.id === rule.scope.academicYearId)?.label ??
            rule.scope.academicYearId,
        ],
        [
          "Calendário",
          calendar ? `${calendar.title} · ${calendar.periods.length} período(s)` : "Não localizado",
        ],
        ["Etapas/modalidades", stageLabels || "Não declaradas"],
        [
          "Vigência",
          rule.validFrom || rule.validUntil
            ? `${rule.validFrom ? formatAcademicDate(rule.validFrom) : "—"} a ${rule.validUntil ? formatAcademicDate(rule.validUntil) : "—"}`
            : "Não delimitada",
        ],
        ["Estratégia", rule.strategy],
        ["Categorias", String(rule.categories.length)],
        ["Fechamento do período", aggregationLabel(rule.periodAggregation)],
        [
          "Consolidação anual",
          rule.cycleAggregation
            ? aggregationLabel(rule.cycleAggregation)
            : "Pendente de definição normativa",
        ],
        [
          "Recuperação periódica",
          !rule.periodicRecovery?.enabled
            ? "Não prevista"
            : rule.periodicRecovery.prevalence
              ? RECOVERY_PREVALENCE_LABEL[rule.periodicRecovery.prevalence]
              : "Prevalência pendente de definição",
        ],
        [
          "Recuperação final",
          !rule.finalRecovery?.enabled
            ? "Não prevista"
            : rule.finalRecovery.prevalence
              ? RECOVERY_PREVALENCE_LABEL[rule.finalRecovery.prevalence]
              : "Prevalência pendente de definição",
        ],
        [
          "Arredondamento",
          rule.rounding.mode === "sem-arredondamento"
            ? "Nenhum"
            : `${rule.rounding.mode} · ${rule.rounding.applyAt.length ? rule.rounding.applyAt.join(", ") : "sem momento"}`,
        ],
        [
          "Alimenta cálculo institucional",
          rule.status === "homologada"
            ? "Sim, regra homologada"
            : "Não — apenas prévia e simulação",
        ],
      ].map(([term, detail]) => (
        <div key={term} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{term}</dt>
          <dd className="mt-0.5 break-words text-foreground">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------- Lista

export function AssessmentRuleListPage({ profile }: { profile: RuleProfile }) {
  const actor = actorFor(profile);
  const rules = useAssessmentRules();
  const calendars = useNetworkCalendars();
  const [year, setYear] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [message, setMessage] = useState<string | null>(null);
  const sup = actor.role === "supervisao";

  const visible = rules.filter((rule) => {
    if (!ruleCapabilities(actor, rule).view) return false;
    if (year !== "todos" && rule.scope.academicYearId !== year) return false;
    if (status !== "todos" && rule.status !== status) return false;
    return true;
  });

  const createDraft = () => {
    const calendar = calendars[0];
    if (!calendar) {
      setMessage("Nenhum calendário da rede disponível para referenciar os períodos.");
      return;
    }
    const result = assessmentRuleRepository.create(actor, {
      name: "Nova regra avaliativa (rascunho)",
      academicYearId: calendar.academicYearId,
      calendarId: calendar.id,
    });
    setMessage(
      result.ok
        ? "Rascunho criado. Configure a regra antes de enviar para revisão."
        : result.reason,
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={sup ? "Supervisão de Ensino" : "Regra avaliativa da rede"}
        title="Regras avaliativas"
        description={
          sup
            ? "A Supervisão configura, revisa e homologa as regras que alimentam o cálculo. Nenhuma regra real da rede está homologada ainda."
            : "Regras homologadas pela Supervisão de Ensino. Escolas e professores apenas consultam."
        }
        actions={
          sup ? (
            <Button size="sm" onClick={createDraft}>
              <Plus className="size-4" /> Nova regra
            </Button>
          ) : undefined
        }
      />
      <ProfileSwitch profile={profile} to="/regras-avaliativas" />
      {message && <StatePanel tone="info" title="Aviso" description={message} />}

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field label="Ano letivo">
          <select className={selectCls} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="todos">Todos</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="todos">Todos</option>
            {(Object.keys(RULE_STATUS_LABEL) as AssessmentRuleStatus[]).map((s) => (
              <option key={s} value={s}>
                {RULE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {sup && (
        <Button size="sm" variant="outline" onClick={createDraft} className="sm:hidden">
          <Plus className="size-4" /> Nova regra
        </Button>
      )}

      {visible.length === 0 ? (
        <StatePanel
          title="Nenhuma regra avaliativa disponível"
          description={
            sup
              ? "Nenhuma regra corresponde aos filtros. Crie um rascunho para começar a configurar."
              : "A Supervisão de Ensino ainda não homologou nenhuma regra avaliativa. Enquanto isso, o cálculo de resultados permanece bloqueado."
          }
        />
      ) : (
        <ul
          className="divide-y divide-border/70 border-y border-border/70"
          aria-label="Regras avaliativas da rede"
        >
          {visible.map((rule) => {
            const calendar = calendarRepository.get(rule.scope.calendarId);
            return (
              <li
                key={rule.id}
                className="grid min-w-0 gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-foreground [overflow-wrap:anywhere]">
                    {rule.name}
                  </p>
                  <p className="break-words text-sm text-muted-foreground">
                    v{rule.version} ·{" "}
                    {academicYears.find((y) => y.id === rule.scope.academicYearId)?.label ??
                      rule.scope.academicYearId}{" "}
                    ·{" "}
                    {rule.scope.stageIds
                      .map((id) => getStageReference(id)?.label ?? id)
                      .join(", ") || "sem etapa declarada"}{" "}
                    ·{" "}
                    {calendar
                      ? `${calendar.periods.length} período(s)`
                      : "calendário não localizado"}
                    {rule.originRuleId ? " · duplicada" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={STATUS_TONE[rule.status]}>
                    {RULE_STATUS_LABEL[rule.status]}
                  </StatusBadge>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/regras-avaliativas/$regraId"
                      params={{ regraId: rule.id }}
                      search={{ perfil: profile }}
                    >
                      Abrir
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Detalhe

export function AssessmentRuleDetailPage({
  ruleId,
  profile,
}: {
  ruleId: string;
  profile: RuleProfile;
}) {
  const actor = actorFor(profile);
  const rules = useAssessmentRules();
  const rule = rules.find((r) => r.id === ruleId);
  const [message, setMessage] = useState<string | null>(null);

  if (!rule)
    return (
      <StatePanel
        tone="warning"
        title="Regra não encontrada"
        description="A regra avaliativa solicitada não existe ou foi excluída enquanto era um rascunho."
      />
    );
  const caps = ruleCapabilities(actor, rule);
  if (!caps.view)
    return (
      <StatePanel
        tone="warning"
        title="Regra em elaboração"
        description="Somente a Supervisão de Ensino consulta regras que ainda não foram homologadas."
      />
    );

  const validation = validateRule(rule, {
    calendar: calendarRepository.get(rule.scope.calendarId),
    instrumentTypeIds: instrumentTypes.map((t) => t.id),
  });
  const sections = describeRule(rule, {
    calendar: calendarRepository.get(rule.scope.calendarId),
    instrumentTypes,
    yearLabel:
      academicYears.find((y) => y.id === rule.scope.academicYearId)?.label ??
      rule.scope.academicYearId,
    stageLabels: rule.scope.stageIds.map((id) => getStageReference(id)?.label ?? id),
  });

  const run = (t: RuleTransition) => {
    const result = assessmentRuleRepository.transition(rule.id, actor, t, {
      blockingErrors: validation.errors.length,
      requiredPending: validation.requiredPending.length,
    });
    setMessage(result.ok ? "Operação concluída." : result.reason);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Regra avaliativa institucional"
        title={rule.name}
        description="Prévia da regra em linguagem natural, situação normativa, auditoria demonstrativa e simulador da Supervisão."
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link to="/regras-avaliativas" search={{ perfil: profile }}>
                <ArrowLeft className="size-4" /> Regras
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/regras-avaliativas/$regraId/comparar"
                params={{ regraId: rule.id }}
                search={{ perfil: profile }}
              >
                <GitCompare className="size-4" /> Comparar versões
              </Link>
            </Button>
            {caps.edit && (
              <Button asChild size="sm">
                <Link
                  to="/regras-avaliativas/$regraId/editar"
                  params={{ regraId: rule.id }}
                  search={{ perfil: profile }}
                >
                  Editar rascunho
                </Link>
              </Button>
            )}
          </>
        }
      />
      <ProfileSwitch
        profile={profile}
        to="/regras-avaliativas/$regraId"
        params={{ regraId: rule.id }}
      />
      {message && <StatePanel tone="info" title="Aviso" description={message} />}

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={STATUS_TONE[rule.status]}>{RULE_STATUS_LABEL[rule.status]}</StatusBadge>
        {rule.status === "homologada" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Snapshot imutável: alterações exigem nova versão.
          </span>
        )}
        {caps.submitForReview && (
          <Button size="sm" variant="outline" onClick={() => run("enviar-revisao")}>
            Enviar para revisão
          </Button>
        )}
        {caps.returnToDraft && (
          <>
            <Button size="sm" variant="outline" onClick={() => run("devolver-rascunho")}>
              Devolver ao rascunho
            </Button>
            <Button size="sm" onClick={() => run("homologar")}>
              <ShieldCheck className="size-4" /> Homologar
            </Button>
          </>
        )}
        {caps.archive && (
          <Button size="sm" variant="outline" onClick={() => run("arquivar")}>
            Arquivar
          </Button>
        )}
        {caps.duplicate && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const result = assessmentRuleRepository.duplicate(rule.id, actor);
              setMessage(result.ok ? "Nova versão criada em rascunho." : result.reason);
            }}
          >
            <CopyPlus className="size-4" /> Duplicar como nova versão
          </Button>
        )}
        {caps.remove && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const result = assessmentRuleRepository.remove(rule.id, actor);
              setMessage(result.ok ? "Rascunho excluído." : result.reason);
            }}
          >
            <Trash2 className="size-4" /> Excluir rascunho
          </Button>
        )}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Section
            title="Prévia da regra"
            description="Tradução da regra para linguagem natural, para validação pedagógica."
          >
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.title} className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                  <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                    {section.lines.map((line) => (
                      <li key={line} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
          <Sandbox rule={rule} />
          <Section
            title="Auditoria demonstrativa"
            description="Sem backend, nada aqui é registro oficial."
          >
            <ul className="space-y-2 text-sm">
              {rule.audit.events.map((event, index) => (
                <li key={`${event.at}-${index}`} className="min-w-0 break-words">
                  <span className="font-medium text-foreground">{event.action}</span>{" "}
                  <span className="text-muted-foreground">
                    · {event.actorName} · {formatAcademicDate(event.at.slice(0, 10))} —{" "}
                    {event.detail}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-4 xl:self-start">
          <Section title="Resumo da regra">
            <RuleSummary rule={rule} />
          </Section>
          <Section
            title="Definições pendentes"
            description="O que a rede ainda não decidiu nesta regra."
          >
            <PendingDefinitionsPanel validation={validation} />
          </Section>
          <Section title="Validação">
            <ValidationPanel validation={validation} />
          </Section>
        </aside>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Sandbox

function Sandbox({ rule }: { rule: InstitutionalAssessmentRule }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [recovery, setRecovery] = useState("");
  const result = simulateRule(rule, {
    categoryValues: Object.fromEntries(
      rule.categories.map((c) => [
        c.id,
        values[c.id] === undefined || values[c.id] === "" ? undefined : Number(values[c.id]),
      ]),
    ),
    ...(recovery === "" ? {} : { recoveryValue: Number(recovery) }),
  });
  return (
    <Section
      title="Testar fórmula"
      description="Simulação com valores fictícios digitados pela Supervisão, antes da homologação."
    >
      <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <FlaskConical className="size-4" /> {result.notice}
      </p>
      {result.blocked ? (
        <StatePanel tone="info" title="Sem simulação numérica" description={result.blocked} />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            {rule.categories.map((category) => (
              <Field key={category.id} label={category.label}>
                <input
                  className={inputCls}
                  type="number"
                  inputMode="decimal"
                  value={values[category.id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [category.id]: e.target.value }))}
                />
              </Field>
            ))}
            {rule.periodicRecovery?.enabled && (
              <Field
                label="Recuperação fictícia"
                hint="Participa conforme a prevalência configurada."
              >
                <input
                  className={inputCls}
                  type="number"
                  inputMode="decimal"
                  value={recovery}
                  onChange={(e) => setRecovery(e.target.value)}
                />
              </Field>
            )}
            {rule.categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                A regra ainda não tem categorias para simular.
              </p>
            )}
          </div>
          <dl className="grid min-w-0 gap-3 text-sm">
            {result.categories.map((category) => (
              <div key={category.categoryId} className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">{category.label}</dt>
                <dd className="break-words tabular-nums text-foreground">
                  {category.stage ? category.stage.value : "sem valor informado"}
                </dd>
              </div>
            ))}
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">Resultado do período</dt>
              <dd className="break-words tabular-nums text-foreground">
                {result.period ? result.period.value : "—"}
                {result.period && result.period.rounded ? " (arredondado no fechamento)" : ""}
              </dd>
            </div>
            {result.recovery && (
              <>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">Recuperação</dt>
                  <dd className="tabular-nums text-foreground">{result.recovery.value}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">Pós-recuperação</dt>
                  <dd className="break-words tabular-nums text-foreground">
                    {result.afterRecovery?.value} · {result.prevalenceLabel}
                  </dd>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              A simulação não produz situação acadêmica: nenhuma aprovação, reprovação ou resultado
              oficial é derivada aqui.
            </p>
          </dl>
        </div>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------- Editor

export function AssessmentRuleEditorPage({
  ruleId,
  profile,
}: {
  ruleId: string;
  profile: RuleProfile;
}) {
  const actor = actorFor(profile);
  const rules = useAssessmentRules();
  const rule = rules.find((r) => r.id === ruleId);
  const [message, setMessage] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  if (!rule)
    return (
      <StatePanel
        tone="warning"
        title="Regra não encontrada"
        description="A regra avaliativa solicitada não existe."
      />
    );
  const caps = ruleCapabilities(actor, rule);
  const validation = validateRule(rule, {
    calendar: calendarRepository.get(rule.scope.calendarId),
    instrumentTypeIds: instrumentTypes.map((t) => t.id),
  });
  const calendar = calendarRepository.get(rule.scope.calendarId);

  const change = (m: RuleMutation) => {
    const result = assessmentRuleRepository.mutate(rule.id, actor, m);
    setMessage(result.ok ? null : result.reason);
  };
  const readOnly = !caps.edit;

  const recoveryEditor = (scope: "periodo" | "anual") => {
    const current = scope === "periodo" ? rule.periodicRecovery : rule.finalRecovery;
    const kind: RuleMutation["kind"] =
      scope === "periodo" ? "recuperacao-periodica" : "recuperacao-final";
    const save = (patch: Clearable<RecoveryRule>) => {
      const base: RecoveryRule = current ?? {
        id: `rec-${scope}`,
        enabled: false,
        scope,
        replacesCategoryIds: [],
        instrumentTypeIds: [],
        // Nada é presumido: prevalência e fórmula nascem pendentes de definição.
        normativeStatus: "pendente",
      };
      const next = { ...base } as Record<string, unknown>;
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        if (value === null) delete next[key];
        else next[key] = value;
      }
      change({ kind, recovery: next as unknown as RecoveryRule } as RuleMutation);
    };
    return (
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Prevista nesta regra">
          <select
            className={selectCls}
            disabled={readOnly}
            value={current?.enabled ? "sim" : "nao"}
            onChange={(e) => save({ enabled: e.target.value === "sim" })}
          >
            <option value="nao">Não prevista</option>
            <option value="sim">Prevista</option>
          </select>
        </Field>
        <Field
          label="Forma de prevalência"
          hint="Valor configurável da regra; o sistema é capaz de representar outras formas."
        >
          <select
            className={selectCls}
            disabled={readOnly || !current?.enabled}
            value={current?.prevalence ?? ""}
            onChange={(e) =>
              save(
                e.target.value === ""
                  ? { prevalence: null }
                  : { prevalence: e.target.value as RecoveryPrevalence },
              )
            }
          >
            <option value="">Pendente de definição normativa</option>
            {PREVALENCES.map((p) => (
              <option key={p} value={p}>
                {RECOVERY_PREVALENCE_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Teto da recuperação" hint="Deixe vazio para não definir teto.">
          <input
            className={inputCls}
            type="number"
            disabled={readOnly || !current?.enabled}
            value={current?.maxScore ?? ""}
            onChange={(e) =>
              save(
                e.target.value === "" ? { maxScore: null } : { maxScore: Number(e.target.value) },
              )
            }
          />
        </Field>
        <Field label="Forma de cálculo dos registros">
          <select
            className={selectCls}
            disabled={readOnly || !current?.enabled}
            value={current?.aggregation?.kind ?? ""}
            onChange={(e) =>
              save(
                e.target.value === ""
                  ? { aggregation: null }
                  : { aggregation: { kind: e.target.value as AggregationRule["kind"] } },
              )
            }
          >
            <option value="">Pendente de definição normativa</option>
            {AGGREGATIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="text-sm font-medium text-foreground">Tipos de instrumento</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {instrumentTypes.map((type) => (
              <label key={type.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={readOnly || !current?.enabled}
                  checked={current?.instrumentTypeIds.includes(type.id) ?? false}
                  onChange={(e) =>
                    save({
                      instrumentTypeIds: e.target.checked
                        ? [...(current?.instrumentTypeIds ?? []), type.id]
                        : (current?.instrumentTypeIds ?? []).filter((id) => id !== type.id),
                    })
                  }
                />
                <span className="break-words">{type.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="text-sm font-medium text-foreground">Categorias substituídas</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {rule.categories.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria configurada.</p>
            )}
            {rule.categories.map((category) => (
              <label key={category.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={readOnly || !current?.enabled}
                  checked={current?.replacesCategoryIds.includes(category.id) ?? false}
                  onChange={(e) =>
                    save({
                      replacesCategoryIds: e.target.checked
                        ? [...(current?.replacesCategoryIds ?? []), category.id]
                        : (current?.replacesCategoryIds ?? []).filter((id) => id !== category.id),
                    })
                  }
                />
                <span className="break-words">{category.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Supervisão de Ensino"
        title={`Editar regra — ${rule.name}`}
        description="Identificação, estratégia, composição do período, recuperações, consolidação anual e arredondamento."
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/regras-avaliativas/$regraId"
              params={{ regraId: rule.id }}
              search={{ perfil: profile }}
            >
              <ArrowLeft className="size-4" /> Voltar à regra
            </Link>
          </Button>
        }
      />
      {readOnly && (
        <StatePanel
          tone="warning"
          title="Somente leitura"
          description={
            rule.status === "homologada"
              ? "Regra homologada é imutável. Para alterar, duplique como nova versão em rascunho."
              : rule.status === "em-revisao"
                ? "Regra em revisão está bloqueada para edição. Devolva ao rascunho para alterar."
                : "Somente a Supervisão de Ensino configura regras avaliativas da rede."
          }
        />
      )}
      {message && <StatePanel tone="danger" title="Alteração não aplicada" description={message} />}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Section title="Identificação" description="Contexto institucional e vigência.">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Nome da regra">
                <input
                  className={inputCls}
                  disabled={readOnly}
                  value={rule.name}
                  onChange={(e) =>
                    change({ kind: "identificacao", patch: { name: e.target.value } })
                  }
                />
              </Field>
              <Field label="Ano letivo">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.scope.academicYearId}
                  onChange={(e) =>
                    change({ kind: "escopo", patch: { academicYearId: e.target.value } })
                  }
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Calendário da rede"
                hint="Os períodos vêm deste calendário, por identificador."
              >
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.scope.calendarId}
                  onChange={(e) =>
                    change({ kind: "escopo", patch: { calendarId: e.target.value } })
                  }
                >
                  {calendarRepository.list().map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {c.year}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Início da vigência">
                <DateInput
                  className={inputCls}
                  disabled={readOnly}
                  value={rule.validFrom ?? ""}
                  onChange={(e) =>
                    change({ kind: "identificacao", patch: { validFrom: e.target.value } })
                  }
                />
              </Field>
              <Field label="Término da vigência">
                <DateInput
                  className={inputCls}
                  disabled={readOnly}
                  value={rule.validUntil ?? ""}
                  onChange={(e) =>
                    change({ kind: "identificacao", patch: { validUntil: e.target.value } })
                  }
                />
              </Field>
              <fieldset className="min-w-0 sm:col-span-2">
                <legend className="text-sm font-medium text-foreground">
                  Etapas e modalidades
                </legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  {stageReferences.map((stage) => (
                    <label key={stage.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={rule.scope.stageIds.includes(stage.id)}
                        onChange={(e) =>
                          change({
                            kind: "escopo",
                            patch: {
                              stageIds: e.target.checked
                                ? [...rule.scope.stageIds, stage.id]
                                : rule.scope.stageIds.filter((id) => id !== stage.id),
                            },
                          })
                        }
                      />
                      <span className="break-words">{stage.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </Section>

          <Section
            title="Estratégia"
            description="Define se a regra trabalha com nota ou com registros pedagógicos."
          >
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Estratégia avaliativa">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.strategy}
                  onChange={(e) =>
                    change({
                      kind: "estrategia",
                      patch: {
                        strategy: e.target.value as InstitutionalAssessmentRule["strategy"],
                      },
                    })
                  }
                >
                  {["quantitativa", "conceitual", "descritiva", "hibrida", "acompanhamento"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Semântica do valor">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.scaleSemantics}
                  onChange={(e) =>
                    change({
                      kind: "estrategia",
                      patch: {
                        scaleSemantics: e.target
                          .value as InstitutionalAssessmentRule["scaleSemantics"],
                      },
                    })
                  }
                >
                  {["quantitativa", "conceitual", "descritiva"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Admite nota">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.allowsGrades ? "sim" : "nao"}
                  onChange={(e) =>
                    change({
                      kind: "estrategia",
                      patch: { allowsGrades: e.target.value === "sim" },
                    })
                  }
                >
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </Field>
              <Field label="Usa registros pedagógicos do Diário">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.usesPedagogicalRecords ? "sim" : "nao"}
                  onChange={(e) =>
                    change({
                      kind: "estrategia",
                      patch: { usesPedagogicalRecords: e.target.value === "sim" },
                    })
                  }
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section
            title="Composição do período"
            description="Categorias com identificador estável: renomear ou reordenar nunca troca a identidade."
            aside={
              caps.edit ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    change({
                      kind: "adicionar-categoria",
                      label: `Categoria ${rule.categories.length + 1}`,
                    })
                  }
                >
                  <Plus className="size-4" /> Categoria
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-4">
              {rule.categories.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma categoria configurada. Uma regra com nota precisa de ao menos uma.
                </p>
              )}
              {rule.categories.map((category, index) => (
                <div key={category.id} className="min-w-0 rounded-md border border-border/70 p-3">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    <Field label="Nome da categoria" hint={`Identificador estável: ${category.id}`}>
                      <input
                        className={inputCls}
                        disabled={readOnly}
                        value={category.label}
                        onChange={(e) =>
                          change({
                            kind: "atualizar-categoria",
                            categoryId: category.id,
                            patch: { label: e.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field label="Peso">
                      <input
                        className={inputCls}
                        type="number"
                        disabled={readOnly}
                        value={category.weight}
                        onChange={(e) =>
                          change({
                            kind: "atualizar-categoria",
                            categoryId: category.id,
                            patch: { weight: Number(e.target.value) },
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Teto da categoria"
                      hint="Vazio permanece indefinido: nenhum teto é presumido."
                    >
                      <input
                        className={inputCls}
                        type="number"
                        disabled={readOnly}
                        value={category.maxScore ?? ""}
                        onChange={(e) =>
                          change({
                            kind: "atualizar-categoria",
                            categoryId: category.id,
                            patch: {
                              maxScore: e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                    <Field label="Forma de cálculo da categoria">
                      <select
                        className={selectCls}
                        disabled={readOnly}
                        value={category.aggregation.kind}
                        onChange={(e) =>
                          change({
                            kind: "atualizar-categoria",
                            categoryId: category.id,
                            patch: {
                              aggregation: { kind: e.target.value as AggregationRule["kind"] },
                            },
                          })
                        }
                      >
                        {AGGREGATIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Quantidade mínima de registros"
                      hint="Vazio permanece indefinido: o sistema não presume nenhum número."
                    >
                      <input
                        className={inputCls}
                        type="number"
                        disabled={readOnly}
                        value={category.minimumEntries ?? ""}
                        onChange={(e) =>
                          change({
                            kind: "atualizar-categoria",
                            categoryId: category.id,
                            patch: {
                              minimumEntries: e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                    <fieldset className="min-w-0 sm:col-span-2">
                      <legend className="text-sm font-medium text-foreground">
                        Tipos de instrumento admitidos
                      </legend>
                      <div className="mt-1 flex flex-wrap gap-3">
                        {instrumentTypes.map((type) => (
                          <label key={type.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              disabled={readOnly}
                              checked={category.instrumentTypeIds.includes(type.id)}
                              onChange={(e) =>
                                change({
                                  kind: "atualizar-categoria",
                                  categoryId: category.id,
                                  patch: {
                                    instrumentTypeIds: e.target.checked
                                      ? [...category.instrumentTypeIds, type.id]
                                      : category.instrumentTypeIds.filter((id) => id !== type.id),
                                  },
                                })
                              }
                            />
                            <span className="break-words">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  {caps.edit && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() =>
                          change({
                            kind: "mover-categoria",
                            categoryId: category.id,
                            direction: -1,
                          })
                        }
                      >
                        <ArrowUp className="size-4" /> Subir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={index === rule.categories.length - 1}
                        onClick={() =>
                          change({ kind: "mover-categoria", categoryId: category.id, direction: 1 })
                        }
                      >
                        <ArrowDown className="size-4" /> Descer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          change({ kind: "remover-categoria", categoryId: category.id })
                        }
                      >
                        <Trash2 className="size-4" /> Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Field label="Fechamento do período">
                  <select
                    className={selectCls}
                    disabled={readOnly}
                    value={rule.periodAggregation.kind}
                    onChange={(e) =>
                      change({
                        kind: "composicao-periodo",
                        patch: {
                          periodAggregation: { kind: e.target.value as AggregationRule["kind"] },
                        },
                      })
                    }
                  >
                    {AGGREGATIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Teto do período" hint="Vazio: nenhum teto é presumido.">
                  <input
                    className={inputCls}
                    type="number"
                    disabled={readOnly}
                    value={rule.periodMaxScore ?? ""}
                    onChange={(e) =>
                      change({
                        kind: "composicao-periodo",
                        patch: {
                          periodMaxScore: e.target.value === "" ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section
            title="Recuperação periódica"
            description="Opcional. Nenhuma forma de prevalência é imposta pelo sistema."
          >
            {recoveryEditor("periodo")}
          </Section>

          <Section
            title="Consolidação anual"
            description="Fórmula e pesos por período oficial do calendário."
          >
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Consolidação anual">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.cycleAggregation?.kind ?? ""}
                  onChange={(e) =>
                    change({
                      kind: "consolidacao-anual",
                      patch:
                        e.target.value === ""
                          ? { cycleAggregation: null }
                          : {
                              cycleAggregation: {
                                kind: e.target.value as AggregationRule["kind"],
                              },
                            },
                    })
                  }
                >
                  <option value="">Pendente de definição normativa</option>
                  {AGGREGATIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Exige todos os períodos completos">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.requiresAllPeriods ? "sim" : "nao"}
                  onChange={(e) =>
                    change({
                      kind: "consolidacao-anual",
                      patch: { requiresAllPeriods: e.target.value === "sim" },
                    })
                  }
                >
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </Field>
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-foreground">Pesos por período</p>
              {!calendar && (
                <p className="text-sm text-muted-foreground">
                  Calendário não localizado: não é possível listar os períodos oficiais.
                </p>
              )}
              {(calendar?.periods ?? []).map((period) => {
                const weight = (rule.cyclePeriodWeights ?? []).find(
                  (w) => w.calendarPeriodId === period.id,
                );
                return (
                  <Field key={period.id} label={period.name}>
                    <input
                      className={inputCls}
                      type="number"
                      disabled={readOnly}
                      value={weight?.weight ?? ""}
                      onChange={(e) => {
                        const rest = (rule.cyclePeriodWeights ?? []).filter(
                          (w) => w.calendarPeriodId !== period.id,
                        );
                        change({
                          kind: "consolidacao-anual",
                          patch: {
                            cyclePeriodWeights:
                              e.target.value === ""
                                ? rest
                                : [
                                    ...rest,
                                    { calendarPeriodId: period.id, weight: Number(e.target.value) },
                                  ],
                          },
                        });
                      }}
                    />
                  </Field>
                );
              })}
            </div>
          </Section>

          <Section
            title="Recuperação final"
            description="Opcional. O resultado anterior é sempre preservado."
          >
            {recoveryEditor("anual")}
          </Section>

          <Section
            title="Arredondamento"
            description="A regra define a forma e os momentos; fora deles a precisão é integral."
          >
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Forma">
                <select
                  className={selectCls}
                  disabled={readOnly}
                  value={rule.rounding.mode}
                  onChange={(e) =>
                    change({
                      kind: "arredondamento",
                      patch: { mode: e.target.value as RoundingMode },
                    })
                  }
                >
                  {ROUNDING_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Casas decimais">
                <input
                  className={inputCls}
                  type="number"
                  disabled={readOnly}
                  value={rule.rounding.decimals ?? ""}
                  onChange={(e) =>
                    change({
                      kind: "arredondamento",
                      patch: { decimals: e.target.value === "" ? null : Number(e.target.value) },
                    })
                  }
                />
              </Field>
              <Field label="Passo da escala" hint="Usado somente na forma por passo.">
                <input
                  className={inputCls}
                  type="number"
                  step="0.1"
                  disabled={readOnly}
                  value={rule.rounding.step ?? ""}
                  onChange={(e) =>
                    change({
                      kind: "arredondamento",
                      patch: { step: e.target.value === "" ? null : Number(e.target.value) },
                    })
                  }
                />
              </Field>
              <fieldset className="min-w-0 sm:col-span-2">
                <legend className="text-sm font-medium text-foreground">
                  Momentos de aplicação
                </legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  {ROUNDING_POINTS.map((point) => (
                    <label key={point} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={rule.rounding.applyAt.includes(point)}
                        onChange={(e) =>
                          change({
                            kind: "arredondamento",
                            patch: {
                              applyAt: e.target.checked
                                ? [...rule.rounding.applyAt, point]
                                : rule.rounding.applyAt.filter((p) => p !== point),
                            },
                          })
                        }
                      />
                      <span className="break-words">{ROUNDING_POINT_LABEL[point]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </Section>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Button
            size="sm"
            variant="outline"
            className="xl:hidden"
            onClick={() => setShowSummary((v) => !v)}
            aria-expanded={showSummary}
          >
            {showSummary ? "Ocultar resumo e validação" : "Ver resumo e validação"}
          </Button>
          <div className={cn("space-y-5", showSummary ? "block" : "hidden xl:block")}>
            <Section title="Resumo da regra">
              <RuleSummary rule={rule} />
            </Section>
            <Section
              title="Definições pendentes"
              description="O que a rede ainda não decidiu nesta regra."
            >
              <PendingDefinitionsPanel validation={validation} />
            </Section>
            <Section title="Validação">
              <ValidationPanel validation={validation} />
            </Section>
          </div>
        </aside>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Comparação

export function AssessmentRuleComparePage({
  ruleId,
  profile,
}: {
  ruleId: string;
  profile: RuleProfile;
}) {
  const actor = actorFor(profile);
  const rules = useAssessmentRules();
  const rule = rules.find((r) => r.id === ruleId);
  const candidates = rules.filter((r) => r.id !== ruleId && ruleCapabilities(actor, r).view);
  const [otherId, setOtherId] = useState(candidates[0]?.id ?? "");
  const other = rules.find((r) => r.id === otherId);

  if (!rule)
    return (
      <StatePanel
        tone="warning"
        title="Regra não encontrada"
        description="A regra avaliativa solicitada não existe."
      />
    );
  const diffs = other ? compareRules(other, rule) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Regra avaliativa institucional"
        title="Comparar versões"
        description="Diferenças identificadas por identificador, nunca por nome. Renomear não faz uma categoria desaparecer."
        actions={
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/regras-avaliativas/$regraId"
              params={{ regraId: rule.id }}
              search={{ perfil: profile }}
            >
              <ArrowLeft className="size-4" /> Voltar à regra
            </Link>
          </Button>
        }
      />
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:max-w-3xl">
        <Field label="Versão de referência">
          <select
            className={selectCls}
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
          >
            <option value="">Selecione</option>
            {candidates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · v{r.version} · {RULE_STATUS_LABEL[r.status]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Versão analisada">
          <input className={inputCls} readOnly value={`${rule.name} · v${rule.version}`} />
        </Field>
      </div>
      {!other ? (
        <StatePanel
          tone="info"
          title="Escolha uma versão de referência"
          description="Selecione outra regra ou versão para ver as diferenças estruturais."
        />
      ) : diffs.length === 0 ? (
        <StatePanel
          tone="success"
          title="Nenhuma diferença estrutural"
          description="As duas versões descrevem a mesma regra avaliativa."
        />
      ) : (
        <ul
          className="divide-y divide-border/70 border-y border-border/70"
          aria-label="Diferenças entre versões"
        >
          {diffs.map((diff, index) => (
            <li key={`${diff.area}-${diff.label}-${index}`} className="grid min-w-0 gap-1 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  tone={
                    diff.kind === "adicionada"
                      ? "success"
                      : diff.kind === "removida"
                        ? "danger"
                        : "info"
                  }
                >
                  {diff.kind}
                </StatusBadge>
                <span className="min-w-0 break-words text-sm font-medium text-foreground">
                  {diff.area} · {diff.label}
                </span>
              </div>
              <p className="min-w-0 break-words text-sm text-muted-foreground">
                {diff.before !== undefined ? `Antes: ${show(diff.before)}. ` : ""}
                {diff.after !== undefined ? `Agora: ${show(diff.after)}.` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
