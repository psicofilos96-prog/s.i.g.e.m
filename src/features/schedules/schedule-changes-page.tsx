import { Link } from "@tanstack/react-router";
import { AuditTimeline, DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  BeforeAfterList,
  ChangeKindBadge,
  FutureCapabilitiesPanel,
  ImpactPanel,
  OperationalStatesPanel,
} from "./lifecycle-widgets";
import {
  LIFECYCLE_CLASSIFICATION_NOTE,
  changeImpact,
  changeRequestStateTone,
  changeRequestsForClass,
  getVersionRecord,
  versionsForClass,
} from "./schedule-lifecycle";

/** Alterações de grade publicada — /horarios/turmas/$turmaId/alteracoes. */
export function ScheduleChangesPage({ classId }: { classId: string }) {
  const klass = getDemonstrationClass(classId);
  const requests = changeRequestsForClass(classId);
  const rectifications = versionsForClass(classId).flatMap((record) =>
    record.rectifications.map((item) => ({ record, item })),
  );

  if (!klass)
    return (
      <EmptyState
        title="Turma não encontrada"
        description="O identificador não corresponde às turmas fictícias disponíveis."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/turmas">Voltar</Link>
          </Button>
        }
      />
    );

  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={`Alterações da grade — ${klass.name}`}
        description="Propostas demonstrativas de alteração e retificações rastreadas. A grade de origem nunca é alterada silenciosamente."
        parent={{ label: "Horários escolares", to: "/horarios" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/horarios/turmas/$turmaId/versoes" params={{ turmaId: classId }}>
                Histórico de versões
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/horarios/turmas/$turmaId/alteracoes/nova" params={{ turmaId: classId }}>
                Nova proposta de alteração
              </Link>
            </Button>
          </>
        }
      />
      {requests.length === 0 ? (
        <EmptyState
          compact
          title="Nenhuma proposta registrada"
          description="Esta turma demonstrativa não possui propostas de alteração."
        />
      ) : (
        <div className="space-y-5">
          {requests.map((request) => {
            const impact = changeImpact(request.id);
            return (
              <section key={request.id} className="border border-border bg-card p-4">
                <header className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    {request.operation} · {request.id}
                  </h2>
                  <ChangeKindBadge kind={request.kind} />
                  <StatusBadge tone={changeRequestStateTone(request.state)}>
                    {request.state}
                  </StatusBadge>
                  {request.requiresNewVersion === null ? (
                    <StatusBadge tone="warning">Decisão pendente</StatusBadge>
                  ) : request.requiresNewVersion ? (
                    <StatusBadge tone="info">Exige nova versão</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Retificação sem nova versão principal</StatusBadge>
                  )}
                </header>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Grade de origem</dt>
                    <dd>
                      {getVersionRecord(request.originVersionId)?.version ??
                        request.originVersionId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Data de efeito</dt>
                    <dd>{request.effectFrom || "não definida"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Responsável demonstrativo</dt>
                    <dd>{request.author}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Blocos afetados</dt>
                    <dd>{request.affectedBlockIds.join("; ") || "nenhum identificado"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Justificativa</dt>
                    <dd>{request.justification}</dd>
                  </div>
                </dl>
                {impact ? (
                  <div className="mt-4 space-y-3">
                    <BeforeAfterList impact={impact} label={`Antes e depois — ${request.id}`} />
                    <ImpactPanel impact={impact} />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/horarios/turmas/$turmaId/documentos/$tipo/$referenciaId"
                      params={{ turmaId: classId, tipo: "proposta", referenciaId: request.id }}
                    >
                      Imprimir proposta
                    </Link>
                  </Button>
                  {request.resultingVersionId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/horarios/turmas/$turmaId/versoes/$versaoId"
                        params={{ turmaId: classId, versaoId: request.resultingVersionId }}
                      >
                        Ver versão resultante
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <DetailSection
        title="Retificações registradas"
        description="Alterações simples preservam a identificação da versão principal e o conteúdo publicado anteriormente."
      >
        <AuditTimeline
          label="Retificações demonstrativas"
          items={rectifications.map(({ record, item }) => ({
            id: item.id,
            title: `${item.kind} em ${record.version}`,
            description: `${item.justification} Antes: ${item.before.start}–${item.before.end}. Depois: ${item.after.start}–${item.after.end}.`,
            meta: `${item.operationReference} · ${item.author}`,
            timestamp: `Efeito desde ${item.effectFrom}`,
          }))}
          emptyMessage="Nenhuma retificação registrada nesta turma demonstrativa."
        />
      </DetailSection>
      <StatePanel
        tone="info"
        title="Classificação configurável"
        description={LIFECYCLE_CLASSIFICATION_NOTE}
      />
      <OperationalStatesPanel />
      <FutureCapabilitiesPanel />
    </div>
  );
}
