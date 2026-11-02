import { humanizeForScreen } from "@/config/technical-codes";
import { operationalToday, civilDateOf } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDateNumeric as br } from "@/lib/academic-date";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { loadStudentRecord } from "@/features/students/student-record";
import { Link } from "@tanstack/react-router";
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
  // Fallback exclusivo aos fatos administrativos já autorizados pela RLS da ficha escolar.
  // Não substitui nem amplia as permissões dos domínios pedagógicos.
  const administrative = useQuery({
    queryKey: ["student-trajectory-administrative", studentId],
    queryFn: ({ signal }) => loadStudentRecord(studentId, signal),
    enabled: t?.result === "access-denied",
  });
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
      {t?.result === "unavailable" && <EmptyState title="Ficha indisponível agora" description={humanizeForScreen(t.reason)} />}
      {t?.result === "access-denied" && (
        administrative.isPending ? <SkeletonState label="Consultando histórico escolar autorizado" /> :
        administrative.data?.enrollments.length ? (
          <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Histórico administrativo autorizado">
            <h2 className="font-display text-xl font-semibold">Histórico escolar autorizado · {administrative.data.name}</h2>
            <p className="text-sm text-muted-foreground">Sua conta pode consultar estes vínculos escolares. Frequência, avaliações e acompanhamento pedagógico só aparecem quando houver autorização específica; nenhum acesso adicional foi concedido.</p>
            {administrative.data.enrollments.map((e) => (
              <div key={e.id} className="space-y-2 rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{e.schoolLabel ?? "Escola vinculada"} · Ingresso: {e.openedOn ? br(e.openedOn) : "não registrado"}</p>
                {e.classes.length ? (
                  <ul className="list-disc pl-5">
                    {e.classes.map((cl) => (
                      <li key={cl.episodeId}>{cl.label} · {cl.validFrom ? `desde ${br(cl.validFrom)}` : "início não registrado"} · {cl.situation.kind === "encerrado" ? `encerrado em ${br(cl.situation.on)}` : "sem encerramento registrado"}</li>
                    ))}
                  </ul>
                ) : <p className="text-muted-foreground">Sem vínculo de turma visível.</p>}
              </div>
            ))}
            <Link className="text-sm font-medium text-primary underline" to="/alunos/$id" params={{ id: studentId }}>Abrir ficha escolar completa</Link>
          </section>
        ) : (
          <EmptyState title="Ficha fora do seu alcance" description="Este aluno não possui matrícula visível para sua conta. Consulte a administração de acessos se deveria pertencer à sua escola." />
        )
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
            Esta ficha mostra só o que foi registrado.
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
