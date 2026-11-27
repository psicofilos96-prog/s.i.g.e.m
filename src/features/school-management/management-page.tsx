import { MoreFilters } from "@/components/sigem/more-filters";
import { ExportMenu } from "@/components/sigem/export-menu";
import { SkeletonState } from "@/components/sigem/guidance";
import { operationalToday } from "@/lib/academic-date";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { readYears, type YearOption } from "@/features/year-transition/year-transition-source";
import { yearStateLabel } from "@/features/school-secretariat/secretariat";
import { runReport, toCsv, toPrintableHtml } from "@/features/reports/report-engine";
import { openSchedulePrint } from "@/features/schedules/schedule-print";
import { GESTAO_ESCOLAR } from "@/features/reports/report-registry";
import { buildPanel, dossierPrintHtml, managementRows, type Block, type Pending } from "./management-panel";
import { readManagementInputs } from "./management-source";
import { CensusDeclaredStaff } from "@/features/professionals/census-declared-staff";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { OwnSchoolName } from "@/features/authority/own-school-field";
import { OccurrencesPanel } from "./occurrences-panel";
import { DirectorSummaryPanel } from "./director-summary-panel";
import { SchoolLogoPanel } from "./school-logo";
import { SchoolNoticesPanel } from "./school-notices-panel";
import { ClassCouncilPanel } from "./class-council-panel";
import { RiskLimitsPanel } from "./risk-limits-panel";
import { FrequencyRiskPanel } from "./frequency-risk-panel";
import { ReclassificationPanel } from "./reclassification-panel";
import { VaccinationOverduePanel } from "./vaccination-overdue-panel";
import { useActiveYear } from "@/features/academic-year/active-year";
import { loadSchoolLogo } from "./school-logo-data";

const field = "mt-1 block w-full rounded-md border border-input bg-background p-2";
const today = () => operationalToday();

export function ManagementPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [years, setYears] = useState<YearOption[]>([]);
  const [f, setF] = useState({ school: "", year: "", on: today(), knownAt: "" });
  const active = useActiveYear();
  useEffect(() => { if (active.id) setF((p) => (p.year === active.id ? p : { ...p, year: active.id })); }, [active.id]);
  const own = useOwnSchoolId();
  useEffect(() => { if (own) setF((p) => (p.school === own ? p : { ...p, school: own })); }, [own]);
  useEffect(() => {
    void supabase.from("institutional_school_record_versions").select("school_id,official_name,version_number").order("version_number", { ascending: false }).then(({ data }) => {
      const m = new Map<string, string>();
      for (const r of (data ?? []) as { school_id: string; official_name: string }[]) if (!m.has(r.school_id)) m.set(r.school_id, r.official_name);
      setSchools([...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
    });
    readYears().then(setYears).catch(() => setYears([]));
  }, []);
  const ready = f.school && f.year && f.on;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Direção" title="Gestão Escolar" description="Acompanhe os principais indicadores e a situação da sua escola." />
      <section aria-label="Contexto" className="grid gap-3 sm:grid-cols-3">
        {own ? <OwnSchoolName schoolId={own} /> : <label className="text-sm">Escola<select className={field} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })}>
          <option value="">{schools === null ? "Carregando…" : "Escolha a escola"}</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <label className="text-sm">Ano letivo<select className={field} value={f.year} onChange={(e) => { setF({ ...f, year: e.target.value }); active.setYear(e.target.value); }}>
          <option value="">Escolha o ano</option>{years.map((y) => <option key={y.id} value={y.id}>{y.label} — {yearStateLabel(y.state)}</option>)}</select></label>
        <label className="text-sm">Data de referência<DateInput value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></label>
        <MoreFilters active={!!f.knownAt}><label className="text-sm">Consultar histórico<input type="datetime-local" className={field} value={f.knownAt} onChange={(e) => setF({ ...f, knownAt: e.target.value })} /></label></MoreFilters>
      </section>
      {ready ? <Station key={JSON.stringify(f)} {...f} schoolName={schools?.find((s) => s.id === f.school)?.name ?? f.school} />
        : <EmptyState title="Informe a escola, o ano e a data" description="Faltam dados para buscar o painel. Escolha a escola, o ano letivo e a data nos campos acima para consultar as informações." />}
    </div>
  );
}

