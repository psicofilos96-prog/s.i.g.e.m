import { useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
import type { FollowupVisit } from "./model";

/**
 * A comparação usa apenas visitas vigentes da escola já autorizada.
 * Nunca interpreta versões de uma mesma visita lógica como dois encontros.
 */
export function comparableFollowupVisits(
  visits: readonly FollowupVisit[], schoolId: string,
): FollowupVisit[] {
  const latest = new Map<string, FollowupVisit>();
  for (const visit of visits) {
    if (visit.school_id !== schoolId) continue;
    const existing = latest.get(visit.logical_id);
    if (!existing || visit.version > existing.version
      || (visit.version === existing.version && visit.created_at > existing.created_at)) {
      latest.set(visit.logical_id, visit);
    }
  }
  return [...latest.values()].sort((a, b) =>
    b.visit_date.localeCompare(a.visit_date)
    || b.created_at.localeCompare(a.created_at)
    || b.id.localeCompare(a.id));
}

const valueOrEmpty = (value: string | null | undefined) => value?.trim() || "Não informado";

export function FollowupVisitComparison({ visits, schoolId }: {
  visits: readonly FollowupVisit[]; schoolId: string;
}) {
  const [earlierChoice, setEarlierChoice] = useState("");
  const [laterChoice, setLaterChoice] = useState("");
  const options = comparableFollowupVisits(visits, schoolId);
  const earlierId = options.some((v) => v.id === earlierChoice)
    ? earlierChoice : options[1]?.id ?? "";
  const laterId = options.some((v) => v.id === laterChoice)
    ? laterChoice : options[0]?.id ?? "";
  const first = options.find((v) => v.id === earlierId);
  const second = options.find((v) => v.id === laterId);
  const sameVisit = Boolean(first && second && first.id === second.id);
  const ordered = first && second && !sameVisit
    ? [...[first, second]].sort((a, b) =>
      a.visit_date.localeCompare(b.visit_date)
      || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    : [];
  const older = ordered[0];
  const newer = ordered[1];

  const fields = older && newer ? [
    ["Objetivo declarado", older.purpose_note, newer.purpose_note],
    ["Diagnóstico da realidade", older.diagnosis, newer.diagnosis],
    ["Pontos fortes", older.strengths, newer.strengths],
    ["Fragilidades e necessidades", older.weaknesses, newer.weaknesses],
    ["Observações e encaminhamentos", older.summary, newer.summary],
    ["Demais participantes informados", older.participants_note, newer.participants_note],
  ] as const : [];

  return <section className="space-y-3 rounded-xl border p-4"
    aria-label="Comparar visitas registradas">
    <div>
      <h3 className="font-semibold">Comparar duas visitas da unidade</h3>
      <p className="text-sm text-muted-foreground">
        Confronte o que foi declarado em duas datas. A comparação é descritiva:
        não estabelece evolução, qualidade, cumprimento de providências nem homologação pelo Gabinete.
      </p>
    </div>
    {options.length < 2
      ? <p className="text-sm text-muted-foreground">
        São necessárias pelo menos duas visitas distintas registradas para comparar.
      </p>
      : <>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Primeira visita escolhida
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={earlierId} onChange={(e) => setEarlierChoice(e.target.value)}>
              {options.map((v) => <option key={v.id} value={v.id}>
                {formatAcademicDate(v.visit_date)} — {v.author_name || "Autoria registrada"}
                {v.version > 1 ? ` (versão ${v.version})` : ""}
              </option>)}
            </select>
          </label>
          <label className="text-sm">Segunda visita escolhida
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={laterId} onChange={(e) => setLaterChoice(e.target.value)}>
              {options.map((v) => <option key={v.id} value={v.id}>
                {formatAcademicDate(v.visit_date)} — {v.author_name || "Autoria registrada"}
                {v.version > 1 ? ` (versão ${v.version})` : ""}
              </option>)}
            </select>
          </label>
        </div>
        {sameVisit && <p role="status" className="text-sm text-muted-foreground">
          Selecione duas visitas diferentes para visualizar os relatos lado a lado.
        </p>}
        {older && newer && <div className="space-y-3">
          <div className="grid gap-3 rounded-lg bg-muted/30 p-3 text-sm md:grid-cols-2">
            <p><strong>Anterior:</strong> {formatAcademicDate(older.visit_date)}
              {" · "}{older.author_name || "Autoria registrada"}
              {older.version > 1 ? ` · versão vigente ${older.version}` : ""}
            </p>
            <p><strong>Posterior:</strong> {formatAcademicDate(newer.visit_date)}
              {" · "}{newer.author_name || "Autoria registrada"}
              {newer.version > 1 ? ` · versão vigente ${newer.version}` : ""}
            </p>
          </div>
          {fields.map(([label, before, after]) => <div key={label} className="space-y-2 border-b pb-3 last:border-0">
            <h4 className="text-sm font-semibold">{label}</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="min-w-0 rounded-lg bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Visita anterior</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{valueOrEmpty(before)}</p>
              </div>
              <div className="min-w-0 rounded-lg bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">Visita posterior</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{valueOrEmpty(after)}</p>
              </div>
            </div>
          </div>)}
          <p className="text-xs text-muted-foreground">
            A comparação utiliza as versões vigentes das visitas escolhidas. Retificações e
            evoluções das medidas continuam disponíveis no histórico integral da escola.
            A ausência de informação em um relato não significa que a atividade não ocorreu.
          </p>
        </div>}
      </>}
  </section>;
}
