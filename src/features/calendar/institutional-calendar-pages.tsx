import { PageHeader } from "@/components/sigem/patterns";
/**
 * B4.6.7 — Consulta institucional positiva do calendário (lista + detalhe com grade mensal e totais por período B2.4).
 *
 * - Fonte única: leitores autorizados (`calendar_list_at`, `calendar_at`, `calendar_days_at`) por parsers estritos.
 * - Chaves de cache: `userId#sessionRevision` + snapshot (UM knownAt por carga); dado de outra chave nunca aparece.
 * - IDs técnicos só no bloco "Auditoria"; a operação mostra rótulos humanos (ano letivo, período, tipo de dia).
 * - Totais só quando TODOS os dias do período têm efeito determinado; senão "não calculável" com motivo, nunca zero.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DateInput } from "@/components/sigem/date-input";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { InstitutionalCalendarManagement } from "./institutional-calendar-management";
import { CalendarAccessPanel } from "./calendar-access-panel";
import { calendarErrorMessage, captureCalendarKnownAt, isIsoDate, readCalendarAt, type CalendarAtState } from "./institutional-calendar-source";
import {
  CalendarReaderShapeError, countSchoolDaysStrict, dayEffectFromRows, readCalendarDays, readCalendarList,
  type CalendarDayEffect, type CalendarDayRead, type CalendarVersionSummary,
} from "./institutional-calendar-readers";

const today = () => new Date().toISOString().slice(0, 10);
export const readerErrorText = (e: unknown) =>
  e instanceof CalendarReaderShapeError ? "A resposta do calendário veio em formato inesperado. Nada foi exibido." : calendarErrorMessage(e);

const STATE_TEXT: Record<CalendarAtState, string> = {
  "access-denied": "Nenhum calendário homologado disponível nesta data para a sua conta.",
  homologada: "Homologado na data consultada.",
  "nao-homologada": "Em construção — ainda não homologado (visível apenas para quem constrói).",
  revogada: "Homologação revogada na data consultada.",
  "sem-versao-vigente": "Sem versão vigente na data consultada.",
  "cadeia-invalida": "Registro de homologação inconsistente — nada é considerado oficial.",
};
export const EFFECT_TEXT: Record<CalendarDayEffect["kind"], string> = {
  letivo: "Letivo", "nao-letivo": "Não letivo", conflito: "Declarações em conflito", "efeito-nao-declarado": "Efeito não declarado",
  "nao-declarado": "Sem declaração", indeterminado: "Indeterminado",
};

type Labels = { years: Map<string, string>; periods: { id: string; organizationId: string; name: string; startsOn: string; endsOn: string }[] };

/** Rótulos humanos B2.4 conhecidos em knownAt (última versão registrada até o instante). */
async function readB24Labels(knownAt: string, validOn: string): Promise<Labels> {
  const [y, p, pv] = await Promise.all([
    supabase.from("institutional_academic_year_versions").select("academic_year_id, version, official_name, created_at").lte("created_at", knownAt),
    supabase.from("institutional_academic_periods").select("id, period_organization_id"),
    supabase.from("institutional_academic_period_versions").select("period_id, version, official_name, starts_on, ends_on, is_active, valid_from, created_at").lte("created_at", knownAt),
  ]);
  for (const r of [y, p, pv]) if (r.error) throw r.error;
  const years = new Map<string, { v: number; name: string }>();
  for (const r of y.data ?? []) { const c = years.get(r.academic_year_id); if (!c || r.version > c.v) years.set(r.academic_year_id, { v: r.version, name: r.official_name }); }
  const latest = new Map<string, NonNullable<typeof pv.data>[number]>();
  for (const r of pv.data ?? []) if (r.valid_from <= validOn) { const c = latest.get(r.period_id); if (!c || r.version > c.version) latest.set(r.period_id, r); }
  const periods = (p.data ?? []).flatMap((x) => {
    const v = latest.get(x.id); if (!v || !v.is_active || !x.period_organization_id) return [];
    return [{ id: x.id, organizationId: x.period_organization_id, name: v.official_name, startsOn: v.starts_on, endsOn: v.ends_on }];
  }).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return { years: new Map([...years].map(([k, v]) => [k, v.name])), periods };
}