function Station({ school, year, on, knownAt, schoolName }: { school: string; year: string; on: string; knownAt: string; schoolName: string }) {
  const [res, setRes] = useState<{ blocks: Block[]; pending: Pending[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const k = knownAt ? new Date(knownAt).toISOString() : null;
  useEffect(() => {
    // NLOADING.2: resposta de contexto anterior nunca grava; troca limpa o painel antigo.
    let current = true;
    setRes(null);
    setErr(null);
    readManagementInputs(school, year, on, k)
      .then((inputs) => {
        if (current) setRes(buildPanel(inputs));
      })
      .catch((error: unknown) => {
        if (current) setErr(userErrorText(error, { operation: "gestao-escolar:load", route: "/gestao-escolar" }));
      });
    return () => { current = false; };
  }, [school, year, on, k]);
  if (err) return <StatePanel tone="neutral" title="Não foi possível buscar os dados da escola" description={err} action={<Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>} />;
  if (!res) return <SkeletonState label="Carregando painel" />;
  const exportCsv = () => {
    const r = runReport(GESTAO_ESCOLAR, { params: { school, on } }, managementRows(res.blocks));
    const meta = [`Escola: ${schoolName}`, `Data de referência: ${on}`, `Atualizado até: ${k ?? "momento da consulta"}`, "Resumo de acompanhamento da escola."];
    const blob = new Blob([toCsv(r, { headerLines: ["SIGEM"], title: GESTAO_ESCOLAR.title }, meta)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `gestao-escolar-${on}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const exportPdf = async () => {
    const r = runReport(GESTAO_ESCOLAR, { params: { school, on } }, managementRows(res.blocks));
    const meta = [`Escola: ${schoolName}`, `Data de referência: ${on}`, `Atualizado até: ${k ?? "momento da consulta"}`];
    const logo = await loadSchoolLogo(school); // ausência ou falha = sem logo, nunca a de outra escola
    openSchedulePrint(dossierPrintHtml(toPrintableHtml(r, { headerLines: ["SIGEM"], title: "Dossiê da Direção — situação da escola", logoUrl: logo?.dataUrl ?? null }, meta), res.pending));
  };
  return (
    <div className="space-y-6">
      {k && <StatePanel tone="info" title="Visão histórica" description="Você está consultando registros de uma data anterior." />}
      <DirectorSummaryPanel school={school} year={year} on={on} blocks={res.blocks} />
      <section aria-label="Visão geral da escola" className="space-y-3">
        <h2 className="text-base font-semibold">Visão geral da escola</h2>
        <div className="divide-y rounded-lg border bg-card px-4">
          {res.blocks.filter((b) => !["matriculas", "alocacoes"].includes(b.id)).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{b.title.replace(/utilizável/g, "cadastrada").replace(/alocações/g, "turmas")}</p>
                <p className="text-xs text-muted-foreground">{b.state === "UNKNOWN" ? "Aguardando preenchimento" : b.state === "UNAVAILABLE" ? "Informação indisponível para este perfil" : b.state === "BLOCKED" ? "Consulta disponível no módulo específico" : b.detail.replace(/ na fonte/g, "").replace(/alocados/g, "matriculados").replace(/utilizável/g, "cadastrada")}</p>
                {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
              </div>
              <div className="flex items-center gap-3">
                {b.value !== null && b.state !== "UNKNOWN" && <span className="text-sm font-semibold tabular-nums">{b.value}</span>}
                {b.state === "UNKNOWN" || b.state === "BLOCKED" ? <Button asChild size="sm" variant="outline"><Link to={b.link as "/secretaria"}>{b.state === "UNKNOWN" ? "Preencher" : "Consultar"}</Link></Button> : null}
              </div>
            </div>))}
        </div>
      </section>
      {res.pending.length > 0 && <section aria-label="Pendências que precisam de atenção" className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <h2 className="font-semibold">Pendências que precisam de atenção</h2>
        <ul className="space-y-3">{res.pending.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.text.replace(/fonte não lida/g, "A fonte de dados não respondeu").replace(/alocações/g, "turmas").replace(/utilizável/g, "cadastrada")}</p>
            <p className="text-xs text-muted-foreground">{p.kind === "fato-ausente" ? "Importa porque um registro necessário está incompleto e pode comprometer a conferência da situação escolar." : p.kind === "ambiguidade" ? "Importa porque há mais de uma interpretação possível e é necessária conferência antes de agir." : p.kind === "conferencia" ? "Importa porque existe uma informação aguardando conferência ou publicação." : p.kind === "bloqueio-normativo" ? "Importa porque a etapa depende de um registro ou decisão formal antes de prosseguir." : "Importa porque o painel não conseguiu confirmar esta informação; não significa que o dado seja zero."}</p></div>
          <Button asChild size="sm" variant="outline"><Link to={p.link as "/secretaria"}>{p.kind === "fonte-indisponivel" ? "Abrir módulo" : "Resolver"}</Link></Button>
        </li>)}</ul>
      </section>}
      <details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer font-semibold">Mais informações e ferramentas da Gestão Escolar</summary><div className="mt-4 space-y-5">
        <OccurrencesPanel school={school} schoolName={schoolName} />
        <SchoolNoticesPanel school={school} year={year} on={on} />
        <ClassCouncilPanel school={school} year={year} on={on} />
        <ReclassificationPanel school={school} />
        <RiskLimitsPanel school={school} />
        <FrequencyRiskPanel school={school} schoolName={schoolName} today={today()} />
        <VaccinationOverduePanel school={school} schoolName={schoolName} today={today()} />
        <SchoolLogoPanel school={school} />
        <CensusDeclaredStaff school={school} />
      </div></details>
      <ExportMenu onCsv={exportCsv} onPdf={exportPdf} label="Exportar situação" />
    </div>
  );
}
