import { Link } from "@tanstack/react-router";
import { BookOpenCheck, FileQuestion, GraduationCap, ShieldCheck } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import {
  PEDAGOGICAL_AUTHORIZATION_NOTE,
  PEDAGOGICAL_AUTHORIZATION_REQUIREMENTS,
  PEDAGOGICAL_DATA_MINIMIZATION_NOTE,
  PEDAGOGICAL_FUNCTION_NOTE,
  PEDAGOGICAL_PERIOD_NOTE,
  PEDAGOGICAL_POSTING_NOTE,
  currentPedagogical,
  functionalTrajectoryWithPedagogical,
  historicalPedagogical,
  pedagogicalAssignmentsForProfessional,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
  pedagogicalWarnings,
  type PedagogicalAssignmentRecord,
} from "./pedagogical-data";

function RecordRow({ record }: { record: PedagogicalAssignmentRecord }) {
  const { link, klass, unitName, periodLabel } = pedagogicalContext(record);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{klass?.name ?? record.classId}</p>
          <StatusBadge tone={record.status === "Atual" ? "success" : "neutral"}>
            {pedagogicalSituationLabel(record)}
          </StatusBadge>
          <StatusBadge tone="info">{record.role}</StatusBadge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Vínculo {link?.functionalIdentifier ?? "não identificado"} · {unitName} · {periodLabel}
        </p>
        <p className="text-xs text-muted-foreground">
          {pedagogicalFieldLabel(record)} · vigência {pedagogicalValidityLabel(record)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/atuacoes/$atuacaoId"
            params={{ id: record.professionalId, atuacaoId: record.id }}
          >
            Consultar atuação
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/atuacoes/$atuacaoId/editar"
            params={{ id: record.professionalId, atuacaoId: record.id }}
          >
            Editar
          </Link>
        </Button>
      </div>
    </li>
  );
}

