import { MatrixTable } from "@/components/sigem/curriculum-table";
import { StatusBadge } from "@/components/sigem/patterns";
import { DefinitionList } from "@/components/sigem/operational";
import type { CurriculumStructure } from "@/features/curriculum/curriculum-data";

/**
 * Apresentação da estrutura curricular adaptada à natureza da matriz.
 * Terminologia deliberadamente neutra: "elementos curriculares" abrange
 * componentes curriculares, campos de experiências e elementos de ampliação.
 */
export function CurriculumStructureView({
  structure,
  label,
}: {
  structure: CurriculumStructure;
  label: string;
}) {
  if (structure.kind === "grid") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Organização:{" "}
          <span className="font-medium text-foreground">{structure.organizationLabel}</span>
        </p>
        <MatrixTable
          label={`Estrutura curricular de ${label}`}
          rowsHeader={structure.rowsHeader}
          unitLabel={structure.unitLabel}
          columns={structure.columns}
          groups={structure.groups}
          totals={structure.totals}
          totalsLabel={structure.totalsLabel}
          showRowTotals
          rowTotalsHeader="Soma"
          legend={structure.legend}
        />
      </div>
    );
  }

  if (structure.kind === "experience-fields") {
    return (
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground">{structure.note}</p>
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            Agrupamentos da organização acadêmica
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Agrupamentos">
            {structure.groupings.map((group) => (
              <li
                key={group.id}
                className="border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {group.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            Campos de experiências
          </h3>
          <ol className="mt-2 divide-y divide-border border-y border-border">
            {structure.fields.map((field, index) => (
              <li key={field.id} className="flex gap-3 py-2.5">
                <span className="mt-0.5 font-mono text-xs text-tabular text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{field.label}</p>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            Jornadas e cargas
          </h3>
          <div className="mt-2">
            <DefinitionList
              items={structure.journeys.map((journey) => ({
                term: journey.label,
                detail: (
                  <span>
                    <span className="font-mono text-tabular">{journey.weekly}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {journey.description}
                    </span>
                  </span>
                ),
              }))}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-foreground">{structure.description}</p>
      <p className="text-xs text-muted-foreground">
        Organização:{" "}
        <span className="font-medium text-foreground">{structure.organizationLabel}</span>
      </p>
      <ol className="divide-y divide-border border-y border-border" aria-label="Eixos de ampliação">
        {structure.axes.map((axis) => (
          <li key={axis.id} className="py-2.5">
            <p className="text-sm font-medium text-foreground">{axis.label}</p>
            <p className="text-xs text-muted-foreground">{axis.description}</p>
          </li>
        ))}
      </ol>
      <div>
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">
          Não modelado nesta etapa
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Itens não modelados">
          {structure.pending.map((item) => (
            <li key={item}>
              <StatusBadge tone="neutral">{item}</StatusBadge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
