/**
 * Etapa 13G — Portal da Secretaria Escolar (tela demonstrativa).
 *
 * A tela NÃO é fonte de verdade: tudo aqui é leitura de uma projeção
 * operacional autorizada sobre os domínios canônicos 13A–13F. Nenhum card,
 * fila, contagem ou pendência é persistido.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Inbox, Lock, Search, ShieldQuestion } from "lucide-react";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSecretaryWorkspaceProjection,
  createSecretaryAccessContext,
  createSecretaryProfileSectionRegistry,
  DEMO_WORKSPACE_CAPACITIES,
  demonstrationSearchableSubjects,
} from "./secretary-workspace";
import { isActionExecutable, projectIntegratedProfile } from "./workspace-engine";
import { searchAuthorizedSubjects } from "./workspace-search";
import {
  WORKSPACE_ADMISSIBILITY,
  WORKSPACE_AUTHORIZATION,
  type OperationalQueueItem,
  type WorkspaceActionDescriptor,
} from "./workspace-types";

const SCOPE_OPTIONS = [
  { entityId: "demo-001", label: "Instituição Educacional Demonstrativa Horizonte" },
  { entityId: "demo-002", label: "Escola Demonstrativa Águas Claras" },
] as const;

const CAPACITY_OPTIONS = [
  { id: DEMO_WORKSPACE_CAPACITIES.consultStudentLife, label: "Consultar vida escolar" },
  { id: DEMO_WORKSPACE_CAPACITIES.operateEnrollment, label: "Operar inscrição letiva" },
  { id: DEMO_WORKSPACE_CAPACITIES.operateAllocation, label: "Operar enturmação" },
  { id: DEMO_WORKSPACE_CAPACITIES.operateMobility, label: "Operar mobilidade" },
  { id: DEMO_WORKSPACE_CAPACITIES.verifyDocument, label: "Conferir documento" },
] as const;

function ActionChip({ action }: { action: WorkspaceActionDescriptor }) {
  const executable = isActionExecutable(action);
  const tone =
    executable
      ? "success"
      : action.actorAuthorization === WORKSPACE_AUTHORIZATION.inconclusive ||
          action.processAdmissibility === WORKSPACE_ADMISSIBILITY.inconclusive
        ? "warning"
        : "neutral";
  return (
    <div className="rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{action.labelSnapshot}</span>
        <StatusBadge tone={tone}>
          {executable ? "Autorizada e admissível" : "Indisponível agora"}
        </StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {action.explanation}
      </p>
      {action.impedimentMessages.map((message) => (
        <p key={message} className="mt-1 text-xs text-muted-foreground">
          Impedimento declarado: {message}
        </p>
      ))}
      <Button className="mt-2" size="sm" variant="outline" disabled>
        Executar no domínio competente
      </Button>
    </div>
  );
}

function QueueItemCard({ item }: { item: OperationalQueueItem }) {
  const studentId = item.deepLink?.params["alunoId"];
  return (
    <article className="rounded-md border border-border/70 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
            {item.titleSnapshot}
          </h3>
          <p className="text-xs text-muted-foreground">
            Vigência declarada: {formatAcademicDate(item.effectiveDate)}
            {item.deadline
              ? ` · Prazo: ${formatAcademicDate(item.deadline.dueDate)}`
              : ""}
          </p>
        </div>
        <StatusBadge tone="info">
          {String(item.authorizedPayload["estado"] ?? item.processStateDefinitionId)}
        </StatusBadge>
      </header>
      {item.redactedFieldPaths.length > 0 ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Campos não autorizados foram ocultados por política de
          acesso.
        </p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {item.actions.map((action) => (
          <ActionChip key={action.actionKey} action={action} />
        ))}
      </div>
      {studentId ? (
        <Button asChild size="sm" variant="ghost" className="mt-2 px-2">
          <Link to="/alunos/$id" params={{ id: studentId }}>
            {item.deepLink?.labelSnapshot ?? "Abrir objeto de origem"}
          </Link>
        </Button>
      ) : null}
    </article>
  );
}

export function SecretaryWorkspacePage() {
  const [scopeIds, setScopeIds] = useState<string[]>(["demo-001"]);
  const [capacityIds, setCapacityIds] = useState<string[]>(
    CAPACITY_OPTIONS.map((option) => option.id),
  );
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const context = useMemo(
    () =>
      createSecretaryAccessContext({
        institutionalScopeIds: scopeIds,
        capacityDefinitionIds: capacityIds,
      }),
    [scopeIds, capacityIds],
  );

  const projection = useMemo(
    () => buildSecretaryWorkspaceProjection({ context }),
    [context],
  );

  const hits = useMemo(
    () =>
      query.trim().length < 2
        ? []
        : searchAuthorizedSubjects({
            query,
            subjects: demonstrationSearchableSubjects,
            context,
          }),
    [query, context],
  );

  const profile = useMemo(() => {
    if (!selectedSubjectId) return null;
    return projectIntegratedProfile({
      subjectEntityId: selectedSubjectId,
      context,
      projection,
      registry: createSecretaryProfileSectionRegistry(),
    });
  }, [selectedSubjectId, context, projection]);

  function toggle(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  return (
    <div className="page-shell">
      <OperationalPageHeader
        title="Portal da Secretaria Escolar"
        description="Ambiente operacional demonstrativo. Tudo o que aparece aqui é projeção autorizada sobre os domínios canônicos da vida escolar — o portal não cria, não decide e não guarda nenhuma verdade institucional própria."
      />

      <DetailSection
        title="Contexto de atuação"
        description="Autorização decorre de capacidades efetivas e escopo institucional — nunca do nome do perfil."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">
              Escopo institucional
            </legend>
            {SCOPE_OPTIONS.map((option) => (
              <div key={option.entityId} className="flex items-start gap-2">
                <Checkbox
                  id={`escopo-${option.entityId}`}
                  checked={scopeIds.includes(option.entityId)}
                  onCheckedChange={() =>
                    setScopeIds((current) => toggle(current, option.entityId))
                  }
                />
                <Label htmlFor={`escopo-${option.entityId}`} className="text-sm font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">
              Capacidades efetivas declaradas
            </legend>
            {CAPACITY_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-start gap-2">
                <Checkbox
                  id={`cap-${option.id}`}
                  checked={capacityIds.includes(option.id)}
                  onCheckedChange={() =>
                    setCapacityIds((current) => toggle(current, option.id))
                  }
                />
                <Label htmlFor={`cap-${option.id}`} className="text-sm font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </fieldset>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Projeção gerada em {formatAcademicDate(projection.producedAt.slice(0, 10))} · esquema
          de projeção versão {projection.workspaceProjectionSchemaVersion} · política de acesso{" "}
          {projection.accessPolicyId} v{projection.accessPolicyVersion}.
        </p>
      </DetailSection>

      <DetailSection
        title="Busca universal"
        description="A autorização acontece antes da formação do resultado: quem não pode ser visto não existe para a busca. O atendimento comum usa nome e identificador institucional."
      >
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Pesquisar aluno"
            placeholder="Nome ou identificador institucional"
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="mt-3 space-y-2">
          {query.trim().length >= 2 && hits.length === 0 ? (
            <EmptyState
              compact
              icon={ShieldQuestion}
              title="Nenhum resultado autorizado"
              description="Não há sujeito autorizado para este contexto de atuação e esta finalidade."
            />
          ) : null}
          {hits.map((hit) => (
            <button
              key={hit.subjectEntityId}
              type="button"
              onClick={() => setSelectedSubjectId(hit.subjectEntityId)}
              className="w-full rounded-md border border-border/70 p-3 text-left hover:border-primary/50"
            >
              <span className="block text-sm font-medium text-foreground">
                {hit.displaySnapshot}
              </span>
              <span className="block text-xs text-muted-foreground">
                {hit.authorizedAttributes
                  .map((attribute) => `${attribute.labelSnapshot}: ${attribute.value}`)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </DetailSection>

      <DetailSection
        title="Central de trabalho"
        description="Caixas de trabalho derivadas dos fatos publicados pelos domínios. Nenhuma fila é entidade; as contagens são apenas navegação, não indicadores."
      >
        <div className="space-y-6">
          {projection.queues.map((queue) => (
            <section key={queue.definition.queueDefinitionId}>
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {queue.definition.labelSnapshot}
                </h3>
                <StatusBadge tone="neutral">
                  {queue.itemCount === 1 ? "1 item" : `${queue.itemCount} itens`}
                </StatusBadge>
              </header>
              {queue.items.length === 0 ? (
                <EmptyState
                  compact
                  icon={Inbox}
                  title="Nada nesta caixa"
                  description="Nenhum fato autorizado satisfaz os critérios configurados desta caixa de trabalho."
                />
              ) : (
                <div className="space-y-3">
                  {queue.items.map((item) => (
                    <QueueItemCard key={item.queueItemKey} item={item} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </DetailSection>

      <DetailSection
        title="Matriz de pendências"
        description="A Secretaria não mantém catálogo próprio de pendências: aqui estão os diagnósticos, requisitos, efeitos e prazos produzidos pelos domínios competentes, com política, versão e executor preservados."
      >
        {projection.requirementMatrix.length === 0 ? (
          <EmptyState
            compact
            icon={CircleAlert}
            title="Nenhuma pendência autorizada"
            description="Nenhum domínio publicou requisito em aberto para este contexto."
          />
        ) : (
          <div className="space-y-3">
            {projection.requirementMatrix.map((diagnostic) => (
              <article
                key={`${diagnostic.sourceReference.entityId}-${diagnostic.diagnosticCode}`}
                className="rounded-md border border-border/70 p-4"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  {diagnostic.messageSnapshot}
                </h3>
                <DefinitionList
                  items={[
                    { term: "Efeito declarado", detail: diagnostic.effectLabelSnapshot },
                    {
                      term: "Executor competente",
                      detail: diagnostic.competentExecutorDefinitionId,
                    },
                    {
                      term: "Regra de origem",
                      detail: `${diagnostic.policyId} · versão ${diagnostic.policyVersion}`,
                    },
                    {
                      term: "Prazo declarado",
                      detail: diagnostic.deadline
                        ? formatAcademicDate(diagnostic.deadline.dueDate)
                        : "Sem prazo declarado pela regra",
                    },
                  ]}
                />
              </article>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection
        title="Ficha integrada"
        description="A ficha é composta por seções registradas pelos próprios domínios; o portal apenas decide o que cabe nesta perspectiva."
      >
        {!profile ? (
          <StatePanel
            title="Nenhum aluno selecionado"
            description="Use a busca universal acima e selecione um resultado autorizado para compor a ficha integrada."
          />
        ) : (
          <div className="space-y-4">
            {profile.sections.map((section) => (
              <article
                key={section.sectionDefinitionId}
                className="rounded-md border border-border/70 p-4"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  {section.labelSnapshot}
                </h3>
                <DefinitionList
                  items={section.entries.map((entry) => ({
                    term: entry.term,
                    detail: entry.detailSnapshot,
                  }))}
                />
              </article>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection
        title="Fronteiras desta etapa"
        description="Limites preservados deliberadamente."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Documentos oficiais, históricos e declarações permanecem no Capítulo 15.</li>
          <li>Indicadores, taxas e gráficos permanecem no Capítulo 14 (CIECE).</li>
          <li>Orientação, Direção e Supervisão serão perspectivas próprias (13H–13J).</li>
          <li>
            As telas anteriores seguem ativas: nenhuma rota legada foi redirecionada antes de
            equivalência funcional comprovada.
          </li>
        </ul>
      </DetailSection>
    </div>
  );
}