export function ProfessionalPedagogicalPage({ professionalId }: { professionalId: string }) {
  const professional = getDemonstrationProfessional(professionalId);
  if (!professional)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Profissional não encontrado"
          description="A Atuação Pedagógica depende de Pessoa, Profissional e Vínculo Funcional existentes."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais">Voltar para profissionais</Link>
            </Button>
          }
        />
      </div>
    );

  const records = pedagogicalAssignmentsForProfessional(professional.id);
  const current = currentPedagogical(records);
  const historical = historicalPedagogical(records);
  const trajectory = functionalTrajectoryWithPedagogical(professional);
  const warnings = records.flatMap((record) =>
    pedagogicalWarnings(record).map((warning) => ({ record, warning })),
  );

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Atuações pedagógicas do profissional"
        description={`${professional.personName} · ${professional.professionalId}`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link to="/profissionais/$id/atuacoes/nova" params={{ id: professional.id }}>
                Nova atuação pedagógica
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/atuacoes-pedagogicas">Consulta geral</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/profissionais/$id" params={{ id: professional.id }}>
                Voltar ao profissional
              </Link>
            </Button>
          </>
        }
      />
      <p className="border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <BookOpenCheck className="mr-1 inline size-3.5" />
        Vínculo funcional e atuação pedagógica não se confundem: um profissional pode possuir
        múltiplos vínculos e múltiplas atuações, cada uma com contexto acadêmico e vigência
        próprios.
      </p>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <DetailSection
            title="Vínculos funcionais associados"
            description="Cada atuação referencia explicitamente o vínculo pelo qual o profissional atua; o identificador da Pessoa não representa a atribuição."
          >
            <ul className="divide-y divide-border" aria-label="Vínculos funcionais do profissional">
              {professional.links.map((link) => {
                const linkRecords = records.filter((record) => record.linkId === link.id);
                return (
                  <li key={link.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {link.functionalIdentifier || "Vínculo sem matrícula funcional"}
                      </p>
                      <StatusBadge tone={link.status === "Vigente" ? "success" : "neutral"}>
                        {link.status}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cargo contextual: {link.cargo} · vigência {link.start} —{" "}
                      {link.end ?? "em andamento"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {linkRecords.length
                        ? `${linkRecords.length} atuação(ões) pedagógica(s) registrada(s) neste vínculo.`
                        : "Nenhuma atuação pedagógica registrada neste vínculo."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Lotações conhecidas:{" "}
                      {link.allocations.length
                        ? link.allocations
                            .map((posting) => `${posting.status}: ${posting.place}`)
                            .join("; ")
                        : "nenhuma lotação registrada"}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{PEDAGOGICAL_POSTING_NOTE}</p>
            <p className="mt-1 text-xs text-muted-foreground">{PEDAGOGICAL_FUNCTION_NOTE}</p>
          </DetailSection>
          <DetailSection
            title="Atuações vigentes"
            description="ATUAL e HISTÓRICO são distinguidos por rótulo textual, não somente por cor."
          >
            {current.length ? (
              <ul className="divide-y divide-border" aria-label="Atuações pedagógicas vigentes">
                {current.map((record) => (
                  <RecordRow key={record.id} record={record} />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={GraduationCap}
                title="Nenhuma atuação pedagógica vigente"
                description="Vínculo e lotação existentes não criam atuação pedagógica automaticamente."
              />
            )}
          </DetailSection>
          <DetailSection
            title="Atuações históricas"
            description="Atuações encerradas, mudanças de turma, de componente, substituições e períodos de corresponsabilidade permanecem consultáveis."
          >
            {historical.length ? (
              <ul className="divide-y divide-border" aria-label="Atuações pedagógicas históricas">
                {historical.map((record) => (
                  <RecordRow key={record.id} record={record} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma atuação histórica.</p>
            )}
          </DetailSection>
          <DetailSection
            title="Compatibilidades pendentes"
            description="Avisos demonstrativos; nenhum bloqueio jurídico definitivo é aplicado."
          >
            {warnings.length ? (
              <ul className="space-y-2" aria-label="Avisos de compatibilidade das atuações">
                {warnings.map(({ record, warning }, index) => (
                  <li key={`${record.id}-${index}`} className="border border-border p-3 text-xs">
                    <p className="font-medium text-foreground">{warning.title}</p>
                    <p className="mt-1 text-muted-foreground">{warning.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma pendência de compatibilidade nesta leitura demonstrativa.
              </p>
            )}
          </DetailSection>
          <DetailSection
            title="Trajetória funcional"
            description="Narrativa cronológica com conceitos distinguidos: vínculo, lotação, função e atuação pedagógica não são eventos equivalentes."
          >
            <ol aria-label="Trajetória funcional com atuações pedagógicas" className="space-y-3">
              {trajectory.map((period) => (
                <li key={period.year}>
                  <p className="font-mono text-xs text-muted-foreground">{period.year}</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {period.entries.map((entry) => (
                      <li key={entry.text}>
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          {entry.kind}
                        </span>{" "}
                        — {entry.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </DetailSection>
        </div>
        <aside
          aria-label="Contexto das atuações pedagógicas"
          className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
        >
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Período letivo</h2>
          <p className="mt-2 text-xs text-muted-foreground">{PEDAGOGICAL_PERIOD_NOTE}</p>
          <h2 className="mt-5 text-xs font-semibold uppercase text-muted-foreground">
            Autorização futura
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-3.5" />
            {PEDAGOGICAL_AUTHORIZATION_NOTE}
          </p>
          <ul
            className="mt-2 list-disc pl-4 text-xs text-muted-foreground"
            aria-label="Elementos da autorização contextual futura"
          >
            {PEDAGOGICAL_AUTHORIZATION_REQUIREMENTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground" role="note">
            {PEDAGOGICAL_DATA_MINIMIZATION_NOTE}
          </p>
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">
            Áreas futuras
          </h2>
          <FutureAreaLink>Registrar atuação pedagógica — Etapa 9E2</FutureAreaLink>
          <FutureAreaLink>Diário</FutureAreaLink>
          <FutureAreaLink>Histórico/Auditoria</FutureAreaLink>
        </aside>
      </div>
    </div>
  );
}
