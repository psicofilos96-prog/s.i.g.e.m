import { teachingClass } from "@/features/diary/institutional-teaching";
import { useClassConfigurationState } from "@/features/assessment/assessment-normative-sources";
/**
 * Etapa 12L — consulta da projeção canônica (somente leitura).
 *
 * A tela não lavra, não edita e não recalcula: ela espelha o que o encerramento
 * congelou. Alternar versões apenas consulta a cadeia; o conteúdo histórico
 * permanece exatamente como foi publicado. Datas na interface: DD/MM/AAAA.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "@/features/diary/diary-data";
import { classConfigurationState } from "@/features/assessment/assessment-configuration";
import { resolveCycles } from "@/features/assessment/cycle-configuration";
import { useCycleClosingStore } from "@/features/cycle-closing/cycle-closing-store";
import { formatAcademicDate, formatDateTime } from "@/lib/academic-date";
import { projectClosingChain, type ProjectionOptions } from "./academic-projection-service";
import { useCloudCycleClosing } from "@/features/cycle-closing/cycle-closing-cloud";
import { useSessionAuthority } from "@/features/authority/session-authority";
import {
  demonstrationProjectionOptions,
  PROJECTION_DEMONSTRATION_NOTE,
} from "./academic-projection-fixtures";
import {
  ACADEMIC_PROJECTION_MODULE_LABEL,
  ACADEMIC_PROJECTION_MODULE_NOTE,
  ACADEMIC_PROJECTION_SCHEMA_VERSION,
  type AcademicDimensionProjection,
  type ProjectionFact,
  type StudentAcademicCycleProjection,
} from "./academic-projection-types";

const factValue = (fact: ProjectionFact) => {
  if (fact.value === null)
    return fact.unavailableReason ? `Não disponível — ${fact.unavailableReason}` : "Não disponível";
  if (Array.isArray(fact.value)) return fact.value.join(", ");
  if (typeof fact.value === "boolean") return fact.value ? "Sim" : "Não";
  return `${fact.value}${fact.unit ? ` ${fact.unit}` : ""}`;
};

function DimensionCard({ dimension }: { dimension: AcademicDimensionProjection }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="text-sm font-medium text-foreground">
        {dimension.labelSnapshot ?? dimension.dimensionId}
      </p>
      <p className="text-xs text-muted-foreground">
        Natureza declarada: {dimension.dimensionKindId}
        {dimension.parentDimensionId ? ` · vinculada a ${dimension.parentDimensionId}` : ""}
      </p>
      <ul className="mt-2 space-y-1">
        {dimension.facts.map((fact) => (
          <li key={fact.factId} className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{fact.labelSnapshot ?? fact.factId}</span>
            <span className="font-medium text-foreground">{factValue(fact)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StudentCard({ student }: { student: StudentAcademicCycleProjection }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {student.studentNameSnapshot ?? student.studentId}
          </p>
          <p className="text-xs text-muted-foreground">
            {student.resolution.standingId
              ? `Resolução publicada: ${student.resolution.standingId}`
              : "Sem situação acadêmica — ausência legítima, nada é presumido"}
            {student.resolution.sourceTypeId ? ` · origem: ${student.resolution.sourceTypeId}` : ""}
          </p>
        </div>
        <StatusBadge tone={student.issues.length ? "warning" : "success"}>
          {student.issues.length ? `${student.issues.length} pendência(s)` : "Sem pendências"}
        </StatusBadge>
      </div>

      {student.dimensions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Percurso por dimensão
          </p>
          {student.dimensions.map((dimension) => (
            <DimensionCard key={`${dimension.dimensionKindId}-${dimension.dimensionId}`} dimension={dimension} />
          ))}
        </div>
      )}

      {(student.attendance.facts.length > 0 || student.attendance.dimensions.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Frequência publicada
          </p>
          {student.attendance.facts.map((fact) => (
            <div key={fact.factId} className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{fact.labelSnapshot ?? fact.factId}</span>
              <span className="font-medium text-foreground">{factValue(fact)}</span>
            </div>
          ))}
          {student.attendance.dimensions.map((dimension) => (
            <DimensionCard key={`frq-${dimension.dimensionId}`} dimension={dimension} />
          ))}
        </div>
      )}

      {student.deliberations.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Deliberações: {student.deliberations.map((item) => `${item.kind} ${item.id}`).join(" · ")}
        </p>
      )}

      {student.issues.length > 0 && (
        <ul className="space-y-1">
          {student.issues.map((issue) => (
            <li key={issue.issueId} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{issue.issueTypeId}</span> — {issue.status}
              {issue.description ? `: ${issue.description}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AcademicProjectionPage({
  classId,
  search,
}: {
  classId: string;
  search: DiarySearch;
}) {
  const closings = useCycleClosingStore();
  const sessionAuthority = useSessionAuthority();
  const cloud = sessionAuthority.status === "signed-in";
  const cloudClosing = useCloudCycleClosing(classId, cloud, {
    userId: sessionAuthority.status === "signed-in" ? sessionAuthority.user.id : null,
  });
  const [selectedClosingId, setSelectedClosingId] = useState<string | null>(null);

  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((assignment) => assignment.classId === classId);
  const klass = teachingClass(classId);
  const state = useClassConfigurationState(classId);

  if (!klass || !item || !("configuration" in state) || !("structure" in state))
    return (
      <StatePanel
        tone="warning"
        title="Projeção indisponível"
        description="Turma, atuação pedagógica ou configuração avaliativa não encontradas para este contexto."
      />
    );

  const { configuration, structure, year } = state;
  const cycle = resolveCycles({ configuration, structure })[0];
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  const header = (
    <DiaryHeader
      title={ACADEMIC_PROJECTION_MODULE_LABEL}
      description={`${klass.name} · ${year.label}`}
      context={context}
    />
  );

  if (!cycle)
    return (
      <div className="space-y-5">
        {header}
        <StatePanel
          tone="warning"
          title="Nenhum ciclo configurado para esta turma"
          description="A projeção publica o que o encerramento de um ciclo configurado congelou. Sem ciclo configurado não existe percurso a publicar."
        />
      </div>
    );

  const snapshots = closings.chain({ classId, cycleId: cycle.id });
  // 6D.FINAL.6 — com sessão, o catálogo vem só da política homologada do encerramento;
  // as opções demonstrativas são inalcançáveis numa sessão institucional.
  const currentSnapshot = closings.current({ classId, cycleId: cycle.id });
  const institutionalCatalog = currentSnapshot
    ? cloudClosing.policies.find(
        (p) => p.id === currentSnapshot.policyId && p.version === currentSnapshot.policyVersion,
      )?.projectionCatalog
    : undefined;
  const options: ProjectionOptions | undefined = cloud
    ? institutionalCatalog
      ? { ...institutionalCatalog }
      : undefined
    : demonstrationProjectionOptions;
  if (cloud && currentSnapshot && !options)
    return (
      <div className="space-y-5">
        {header}
        <StatePanel
          tone="warning"
          title="Projeção indisponível"
          description="A política homologada do encerramento não declara o catálogo de projeção (dimensões e fatos publicáveis). Nenhuma lista demonstrativa é usada no lugar."
        />
      </div>
    );
  const projections = options ? projectClosingChain(snapshots, options) : [];
  const selected =
    projections.find((projection) => projection.closingSnapshotId === selectedClosingId) ??
    projections.find((projection) => projection.isCurrentClosingVersion);

  return (
    <div className="space-y-5">
      {header}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/diario/turmas/$turmaId/encerramento" params={{ turmaId: classId }} search={classSearch}>
            <ArrowLeft className="mr-1.5 size-4" /> Encerramento do ciclo
          </Link>
        </Button>
        <StatusBadge tone="neutral">Contrato da projeção v{ACADEMIC_PROJECTION_SCHEMA_VERSION}</StatusBadge>
      </div>

      <StatePanel
        tone="info"
        title="Fronteira de publicação dos fatos oficiais"
        description={cloud ? ACADEMIC_PROJECTION_MODULE_NOTE : `${ACADEMIC_PROJECTION_MODULE_NOTE} ${PROJECTION_DEMONSTRATION_NOTE}`}
      />

      {!selected ? (
        <StatePanel
          tone="warning"
          title="Nenhum encerramento lavrado para este ciclo"
          description="A projeção nasce exclusivamente do encerramento oficial versionado. Enquanto o ciclo não for encerrado, não há fatos acadêmicos oficiais a publicar — e nada é reconstruído a partir do estado atual das fontes."
        />
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Versões publicadas
            </p>
            <div className="flex flex-wrap gap-2">
              {projections.map((projection) => (
                <Button
                  key={projection.closingSnapshotId}
                  size="sm"
                  variant={
                    projection.closingSnapshotId === selected.closingSnapshotId
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setSelectedClosingId(projection.closingSnapshotId)}
                >
                  <Layers className="mr-1.5 size-4" />
                  Versão {projection.closingVersion}
                  {projection.isCurrentClosingVersion ? " · vigente" : " · superada"}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-card/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {selected.act.kindLabelSnapshot}
              </p>
              <StatusBadge tone={selected.isCurrentClosingVersion ? "success" : "neutral"}>
                {selected.isCurrentClosingVersion ? "Versão vigente" : "Versão superada"}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              Lavrado em {formatDateTime(selected.act.declaredAt)} por{" "}
              {selected.act.declaredByActorNameSnapshot}.
            </p>
            {selected.cycleStartDate && selected.cycleEndDate && (
              <p className="text-xs text-muted-foreground">
                Intervalo do ciclo: {formatAcademicDate(selected.cycleStartDate)} a{" "}
                {formatAcademicDate(selected.cycleEndDate)}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Proveniência: encerramento {selected.provenance.closingSnapshotId} (versão{" "}
              {selected.provenance.closingVersion}), política {selected.provenance.policyId} versão{" "}
              {selected.provenance.policyVersion}, {selected.provenance.sourceReferences.length}{" "}
              fonte(s) com versão preservada.
            </p>
            {selected.act.justification && (
              <p className="text-xs text-muted-foreground">
                Justificativa registrada: {selected.act.justification}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Percursos publicados
            </p>
            {selected.students.length === 0 ? (
              <StatePanel
                tone="neutral"
                title="Nenhum percurso publicado neste encerramento"
                description="O encerramento não registrou percurso individual algum."
              />
            ) : (
              selected.students.map((student) => (
                <StudentCard key={student.studentId} student={student} />
              ))
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              Consulta somente de leitura. A projeção não altera, não recalcula e não reinterpreta
              nenhum fato: qualquer correção passa pelo rito formal de retificação do encerramento, o
              que gera nova versão sem apagar a anterior.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
