import { Link } from "@tanstack/react-router";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DetailSection } from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  PEDAGOGICAL_DATA_MINIMIZATION_NOTE,
  pedagogicalAssignmentsForClass,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
} from "./pedagogical-data";

/**
 * Painel de atuações pedagógicas no contexto da Turma. Lê os mesmos registros
 * da consulta geral — nenhuma cópia independente é criada.
 */
export function ClassPedagogicalPanel({ classId }: { classId: string }) {
  const records = pedagogicalAssignmentsForClass(classId);
  return (
    <DetailSection
      title="Profissionais em atuação pedagógica"
      description="Uma turma pode ter mais de um profissional e mais de um profissional no mesmo componente. Vínculo, papel e intervalo são apresentados separadamente."
    >
      <div className="mb-3">
        <Button asChild size="sm" variant="outline">
          <Link to="/atuacoes-pedagogicas/nova" search={{ turma: classId }}>
            Nova atuação nesta turma
          </Link>
        </Button>
      </div>
      {records.length ? (
        <ul className="divide-y divide-border" aria-label="Atuações pedagógicas nesta turma">
          {records.map((record) => {
            const { professional, link } = pedagogicalContext(record);
            return (
              <li
                key={record.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {professional?.personName ?? "Profissional não identificado"}
                    </p>
                    <StatusBadge tone={record.status === "Atual" ? "success" : "neutral"}>
                      {pedagogicalSituationLabel(record)}
                    </StatusBadge>
                    <StatusBadge tone="info">{record.role}</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vínculo funcional {link?.functionalIdentifier ?? "não identificado"} ·{" "}
                    {pedagogicalFieldLabel(record)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Intervalo de atuação {pedagogicalValidityLabel(record)}
                    {record.substitutionOf ? " · substituição temporária" : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/profissionais/$id/atuacoes/$atuacaoId"
                    params={{ id: record.professionalId, atuacaoId: record.id }}
                  >
                    Consultar atuação
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma atuação pedagógica registrada nesta turma. Lotação em uma unidade não cria atuação
          nesta turma automaticamente.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground" role="note">
        {PEDAGOGICAL_DATA_MINIMIZATION_NOTE}
      </p>
    </DetailSection>
  );
}
