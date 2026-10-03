/**
 * B4.5 — "Meu horário" (sessão institucional): projeção somente leitura da própria pessoa.
 * Sem seletor de outros profissionais, sem editar/publicar/corrigir/redistribuir.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import { WEEKDAY_LABEL, formatMinutes } from "@/features/student-life/class-journey-source";
import { BLOCK_STATE_TEXT, scheduleMessage } from "@/features/student-life/class-schedule-source";
import {
  CONFLICT_TEXT, SOURCE_STATE_TEXT, UNAVAILABLE_TEXT, capturePersonScheduleKnownAt, readMySchedule, readPlaceNames,
  type PersonBlock, type PersonSchedule,
} from "./person-schedule-source";

const today = () => new Date().toISOString().slice(0, 10);
type Names = { classes: Map<string, string>; schools: Map<string, string> };

export function MySchedulePage() {
  const [validOn, setValidOn] = useState(today());
  const knownAt = useMemo(() => capturePersonScheduleKnownAt(), [validOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({ queryKey: ["b45-my", validOn, knownAt], queryFn: () => readMySchedule({ validOn, knownAt }) });
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader title="Meu horário" description="Projeção somente leitura dos blocos das grades das turmas em que você atua." />
      <div className="space-y-1">
        <Label htmlFor="b45-date">Data de referência</Label>
        <DateInput id="b45-date" value={validOn} onChange={(e) => e.target.value && setValidOn(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Consulta em {fmt(validOn)}. O horário pertence às grades das turmas; aqui ele só é reunido para você.</p>
      {q.error && <p role="alert" className="text-sm text-destructive">{scheduleMessage(q.error)}</p>}
      {q.data && <MyScheduleView schedule={q.data} />}
    </div>
  );
}

export function MyScheduleView({ schedule: s, names }: { schedule: PersonSchedule; names?: Names }) {
  const classIds = s.kind === "projetado" ? [...new Set([...s.blocks.map((b) => b.classId), ...s.unavailable.map((u) => u.classId)])] : [];
  const schoolIds = s.kind === "projetado" ? [...new Set(s.blocks.flatMap((b) => (b.schoolId ? [b.schoolId] : [])))] : [];
  const nq = useQuery({ queryKey: ["b45-names", classIds, schoolIds, s.validOn], enabled: !names && classIds.length > 0, queryFn: () => readPlaceNames(classIds, schoolIds, s.validOn) });
  const n: Names = names ?? nq.data ?? { classes: new Map(), schools: new Map() };
  if (s.kind === "negado") return <p role="status" className="text-sm text-muted-foreground">Sua conta não está vinculada a uma pessoa institucional; não há horário a exibir.</p>;
  if (s.kind === "ausente") return <p role="status" className="text-sm text-muted-foreground">Nenhum bloco previsto registrado para você nesta data.</p>;
  const cls = (id: string) => n.classes.get(id) ?? "Turma sem nome legível";
  const sch = (id: string | null) => (id && n.schools.get(id)) || "Escola sem nome legível";
  const byId = new Map(s.blocks.map((b) => [b.blockId, b]));
  const label = (b: PersonBlock) => b.componentId ? b.componentName ?? "Componente sem nome legível" : b.natureLabel ?? "Bloco previsto";
  const days = [...new Set(s.blocks.map((b) => b.weekday))].sort();
  return (
    <div className="space-y-3 text-sm">
      {s.unavailable.map((u) => (
        <p key={u.classId} role="alert" className="text-destructive">{cls(u.classId)}: {UNAVAILABLE_TEXT[u.state]}</p>
      ))}
      {days.map((d) => (
        <section key={d} aria-label={WEEKDAY_LABEL[d] ?? "Dia não reconhecido"} className="rounded-md border border-border p-3">
          <h2 className="font-medium">{WEEKDAY_LABEL[d] ?? "Dia não reconhecido"}</h2>
          <ul className="space-y-1">
            {s.blocks.filter((b) => b.weekday === d).map((b) => (
              <li key={b.blockId} data-testid="my-block" className={b.operational ? "" : "text-muted-foreground"}>
                {b.startsAt}–{b.endsAt} · {label(b)} · {cls(b.classId)} · {sch(b.schoolId)}
                {!b.operational && <> — {b.sourceState !== "utilizavel" ? SOURCE_STATE_TEXT[b.sourceState] : `Bloco não confirmado: ${BLOCK_STATE_TEXT[b.blockState]}`}</>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {s.conflicts.length > 0 && (
        <section aria-label="Conflitos potenciais" className="rounded-md border border-border p-3">
          <h2 className="font-medium">Sobreposições potenciais</h2>
          <ul>
            {s.conflicts.map((c) => {
              const a = byId.get(c.blockId); const b = byId.get(c.otherBlockId);
              return (
                <li key={`${c.blockId}-${c.otherBlockId}`} data-testid="my-conflict">
                  {WEEKDAY_LABEL[c.weekday]} {c.overlapStartsAt}–{c.overlapEndsAt}: {a ? label(a) : "Bloco"} ({cls(c.classId)}) e {b ? label(b) : "Bloco"} ({cls(c.otherClassId)}). {CONFLICT_TEXT}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <p>
        Soma descritiva dos blocos confirmados: {formatMinutes(s.weekMinutes)} em {s.operationalBlockCount} bloco(s)
        {s.unavailableBlockCount > 0 ? `; ${s.unavailableBlockCount} bloco(s) não confirmado(s) fora da soma` : ""}.
        <span className="text-xs text-muted-foreground"> Não é carga horária contratual nem docente.</span>
      </p>
      <details className="text-xs text-muted-foreground">
        <summary>Detalhe técnico (auditoria)</summary>
        {s.blocks.map((b) => (
          <p key={b.blockId}>Bloco {b.blockKey} · {b.blockId} · turma {b.classId} · grade {b.scheduleId} v{b.version} ({b.versionId}) · atuações {b.ownEngagementIds.join(", ")}</p>
        ))}
        {s.conflicts.map((c) => <p key={`a-${c.blockId}-${c.otherBlockId}`}>Conflito {c.blockId} × {c.otherBlockId}</p>)}
        {s.unavailable.map((u) => <p key={`u-${u.classId}`}>Fonte {u.classId}: {u.state}{u.issue ? ` (${u.issue})` : ""}</p>)}
        <p>validOn {s.validOn} · knownAt {s.knownAt}</p>
      </details>
    </div>
  );
}
