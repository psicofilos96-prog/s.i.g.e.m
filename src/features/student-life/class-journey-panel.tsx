/**
 * B4.3 — Painel SOMENTE LEITURA da jornada recorrente da turma (fonte institucional).
 * Sem ações de registrar/corrigir: não há writer porque a competência não está definida.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import {
  WEEKDAY_LABEL, captureJourneyKnownAt, formatMinutes, journeyMessage, readClassJourney, type ClassJourney,
} from "./class-journey-source";

export function ClassJourneyPanel({ validOn, classes }: { validOn: string; classes: readonly { id: string; name: string }[] }) {
  const [picked, setPicked] = useState("");
  const classId = picked || classes[0]?.id || "";
  const knownAt = useMemo(() => captureJourneyKnownAt(), [classId, validOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({
    queryKey: ["b43-journey", classId, validOn, knownAt],
    enabled: Boolean(classId),
    queryFn: () => readClassJourney(classId, { validOn, knownAt }),
  });
  return (
    <section className="space-y-3 rounded-md border border-border p-3" aria-label="Jornada da turma">
      <h3 className="font-medium">Jornada da turma (somente leitura)</h3>
      <p className="text-xs text-muted-foreground">
        Data de referência: {fmt(validOn)}. Jornada é o funcionamento semanal recorrente da turma; não é turno, grade de horário nem calendário.
      </p>
      {classes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma turma ativa nesta data.</p> : (
        <div className="space-y-1">
          <Label htmlFor="b43-class">Turma</Label>
          <select id="b43-class" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={classId} onChange={(e) => setPicked(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {q.error && <p role="alert" className="text-sm text-destructive">{journeyMessage(q.error)}</p>}
      {q.data && <JourneyView journey={q.data} />}
    </section>
  );
}

export function JourneyView({ journey: j }: { journey: ClassJourney }) {
  if (j.kind === "negado") return <p role="status" className="text-sm text-muted-foreground">Sua atuação não permite consultar esta turma.</p>;
  if (j.kind === "ausente") return <p role="status" className="text-sm text-muted-foreground">Jornada não registrada.</p>;
  return (
    <div className="space-y-2 text-sm">
      <p>Vigência: {fmt(j.validFrom)} — {j.effectiveUntil ? fmt(j.effectiveUntil) : "sem término registrado"}</p>
      <table className="w-full text-xs">
        <thead><tr className="text-left"><th>Dia</th><th>Intervalos</th><th>Início</th><th>Fim</th><th>Total do dia</th></tr></thead>
        <tbody>
          {j.days.map((d) => (
            <tr key={d.weekday} className="border-t border-border align-top">
              <td>{WEEKDAY_LABEL[d.weekday] ?? "Dia não reconhecido"}</td>
              <td>{d.intervals.map((i) => `${i.startsAt}–${i.endsAt}`).join(" · ")}</td>
              <td>{d.firstStart}</td><td>{d.lastEnd}</td><td>{formatMinutes(d.minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Total semanal dos intervalos: {formatMinutes(j.weekMinutes)} <span className="text-xs text-muted-foreground">(descritivo; não é carga horária normativa)</span></p>
      <details className="text-xs text-muted-foreground">
        <summary>Detalhe técnico (auditoria)</summary>
        <p>Turma {j.classId} · jornada {j.journeyId} · versão {j.versionId} (v{j.version}, {j.changeKind})</p>
        <p>Ato {j.actRef}{j.changeReason ? ` · motivo ${j.changeReason}` : ""} · registrada {j.recordedAt}</p>
        <p>validOn {j.validOn} · knownAt {j.knownAt}</p>
      </details>
    </div>
  );
}
