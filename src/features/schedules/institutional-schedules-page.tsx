/**
 * B4.4 — Horários com sessão institucional: SOMENTE fontes canônicas (turmas legíveis, jornada
 * B4.3 e grade B4.4). Nenhuma fixture de horários é lida aqui. Sem editor, publicação,
 * homologação, distribuição automática ou correção: não há writer nem competência definida.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import { instantMicros } from "@/lib/postgres-instant";
import { JourneyView } from "@/features/student-life/class-journey-panel";
import { journeyMessage, readClassJourney, WEEKDAY_LABEL, formatMinutes } from "@/features/student-life/class-journey-source";
import {
  BLOCK_STATE_TEXT, COVERAGE_TEXT, SCHEDULE_STATE_TEXT, blockLabel, readClassSchedule, scheduleMessage,
  type ClassSchedule,
} from "@/features/student-life/class-schedule-source";
import { useScheduleReference } from "./schedule-session-context";

type Snapshot = { validOn: string; knownAt: string };
type ClassOption = { id: string; name: string };

/**
 * B4.10.0e — turmas legíveis pela RLS (identidade não bitemporal) com nome por `class_at` no MESMO
 * snapshot (validOn, knownAt). Sem registro na data ⇒ fora da lista; erro ou ambiguidade ⇒ a lista
 * inteira falha (nunca "vazio"). A RLS dos readers decide a autorização; a tela não a reinterpreta.
 */
export async function readableClasses(t: Snapshot): Promise<ClassOption[]> {
  const r = await supabase.from("institutional_classes").select("id");
  if (r.error) throw new Error(r.error.message);
  const out = await Promise.all((r.data ?? []).map(async (c) => {
    const rec = await supabase.rpc("class_at", { _class_id: c.id, _valid_on: t.validOn, _known_at: t.knownAt });
    if (rec.error) throw new Error(`class_at:${c.id}:${rec.error.message}`);
    const rows = (rec.data ?? []) as { name: string }[];
    if (rows.length > 1) throw new Error(`class_at:${c.id}:ambiguous`);
    return rows.length === 1 ? { id: c.id, name: rows[0]!.name } : null;
  }));
  return out.filter((x): x is ClassOption => x !== null).sort((a, b) => a.name.localeCompare(b.name));
}

export type ResponsibleNames = { names: Map<string, string>; errors: string[] };

/**
 * Nomes dos responsáveis dentro da autorização existente (RLS de atuações/pessoas). Atuação só conta se
 * registrada até knownAt; o nome da pessoa NÃO é versionado (valor corrente, limitação declarada).
 * Erros viram diagnóstico e rótulo neutro; nunca derrubam a grade lida.
 */
export async function responsibleNames(ids: string[], t: Snapshot): Promise<ResponsibleNames> {
  const names = new Map<string, string>(); const errors: string[] = [];
  if (!ids.length) return { names, errors };
  const k = instantMicros(t.knownAt);
  if (k === null) return { names, errors: ["knownAt inválido"] };
  const e = await supabase.from("institutional_engagements").select("id, person_id, created_at").in("id", ids);
  if (e.error) return { names, errors: [`atuações:${e.error.message}`] };
  const known = ((e.data ?? []) as { id: string; person_id: string; created_at: string }[]).filter((x) => {
    const m = instantMicros(x.created_at); return m !== null && m <= k;
  });
  const persons = [...new Set(known.map((x) => x.person_id))];
  const p = persons.length ? await supabase.from("institutional_persons").select("id, display_name").in("id", persons) : { data: [], error: null };
  if (p.error) return { names, errors: [`pessoas:${p.error.message}`] };
  const pn = new Map(((p.data ?? []) as { id: string; display_name: string }[]).map((x) => [x.id, x.display_name]));
  for (const x of known) { const n = pn.get(x.person_id); if (n) names.set(x.id, n); }
  return { names, errors };
}

