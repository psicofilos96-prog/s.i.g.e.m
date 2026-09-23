import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import {
  DiffList,
  FutureCapabilitiesPanel,
  OperationalStatesPanel,
  ScheduleBlocksView,
} from "./lifecycle-widgets";
import {
  compareVersions,
  getVersionRecord,
  lifecycleStateTone,
  versionsForClass,
} from "./schedule-lifecycle";

/** Comparação de versões — /horarios/turmas/$turmaId/versoes/$versaoId/comparar. */
export function ScheduleVersionComparePage({
  classId,
  versionId,
}: {
  classId: string;
  versionId: string;
}) {
  const klass = getDemonstrationClass(classId);
  const versions = versionsForClass(classId);
  const base = getVersionRecord(versionId);
  const fallback = versions.find((item) => item.id !== versionId);
  const [otherId, setOtherId] = useState(fallback?.id ?? versionId);
  const other = getVersionRecord(otherId);

  if (!klass || !base || base.classId !== classId)
    return (
      <EmptyState
        title="Comparação indisponível"
        description="O identificador não corresponde às versões demonstrativas desta turma."
        action={
          <Button asChild variant="outline">
            <Link to="/horarios/turmas/$turmaId/versoes" params={{ turmaId: classId }}>
              Voltar ao histórico
            </Link>
          </Button>
        }
      />
    );

  if (!other || other.id === base.id)
    return (
      <div className="space-y-5 pb-5">
        <OperationalPageHeader
          title={`Comparar ${base.version} — ${klass.name}`}
          description="Comparação semântica entre versões demonstrativas."
          parent={{ label: "Horários escolares", to: "/horarios" }}
        />
        <StatePanel
          tone="warning"
          title="Informação insuficiente para comparar"
          description="Esta turma demonstrativa possui apenas uma versão registrada; nenhuma comparação é inventada."
        />
      </div>
    );

  const diffs = compareVersions(other.id, base.id);

  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title={`Comparar versões — ${klass.name}`}
        description="Comparação semântica: blocos adicionados, removidos, deslocados e alterações de duração, componente, profissional, vínculo e vigência."
        parent={{ label: "Horários escolares", to: "/horarios" }}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link
              to="/horarios/turmas/$turmaId/documentos/$tipo/$referenciaId"
              params={{ turmaId: classId, tipo: "comparacao", referenciaId: base.id }}
            >
              Imprimir comparação
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 md:grid-cols-[18rem_1fr] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="versao-comparada">Comparar com</Label>
          <Select value={otherId} onValueChange={setOtherId}>
            <SelectTrigger id="versao-comparada" className="h-9" aria-label="Comparar com">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions
                .filter((item) => item.id !== base.id)
                .map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.version} · {item.state}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={lifecycleStateTone(other.state)}>
            Origem: {other.version} ({other.state})
          </StatusBadge>
          <StatusBadge tone={lifecycleStateTone(base.state)}>
            Destino: {base.version} ({base.state})
          </StatusBadge>
        </div>
      </div>
      <DetailSection
        title="Diferenças semânticas"
        description="Nenhuma comparação de texto bruto ou JSON é apresentada."
      >
        <DiffList diffs={diffs} label="Diferenças semânticas entre versões" />
      </DetailSection>
      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection title={`${other.version} (${other.state})`}>
          <ScheduleBlocksView record={other} label={`Grade da ${other.version}`} />
        </DetailSection>
        <DetailSection title={`${base.version} (${base.state})`}>
          <ScheduleBlocksView record={base} label={`Grade da ${base.version}`} />
        </DetailSection>
      </div>
      <StatePanel
        tone="info"
        title="Versões preservadas"
        description="Nenhuma versão é sobrescrita pela comparação; ambas permanecem consultáveis em leitura."
      />
      <OperationalStatesPanel />
      <FutureCapabilitiesPanel />
    </div>
  );
}
