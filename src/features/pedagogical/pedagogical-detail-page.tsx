import { Link } from "@tanstack/react-router";
import { formatAcademicDate } from "@/lib/academic-date";
import { FileQuestion, ShieldCheck } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  PEDAGOGICAL_AUTHORIZATION_NOTE,
  PEDAGOGICAL_AUTHORIZATION_REQUIREMENTS,
  PEDAGOGICAL_DATA_MINIMIZATION_NOTE,
  PEDAGOGICAL_FUNCTION_NOTE,
  PEDAGOGICAL_PERIOD_NOTE,
  PEDAGOGICAL_POSTING_NOTE,
  PEDAGOGICAL_SUBSTITUTION_NOTE,
  coresponsibilityPeers,
  getPedagogicalAssignment,
  pedagogicalClassContextNote,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
  pedagogicalWarnings,
  substitutionRelations,
} from "./pedagogical-data";

export function PedagogicalDetailPage({
  professionalId,
  activityId,
}: {
  professionalId: string;
  activityId: string;
}) {
  const record = getPedagogicalAssignment(activityId);
  if (!record || record.professionalId !== professionalId)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Atuação pedagógica não encontrada"
          description="A atuação não pertence ao profissional informado ou não existe nos dados fictícios."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais/$id/atuacoes" params={{ id: professionalId }}>
                Voltar às atuações
              </Link>
            </Button>
          }
        />
      </div>
    );

  const { professional, link, klass, unitName, periodLabel } = pedagogicalContext(record);
  const posting = link?.allocations.find((item) => item.id === record.postingId);
  const { substituted, substitutes } = substitutionRelations(record);
  const peers = coresponsibilityPeers(record);
  const warnings = pedagogicalWarnings(record);

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={klass?.name ?? "Atuação pedagógica demonstrativa"}
        description={`${professional?.personName ?? "Profissional"} · ${record.role}`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link
                to="/profissionais/$id/atuacoes/$atuacaoId/editar"
                params={{ id: record.professionalId, atuacaoId: record.id }}
              >
                Editar atuação
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/atuacoes/$atuacaoId/encerrar"
                params={{ id: record.professionalId, atuacaoId: record.id }}
              >
                Encerrar atuação
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/atuacoes/$atuacaoId/substituir"
                params={{ id: record.professionalId, atuacaoId: record.id }}
              >
                Substituição temporária
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/profissionais/$id/atuacoes" params={{ id: record.professionalId }}>
                Atuações do profissional
              </Link>
            </Button>
            {klass ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/turmas/$id" params={{ id: klass.id }}>
                  Abrir turma
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3 text-xs">
        <StatusBadge tone={record.status === "Atual" ? "success" : "neutral"}>
          {pedagogicalSituationLabel(record)}
        </StatusBadge>
        <span className="text-muted-foreground">
          Vigência {pedagogicalValidityLabel(record)} · {periodLabel}
        </span>
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,24vw,23rem)]">
        <div className="min-w-0">
          <DetailSection
            title="Profissional e vínculo funcional"
            description="A atuação pertence a um vínculo funcional específico; Pessoa e Profissional não a representam sozinhos."
          >
            <DefinitionList
              items={[
                { term: "Profissional", detail: professional?.personName ?? "Não identificado" },
                {
                  term: "Vínculo funcional",
                  detail: link ? (
                    <Link
                      to="/profissionais/$id/vinculos/$vinculoId"
                      params={{ id: record.professionalId, vinculoId: record.linkId }}
                      className="text-primary hover:underline"
                    >
                      {link.functionalIdentifier || "Vínculo sem matrícula funcional"}
                    </Link>
                  ) : (
                    "Não identificado"
                  ),
                },
                { term: "Cargo contextual", detail: link?.cargo ?? "Não informado" },
                {
                  term: "Lotação relacionada",
                  detail: posting
                    ? `${posting.place} · ${formatAcademicDate(posting.start)} — ${formatAcademicDate(posting.end, "em andamento")}`
                    : "Nenhuma lotação relacionada informada nesta atuação",
                },
                { term: "Observação", detail: PEDAGOGICAL_POSTING_NOTE },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Contexto acadêmico"
            description="Unidade, período letivo, oferta, organização acadêmica e agrupamentos permanecem conceitos distintos."
          >
            <DefinitionList
              items={[
                {
                  term: "Unidade",
                  detail: klass ? (
                    <Link
                      to="/unidades/$id"
                      params={{ id: klass.unitId }}
                      className="text-primary hover:underline"
                    >
                      {unitName}
                    </Link>
                  ) : (
                    unitName
                  ),
                },
                { term: "Período letivo", detail: periodLabel },
                { term: "Sobre o período letivo", detail: PEDAGOGICAL_PERIOD_NOTE },
                {
                  term: "Turma",
                  detail: klass ? (
                    <Link
                      to="/turmas/$id"
                      params={{ id: klass.id }}
                      className="text-primary hover:underline"
                    >
                      {klass.name}
                    </Link>
                  ) : (
                    "Turma não identificada"
                  ),
                },
                { term: "Organização acadêmica", detail: klass?.academicOrganization ?? "—" },
                { term: "Agrupamentos", detail: pedagogicalClassContextNote(record) },
                { term: "Componente ou campo", detail: pedagogicalFieldLabel(record) },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Papel e vigência"
            description="Papéis pedagógicos são distinguíveis e não possuem, por si, as mesmas permissões de diário, frequência ou avaliação."
          >
            <DefinitionList
              items={[
                { term: "Papel na atuação", detail: record.role },
                { term: "Início", detail: record.start },
                { term: "Término", detail: record.end ?? "Sem término informado" },
                {
                  term: "Situação temporal",
                  detail: pedagogicalSituationLabel(record),
                },
                { term: "Leitura do cenário", detail: record.note },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Substituição e corresponsabilidade"
            description="Relações entre profissionais no mesmo contexto, quando existirem."
          >
            <DefinitionList
              items={[
                {
                  term: "Atuação substituída",
                  detail: substituted
                    ? `${substituted.role} de ${
                        pedagogicalContext(substituted).professional?.personName ?? "profissional"
                      } · vínculo ${
                        pedagogicalContext(substituted).link?.functionalIdentifier ?? "—"
                      } · ${pedagogicalValidityLabel(substituted)} · permanece ${pedagogicalSituationLabel(
                        substituted,
                      )}`
                    : "Esta atuação não substitui outra",
                },
                {
                  term: "Substituições recebidas",
                  detail: substitutes.length
                    ? substitutes
                        .map(
                          (item) =>
                            `${pedagogicalContext(item).professional?.personName ?? "profissional"} (${
                              item.role
                            }) · vínculo ${
                              pedagogicalContext(item).link?.functionalIdentifier ?? "—"
                            } · ${pedagogicalValidityLabel(item)}`,
                        )
                        .join("; ")
                    : "Nenhuma substituição registrada",
                },
                {
                  term: "Corresponsabilidade",
                  detail: peers.length
                    ? peers
                        .map(
                          (item) =>
                            `${pedagogicalContext(item).professional?.personName ?? "profissional"} — ${
                              item.role
                            } · ${pedagogicalValidityLabel(item)}`,
                        )
                        .join("; ")
                    : "Nenhum outro profissional registrado neste mesmo componente ou campo",
                },
                { term: "Observação", detail: PEDAGOGICAL_SUBSTITUTION_NOTE },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Compatibilidades e avisos"
            description="Somente avisos demonstrativos; nenhuma regra normativa não confirmada é congelada."
          >
            {warnings.length ? (
              <ul className="space-y-2" aria-label="Avisos desta atuação pedagógica">
                {warnings.map((warning, index) => (
                  <li key={index} className="border border-border p-3 text-xs">
                    <p className="font-medium text-foreground">{warning.title}</p>
                    <p className="mt-1 text-muted-foreground">{warning.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum aviso nesta leitura.</p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">{PEDAGOGICAL_FUNCTION_NOTE}</p>
          </DetailSection>
        </div>
        <aside
          aria-label="Contexto e autorização da atuação"
          className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
        >
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Autorização futura
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-3.5" />
            {PEDAGOGICAL_AUTHORIZATION_NOTE}
          </p>
          <ul
            className="mt-2 list-disc pl-4 text-xs text-muted-foreground"
            aria-label="Elementos mínimos da autorização do Diário"
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
          <FutureAreaLink>Registrar, editar, encerrar ou substituir — Etapa 9E2</FutureAreaLink>
          <FutureAreaLink>Histórico/Auditoria</FutureAreaLink>
        </aside>
      </div>
    </div>
  );
}
