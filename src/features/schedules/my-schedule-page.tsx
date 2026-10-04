/**
 * B4.5 — "Meu horário" (sessão institucional): projeção somente leitura da própria pessoa.
 * Sem seletor de outros profissionais, sem editar/publicar/corrigir/redistribuir.
 * Cache isolado por contexto de sessão (userId#revisão na query key) e sem dados anteriores durante nova carga.
 */
import { useQuery } from "@tanstack/react-query";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import { WEEKDAY_LABEL, formatMinutes } from "@/features/student-life/class-journey-source";
import { BLOCK_STATE_TEXT, scheduleMessage } from "@/features/student-life/class-schedule-source";
import {
  CONFLICT_TEXT, SOURCE_STATE_TEXT, UNAVAILABLE_TEXT, readMySchedule, readPlaceNames,
  type PersonBlock, type PersonSchedule, type PlaceNames,
} from "./person-schedule-source";
import { useScheduleReference } from "./schedule-session-context";
import { CalendarDayNotice } from "./institutional-schedules-page";

/** B4.10.0e — contexto `userId#revisão` em toda chave; data da URL ou hoje operacional; knownAt único por data. */
export function MySchedulePage({ contextKey, referenceDate, onDateChange }: {
  contextKey: string; referenceDate?: string | undefined; onDateChange?: (iso: string) => void;
}) {
  const { reference: ref, inputValue, choose } = useScheduleReference(referenceDate);
  const ready = ref.kind === "ready";
  const t = ready ? { validOn: ref.validOn, knownAt: ref.knownAt } : { validOn: "", knownAt: "" };
  const q = useQuery({
    queryKey: ["b45-my", contextKey, t.validOn, t.knownAt],
    enabled: ready,
    queryFn: () => readMySchedule(t),
  });
  const fresh = ready && !q.error && q.data && q.data.validOn === t.validOn && q.data.knownAt === t.knownAt ? q.data : undefined;
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader title="Meu horário" description="Projeção somente leitura dos blocos das grades das turmas em que você atua." />
      <div className="space-y-1">
        <Label htmlFor="b45-date">Data de referência</Label>
        <DateInput id="b45-date" value={inputValue} onChange={(e) => { const iso = choose(e.target.value); if (iso) onDateChange?.(iso); }} />
      </div>
      {ref.kind === "bloqueada" ? (
        <p role="alert" className="text-sm text-destructive">{ref.reason}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Consulta em {fmt(ref.validOn)}. O horário pertence às grades das turmas; aqui ele só é reunido para você.</p>
      )}
      {ready && q.isFetching && !fresh && !q.error && <p role="status" className="text-sm text-muted-foreground">Consultando seu horário…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{scheduleMessage(q.error)}</p>}
      {fresh && <MyScheduleView schedule={fresh} contextKey={contextKey} />}
    </div>
  );
}

export function MyScheduleView({ schedule: s, names, contextKey = "" }: { schedule: PersonSchedule; names?: PlaceNames; contextKey?: string }) {
  const classIds = s.kind === "projetado" ? [...new Set([...s.blocks.map((b) => b.classId), ...s.unavailable.map((u) => u.classId)])].sort() : [];
  const schoolIds = s.kind === "projetado" ? [...new Set(s.blocks.flatMap((b) => (b.schoolId ? [b.schoolId] : [])))].sort() : [];
  const nq = useQuery({
    queryKey: ["b45-names", contextKey, classIds, schoolIds, s.validOn, s.knownAt],
    enabled: !names && classIds.length > 0 && Boolean(contextKey),
    queryFn: () => readPlaceNames(classIds, schoolIds, { validOn: s.validOn, knownAt: s.knownAt }),
  });
  const n: PlaceNames = names ?? (nq.error ? undefined : nq.data) ?? { classes: new Map(), schools: new Map(), errors: [] };
  const nameErrors = [...n.errors, ...(nq.error ? [String((nq.error as Error).message ?? nq.error)] : [])];
  if (s.kind === "negado") return <p role="status" className="text-sm text-muted-foreground">Sua conta não está vinculada a uma pessoa institucional; não há horário a exibir.</p>;
  if (s.kind === "ausente") return <p role="status" className="text-sm text-muted-foreground">Nenhum bloco previsto registrado para você nesta data.</p>;
  const cls = (id: string) => n.classes.get(id) ?? "Turma sem nome legível";
  const sch = (id: string | null) => (id && n.schools.get(id)) || "Escola sem nome legível";
  const byId = new Map(s.blocks.map((b) => [b.blockId, b]));
  const label = (b: PersonBlock) => b.componentId ? b.componentName ?? "Componente sem nome legível" : b.natureLabel ?? "Bloco previsto";
  const days = [...new Set(s.blocks.map((b) => b.weekday))].sort();
  return (
    <div className="space-y-3 text-sm">
      {nameErrors.length > 0 && (
        <p role="status" data-testid="names-warning" className="text-muted-foreground">
          Alguns nomes de turma ou escola não puderam ser lidos e aparecem com rótulo neutro. A leitura do horário continua, e o estado de cada bloco abaixo é preservado.
        </p>
      )}
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
      {contextKey && classIds.length > 0 && (
        <section aria-label="Calendário nesta data" data-testid="my-calendar" className="rounded-md border border-border p-3">
          <h2 className="font-medium">Calendário em {fmt(s.validOn)}</h2>
          <p className="text-xs text-muted-foreground">Lido do calendário homologado aplicado às alocações de cada turma, no mesmo instante da grade. A grade não é alterada.</p>
          <ul className="space-y-1">
            {classIds.map((id) => {
              const school = s.blocks.find((b) => b.classId === id && b.schoolId)?.schoolId ?? undefined;
              return (
                <li key={id}>
                  <span className="font-medium">{cls(id)}:</span>{" "}
                  {school
                    ? <CalendarDayNotice validOn={s.validOn} knownAt={s.knownAt} contextKey={contextKey} classId={id} schoolId={school} />
                    : <span className="text-muted-foreground">escola da turma não identificada; o calendário não foi lido e nada foi inferido.</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
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
        {nameErrors.map((e) => <p key={e}>Erro de nomes: {e}</p>)}
        <p>validOn {s.validOn} · knownAt {s.knownAt}</p>
      </details>
    </div>
  );
}
