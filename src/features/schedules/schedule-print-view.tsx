import { Link } from "@tanstack/react-router";
import { formatAcademicDate } from "@/lib/academic-date";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/branding";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { getDemonstrationUnit } from "@/features/units/units-data";
import { ScheduleWeekView } from "./schedule-week-view";
import {
  SCHEDULE_INTEGRATION_REFERENCE_DATE,
  classProjection,
  normalizeReferenceDate,
  personProjection,
  referenceSearch,
  unitProjection,
  type ClassProjection,
} from "./schedule-integration";
import { SCHEDULE_DEMONSTRATION_NOTE, type ScheduleBlock } from "./schedules-data";

type PrintScope =
  | { kind: "class"; id: string }
  | { kind: "professional"; id: string }
  | { kind: "unit"; id: string };

type PrintSection = {
  key: string;
  title: string;
  context: string;
  projection: ClassProjection;
  blocks: ScheduleBlock[];
};

function classSection(projection: ClassProjection, blocks?: ScheduleBlock[]): PrintSection {
  return {
    key: `${projection.classId}-${projection.displayed?.id ?? "sem-versao"}`,
    title: projection.klass?.name ?? projection.classId,
    context: `${projection.unitName} · ${projection.periodLabel} · ${projection.displayed?.version ?? "Sem versão"} · ${projection.displayed?.state ?? "Não iniciada"} · vigência ${formatAcademicDate(projection.displayed?.effectiveFrom, "não definida")}${projection.displayed?.effectiveUntil ? ` até ${formatAcademicDate(projection.displayed.effectiveUntil)}` : ""} · ${projection.situation}`,
    projection,
    blocks: blocks ?? projection.blocks,
  };
}

/**
 * Impressões A4 demonstrativas de grade da turma, horário individual e quadro da
 * unidade. Sempre identificam versão, vigência, situação e data de referência.
 */
export function SchedulePrintView({
  scope,
  referenceDate = SCHEDULE_INTEGRATION_REFERENCE_DATE,
}: {
  scope: PrintScope;
  referenceDate?: string;
}) {
  const date = normalizeReferenceDate(referenceDate);
  const search = referenceSearch(date);
  const classItem = scope.kind === "class" ? getDemonstrationClass(scope.id) : undefined;
  const professional =
    scope.kind === "professional" ? getDemonstrationProfessional(scope.id) : undefined;
  const unit = scope.kind === "unit" ? getDemonstrationUnit(scope.id) : undefined;

  const sections: PrintSection[] =
    scope.kind === "class"
      ? classItem
        ? [classSection(classProjection(scope.id, date))]
        : []
      : scope.kind === "unit"
        ? unitProjection(scope.id, date).map((projection) => classSection(projection))
        : personProjection(scope.id, date).groups.map((group) =>
            classSection(classProjection(group.classId, date), group.blocks),
          );

  const title =
    classItem?.name ?? professional?.personName ?? unit?.currentName ?? "Consulta não encontrada";
  const scopeLabel =
    scope.kind === "class"
      ? "Grade da turma"
      : scope.kind === "professional"
        ? "Horário individual"
        : "Quadro da unidade";
  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-xs text-muted-foreground">
          Pré-visualização A4 demonstrativa. Não é documento oficial publicado.
        </p>
        <div className="flex gap-2">
          {scope.kind === "class" ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/horarios/turmas/$turmaId" params={{ turmaId: scope.id }} search={search}>
                Voltar
              </Link>
            </Button>
          ) : scope.kind === "professional" ? (
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/profissionais/$profissionalId"
                params={{ profissionalId: scope.id }}
                search={search}
              >
                Voltar
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/unidades/$unidadeId"
                params={{ unidadeId: scope.id }}
                search={search}
              >
                Voltar
              </Link>
            </Button>
          )}
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
            {scopeLabel} — {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Consulta de horários · data de referência {formatAcademicDate(date)}
          </p>
          <p className="mt-2 font-semibold uppercase text-warning-foreground">
            Documento demonstrativo — não oficial
          </p>
        </header>
        <div className="mt-4 space-y-6">
          {sections.length ? (
            sections.map((section) => (
              <section key={section.key}>
                <h2 className="mb-2 text-sm font-semibold">{section.title}</h2>
                <p className="mb-3 text-xs text-muted-foreground">{section.context}</p>
                {section.blocks.length ? (
                  <ScheduleWeekView
                    schedule={section.projection.weekView}
                    blocks={section.blocks}
                    label={`${scopeLabel} — ${section.title}`}
                  />
                ) : (
                  <p className="border border-dashed border-border p-4 text-xs text-muted-foreground">
                    Nenhuma distribuição vigente nesta data de referência. Ausência de grade não é
                    erro.
                  </p>
                )}
              </section>
            ))
          ) : (
            <p className="border border-dashed border-border p-4 text-xs text-muted-foreground">
              Nenhuma grade demonstrativa encontrada para este recorte.
            </p>
          )}
        </div>
        <footer className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
          {SCHEDULE_DEMONSTRATION_NOTE}
        </footer>
      </article>
    </div>
  );
}
