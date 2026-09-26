/**
 * Etapa 13H — Portal da Orientação Pedagógica (tela demonstrativa).
 *
 * Três portas: Central de Acompanhamento, Alunos e Turmas. A tela apenas LÊ uma
 * projeção operacional autorizada; nenhuma fila, contagem, sinal ou pendência é
 * persistida, e nenhum rótulo é atribuído ao estudante.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HeartHandshake, Lock, Search, ShieldQuestion } from "lucide-react";
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
import { isActionExecutable, projectIntegratedProfile } from "@/features/workspace/workspace-engine";
import { searchAuthorizedSubjects } from "@/features/workspace/workspace-search";
import {
  WORKSPACE_ADMISSIBILITY,
  WORKSPACE_AUTHORIZATION,
  type OperationalQueueItem,
  type WorkspaceActionDescriptor,
} from "@/features/workspace/workspace-types";
import { GUIDANCE_CAPACITIES } from "./guidance-fixtures";
import {
  PEDAGOGICAL_GUIDANCE_MODULE_LABEL,
  PEDAGOGICAL_GUIDANCE_PRINCIPLE,
} from "./guidance-types";
import {
  buildGuidanceWorkspaceProjection,
  createGuidanceAccessContext,
  createGuidanceProfileSectionRegistry,
  guidanceSearchableSubjects,
  projectGuidanceClassView,
} from "./guidance-workspace";

const SCOPE_OPTIONS = [
  { entityId: "demo-001", label: "Instituição Educacional Demonstrativa Horizonte" },
  { entityId: "demo-002", label: "Escola Demonstrativa Águas Claras" },
] as const;

const CAPACITY_OPTIONS = [
  { id: GUIDANCE_CAPACITIES.consultPedagogicalPath, label: "Consultar percurso pedagógico" },
  { id: GUIDANCE_CAPACITIES.readGuidanceContent, label: "Ler conteúdo de acompanhamento" },
  { id: GUIDANCE_CAPACITIES.analyseSignal, label: "Analisar sinal de atenção" },
  { id: GUIDANCE_CAPACITIES.openFollowUpCase, label: "Abrir acompanhamento" },
  { id: GUIDANCE_CAPACITIES.registerIntervention, label: "Registrar intervenção" },
  { id: GUIDANCE_CAPACITIES.issueReferral, label: "Encaminhar questão" },
] as const;

const CLASS_OPTIONS = [{ classId: "tur-001", label: "Turma demonstrativa tur-001" }] as const;

function ActionChip({ action }: { action: WorkspaceActionDescriptor }) {
  const executable = isActionExecutable(action);
  const tone = executable
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
            Data declarada: {formatAcademicDate(item.effectiveDate)}
            {item.deadline ? ` · Prazo: ${formatAcademicDate(item.deadline.dueDate)}` : ""}
          </p>
        </div>
        <StatusBadge tone="info">
          {String(item.authorizedPayload["estado"] ?? item.processStateDefinitionId)}
        </StatusBadge>
      </header>
      {item.summary ? (
        <p className="mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {item.summary}
        </p>
      ) : null}
      {item.redactedFieldPaths.length > 0 ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Parte do conteúdo foi ocultada pela política de acesso.
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

export function GuidanceWorkspacePage() {
  const [scopeIds, setScopeIds] = useState<string[]>(["demo-001", "tur-001"]);
  const [capacityIds, setCapacityIds] = useState<string[]>(
    CAPACITY_OPTIONS.map((option) => option.id),
  );
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("tur-001");

  const context = useMemo(
    () =>
      createGuidanceAccessContext({
        institutionalScopeIds: scopeIds,
        capacityDefinitionIds: capacityIds,
      }),
    [scopeIds, capacityIds],
  );

  const projection = useMemo(
    () => buildGuidanceWorkspaceProjection({ context }),
    [context],
  );

  const hits = useMemo(
    () =>
      searchAuthorizedSubjects({
        query,
        subjects: guidanceSearchableSubjects,
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
      registry: createGuidanceProfileSectionRegistry(),
    });
  }, [selectedSubjectId, context, projection]);

  const classView = useMemo(
    () => projectGuidanceClassView({ classId: selectedClassId, context, projection }),
    [selectedClassId, context, projection],
  );

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        eyebrow="Etapa 13H"
        title="Portal da Orientação Pedagógica"
        description="Central de acompanhamento, estudantes e turmas como projeção operacional autorizada sobre os fatos canônicos. A Orientação acompanha o percurso e registra o que pertence ao acompanhamento — sem criar segunda ficha do estudante."
      />

      <StatePanel tone="info" title="Princípio desta etapa">
        {PEDAGOGICAL_GUIDANCE_PRINCIPLE}
      </StatePanel>

      <DetailSection
        title="Contexto de atuação"
        description="A autoridade vem de capacidades efetivas e escopo institucional, nunca do nome do perfil."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Escopo institucional
            </p>
            {SCOPE_OPTIONS.map((option) => (
              <label key={option.entityId} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={scopeIds.includes(option.entityId)}
                  onCheckedChange={() => setScopeIds((list) => toggle(list, option.entityId))}
                />
                <span className="[overflow-wrap:anywhere]">{option.label}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Capacidades efetivas
            </p>
            {CAPACITY_OPTIONS.map((option) => (
              <label key={option.id} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={capacityIds.includes(option.id)}
                  onCheckedChange={() => setCapacityIds((list) => toggle(list, option.id))}
                />
                <span className="[overflow-wrap:anywhere]">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Central de acompanhamento"
        description="Caixas de trabalho configuradas, derivadas dos fatos autorizados. As contagens descrevem a própria projeção e não são indicadores institucionais."
      >
        <div className="space-y-6">
          {projection.queues.map((queue) => (
            <section key={queue.definition.queueDefinitionId} className="space-y-3">
              <header className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {queue.definition.labelSnapshot}
                </h3>
                <StatusBadge tone="neutral">
                  {queue.itemCount === 1 ? "1 item" : `${queue.itemCount} itens`}
                </StatusBadge>
              </header>
              {queue.definition.descriptionSnapshot ? (
                <p className="text-xs text-muted-foreground">
                  {queue.definition.descriptionSnapshot}
                </p>
              ) : null}
              {queue.items.length === 0 ? (
                <EmptyState
                  title="Nenhum item autorizado nesta caixa"
                  description="Ausência de item é apenas ausência de registro autorizado: não afirma que não há necessidade de acompanhamento."
                />
              ) : (
                <div className="grid gap-3">
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
        title="Estudantes"
        description="A autorização acontece antes da formação do resultado: quem não pode ser visto não existe para a busca, nem por trecho de conteúdo."
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="guidance-search">Nome ou identificador institucional</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="guidance-search"
                className="pl-9"
                value={query}
                placeholder="Pesquisar estudante"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          {query.trim().length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Informe um termo para consultar os estudantes do seu escopo.
            </p>
          ) : hits.length === 0 ? (
            <EmptyState
              title="Nenhum resultado autorizado"
              description="Nada é revelado fora do escopo e das capacidades declaradas."
            />
          ) : (
            <ul className="grid gap-2">
              {hits.map((hit) => (
                <li key={hit.subjectEntityId}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-border/70 p-3 text-left hover:bg-muted/40"
                    onClick={() => setSelectedSubjectId(hit.subjectEntityId)}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {hit.displaySnapshot}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {hit.authorizedAttributes
                        .map((attribute) => `${attribute.labelSnapshot}: ${attribute.value}`)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DetailSection>

      {profile ? (
        <DetailSection
          title="Ficha pedagógica"
          description="Composição de seções registradas por cada domínio. A mesma pessoa produz aqui uma leitura diferente daquela vista pela Secretaria."
        >
          <div className="space-y-5">
            {profile.sections.map((section) => (
              <section key={section.sectionDefinitionId} className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {section.labelSnapshot}
                </h3>
                <DefinitionList
                  items={section.entries.map((entry) => ({
                    term: entry.term,
                    detail: entry.detailSnapshot,
                  }))}
                />
              </section>
            ))}
          </div>
        </DetailSection>
      ) : null}

      <DetailSection
        title="Turmas"
        description="A turma é porta de entrada operacional: quais estudantes possuem itens de acompanhamento que estou autorizado a conhecer. Taxas, gráficos e séries históricas pertencem ao CIECE."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {CLASS_OPTIONS.map((option) => (
              <Button
                key={option.classId}
                size="sm"
                variant={selectedClassId === option.classId ? "default" : "outline"}
                onClick={() => setSelectedClassId(option.classId)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {classView.students.length === 0 ? (
            <EmptyState
              title="Nenhum estudante projetado nesta turma"
              description="A turma pode existir sem estudantes autorizados nesta finalidade."
            />
          ) : (
            <ul className="grid gap-2">
              {classView.students.map((student) => (
                <li
                  key={student.subjectEntityId}
                  className="rounded-md border border-border/70 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {student.displaySnapshot}
                    </span>
                    <StatusBadge tone="neutral">
                      {student.authorizedItems.length === 1
                        ? "1 item autorizado"
                        : `${student.authorizedItems.length} itens autorizados`}
                    </StatusBadge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 px-2"
                    onClick={() => setSelectedSubjectId(student.subjectEntityId)}
                  >
                    Abrir ficha pedagógica
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DetailSection>

      <DetailSection
        title="Fronteiras desta etapa"
        description="O que esta perspectiva deliberadamente não faz."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <ShieldQuestion className="mr-1 inline size-3" />
            Nenhum sinal se converte em diagnóstico, rótulo pessoal ou abertura automática de
            acompanhamento.
          </li>
          <li>
            Nota, frequência, matrícula, turma, mobilidade e situação acadêmica continuam nos
            domínios responsáveis: aqui são apenas referenciadas.
          </li>
          <li>
            Encerrar um acompanhamento não significa problema resolvido: estado final e motivo são
            registrados separadamente.
          </li>
          <li>
            Observação registrada pelo professor permanece do professor, com autoria preservada.
          </li>
          <li>
            <HeartHandshake className="mr-1 inline size-3" />
            {PEDAGOGICAL_GUIDANCE_MODULE_LABEL}
          </li>
        </ul>
      </DetailSection>
    </div>
  );
}
