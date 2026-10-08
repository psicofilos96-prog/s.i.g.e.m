import { operationalToday, civilDateOf } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDateNumeric as br } from "@/lib/academic-date";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { NETWORK_BRANDING } from "@/features/reports/report-registry";
import {
  DOMAIN_LABEL, DOMAIN_STATE_LABEL, FICHA_LONGITUDINAL, TRAJECTORY_DOMAINS, eventValueText, readStudentTrajectory, trajectoryRows,
  type Trajectory, type TrajectoryDomain,
} from "./student-trajectory-source";

const todayIso = () => operationalToday();

export function StudentTrajectoryPage({ studentId }: { studentId: string }) {
  const [asOf, setAsOf] = useState(todayIso());
  const [domains, setDomains] = useState<TrajectoryDomain[]>([...TRAJECTORY_DOMAINS]);
  const q = useQuery({
    queryKey: ["student-trajectory", studentId, asOf, domains.join(",")],
    queryFn: () => readStudentTrajectory({ studentId, asOf, domains }),
  });
  const t: Trajectory | undefined = q.data;
  const toggle = (d: TrajectoryDomain) => setDomains((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Acompanhamento" title="Ficha longitudinal do aluno"
        description="Linha do tempo dos registros que sua atuação autoriza ver. Cada linha mostra de onde veio. Nada aqui é diagnóstico nem classificação." />
      <section className="flex flex-wrap items-end gap-4 rounded-lg border border-border p-4">
        <label className="grid gap-1 text-sm">Data de referência
          <DateInput value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
        </label>
        <fieldset className="flex flex-wrap gap-3 text-sm">
          <legend className="mb-1 text-sm">Assuntos</legend>
          {TRAJECTORY_DOMAINS.map((d) => (
            <label key={d} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={domains.includes(d)} onChange={() => toggle(d)} /> {DOMAIN_LABEL[d]}
            </label>
          ))}
        </fieldset>
        {t?.result === "ok" && t.events.length > 0 && (
          <button className="min-h-11 rounded-md border border-border px-3" onClick={() => exportCsv(t, asOf)}>Exportar (CSV)</button>
        )}
      </section>

      {q.isLoading && <SkeletonState label="Carregando a ficha" />}
      {t?.result === "unavailable" && <EmptyState title="Ficha indisponível agora" description={t.reason} />}
      {t?.result === "access-denied" && (
        <EmptyState title="Ficha não disponível para você" description="Não há registros deste aluno que sua atuação permita consultar nesta data." />
      )}
      {t?.result === "ok" && (
        <>
          <section aria-label="Situação por assunto" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TRAJECTORY_DOMAINS.map((d) => (
              <div key={d} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium text-foreground">{DOMAIN_LABEL[d]}</p>
                <p className="text-muted-foreground">{DOMAIN_STATE_LABEL[t.domains[d]]}</p>
              </div>
            ))}
          </section>
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Alertas: desativados — não há regra homologada. A ficha não calcula risco nem pontuação.
          </p>
          {t.events.length === 0 ? (
            <EmptyState compact title="Nenhum registro no período" description="Ausência de registro não é zero nem falta." />
          ) : (
            <ol className="space-y-2">
              {t.events.map((e) => (
                <li key={`${e.source}:${e.sourceId}:${e.on}`} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-foreground">{br(e.on)} · {DOMAIN_LABEL[e.domain]}</span>
                    {eventValueText(e) && <span className="text-foreground">{eventValueText(e)}</span>}
                  </div>
                  {e.label && <p className="text-muted-foreground">{e.label}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Origem: {e.source} · registro {e.sourceId}{e.knownAt ? ` · conhecido em ${br(civilDateOf(e.knownAt))}` : ""}{e.returnOn ? ` · retorno previsto ${br(e.returnOn)}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function exportCsv(t: Trajectory, asOf: string) {
  const res = runReport(FICHA_LONGITUDINAL, { params: { asOf } }, trajectoryRows(t));
  const csv = toCsv(res, NETWORK_BRANDING, [`Data de referência: ${asOf}`, "Natureza: projeção autorizada (não oficial)"]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${FICHA_LONGITUDINAL.id}-${asOf}.csv`;
  a.click();
}
