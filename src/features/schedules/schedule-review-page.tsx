import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { plannedLoad, formatDuration } from "./schedule-draft";
import {
  DiffList,
  FindingsPanel,
  FutureCapabilitiesPanel,
  OperationalStatesPanel,
  ScheduleBlocksView,
  VersionIdentity,
} from "./lifecycle-widgets";
import { SchoolJourneyPanel } from "./school-journey-panel";
import {
  LIFECYCLE_REVIEW_MESSAGE,
  LIFECYCLE_REVIEWER_NOTE,
  compareVersions,
  effectiveVersionFor,
  reviewSituation,
  versionsForClass,
} from "./schedule-lifecycle";
import { getJourneyForClass, scheduleSituationTone } from "./schedules-data";

const DECISIONS = [
  ["correcao", "Solicitar correção", "Correção solicitada ao responsável pela elaboração."],
  [
    "devolver",
    "Devolver para elaboração",
    "Grade devolvida para elaboração; a versão vigente permanece intacta.",
  ],
  [
    "preparar",
    "Marcar como preparada para publicação",
    "Grade marcada como preparada para publicação. Publicar é uma operação distinta.",
  ],
] as const;

/** Revisão de grade — /horarios/turmas/$turmaId/revisar. */
export function ScheduleReviewPage({ classId }: { classId: string }) {
  const [decision, setDecision] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const klass = getDemonstrationClass(classId);
  const versions = versionsForClass(classId);
  const proposal =
    versions.find((item) =>
      [
        "Pronta para revisão",
        "Em revisão",
        "Revisão devolvida",
        "Preparada para publicação",
      ].includes(item.state),
    ) ??
    versions.find((item) => item.state === "Em elaboração") ??
    versions[versions.length - 1];
  const current = effectiveVersionFor(classId);

  if (!klass || !proposal)
    return (
      <EmptyState
        title="Revisão não encontrada"
        description="O identificador não corresponde às turmas fictícias com grade em revisão."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/revisoes">Voltar à central de revisões</Link>
          </Button>
        }
      />
    );

  const situation = reviewSituation(proposal.id);
  const load = plannedLoad({
    classId,
    journeyId: getJourneyForClass(classId)?.id ?? null,
    originScheduleId: proposal.id,
    label: proposal.version,
    state: "Em elaboração",
    blocks: proposal.blocks,
  });
  const decisionRow = DECISIONS.find((item) => item[0] === decision);

  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={`Revisão da grade — ${klass.name}`}
        description="Revisão e publicação são operações distintas. Nenhuma decisão administrativa real é registrada."
        parent={{ label: "Horários escolares", to: "/horarios" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/horarios/turmas/$turmaId/versoes" params={{ turmaId: classId }}>
                Histórico de versões
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/horarios/turmas/$turmaId/publicar" params={{ turmaId: classId }}>
                Preparar publicação
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <StatusBadge tone="neutral">Estado da grade: {proposal.state}</StatusBadge>
        <StatusBadge tone={scheduleSituationTone(situation)}>{situation}</StatusBadge>
        <StatusBadge tone="neutral">Operação de revisão demonstrativa</StatusBadge>
      </div>
      <DetailSection title="Identificação da versão proposta">
        <VersionIdentity record={proposal} />
      </DetailSection>
      <SchoolJourneyPanel journey={getJourneyForClass(classId)} />
      <DetailSection
        title="Grade proposta"
        description="Componentes, campos e profissionais vêm das Atuações Pedagógicas existentes."
      >
        <ScheduleBlocksView record={proposal} label="Grade proposta em revisão" />
      </DetailSection>
      <DetailSection
        title="Carga planejada"
        description="Nenhum cumprimento normativo é declarado."
      >
        <ul className="space-y-1 text-xs">
          <li>Tempo total planejado: {formatDuration(load.totalMinutes)}</li>
          <li>Tempo de ensino planejado: {formatDuration(load.teachingMinutes)}</li>
          <li>Intervalos: {formatDuration(load.intervalMinutes)}</li>
          {load.divergences.map((item) => (
            <li key={item} className="text-warning-foreground">
              {item}
            </li>
          ))}
        </ul>
      </DetailSection>
      <DetailSection
        title="Validações e conflitos em rede"
        description="Bloqueio estrutural, conflito temporal potencial, advertência, informação insuficiente e decisão institucional são categorias distintas."
      >
        <FindingsPanel versionId={proposal.id} />
      </DetailSection>
      <DetailSection
        title="Comparação com a versão vigente"
        description={
          current
            ? `Comparação semântica com ${current.version} (vigente desde ${current.effectiveFrom}).`
            : "Nenhuma versão vigente disponível para comparação."
        }
      >
        {current && current.id !== proposal.id ? (
          <DiffList
            diffs={compareVersions(current.id, proposal.id)}
            label="Comparação com a versão vigente"
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Não há versão vigente distinta para comparar nesta turma demonstrativa.
          </p>
        )}
      </DetailSection>
      <DetailSection
        title="Observações e decisão demonstrativa"
        description={LIFECYCLE_REVIEWER_NOTE}
      >
        <label className="block text-xs font-medium" htmlFor="observacoes">
          Observações da revisão
        </label>
        <textarea
          id="observacoes"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          className="mt-1 w-full border border-border bg-background p-2 text-sm"
          placeholder="Registro demonstrativo; nada é gravado."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {DECISIONS.map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={decision === id ? "default" : "outline"}
              onClick={() => setDecision(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        {decisionRow ? (
          <StatePanel
            tone="success"
            title={decisionRow[1]}
            description={`${decisionRow[2]} ${LIFECYCLE_REVIEW_MESSAGE}`}
          />
        ) : null}
      </DetailSection>
      <OperationalStatesPanel />
      <FutureCapabilitiesPanel />
    </div>
  );
}