export function InstitutionalSchedulesPage({ contextKey, referenceDate, onDateChange }: {
  contextKey: string; referenceDate?: string | undefined; onDateChange?: (iso: string) => void;
}) {
  const { reference: ref, inputValue, choose } = useScheduleReference(referenceDate);
  const [picked, setPicked] = useState("");
  const ready = ref.kind === "ready";
  const t: Snapshot = ready ? { validOn: ref.validOn, knownAt: ref.knownAt } : { validOn: "", knownAt: "" };
  const classes = useQuery({ queryKey: ["b44-classes", contextKey, t.validOn, t.knownAt], enabled: ready, queryFn: () => readableClasses(t) });
  // Só a lista aceita do contexto atual vale; erro após refetch nunca mostra a lista anterior.
  const list = ready && !classes.error ? classes.data : undefined;
  const classId = list ? (list.some((c) => c.id === picked) ? picked : list[0]?.id ?? "") : "";
  const journey = useQuery({ queryKey: ["b44-journey", contextKey, classId, t.validOn, t.knownAt], enabled: Boolean(classId), queryFn: () => readClassJourney(classId, t) });
  const schedule = useQuery({ queryKey: ["b44-schedule", contextKey, classId, t.validOn, t.knownAt], enabled: Boolean(classId), queryFn: () => readClassSchedule(classId, t) });
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title="Horários escolares"
        description="Fonte institucional: jornada e grade semanal recorrente da turma, somente leitura."
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="b44-date">Data de referência</Label>
          <DateInput id="b44-date" value={inputValue} onChange={(e) => { const iso = choose(e.target.value); if (iso) onDateChange?.(iso); }} />
        </div>
        {list && list.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="b44-class">Turma</Label>
            <select id="b44-class" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={classId} onChange={(e) => setPicked(e.target.value)}>
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      {ref.kind === "bloqueada" ? (
        <p role="alert" className="text-sm text-destructive">{ref.reason}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Consulta em {fmt(ref.validOn)}. Jornada é o funcionamento da turma; grade é a distribuição recorrente de blocos dentro dela. Nenhuma das duas é calendário nem aula ministrada.
        </p>
      )}
      {ready && classes.isFetching && !list && !classes.error && <p role="status" className="text-sm text-muted-foreground">Consultando turmas…</p>}
      {classes.error && <p role="alert" className="text-sm text-destructive">Não foi possível listar as turmas. Nenhuma turma é exibida enquanto a leitura falhar.</p>}
      {list?.length === 0 && <p role="status" className="text-sm text-muted-foreground">Nenhuma turma consultável pela sua atuação nesta data.</p>}
      {classId && (
        <>
          <section className="space-y-2 rounded-md border border-border p-3" aria-label="Jornada da turma">
            <h2 className="font-medium">Jornada da turma</h2>
            {journey.error && <p role="alert" className="text-sm text-destructive">{journeyMessage(journey.error)}</p>}
            {journey.data && !journey.error && <JourneyView journey={journey.data} />}
          </section>
          <section className="space-y-2 rounded-md border border-border p-3" aria-label="Grade semanal da turma">
            <h2 className="font-medium">Grade semanal (somente leitura)</h2>
            {schedule.error && <p role="alert" className="text-sm text-destructive">{scheduleMessage(schedule.error)}</p>}
            {schedule.data && !schedule.error && <ScheduleView schedule={schedule.data} contextKey={contextKey} />}
          </section>
        </>
      )}
    </div>
  );
}

