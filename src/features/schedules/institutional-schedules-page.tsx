/**
 * B4.4 — Horários com sessão institucional: SOMENTE fontes canônicas (turmas legíveis, jornada
 * B4.3 e grade B4.4). Nenhuma fixture de horários é lida aqui. Sem editor, publicação,
 * homologação, distribuição automática ou correção: não há writer nem competência definida.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import { JourneyView } from "@/features/student-life/class-journey-panel";
import { journeyMessage, readClassJourney, WEEKDAY_LABEL, formatMinutes } from "@/features/student-life/class-journey-source";
import {
  BLOCK_STATE_TEXT, COVERAGE_TEXT, SCHEDULE_STATE_TEXT, blockLabel, captureScheduleKnownAt, readClassSchedule, scheduleMessage,
  type ClassSchedule,
} from "@/features/student-life/class-schedule-source";

const today = () => new Date().toISOString().slice(0, 10);

type ClassOption = { id: string; name: string };
async function readableClasses(validOn: string): Promise<ClassOption[]> {
  const r = await supabase.from("institutional_classes").select("id");
  if (r.error) throw new Error(r.error.message);
  const out = await Promise.all((r.data ?? []).map(async (c) => {
    const rec = await supabase.rpc("class_at", { _class_id: c.id, _valid_on: validOn });
    const rows = (rec.data ?? []) as { name: string }[];
    return rec.error || rows.length !== 1 ? null : { id: c.id, name: rows[0]!.name };
  }));
  return out.filter((x): x is ClassOption => x !== null).sort((a, b) => a.name.localeCompare(b.name));
}

/** Nomes dos responsáveis apenas dentro da autorização existente (RLS de atuações/pessoas). */
async function responsibleNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const e = await supabase.from("institutional_engagements").select("id, person_id").in("id", ids);
  const persons = [...new Set((e.data ?? []).map((x) => x.person_id))];
  const p = persons.length ? await supabase.from("institutional_persons").select("id, display_name").in("id", persons) : { data: [] };
  const pn = new Map((p.data ?? []).map((x) => [x.id, x.display_name]));
  for (const x of e.data ?? []) { const n = pn.get(x.person_id); if (n) names.set(x.id, n); }
  return names;
}

export function InstitutionalSchedulesPage() {
  const [validOn, setValidOn] = useState(today());
  const [picked, setPicked] = useState("");
  const classes = useQuery({ queryKey: ["b44-classes", validOn], queryFn: () => readableClasses(validOn) });
  const classId = picked || classes.data?.[0]?.id || "";
  const knownAt = useMemo(() => captureScheduleKnownAt(), [classId, validOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = { validOn, knownAt };
  const journey = useQuery({ queryKey: ["b44-journey", classId, validOn, knownAt], enabled: Boolean(classId), queryFn: () => readClassJourney(classId, t) });
  const schedule = useQuery({ queryKey: ["b44-schedule", classId, validOn, knownAt], enabled: Boolean(classId), queryFn: () => readClassSchedule(classId, t) });
  return (
    <div className="space-y-5 pb-5">
      <OperationalPageHeader
        title="Horários escolares"
        description="Fonte institucional: jornada e grade semanal recorrente da turma, somente leitura."
      />
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="b44-date">Data de referência</Label>
          <DateInput id="b44-date" value={validOn} onChange={(e) => e.target.value && setValidOn(e.target.value)} />
        </div>
        {classes.data && classes.data.length > 0 && (
          <div className="space-y-1">
            <Label htmlFor="b44-class">Turma</Label>
            <select id="b44-class" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={classId} onChange={(e) => setPicked(e.target.value)}>
              {classes.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Consulta em {fmt(validOn)}. Jornada é o funcionamento da turma; grade é a distribuição recorrente de blocos dentro dela. Nenhuma das duas é calendário nem aula ministrada.
      </p>
      {classes.error && <p role="alert" className="text-sm text-destructive">Não foi possível listar as turmas.</p>}
      {classes.data?.length === 0 && <p role="status" className="text-sm text-muted-foreground">Nenhuma turma consultável pela sua atuação nesta data.</p>}
      {classId && (
        <>
          <section className="space-y-2 rounded-md border border-border p-3" aria-label="Jornada da turma">
            <h2 className="font-medium">Jornada da turma</h2>
            {journey.error && <p role="alert" className="text-sm text-destructive">{journeyMessage(journey.error)}</p>}
            {journey.data && <JourneyView journey={journey.data} />}
          </section>
          <section className="space-y-2 rounded-md border border-border p-3" aria-label="Grade semanal da turma">
            <h2 className="font-medium">Grade semanal (somente leitura)</h2>
            {schedule.error && <p role="alert" className="text-sm text-destructive">{scheduleMessage(schedule.error)}</p>}
            {schedule.data && <ScheduleView schedule={schedule.data} />}
          </section>
        </>
      )}
    </div>
  );
}

export function ScheduleView({ schedule: s, names }: { schedule: ClassSchedule; names?: Map<string, string> }) {
  const ids = s.kind === "registrada" ? [...new Set(s.days.flatMap((d) => d.blocks.flatMap((b) => b.engagementIds)))] : [];
  const resp = useQuery({ queryKey: ["b44-resp", ids], enabled: !names && ids.length > 0, queryFn: () => responsibleNames(ids) });
  const nameOf = names ?? resp.data ?? new Map<string, string>();
  if (s.kind === "negado") return <p role="status" className="text-sm text-muted-foreground">Sua atuação não permite consultar esta turma.</p>;
  if (s.kind === "ausente") return <p role="status" className="text-sm text-muted-foreground">Grade não registrada.</p>;
  return (
    <div className="space-y-2 text-sm">
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
        <p>validOn {s.validOn} · knownAt {s.knownAt}</p>
      </details>
    </div>
  );
}
