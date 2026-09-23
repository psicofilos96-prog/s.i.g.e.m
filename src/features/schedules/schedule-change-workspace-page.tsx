import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { dayLabel } from "./schedule-draft";
import {
  BeforeAfterList,
  ChangeKindBadge,
  FutureCapabilitiesPanel,
  ImpactPanel,
  OperationalStatesPanel,
} from "./lifecycle-widgets";
import {
  CHANGE_KINDS,
  LIFECYCLE_CHANGE_MESSAGE,
  LIFECYCLE_CLASSIFICATION_NOTE,
  changeImpact,
  changeRequestsForClass,
  classificationGuidance,
  effectiveVersionFor,
  networkConflicts,
  type ChangeKind,
} from "./schedule-lifecycle";

/** Nova proposta de alteração — /horarios/turmas/$turmaId/alteracoes/nova. */
export function ScheduleChangeWorkspacePage({ classId }: { classId: string }) {
  const klass = getDemonstrationClass(classId);
  const origin = effectiveVersionFor(classId);
  const sample = changeRequestsForClass(classId)[0];
  const [kind, setKind] = useState<ChangeKind>("Ajuste pontual");
  const [blockId, setBlockId] = useState<string>(origin?.blocks[0]?.id ?? "");
  const [effectFrom, setEffectFrom] = useState("");
  const [justification, setJustification] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dirty = Boolean(justification || effectFrom) && !prepared;
  const guidance = classificationGuidance(kind);
  const impact = useMemo(() => (sample ? changeImpact(sample.id) : undefined), [sample]);

  if (!klass || !origin)
    return (
      <EmptyState
        title="Operação indisponível"
        description="Não há grade publicada demonstrativa que sirva de origem para uma proposta de alteração nesta turma."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/turmas/$turmaId/versoes" params={{ turmaId: classId }}>
              Consultar versões
            </Link>
          </Button>
        }
      />
    );

  const conflicts = networkConflicts(classId, origin.blocks);

  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={`Nova proposta de alteração — ${klass.name}`}
        description="Registro demonstrativo de proposta. A grade publicada de origem permanece inalterada."
        parent={{ label: "Horários escolares", to: "/horarios" }}
        actions={
          <Button size="sm" variant="outline" onClick={() => setLeaving(true)}>
            Sair
          </Button>
        }
      />
      {leaving && dirty ? (
        <StatePanel
          tone="warning"
          title="Alterações não concluídas"
          description="A proposta demonstrativa possui alterações não concluídas. Nada foi gravado."
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setLeaving(false)}>
                Continuar editando
              </Button>
              <Button asChild size="sm" variant="destructive">
                <Link to="/horarios/turmas/$turmaId/alteracoes" params={{ turmaId: classId }}>
                  Descartar alterações e sair
                </Link>
              </Button>
            </div>
          }
        />
      ) : null}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <StatusBadge tone="neutral">Grade de origem: {origin.version}</StatusBadge>
        <StatusBadge tone="neutral">Referência: {origin.operationReference}</StatusBadge>
        <ChangeKindBadge kind={kind} />
        {dirty ? <StatusBadge tone="warning">Alterações não concluídas</StatusBadge> : null}
      </div>
      <DetailSection
        title="Identificação da proposta"
        description="Grade de origem, blocos afetados, tipo de mudança, justificativa, data de efeito e responsável demonstrativo."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="bloco">Bloco afetado</Label>
            <Select value={blockId} onValueChange={setBlockId}>
              <SelectTrigger id="bloco" className="h-9" aria-label="Bloco afetado">
                <SelectValue placeholder="Selecionar bloco" />
              </SelectTrigger>
              <SelectContent>
                {origin.blocks.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {dayLabel(item.day)} {item.start}–{item.end} · {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tipo">Tipo de mudança</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as ChangeKind)}>
              <SelectTrigger id="tipo" className="h-9" aria-label="Tipo de mudança">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANGE_KINDS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="efeito">Data de efeito</Label>
            <Input
              id="efeito"
              type="date"
              value={effectFrom}
              onChange={(event) => setEffectFrom(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="responsavel">Responsável demonstrativo</Label>
            <Input
              id="responsavel"
              readOnly
              value="Equipe demonstrativa da unidade (perfil funcional fictício)"
              className="h-9"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="justificativa">Justificativa</Label>
            <textarea
              id="justificativa"
              rows={3}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              className="w-full border border-border bg-background p-2 text-sm"
              placeholder="Motivo da alteração; registro demonstrativo."
            />
          </div>
        </div>
      </DetailSection>
      <DetailSection title="Classificação da alteração" description={LIFECYCLE_CLASSIFICATION_NOTE}>
        <StatePanel
          tone={guidance.requiresNewVersion === null ? "warning" : "info"}
          title={
            guidance.requiresNewVersion === null
              ? "Decisão pendente"
              : guidance.requiresNewVersion
                ? "Cenário exige nova versão demonstrativa"
                : "Cenário de alteração simples rastreável"
          }
          description={guidance.note}
        />
      </DetailSection>
      {impact ? (
        <>
          <DetailSection
            title="Comparação antes e depois"
            description="A comparação é semântica; a grade original não é modificada."
          >
            <BeforeAfterList impact={impact} />
          </DetailSection>
          <DetailSection
            title="Impacto em outras turmas e profissionais"
            description="A mesma Pessoa é considerada independentemente da quantidade de vínculos, unidades ou substituições."
          >
            <ImpactPanel impact={impact} />
          </DetailSection>
        </>
      ) : null}
      {conflicts.length ? (
        <StatePanel
          tone="warning"
          title="Conflitos temporais potenciais na origem"
          description={conflicts.map((item) => item.detail).join(" ")}
        />
      ) : null}
      <DetailSection title="Conclusão demonstrativa">
        <Button size="sm" onClick={() => setPrepared(true)}>
          Preparar proposta demonstrativa
        </Button>
        {prepared ? (
          <StatePanel
            tone="success"
            title="Proposta demonstrativa preparada"
            description={`${LIFECYCLE_CHANGE_MESSAGE}${
              guidance.requiresNewVersion === null
                ? " A classificação permanece pendente: nenhuma publicação definitiva é simulada e nenhuma autorização é assumida."
                : ""
            }`}
          />
        ) : null}
      </DetailSection>
      <OperationalStatesPanel />
      <FutureCapabilitiesPanel />
    </div>
  );
}