const calendarTitle = (v: CalendarVersionSummary, years: Map<string, string>) =>
  `Calendário do ano letivo ${years.get(v.academicYearId) ?? "(ano letivo sem nome registrado)"} — versão ${v.version}`;

export function InstitutionalCalendarListView({ contextKey }: { contextKey: string }) {
  const [validOn, setValidOn] = useState(today());
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey, validOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({
    queryKey: ["b467-calendar-list", contextKey, validOn, knownAt], retry: false,
    queryFn: async () => ({ list: await readCalendarList({ knownAt }), labels: await readB24Labels(knownAt, validOn), knownAt }),
  });
  const fresh = q.data?.knownAt === knownAt ? q.data : undefined;
  const authority = useSessionAuthority();
  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Calendários escolares" description="Calendários homologados e, para a Supervisão, construção e homologação." />
      <CalendarAccessPanel contextKey={contextKey} />
      {authority.status === "loading" && <p role="status" className="text-sm text-muted-foreground">Verificando as capacidades da sua atuação…</p>}
      {authority.status === "signed-in" && (
        <InstitutionalCalendarManagement contextKey={contextKey} capabilities={authority.capabilities.filter((c) => c.schoolId === null).map((c) => c.capabilityId)} />
      )}
      <DateField value={validOn} onChange={setValidOn} />
      {q.isFetching && !fresh && !q.error && <p role="status" className="text-sm text-muted-foreground">Consultando os calendários…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{readerErrorText(q.error)}</p>}
      {fresh && !q.error && fresh.list.kind !== "lido" && (
        <p role="note" className="rounded border border-border bg-muted p-3 text-sm">Consulta indisponível para a sua conta.</p>
      )}
      {fresh && !q.error && fresh.list.kind === "lido" && (
        fresh.list.versions.length === 0 ? (
          <p role="note" className="rounded border border-border bg-muted p-3 text-sm">
            {fresh.list.audience === "construcao" ? "Nenhum calendário registrado até agora." : "Nenhum calendário homologado até agora."}
          </p>
        ) : (
          <ul className="space-y-2">
            {fresh.list.versions.map((v) => (
              <li key={v.versionId} className="rounded border border-border p-3">
                <Link to="/calendario-escolar/$calendarioId" params={{ calendarioId: v.calendarId }} className="font-medium underline">
                  {calendarTitle(v, fresh.labels.years)}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Vigência {v.validFrom}{v.validTo ? ` a ${v.validTo}` : " sem término"} ·{" "}
                  {v.lastHomologation ? (v.lastHomologation.decision === "homologada" ? `homologada a partir de ${v.lastHomologation.effectiveFrom}` : `revogada a partir de ${v.lastHomologation.effectiveFrom}`) : "em construção"}
                </p>
                <AuditBlock rows={[["Calendário", v.calendarId], ["Versão", v.versionId], ["Ato", v.actId], ["Registrada em", v.recordedAt]]} />
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

const monthRange = (iso: string) => {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${iso.slice(0, 7)}-01`, to: `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}` };
};

export function InstitutionalCalendarDetailView({ contextKey, calendarId }: { contextKey: string; calendarId: string }) {
  const [validOn, setValidOn] = useState(today());
  const knownAt = useMemo(() => captureCalendarKnownAt(), [contextKey, calendarId, validOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const { from, to } = monthRange(validOn);
  const q = useQuery({
    queryKey: ["b467-calendar-detail", contextKey, calendarId, validOn, knownAt], retry: false,
    queryFn: async () => {
      const at = await readCalendarAt({ calendarId, validOn, knownAt });
      if (at.kind === "access-denied") return { at, knownAt, month: null, list: null, labels: null };
      const [month, list, labels] = await Promise.all([
        readCalendarDays({ calendarId, from, to, knownAt }), readCalendarList({ knownAt }), readB24Labels(knownAt, validOn),
      ]);
      return { at, knownAt, month, list, labels };
    },
  });
  const fresh = q.data?.knownAt === knownAt ? q.data : undefined;
  const version = fresh?.list?.kind === "lido"
    ? [...fresh.list.versions].filter((v) => v.calendarId === calendarId && v.validFrom <= validOn && (!v.validTo || v.validTo >= validOn)).sort((a, b) => b.version - a.version)[0]
    : undefined;
  return (
    <div className="space-y-4 p-4">
      <PageHeader title={version && fresh?.labels ? calendarTitle(version, fresh.labels.years) : "Calendário escolar"} />
      <DateField value={validOn} onChange={setValidOn} />
      {q.isFetching && !fresh && !q.error && <p role="status" className="text-sm text-muted-foreground">Consultando o calendário…</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{readerErrorText(q.error)}</p>}
      {fresh && !q.error && (
        <>
          <p role="note" className="rounded border border-border bg-muted p-3 text-sm">{STATE_TEXT[fresh.at.kind]}</p>
          {fresh.month?.kind === "lido" && <MonthGrid days={fresh.month.days} />}
          {fresh.month && fresh.month.kind !== "lido" && <p className="text-sm text-muted-foreground">Dias do mês indisponíveis para a sua conta.</p>}
          {version && fresh.labels && (
            <PeriodTotals contextKey={contextKey} calendarId={calendarId} knownAt={knownAt}
              periods={fresh.labels.periods.filter((p) => p.organizationId === version.periodOrganizationId)} />
          )}
          {version && <AuditBlock rows={[["Calendário", calendarId], ["Versão", version.versionId], ["Ato", version.actId], ["Instante da consulta", knownAt]]} />}
        </>
      )}
    </div>
  );
}

function MonthGrid({ days }: { days: readonly CalendarDayRead[] }) {
  return (
    <table className="w-full text-sm" aria-label="Dias do mês">
      <thead><tr className="text-left"><th>Data</th><th>Efeito</th><th>Declarações</th></tr></thead>
      <tbody>
        {days.map((d) => {
          const e = dayEffectFromRows(d);
          const labels = (d.rows ?? []).filter((r) => r.declarationId).map((r) => r.eventLabel ?? r.dayTypeLabel ?? "Declaração sem rótulo");
          return (
            <tr key={d.on} className="border-t border-border">
              <td>{d.on}</td><td>{EFFECT_TEXT[e.kind]}</td><td>{labels.join(" · ") || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PeriodTotals({ contextKey, calendarId, knownAt, periods }: { contextKey: string; calendarId: string; knownAt: string; periods: Labels["periods"] }) {
  const q = useQuery({
    queryKey: ["b467-calendar-periods", contextKey, calendarId, knownAt, periods.map((p) => `${p.id}:${p.startsOn}:${p.endsOn}`).join("|")], retry: false,
    queryFn: () => Promise.all(periods.map(async (p) => ({ p, r: await readCalendarDays({ calendarId, from: p.startsOn, to: p.endsOn, knownAt }) }))),
  });
  if (periods.length === 0) return <p className="text-sm text-muted-foreground">A organização de períodos deste calendário não tem períodos ativos registrados; totais por período não são calculáveis.</p>;
  if (q.error) return <p role="alert" className="text-sm text-destructive">{readerErrorText(q.error)}</p>;
  if (!q.data) return <p role="status" className="text-sm text-muted-foreground">Calculando totais por período…</p>;
  return (
    <section aria-label="Totais por período" className="space-y-1">
      <h2 className="font-medium">Totais por período</h2>
      <ul className="text-sm">
        {q.data.map(({ p, r }) => {
          if (r.kind !== "lido") return <li key={p.id}>{p.name}: não calculável — leitura indisponível.</li>;
          const c = countSchoolDaysStrict(r.days);
          return <li key={p.id}>{p.name} ({p.startsOn} a {p.endsOn}): {c.count === null ? `não calculável — ${c.reason}` : `${c.count} dias letivos, ${c.nonSchool} não letivos`}</li>;
        })}
      </ul>
    </section>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label htmlFor="b467-date" className="text-sm font-medium">Data de referência</label>
      <DateInput id="b467-date" value={value} onChange={(e) => isIsoDate(e.target.value) && onChange(e.target.value)} />
    </div>
  );
}

function AuditBlock({ rows }: { rows: [string, string][] }) {
  return (
    <details className="mt-1 text-xs text-muted-foreground">
      <summary>Auditoria</summary>
      <dl>{rows.map(([k, v]) => <div key={k}><dt className="inline">{k}: </dt><dd className="inline font-mono">{v}</dd></div>)}</dl>
    </details>
  );
}
