/**
 * Componentes compartilhados do ciclo de vida das grades (Etapa 10C).
 * Nenhum deles publica, autoriza ou persiste qualquer operação.
 */
import { Link } from "@tanstack/react-router";
import { DefinitionList, DetailSection } from "@/components/sigem/operational";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClassUnitName } from "@/features/classes/classes-data";
import { ScheduleWeekView } from "./schedule-week-view";
import {
  getJourneyForClass,
  type ScheduleBlock,
  type SchedulePublicationState,
  type ScheduleVersion,
} from "./schedules-data";
import {
  LIFECYCLE_AUTHORIZATION_NOTE,
  LIFECYCLE_CAPABILITIES,
  LIFECYCLE_OPERATIONAL_STATES,
  LIFECYCLE_PRIVACY_NOTE,
  LIFECYCLE_REFERENCE_NOTE,
  changeKindTone,
  findingsByCategory,
  lifecycleStateTone,
  type ChangeImpact,
  type ScheduleVersionRecord,
  type VersionDiff,
} from "./schedule-lifecycle";

export function ReferenceDateField({
  value,
  onChange,
  context,
}: {
  value: string;
  onChange: (value: string) => void;
  context: string;
}) {
  return (
    <div className="grid gap-2 border border-border bg-card p-3 sm:grid-cols-[14rem_1fr] sm:items-center">
      <div className="space-y-1">
        <Label htmlFor="referencia">Data de referência</Label>
        <Input
          id="referencia"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Contexto temporal:</span> {context}{" "}
        {LIFECYCLE_REFERENCE_NOTE}
      </p>
    </div>
  );
}

export function VersionIdentity({ record }: { record: ScheduleVersionRecord }) {
  return (
    <DefinitionList
      items={[
        {
          term: "Unidade",
          detail: (
            <Link
              to="/horarios/unidades/$unidadeId"
              params={{ unidadeId: record.unitId }}
              className="text-primary hover:underline"
            >
              {getClassUnitName(record.unitId)}
            </Link>
          ),
        },
        { term: "Período letivo", detail: record.periodLabel },
        { term: "Versão", detail: record.version },
        {
          term: "Vigência",
          detail: `${record.effectiveFrom || "não definida"}${record.effectiveUntil ? ` até ${record.effectiveUntil}` : " (sem término definido)"}`,
        },
        {
          term: "Situação",
          detail: (
            <StatusBadge tone={lifecycleStateTone(record.state)}>{record.state}</StatusBadge>
          ),
        },
        { term: "Data de elaboração", detail: record.preparedOn || "não registrada" },
        {
          term: "Data de publicação",
          detail: record.publishedOn ?? "não publicada (demonstrativo)",
        },
        { term: "Referência da operação", detail: record.operationReference },
        { term: "Responsável demonstrativo", detail: record.author },
        { term: "Natureza", detail: record.nature },
        { term: "Justificativa", detail: record.justification },
      ]}
    />
  );
}

