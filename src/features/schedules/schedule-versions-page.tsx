import { useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import {
  AuditTimeline,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  FutureCapabilitiesPanel,
  OperationalStatesPanel,
  ReferenceDateField,
} from "./lifecycle-widgets";
import {
  LIFECYCLE_REFERENCE_DATE,
  effectiveVersionFor,
  lifecycleStateTone,
  referenceContextLabel,
  versionsForClass,
} from "./schedule-lifecycle";

/** Histórico de versões — /horarios/turmas/$turmaId/versoes. */
export function ScheduleVersionsPage({
  classId,
  referenceDate = LIFECYCLE_REFERENCE_DATE,
}: {
  classId: string;
  referenceDate?: string;
}) {
  const [date, setDate] = useState(referenceDate);
  const klass = getDemonstrationClass(classId);
  const versions = versionsForClass(classId);
  const effective = effectiveVersionFor(classId, date);

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
        title={`Versões da grade — ${klass.name}`}
        description="Linha do tempo cronológica das versões demonstrativas. Versões históricas permanecem em leitura."
        parent={{ label: "Horários escolares", to: "/horarios" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/horarios/turmas/$turmaId/alteracoes" params={{ turmaId: classId }}>
                Alterações
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/turmas/$turmaId/documentos/$tipo/$referenciaId"
                params={{ turmaId: classId, tipo: "vigente", referenciaId: "atual" }}
              >
                Imprimir grade vigente
              </Link>
            </Button>
          </>
        }
      />
      <ReferenceDateField
        value={date}
        onChange={setDate}
        context={referenceContextLabel(classId, date)}
      />
      {effective ? (
        <StatePanel
          tone="info"
          title={`Versão efetiva em ${formatAcademicDate(date)}`}
          description={`${effective.version} · ${effective.state} · vigência desde ${formatAcademicDate(effective.effectiveFrom)}. Blocos de versões diferentes não são misturados.`}
        />
      ) : (
        <StatePanel
          tone="warning"
          title="Nenhuma versão vigente na data escolhida"
          description="Uma versão com vigência futura não é apresentada como vigente hoje."
        />
      )}
      <DetailSection
        title="Linha do tempo"
        description="Versão, situação, vigência, data da operação, natureza, autoria e justificativa."
      >
        {versions.length ? (
          <AuditTimeline
            label="Linha do tempo das versões demonstrativas"
            items={versions.map((record) => ({
              id: record.id,
              title: (
                <span className="flex flex-wrap items-center gap-2">
                  {record.version}
                  <StatusBadge tone={lifecycleStateTone(record.state)}>{record.state}</StatusBadge>
                  {effective?.id === record.id ? (
                    <StatusBadge tone="success">Efetiva na data de referência</StatusBadge>
                  ) : null}
                </span>
              ),
              description: (
                <span className="block space-y-1">
                  <span className="block">{record.nature}</span>
                  <span className="block">{record.justification}</span>
                  <span className="block">
                    Vigência {formatAcademicDate(record.effectiveFrom, "não definida")}
                    {record.effectiveUntil
                      ? ` até ${formatAcademicDate(record.effectiveUntil)}`
                      : ""}{" "}
                    · {record.operationReference} · {record.author}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                      <Link
                        to="/horarios/turmas/$turmaId/versoes/$versaoId"
                        params={{ turmaId: classId, versaoId: record.id }}
                      >
                        Detalhar versão
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                      <Link
                        to="/horarios/turmas/$turmaId/versoes/$versaoId/comparar"
                        params={{ turmaId: classId, versaoId: record.id }}
                      >
                        Comparar
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                      <Link
                        to="/horarios/turmas/$turmaId/documentos/$tipo/$referenciaId"
                        params={{ turmaId: classId, tipo: "versao", referenciaId: record.id }}
                      >
                        Imprimir
                      </Link>
                    </Button>
                  </span>
                </span>
              ),
              timestamp: `Operação em ${record.publishedOn ?? (record.preparedOn || "data não registrada")}`,
            }))}
          />
        ) : (
          <EmptyState
            compact
            title="Nenhuma versão registrada"
            description="A turma possui jornada, mas nenhuma versão demonstrativa foi iniciada."
          />
        )}
      </DetailSection>
      <OperationalStatesPanel />
      <FutureCapabilitiesPanel />
    </div>
  );
}
