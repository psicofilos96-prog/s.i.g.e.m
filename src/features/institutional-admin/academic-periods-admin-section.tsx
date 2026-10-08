import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDate, parseAcademicDate } from "@/lib/academic-date";

type Audit = {
  id: string; version: number; change_reason: string | null; originating_act_ref: string;
  recorded_by_person_id: string; recorded_via_engagement_id: string; created_at: string;
  valid_from: string; is_active: boolean;
};
type Year = Audit & { academic_year_id: string; official_name: string; starts_on: string; ends_on: string };
type Organization = Audit & { organization_id: string; official_name: string };
type Period = Audit & { period_id: string; official_name: string; starts_on: string; ends_on: string };
type OrganizationIdentity = { id: string; academic_year_id: string };
type PeriodIdentity = { id: string; academic_year_id: string; period_organization_id: string };
type Data = { years: Year[]; organizations: Organization[]; organizationIds: OrganizationIdentity[]; periods: Period[]; periodIds: PeriodIdentity[] };
const EMPTY: Data = { years: [], organizations: [], organizationIds: [], periods: [], periodIds: [] };
const dateValue = (v: FormDataEntryValue | null) => {
  const text = String(v ?? "").trim();
  return text ? parseAcademicDate(text) ?? text : "";
};
const chain = <T extends Audit>(rows: T[], key: (row: T) => string) => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
};
const current = <T extends Audit>(rows: T[]) => [...rows].sort((a, b) => b.version - a.version)[0];
const status = (active: boolean) => <Badge variant={active ? "secondary" : "outline"}>{active ? "Ativo" : "Inativo"}</Badge>;
const humanError = (message: string) => {
  if (message.includes("capability:manter-anos-e-periodos-letivos")) return "Sua atuação vigente não concede a manutenção de anos e períodos com alcance de rede.";
  if (message.includes("base-superseded")) return "Uma versão posterior já existe. Recarregue e confira o histórico antes de tentar novamente.";
  if (message.includes("period:overlap")) return "Há sobreposição com outro período ativo desta organização.";
  if (message.includes("period:outside-year") || message.includes("year:period-outside-bounds")) return "O período precisa permanecer dentro dos limites do ano letivo.";
  if (message.includes("invalid-dates")) return "Confira as datas: o início não pode ser posterior ao término.";
  if (message.includes("active-periods")) return "Há períodos ativos vinculados; não é possível inativar este cadastro.";
  if (message.includes("year-unavailable")) return "Ano letivo oficial ativo não encontrado.";
  if (message.includes("organization-unavailable")) return "Organização de períodos ativa não encontrada.";
  if (message.includes("reason-required")) return "Informe o motivo da correção.";
  if (message.includes("act-required")) return "Informe a referência do ato.";
  if (message.includes("no-change")) return "Nenhum dado mudou; não foi criada outra versão.";
  return "Registro recusado. Confira os dados e a versão vigente; nada foi gravado.";
};

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="grid gap-1"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
function AuditHistory({ rows }: { rows: Audit[] }) {
  return <ol className="mt-2 grid gap-1 text-xs text-muted-foreground">
    {[...rows].sort((a, b) => b.version - a.version).map((row) =>
      <li key={row.id}>
        v{row.version} · {row.is_active ? "ativo" : "inativo"} · vigência {formatAcademicDate(row.valid_from)}
        {row.change_reason ? ` · motivo: ${row.change_reason}` : ""} · ato {row.originating_act_ref}
        {` · registrado em ${new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
        {` · pessoa ${row.recorded_by_person_id} · atuação ${row.recorded_via_engagement_id}`}
      </li>,
    )}
  </ol>;
}
function CommonFields({ prefix, row }: { prefix: string; row: Audit | undefined }) {
  return <>
    <Field id={`${prefix}-active`} label="Situação">
      <select id={`${prefix}-active`} name="active" defaultValue={row?.is_active === false ? "nao" : "sim"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        <option value="sim">Ativo</option><option value="nao">Inativo</option>
      </select>
    </Field>
    <Field id={`${prefix}-valid`} label="Início da vigência da versão">
      <DateInput id={`${prefix}-valid`} name="valid" defaultValue={row?.valid_from ?? ""} required />
    </Field>
    <Field id={`${prefix}-act`} label="Ato originador">
      <Input id={`${prefix}-act`} name="act" required />
    </Field>
    {row && <Field id={`${prefix}-reason`} label="Motivo da nova versão">
      <Input id={`${prefix}-reason`} name="reason" required />
    </Field>}
  </>;
}
function YearForm({ base, onSubmit }: { base?: Year; onSubmit: (event: FormEvent<HTMLFormElement>, base?: Year) => void }) {
  const prefix = `year-${base?.id ?? "new"}`;
  return <form onSubmit={(event) => onSubmit(event, base)} className="grid gap-3 sm:grid-cols-2">
    <Field id={`${prefix}-name`} label="Nome institucional do ano letivo"><Input id={`${prefix}-name`} name="name" defaultValue={base?.official_name} required /></Field>
    <Field id={`${prefix}-start`} label="Início do ano letivo"><DateInput id={`${prefix}-start`} name="start" defaultValue={base?.starts_on ?? ""} required /></Field>
    <Field id={`${prefix}-end`} label="Término do ano letivo"><DateInput id={`${prefix}-end`} name="end" defaultValue={base?.ends_on ?? ""} required /></Field>
    <CommonFields prefix={prefix} row={base} />
    <div className="sm:col-span-2"><Button type="submit">{base ? "Registrar nova versão do ano" : "Cadastrar ano letivo"}</Button></div>
  </form>;
}
function OrganizationForm({ yearId, base, onSubmit }: { yearId: string; base?: Organization; onSubmit: (event: FormEvent<HTMLFormElement>, yearId: string, base?: Organization) => void }) {
  const prefix = `org-${base?.id ?? yearId}`;
  return <form onSubmit={(event) => onSubmit(event, yearId, base)} className="grid gap-3 sm:grid-cols-2">
    <Field id={`${prefix}-name`} label="Nome da organização de períodos"><Input id={`${prefix}-name`} name="name" defaultValue={base?.official_name} required /></Field>
    <CommonFields prefix={prefix} row={base} />
    <div className="sm:col-span-2"><Button type="submit">{base ? "Registrar nova versão da organização" : "Cadastrar organização de períodos"}</Button></div>
  </form>;
}
function PeriodForm({ organizationId, base, onSubmit }: { organizationId: string; base?: Period; onSubmit: (event: FormEvent<HTMLFormElement>, organizationId: string, base?: Period) => void }) {
  const prefix = `period-${base?.id ?? organizationId}`;
  return <form onSubmit={(event) => onSubmit(event, organizationId, base)} className="grid gap-3 sm:grid-cols-2">
    <Field id={`${prefix}-name`} label="Nome institucional do período"><Input id={`${prefix}-name`} name="name" defaultValue={base?.official_name} required /></Field>
    <Field id={`${prefix}-start`} label="Início do período"><DateInput id={`${prefix}-start`} name="start" defaultValue={base?.starts_on ?? ""} required /></Field>
    <Field id={`${prefix}-end`} label="Término do período"><DateInput id={`${prefix}-end`} name="end" defaultValue={base?.ends_on ?? ""} required /></Field>
    <CommonFields prefix={prefix} row={base} />
    <div className="sm:col-span-2"><Button type="submit">{base ? "Registrar nova versão do período" : "Cadastrar período"}</Button></div>
  </form>;
}

/** B2.4: consulta institucional e atos de manutenção. Nenhuma fixture é lida. */
export function AcademicPeriodsAdminSection({ canMaintain }: { canMaintain: boolean }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [yv, oi, ov, pi, pv] = await Promise.all([
      supabase.from("institutional_academic_year_versions").select("*").order("version"),
      supabase.from("institutional_period_organizations").select("id, academic_year_id"),
      supabase.from("institutional_period_organization_versions").select("*").order("version"),
      supabase.from("institutional_academic_periods").select("id, academic_year_id, period_organization_id"),
      supabase.from("institutional_academic_period_versions").select("*").order("version"),
    ]);
    const failure = yv.error ?? oi.error ?? ov.error ?? pi.error ?? pv.error;
    setReady(true);
    if (failure) { setLoadError("Não foi possível consultar os cadastros oficiais de anos e períodos letivos."); return; }
    setLoadError(null);
    setData({ years: (yv.data ?? []) as Year[], organizationIds: (oi.data ?? []) as OrganizationIdentity[],
      organizations: (ov.data ?? []) as Organization[], periodIds: (pi.data ?? []) as PeriodIdentity[], periods: (pv.data ?? []) as Period[] });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const years = useMemo(() => chain(data.years, (row) => row.academic_year_id), [data.years]);
  const organizations = useMemo(() => chain(data.organizations, (row) => row.organization_id), [data.organizations]);
  const periods = useMemo(() => chain(data.periods, (row) => row.period_id), [data.periods]);
  const shown = [...years.entries()].filter(([, rows]) => rows.some((row) => row.official_name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))));

  async function saveYear(event: FormEvent<HTMLFormElement>, base?: Year) {
    event.preventDefault(); const form = event.currentTarget; const f = new FormData(form);
    const { error: issue } = await supabase.rpc("register_academic_year_version", {
      _year: (base?.academic_year_id ?? null) as string, _base_version_id: (base?.id ?? null) as string,
      _official_name: String(f.get("name")), _starts_on: dateValue(f.get("start")), _ends_on: dateValue(f.get("end")),
      _is_active: f.get("active") === "sim", _valid_from: dateValue(f.get("valid")),
      _reason: String(f.get("reason") ?? ""), _act_ref: String(f.get("act")),
    });
    if (issue) return setError(humanError(issue.message));
    setError(null); form.reset(); await load();
  }
  async function saveOrganization(event: FormEvent<HTMLFormElement>, yearId: string, base?: Organization) {
    event.preventDefault(); const form = event.currentTarget; const f = new FormData(form);
    const { error: issue } = await supabase.rpc("register_period_organization_version", {
      _organization: (base?.organization_id ?? null) as string, _year: yearId, _base_version_id: (base?.id ?? null) as string,
      _official_name: String(f.get("name")), _is_active: f.get("active") === "sim",
      _valid_from: dateValue(f.get("valid")), _reason: String(f.get("reason") ?? ""), _act_ref: String(f.get("act")),
    });
    if (issue) return setError(humanError(issue.message));
    setError(null); form.reset(); await load();
  }
  async function savePeriod(event: FormEvent<HTMLFormElement>, organizationId: string, base?: Period) {
    event.preventDefault(); const form = event.currentTarget; const f = new FormData(form);
    const { error: issue } = await supabase.rpc("register_academic_period_version", {
      _period: (base?.period_id ?? null) as string, _organization: organizationId, _base_version_id: (base?.id ?? null) as string,
      _official_name: String(f.get("name")), _starts_on: dateValue(f.get("start")), _ends_on: dateValue(f.get("end")),
      _is_active: f.get("active") === "sim", _valid_from: dateValue(f.get("valid")),
      _reason: String(f.get("reason") ?? ""), _act_ref: String(f.get("act")),
    });
    if (issue) return setError(humanError(issue.message));
    setError(null); form.reset(); await load();
  }

  return <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
    <h2 className="mb-1 font-display text-lg font-semibold text-foreground">Anos e períodos letivos</h2>
    <p className="mb-3 text-sm text-muted-foreground">Ano letivo → organização de períodos → períodos oficiais. Os nomes e as datas são dados da rede; toda correção preserva a versão anterior.</p>
    <p className="mb-3 text-sm text-muted-foreground">A associação histórica da turma à organização pertence à etapa da Turma. Enquanto ela não existir, Pauta, Mesa e Fechamento não presumem períodos. O Calendário será integrado na B4.</p>
    {!ready && <SkeletonState label="Carregando cadastros oficiais" />}
    {(loadError || error) && <p className="mb-3 text-sm text-destructive" role="alert">{loadError || error}</p>}
    {ready && !loadError && <>
      <Input className="mb-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Localizar ano letivo pelo nome" aria-label="Localizar ano letivo" />
      {shown.length === 0 && <p className="mb-4 text-sm text-muted-foreground">{data.years.length ? "Nenhum ano letivo corresponde à busca." : "Nenhum ano letivo institucional cadastrado."}</p>}
      <div className="mb-5 grid gap-3">
        {shown.map(([yearId, versions]) => {
          const year = current(versions)!;
          const orgs = data.organizationIds.filter((item) => item.academic_year_id === yearId);
          return <div key={yearId} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><strong>{year.official_name}</strong> · {formatAcademicDate(year.starts_on)} a {formatAcademicDate(year.ends_on)} · código {yearId}</div>
              <div className="flex gap-2">{status(year.is_active)}<Button type="button" size="sm" variant="outline" onClick={() => setExpanded(expanded === yearId ? null : yearId)}>{expanded === yearId ? "Fechar" : "Histórico e períodos"}</Button></div>
            </div>
            {expanded === yearId && <div className="mt-3 grid gap-4">
              <div><strong>Histórico do ano</strong><AuditHistory rows={versions} /></div>
              {canMaintain && <YearForm base={year} onSubmit={saveYear} />}
              <div><strong>Organizações de períodos</strong>{orgs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma organização cadastrada neste ano.</p>}</div>
              {orgs.map(({ id: orgId }) => {
                const orgVersions = organizations.get(orgId) ?? [];
                const org = current(orgVersions);
                if (!org) return <p key={orgId} className="text-sm text-destructive">Organização {orgId} sem versão institucional.</p>;
                const ids = data.periodIds.filter((row) => row.period_organization_id === orgId);
                return <div key={orgId} className="ml-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2"><strong>{org.official_name}</strong>{status(org.is_active)}<span className="text-xs text-muted-foreground">código {orgId}</span></div>
                  <AuditHistory rows={orgVersions} />
                  {canMaintain && <div className="mt-3"><OrganizationForm yearId={yearId} base={org} onSubmit={saveOrganization} /></div>}
                  <div className="mt-4"><strong>Períodos</strong>{ids.length === 0 && <p className="text-sm text-muted-foreground">Nenhum período cadastrado nesta organização.</p>}</div>
                  {ids.map(({ id: periodId }) => {
                    const periodVersions = periods.get(periodId) ?? [];
                    const period = current(periodVersions);
                    if (!period) return <p key={periodId} className="text-sm text-destructive">Período {periodId} sem versão institucional.</p>;
                    return <div key={periodId} className="mt-3 rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2"><span>{period.official_name} · {formatAcademicDate(period.starts_on)} a {formatAcademicDate(period.ends_on)}</span>{status(period.is_active)}<span className="text-xs text-muted-foreground">código {periodId}</span></div>
                      <AuditHistory rows={periodVersions} />
                      {canMaintain && <div className="mt-3"><PeriodForm organizationId={orgId} base={period} onSubmit={savePeriod} /></div>}
                    </div>;
                  })}
                  {canMaintain && <div className="mt-4"><PeriodForm organizationId={orgId} onSubmit={savePeriod} /></div>}
                </div>;
              })}
              {canMaintain && <OrganizationForm yearId={yearId} onSubmit={saveOrganization} />}
            </div>}
          </div>;
        })}
      </div>
      {canMaintain && <div className="border-t border-border pt-4"><h3 className="mb-3 font-medium">Novo ano letivo</h3><YearForm onSubmit={saveYear} /></div>}
    </>}
  </section>;
}