export function FindingsPanel({ versionId }: { versionId: string }) {
  const groups = findingsByCategory(versionId).filter((group) => group.items.length > 0);
  if (!groups.length)
    return (
      <p className="text-xs text-muted-foreground">
        Nenhum apontamento demonstrativo. Nenhuma conformidade legal é declarada.
      </p>
    );
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.category} className="border border-border bg-card p-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            {group.category}
          </h3>
          <ul className="mt-2 space-y-2">
            {group.items.map((item) => (
              <li key={item.id} className="text-xs">
                <span className="font-medium text-foreground">{item.title}</span> — {item.detail}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        Nem toda sobreposição bloqueia a operação; nenhuma conformidade legal é declarada.
      </p>
    </div>
  );
}

export function DiffList({ diffs, label }: { diffs: VersionDiff[]; label: string }) {
  if (!diffs.length)
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma diferença semântica identificada entre as versões comparadas.
      </p>
    );
  return (
    <ul className="divide-y divide-border border border-border bg-card" aria-label={label}>
      {diffs.map((diff) => (
        <li key={diff.id} className="flex flex-wrap items-start gap-2 p-3 text-xs">
          <StatusBadge tone="info">{diff.kind}</StatusBadge>
          <span className="min-w-0 flex-1">{diff.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function ImpactPanel({ impact }: { impact: ChangeImpact }) {
  return (
    <div className="space-y-3" aria-label="Painel de impacto demonstrativo">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Blocos alterados", impact.changedBlocks.length],
          ["Profissionais afetados", impact.professionals.length],
          ["Turmas afetadas", impact.classes.length],
          ["Unidades afetadas", impact.units.length],
          ["Conflitos novos", impact.newConflicts.length],
          ["Conflitos resolvidos", impact.resolvedConflicts.length],
        ].map(([label, value]) => (
          <article key={String(label)} className="border border-border bg-card p-3">
            <p className="font-mono text-xl font-semibold text-tabular">{String(value)}</p>
            <p className="text-xs text-muted-foreground">{String(label)}</p>
          </article>
        ))}
      </div>
      {impact.newConflicts.length ? (
        <StatePanel
          tone="danger"
          title="Conflitos novos após a alteração"
          description={impact.newConflicts.map((item) => item.detail).join(" ")}
        />
      ) : null}
      {impact.resolvedConflicts.length ? (
        <StatePanel
          tone="success"
          title="Conflitos resolvidos pela alteração"
          description={impact.resolvedConflicts.map((item) => item.detail).join(" ")}
        />
      ) : null}
      {impact.pendencies.length ? (
        <StatePanel
          tone="warning"
          title="Pendências remanescentes"
          description={impact.pendencies.join(" ")}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma pendência remanescente registrada nesta simulação.
        </p>
      )}
    </div>
  );
}

export function BeforeAfterList({
  impact,
  label = "Comparação antes e depois",
}: {
  impact: ChangeImpact;
  label?: string;
}) {
  if (!impact.changedBlocks.length)
    return (
      <p className="text-xs text-muted-foreground">
        Nenhum bloco alterado nesta proposta demonstrativa.
      </p>
    );
  return (
    <ul className="divide-y divide-border border border-border bg-card" aria-label={label}>
      {impact.changedBlocks.map((entry) => (
        <li key={entry.id} className="grid gap-2 p-3 text-xs sm:grid-cols-2">
          <div>
            <p className="font-semibold uppercase text-muted-foreground">Antes</p>
            <p>
              {entry.before
                ? `${entry.before.day} ${entry.before.start}–${entry.before.end} · ${entry.before.label}`
                : "Bloco não existia."}
            </p>
          </div>
          <div>
            <p className="font-semibold uppercase text-muted-foreground">Depois</p>
            <p>
              {entry.after
                ? `${entry.after.day} ${entry.after.start}–${entry.after.end} · ${entry.after.label}`
                : "Bloco removido na proposta."}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FutureCapabilitiesPanel() {
  return (
    <DetailSection
      title="Permissões futuras"
      description={LIFECYCLE_AUTHORIZATION_NOTE}
    >
      <ul className="flex flex-wrap gap-2" aria-label="Capacidades futuras distintas">
        {LIFECYCLE_CAPABILITIES.map((capability) => (
          <li key={capability}>
            <StatusBadge tone="neutral">{capability}</StatusBadge>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        A responsabilidade varia conforme unidade, etapa e tipo de alteração. Nenhuma alçada
        específica é atribuída sem documento institucional. {LIFECYCLE_PRIVACY_NOTE}
      </p>
    </DetailSection>
  );
}

export function OperationalStatesPanel() {
  return (
    <DetailSection
      title="Estados operacionais demonstrativos"
      description="Cada estado é representado explicitamente; nada é presumido."
    >
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Estados operacionais demonstrativos">
        {LIFECYCLE_OPERATIONAL_STATES.map((state) => (
          <li key={state.id} className="border border-border bg-card p-2 text-xs">
            <span className="font-medium">{state.label}</span> — {state.detail}
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

export function ChangeKindBadge({ kind }: { kind: Parameters<typeof changeKindTone>[0] }) {
  return <StatusBadge tone={changeKindTone(kind)}>{kind}</StatusBadge>;
}

/** Renderiza os blocos de uma versão sem reconstruí-la com dados atuais. */
export function ScheduleBlocksView({
  record,
  blocks,
  label,
}: {
  record: ScheduleVersionRecord;
  blocks?: ScheduleBlock[];
  label: string;
}) {
  const rendered = blocks ?? record.blocks;
  const state: SchedulePublicationState =
    record.state === "Publicada"
      ? "Publicada"
      : record.state === "Histórica"
        ? "Histórica"
        : record.state === "Substituída"
          ? "Substituída por nova versão"
          : record.state === "Não iniciada"
            ? "Não iniciada"
            : record.state === "Pronta para revisão"
              ? "Pronta para revisão"
              : "Em elaboração";
  const version: ScheduleVersion = {
    id: record.id,
    classId: record.classId,
    journeyId: getJourneyForClass(record.classId)?.id ?? "",
    label: record.version,
    state,
    effectiveFrom: record.effectiveFrom,
    ...(record.effectiveUntil ? { effectiveUntil: record.effectiveUntil } : {}),
    referenceDate: record.effectiveFrom,
    blocks: rendered,
    history: [],
  };
  return <ScheduleWeekView schedule={version} blocks={rendered} label={label} />;
}