export function ScheduleView({ schedule: s, names, contextKey = "" }: { schedule: ClassSchedule; names?: Map<string, string>; contextKey?: string }) {
  const ids = s.kind === "registrada" ? [...new Set(s.days.flatMap((d) => d.blocks.flatMap((b) => b.engagementIds)))].sort() : [];
  const snap = { validOn: s.validOn, knownAt: s.knownAt };
  const resp = useQuery({ queryKey: ["b44-resp", contextKey, ids, snap.validOn, snap.knownAt], enabled: !names && ids.length > 0 && Boolean(contextKey), queryFn: () => responsibleNames(ids, snap) });
  const fresh = !names && !resp.error ? resp.data : undefined;
  const nameOf = names ?? fresh?.names ?? new Map<string, string>();
  const nameErrors = names ? [] : [...(fresh?.errors ?? []), ...(resp.error ? [String((resp.error as Error).message ?? resp.error)] : [])];
  if (s.kind === "negado") return <p role="status" className="text-sm text-muted-foreground">Sua atuação não permite consultar esta turma.</p>;
  if (s.kind === "ausente") return <p role="status" className="text-sm text-muted-foreground">Grade não registrada.</p>;
  return (
    <div className="space-y-2 text-sm">
      {nameErrors.length > 0 && (
        <p role="status" data-testid="resp-names-warning" className="text-muted-foreground">
          Alguns nomes de responsáveis não puderam ser lidos e aparecem com rótulo neutro. A grade abaixo continua exibida, com seu estado preservado.
        </p>
      )}
      <p role="status" className={s.state === "utilizavel" ? "" : "text-destructive"}>{SCHEDULE_STATE_TEXT[s.state]}</p>
      <p>Vigência: {fmt(s.validFrom)} — {s.effectiveUntil ? fmt(s.effectiveUntil) : "sem término registrado"}</p>
      <table className="w-full text-xs">
        <thead><tr className="text-left"><th>Dia</th><th>Horário</th><th>Bloco</th><th>Responsáveis</th><th>Situação</th><th>Currículo</th></tr></thead>
        <tbody>
          {s.days.flatMap((d) => d.blocks.map((b) => (
            <tr key={b.blockId} className="border-t border-border align-top" data-testid="schedule-block">
              <td>{WEEKDAY_LABEL[d.weekday] ?? "Dia não reconhecido"}</td>
              <td>{b.startsAt}–{b.endsAt}</td>
              <td>{blockLabel(b)}</td>
              <td>{b.engagementIds.length === 0 ? "Sem responsável registrado" : b.engagementIds.map((id) => nameOf.get(id) ?? "Responsável sem nome legível").join("; ")}</td>
              <td>{b.issues.length ? b.issues.map((i) => BLOCK_STATE_TEXT[i]).join("; ") : BLOCK_STATE_TEXT.utilizavel}</td>
              <td>{COVERAGE_TEXT[b.coverage]}</td>
            </tr>
          )))}
        </tbody>
      </table>
      <p>Soma descritiva dos blocos: {formatMinutes(s.weekMinutes)} <span className="text-xs text-muted-foreground">(não é carga horária normativa; blocos simultâneos somam separadamente)</span></p>
      <p className="text-xs text-muted-foreground">Sem regra homologada o sistema não conclui; nenhum valor padrão é sugerido.</p>
      <details className="text-xs text-muted-foreground">
        <summary>Detalhe técnico (auditoria)</summary>
        <p>Turma {s.classId} · grade {s.scheduleId} · versão {s.versionId} (v{s.version}, {s.changeKind})</p>
        <p>Ato {s.actRef}{s.changeReason ? ` · motivo ${s.changeReason}` : ""} · registrada {s.recordedAt}</p>
        {s.days.flatMap((d) => d.blocks).map((b) => (
          <p key={b.blockId}>Bloco {b.blockKey} · {b.blockId}{b.componentId ? ` · componente ${b.componentId} v${b.componentVersion ?? "?"}` : ""}{b.nature ? ` · tipo ${b.nature.schemeId}/${b.nature.valueId}@${b.nature.version}` : ""}{b.engagementIds.length ? ` · atuações ${b.engagementIds.join(", ")}` : ""}{b.coverageMatrixIds.length ? ` · matrizes ${b.coverageMatrixIds.join(", ")}` : ""}</p>
        ))}
        {nameErrors.map((e) => <p key={e}>Erro de nomes: {e}</p>)}
        <p>validOn {s.validOn} · knownAt {s.knownAt}</p>
      </details>
    </div>
  );
}
