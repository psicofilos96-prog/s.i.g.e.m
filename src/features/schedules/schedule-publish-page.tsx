import { formatAcademicDate } from "@/lib/academic-date";
import { useState } from "react";
import { DateInput } from "@/components/sigem/date-input";
import { Link } from "@tanstack/react-router";
import {
  AuditTimeline,
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  FindingsPanel,
  FutureCapabilitiesPanel,
  OperationalStatesPanel,
  ScheduleBlocksView,
  VersionIdentity,
} from "./lifecycle-widgets";
import {
  LIFECYCLE_PUBLICATION_MESSAGE,
  effectiveVersionFor,
  networkConflicts,
  reviewSituation,
  versionsForClass,
} from "./schedule-lifecycle";
import { scheduleSituationTone } from "./schedules-data";

/** Preparação de publicação — /horarios/turmas/$turmaId/publicar. */
export function SchedulePublishPage({ classId }: { classId: string }) {
  const klass = getDemonstrationClass(classId);
  const versions = versionsForClass(classId);
  const candidate =
    versions.find((item) => item.state === "Preparada para publicação") ??
    versions.find((item) => item.state === "Pronta para revisão") ??
    versions[versions.length - 1];
  const current = effectiveVersionFor(classId);
  const [confirmed, setConfirmed] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [from, setFrom] = useState(candidate?.effectiveFrom ?? "");
  const [until, setUntil] = useState(candidate?.effectiveUntil ?? "");

  if (!klass || !candidate)
    return (
      <EmptyState
        title="Operação indisponível"
        description="Não há versão demonstrativa disponível para preparação de publicação nesta turma."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/revisoes">Voltar à central de revisões</Link>
          </Button>
        }
      />
    );

  const conflicts = networkConflicts(classId, candidate.blocks);
  const situation = reviewSituation(candidate.id);

  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={`Preparar publicação — ${klass.name}`}
        description="Simulação de preparação de publicação. Nenhuma grade é publicada oficialmente."
        parent={{ label: "Horários escolares", to: "/horarios" }}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/horarios/turmas/$turmaId/revisar" params={{ turmaId: classId }}>
              Voltar à revisão
            </Link>
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <StatusBadge tone="neutral">Estado da grade: {candidate.state}</StatusBadge>
        <StatusBadge tone={scheduleSituationTone(situation)}>{situation}</StatusBadge>
        <StatusBadge tone="warning">Publicação demonstrativa</StatusBadge>
      </div>
      <DetailSection title="Identificação da versão">
        <VersionIdentity record={candidate} />
      </DetailSection>
      <DetailSection
        title="Resumo da grade"
        description="Blocos exatamente como representados nesta versão demonstrativa."
      >
        <ScheduleBlocksView record={candidate} label="Resumo da grade a publicar" />
      </DetailSection>
      <DetailSection
        title="Vigência proposta"
        description="Data de elaboração, data de publicação e início de vigência são campos distintos. Não se presume início no primeiro dia do período letivo."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="vigencia-inicio">Início de vigência</Label>
            <DateInput
              id="vigencia-inicio"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vigencia-fim">Término de vigência (opcional)</Label>
            <DateInput
              id="vigencia-fim"
              value={until}
              onChange={(event) => setUntil(event.target.value)}
              className="h-9"
            />
          </div>
          <DefinitionList
            items={[
              { term: "Elaboração", detail: candidate.preparedOn || "não registrada" },
              {
                term: "Publicação",
                detail: candidate.publishedOn ?? "não publicada (demonstrativo)",
              },
            ]}
          />
        </div>
      </DetailSection>
      <DetailSection
        title="Histórico relacionado"
        description="Versões anteriores permanecem preservadas e consultáveis."
      >
        <AuditTimeline
          label="Histórico relacionado à publicação"
          items={versions.map((item) => ({
            id: item.id,
            title: `${item.version} · ${item.state}`,
            description: item.nature,
            meta: `Vigência ${formatAcademicDate(item.effectiveFrom, "não definida")}${item.effectiveUntil ? ` até ${formatAcademicDate(item.effectiveUntil)}` : ""} · ${item.operationReference}`,
            timestamp: item.publishedOn ?? item.preparedOn,
          }))}
        />
        {current ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Versão vigente hoje: {current.version} (desde{" "}
            {formatAcademicDate(current.effectiveFrom)}). Ela não é sobrescrita por esta preparação.
          </p>
        ) : null}
      </DetailSection>
      <DetailSection title="Pendências e conflitos">
        <FindingsPanel versionId={candidate.id} />
        {conflicts.length ? (
          <StatePanel
            tone="warning"
            title="Conflitos temporais potenciais"
            description={conflicts.map((item) => item.detail).join(" ")}
          />
        ) : null}
      </DetailSection>
      <DetailSection
        title="Confirmação explícita"
        description="A confirmação é obrigatória e apenas simula a preparação da publicação."
      >
        <div className="flex items-start gap-2">
          <Checkbox
            id="confirmar"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
          />
          <Label htmlFor="confirmar" className="text-xs font-normal leading-snug">
            Confirmo que esta operação é demonstrativa, não publica oficialmente a grade e não grava
            dados.
          </Label>
        </div>
        <Button className="mt-3" size="sm" disabled={!confirmed} onClick={() => setPrepared(true)}>
          Preparar publicação demonstrativa
        </Button>
        {prepared ? (
          <StatePanel
            tone="success"
            title="Publicação demonstrativa preparada"
            description={LIFECYCLE_PUBLICATION_MESSAGE}
          />
        ) : null}
      </DetailSection>
      <OperationalStatesPanel />
      <FutureCapabilitiesPanel />
    </div>
  );
}
