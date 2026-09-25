import { formatAcademicDate } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/branding";
import { getClassUnitName, getDemonstrationClass } from "@/features/classes/classes-data";
import { BeforeAfterList, DiffList, ScheduleBlocksView } from "./lifecycle-widgets";
import {
  LIFECYCLE_DOCUMENT_NOTE,
  LIFECYCLE_REFERENCE_DATE,
  changeImpact,
  compareVersions,
  effectiveVersionFor,
  getChangeRequest,
  getVersionRecord,
  versionsForClass,
} from "./schedule-lifecycle";

export type ScheduleDocumentKind = "vigente" | "versao" | "comparacao" | "proposta";

const TITLES: Record<ScheduleDocumentKind, string> = {
  vigente: "Grade vigente",
  versao: "Versão histórica",
  comparacao: "Comparação de versões",
  proposta: "Proposta de alteração",
};

/** Documentos A4 demonstrativos — /horarios/turmas/$turmaId/documentos/$tipo/$referenciaId. */
export function ScheduleDocumentPage({
  classId,
  kind,
  referenceId,
}: {
  classId: string;
  kind: string;
  referenceId: string;
}) {
  const klass = getDemonstrationClass(classId);
  const documentKind = (
    ["vigente", "versao", "comparacao", "proposta"] as ScheduleDocumentKind[]
  ).find((item) => item === kind);
  const record =
    documentKind === "vigente"
      ? effectiveVersionFor(classId, LIFECYCLE_REFERENCE_DATE)
      : getVersionRecord(referenceId);
  const request = documentKind === "proposta" ? getChangeRequest(referenceId) : undefined;

  if (!klass || !documentKind || (documentKind === "proposta" ? !request : !record))
    return (
      <EmptyState
        title="Documento não encontrado"
        description="O tipo de documento ou o identificador de referência não corresponde aos registros demonstrativos."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/turmas/$turmaId/versoes" params={{ turmaId: classId }}>
              Voltar ao histórico
            </Link>
          </Button>
        }
      />
    );

  const comparisonSource =
    documentKind === "comparacao" && record
      ? versionsForClass(classId).find((item) => item.id !== record.id)
      : undefined;
  const impact = request ? changeImpact(request.id) : undefined;
  const reference = record ?? getVersionRecord(request?.originVersionId ?? "");

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-xs text-muted-foreground">
          Pré-visualização A4 demonstrativa. {LIFECYCLE_DOCUMENT_NOTE}
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/horarios/turmas/$turmaId/versoes" params={{ turmaId: classId }}>
              Voltar
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
        </div>
      </div>
      <article className="mx-auto max-w-[1120px] border border-border bg-card p-6 shadow-panel print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-border pb-4 text-center">
          <p className="text-xs uppercase text-muted-foreground">
            Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação
          </p>
          <p className="text-xs uppercase text-muted-foreground">{brand.displayName}</p>
          <h1 className="mt-3 text-lg font-semibold">
            {TITLES[documentKind]} — {klass.name}
          </h1>
          <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">Unidade: </dt>
              <dd className="inline">{getClassUnitName(klass.unitId)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Período letivo: </dt>
              <dd className="inline">{klass.academicPeriod.label}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Versão: </dt>
              <dd className="inline">{reference?.version ?? "não identificada"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Vigência: </dt>
              <dd className="inline">
                {reference?.effectiveFrom || "não definida"}
                {reference?.effectiveUntil
                  ? ` até ${formatAcademicDate(reference.effectiveUntil)}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Situação: </dt>
              <dd className="inline">{request?.state ?? reference?.state ?? "não identificada"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Data de referência: </dt>
              <dd className="inline">{request?.referenceDate ?? LIFECYCLE_REFERENCE_DATE}</dd>
            </div>
          </dl>
          <p className="mt-3 font-semibold uppercase text-warning-foreground">
            Documento demonstrativo — não oficial
          </p>
        </header>
        <div className="mt-4 space-y-4">
          {documentKind === "comparacao" && record ? (
            comparisonSource ? (
              <DiffList
                diffs={compareVersions(comparisonSource.id, record.id)}
                label="Comparação impressa entre versões"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma outra versão disponível para comparação nesta turma demonstrativa.
              </p>
            )
          ) : null}
          {documentKind === "proposta" && impact ? (
            <>
              <p className="text-xs">
                <span className="font-semibold">Justificativa: </span>
                {request?.justification}
              </p>
              <p className="text-xs">
                <span className="font-semibold">Tipo de mudança: </span>
                {request?.kind} · <span className="font-semibold">Data de efeito: </span>
                {request?.effectFrom || "não definida"}
              </p>
              <BeforeAfterList impact={impact} label="Antes e depois impresso" />
            </>
          ) : null}
          {record && documentKind !== "proposta" ? (
            <ScheduleBlocksView record={record} label={`Grade impressa — ${record.version}`} />
          ) : null}
          <div className="flex flex-wrap gap-2 print:hidden">
            <StatusBadge tone="warning">Marcação demonstrativa</StatusBadge>
            <StatusBadge tone="neutral">Sem emissão oficial</StatusBadge>
          </div>
        </div>
        <footer className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
          {LIFECYCLE_DOCUMENT_NOTE}
        </footer>
      </article>
    </div>
  );
}
