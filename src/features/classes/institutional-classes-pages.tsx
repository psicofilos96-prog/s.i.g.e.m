import { StatusBadge } from "@/components/sigem/patterns";
import { RegistryHero, RegistryToolbar, RegistryList, RegistryCard, CardFact, RegistryEmpty, registryTh, registryTd, registryRow } from "@/components/sigem/registry-layout";
import { presentState } from "@/config/state-presentation";
import { ListPager } from "@/components/sigem/list-pager";
import { LIST_PAGE_SIZE, ListTimeoutError, useServerPage } from "@/lib/server-page";
import { ilikeTerm } from "@/features/students/institutional-lists";
import { useDebounced } from "@/features/global-search/global-search";
/**
 * B2.5.4 — Administração institucional de Turmas (sessão real).
 * Só lê pela fonte institucional e só grava pelos escritores do banco.
 * Nenhum dado demonstrativo é consultado aqui, nem por colisão de ID.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, History, Building2, CalendarRange, Layers } from "lucide-react";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { formatAcademicDate, civilDateOf } from "@/lib/academic-date";
import {
  CLASS_PERIOD_ORGANIZATION_CAPABILITY, CLASS_REGISTRY_CAPABILITY,
  type ClassPeriodOrganizationLinkVersion, type InstitutionalClassRecordVersion,
} from "./institutional-class-contract";
import {
  academicYears, canMaintainPeriodLink, canMaintainRegistry, classLinkHistory, classRecordHistory,
  getInstitutionalClass, humanClassError, listInstitutionalClassesPage, organizationsForYear,
  recordClassVersion, recordPeriodLink, registerClass, schoolNames, schoolsWithCapability, todayIso,
  type ClassOperation, type InstitutionalClassSummary, type LinkOperation,
} from "./institutional-class-source";
import { TeachingAssignmentPanel } from "./teaching-assignment-panel";
import { OfferingPanel, ShiftPanel } from "./class-offering-shift-panels";
import { canMaintainOffering, canMaintainShift } from "./class-offering-shift-source";
import { CensusClassBondsPanel } from "@/features/student-life/census-class-bonds";
import { CapacityPanel, CompositionPanel } from "./class-composition-panel";
import { CompositionBreakdownTable, JourneyPanel } from "./class-composition-views";

const fmt = (d: string | null | undefined) => (d ? formatAcademicDate(d) : "sem término");
/** Início ausente = não informado pela fonte; nunca "sem término" nem data de snapshot. */
const fmtStart = (d: string | null | undefined) => (d ? formatAcademicDate(d) : "início não informado");
const Missing = ({ children }: { children: ReactNode }) => (
  <span className="text-sm italic text-muted-foreground">{children}</span>
);
const errText = (e: unknown) => humanClassError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

function useCaps() {
  const a = useSessionAuthority();
  return a.status === "signed-in" ? a.capabilities : [];
}

function Section({ title, icon, children, actions }: { title: string; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

function Field({ label, name, defaultValue, type = "text", required, placeholder }: { label: string; name: string; defaultValue?: string | undefined; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={`f-${name}`} className="text-xs">{label}</Label>
      <Input id={`f-${name}`} name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} />
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? <p role="alert" className="text-sm text-destructive">{text}</p> : null;
}

// ───────── Listagem ─────────
export function InstitutionalClassesListPage() {
  const caps = useCaps();
  const validOn = todayIso();
  const [query, setQueryRaw] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const term = ilikeTerm(useDebounced(query, 300));
  const setQuery = (v: string) => { setQueryRaw(v); setPageNo(1); };
  const canCreate = schoolsWithCapability(caps, CLASS_REGISTRY_CAPABILITY).length > 0;
  // PERF.LOADING.2: página lida no servidor (50 por vez), com tempo-limite e nova tentativa manual.
  const q = useServerPage<InstitutionalClassSummary>(["inst-classes", validOn, term], pageNo, ({ from, to, signal }) => listInstitutionalClassesPage({ validOn, from, to, term, signal }));
  const total = q.data?.total ?? null;
  const pg = { items: q.data?.items ?? [], page: pageNo, pageCount: Math.max(1, Math.ceil((total ?? 0) / LIST_PAGE_SIZE)), total: total ?? 0,
    from: q.data?.items.length ? (pageNo - 1) * LIST_PAGE_SIZE + 1 : 0, to: (pageNo - 1) * LIST_PAGE_SIZE + (q.data?.items.length ?? 0), truncated: false };
  const rows = pg.items;
  return (
    <div className="grid gap-6">
      <RegistryHero
        eyebrow="Rede Municipal de Itaperuna · Organização escolar"
        title="Turmas"
        lede={`Cadastro institucional vigente em ${formatAcademicDate(validOn)}. Abra uma turma para ver composição, turno e organização de períodos.`}
        count={total != null ? <>{total.toLocaleString("pt-BR")}<span className="ml-2 align-middle text-sm font-normal text-muted-foreground">turmas no seu escopo</span></> : undefined}
        actions={canCreate ? (
          <Button asChild><Link to="/turmas/nova"><Plus className="size-4" />Nova turma</Link></Button>
        ) : undefined}
      />
      <RegistryToolbar summary={q.data && rows.length > 0 ? <ListPager r={pg} onPage={setPageNo} noun="turmas" /> : undefined}>
        <div className="grid min-w-0 flex-1 gap-1 sm:max-w-sm">
          <Label htmlFor="classes-search">Pesquisar turmas</Label>
          <Input id="classes-search" aria-label="Pesquisar turmas" placeholder="Nome da turma" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9" />
        </div>
      </RegistryToolbar>
      {q.isPending ? <SkeletonState label="Carregando turmas" /> : null}
      {q.isError ? (
        <RegistryEmpty
          title={q.error instanceof ListTimeoutError ? "A lista de turmas demorou demais para responder" : "Não foi possível consultar as turmas"}
          description="Nenhum dado substituto é exibido. Tente de novo em instantes."
          action={<Button size="sm" variant="outline" onClick={() => void q.refetch()}>Tentar novamente</Button>}
        />
      ) : null}
      {q.data && rows.length === 0 ? (
        <RegistryEmpty
          title={term ? "Nenhuma turma corresponde à pesquisa" : "Nenhuma turma no seu escopo"}
          description={term ? "Confira a grafia ou pesquise só parte do nome." : "Ainda não há turma institucional registrada nas escolas do seu acesso."}
          action={canCreate && !term ? <Button asChild size="sm"><Link to="/turmas/nova"><Plus className="size-4" />Nova turma</Link></Button> : undefined}
        />
      ) : null}
      {rows.length > 0 ? (
        <RegistryList
          label="Turmas institucionais"
          table={
            <table className="w-full text-sm" aria-busy={q.isFetching}>
              <caption className="sr-only">Turmas institucionais</caption>
              <thead><tr>{["Turma", "Ano letivo", "Escola", "Situação", "Organização de períodos"].map((h) => <th key={h} scope="col" className={registryTh}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => <ClassRow key={r.classId} r={r} />)}</tbody>
            </table>
          }
          cards={rows.map((r) => (
            <RegistryCard key={r.classId} title={<Link to="/turmas/$id" params={{ id: r.classId }} className="text-foreground hover:text-primary hover:underline"><RecordName r={r} /></Link>}>
              <CardFact label="Escola">{r.schoolName ?? <Missing>Não registrada</Missing>}</CardFact>
              <CardFact label="Ano letivo">{r.academicYearName ?? <Missing>Não registrado</Missing>}</CardFact>
              <CardFact label="Situação"><StatusCell r={r} /></CardFact>
              <CardFact label="Períodos"><LinkCell r={r} /></CardFact>
            </RegistryCard>
          ))}
        />
      ) : null}
    </div>
  );
}

function RecordName({ r }: { r: InstitutionalClassSummary }) {
  if (r.record.kind === "one") return <>{r.record.value.name}{r.record.value.code ? <span className="ml-1 text-xs text-muted-foreground">({r.record.value.code})</span> : null}</>;
  return <Missing>{r.record.kind === "ambiguous" ? "Cadastro inconsistente na data" : "Sem cadastro vigente na data"}</Missing>;
}
function StatusCell({ r }: { r: InstitutionalClassSummary }) {
  if (r.record.kind !== "one") return <Missing>—</Missing>;
  const s = presentState("turma", r.record.value.administrativeStatus); return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}
function LinkCell({ r }: { r: InstitutionalClassSummary }) {
  if (r.link.kind === "one") return <>{r.link.organizationName ?? <Missing>Organização sem nome registrado</Missing>}</>;
  return <Missing>{r.link.kind === "ambiguous" ? "Vínculo inconsistente na data" : "Ainda não registrada"}</Missing>;
}
function ClassRow({ r }: { r: InstitutionalClassSummary }) {
  return (
    <tr className={registryRow}>
      <td className={`${registryTd} font-medium`}><Link to="/turmas/$id" params={{ id: r.classId }} className="text-foreground hover:text-primary hover:underline"><RecordName r={r} /></Link></td>
      <td className={registryTd}>{r.academicYearName ?? <Missing>Não registrado</Missing>}</td>
      <td className={registryTd}>{r.schoolName ?? <Missing>Não registrada</Missing>}</td>
      <td className={registryTd}><StatusCell r={r} /></td>
      <td className={registryTd}><LinkCell r={r} /></td>
    </tr>
  );
}

// ───────── Criação ─────────
export function InstitutionalClassCreatePage() {
  const caps = useCaps();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const schoolIds = schoolsWithCapability(caps, CLASS_REGISTRY_CAPABILITY);
  const names = useQuery({ queryKey: ["inst-school-names", schoolIds], queryFn: () => schoolNames(schoolIds), enabled: schoolIds.length > 0 });
  const years = useQuery({ queryKey: ["inst-years"], queryFn: academicYears });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (schoolIds.length === 0)
    return (
      <div className="grid gap-4">
        <OperationalPageHeader title="Nova turma" description="Cadastro institucional." parent={{ label: "Turmas", to: "/turmas" }} />
        <p role="alert" className="text-sm text-muted-foreground">Sua atuação vigente não concede o cadastro de turmas em nenhuma escola.</p>
      </div>
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      const id = await registerClass({
        schoolId: String(f.get("school")), academicYearId: String(f.get("year")), code: String(f.get("code") ?? ""),
        name: String(f.get("name")), validFrom: String(f.get("from")), validUntil: String(f.get("until") || "") || null,
        actRef: String(f.get("act")),
      });
      await qc.invalidateQueries({ queryKey: ["inst-classes"] });
      navigate({ to: "/turmas/$id", params: { id } });
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-4">
      <OperationalPageHeader title="Nova turma" description="Escola e ano letivo formam a identidade da turma e não poderão ser alterados depois." parent={{ label: "Turmas", to: "/turmas" }} />
      <form onSubmit={submit} className="grid max-w-2xl gap-3 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-1">
          <Label htmlFor="f-school" className="text-xs">Escola (somente do seu escopo)</Label>
          <select id="f-school" name="school" required className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {schoolIds.map((s) => <option key={s} value={s}>{names.data?.get(s) ?? "Escola sem nome registrado"}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="f-year" className="text-xs">Ano letivo</Label>
          <select id="f-year" name="year" required className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name ?? "Ano sem nome registrado"}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" name="name" required />
          <Field label="Código (opcional)" name="code" />
          <Field label="Vigência — início" name="from" type="date" required />
          <Field label="Vigência — término (opcional)" name="until" type="date" />
        </div>
        <Field label="Referência documental/fonte (opcional)" name="act" />
        <ErrorLine text={error} />
        <div><Button type="submit" disabled={busy}>Registrar turma</Button></div>
      </form>
    </div>
  );
}

// ───────── Detalhe ─────────
function useClass(id: string) {
  const validOn = todayIso();
  return useQuery({ queryKey: ["inst-class", id, validOn], queryFn: () => getInstitutionalClass(id, { validOn }) });
}

export function InstitutionalClassDetailPage({ id }: { id: string }) {
  const caps = useCaps();
  const c = useClass(id);
  const history = useQuery({ queryKey: ["inst-class-history", id], queryFn: () => classRecordHistory(id), enabled: !!c.data });
  if (c.isLoading) return <SkeletonState label="Carregando turma" />;
  if (c.error) return <ErrorLine text="Não foi possível consultar a turma." />;
  if (!c.data) return <NotAvailable />;
  const s = c.data;
  const canRegistry = canMaintainRegistry(caps, s.schoolId);
  const canLink = canMaintainPeriodLink(caps, s.schoolId);
  const rec = s.record.kind === "one" ? s.record.value : null;
  return (
    <div className="grid gap-4">
      <OperationalPageHeader
        title={rec?.name ?? "Turma sem cadastro vigente"}
        description="Leitura institucional na data de hoje."
        parent={{ label: "Turmas", to: "/turmas" }}
        actions={<div className="flex gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/turmas/oferta/$id" params={{ id }}>Organização da oferta</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/horarios/turmas/$turmaId" params={{ turmaId: id }}>Horário da turma</Link></Button>
          {canRegistry && rec ? <Button asChild size="sm" variant="outline"><Link to="/turmas/editar/$id" params={{ id }}>Corrigir cadastro</Link></Button> : null}
        </div>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Identidade" icon={<Building2 className="size-4" />}>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Escola</dt><dd>{s.schoolName ?? <Missing>Não registrada</Missing>}</dd>
            <dt className="text-muted-foreground">Ano letivo</dt><dd>{s.academicYearName ?? <Missing>Não registrado</Missing>}</dd>
            <dt className="text-muted-foreground">Código</dt><dd>{rec?.code ?? <Missing>Sem código</Missing>}</dd>
            <dt className="text-muted-foreground">Situação</dt><dd><StatusCell r={s} /></dd>
            <dt className="text-muted-foreground">Vigência</dt><dd>{rec ? `${fmtStart(rec.validFrom)} – ${fmt(rec.validUntil)}` : <Missing>—</Missing>}</dd>
          </dl>
          {canRegistry && rec ? <StatusAction id={id} rec={rec} /> : null}
        </Section>
        <PeriodLinkPanel s={s} canLink={canLink} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <OfferingPanel classId={s.classId} canMaintain={canMaintainOffering(caps, s.schoolId)} validOn={todayIso()} />
        <ShiftPanel classId={s.classId} canMaintain={canMaintainShift(caps, s.schoolId)} validOn={todayIso()} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CompositionPanel classId={s.classId} />
        <JourneyPanel classId={s.classId} on={todayIso()} canEdit={schoolsWithCapability(caps, "manter-jornada-da-turma").includes(s.schoolId)} />
        <CapacityPanel classId={s.classId} />
      </div>
      <TeachingAssignmentPanel classId={s.classId} validOn={todayIso()} />
      <CensusClassBondsPanel classId={s.classId} />
      <Section title="Histórico cadastral" icon={<History className="size-4" />}>
        <RecordHistory items={history.data ?? []} />
      </Section>
    </div>
  );
}

function NotAvailable() {
  return (
    <div className="grid gap-4">
      <OperationalPageHeader title="Turma indisponível" description="A turma não existe ou está fora do seu escopo autorizado." parent={{ label: "Turmas", to: "/turmas" }} />
    </div>
  );
}

function StatusAction({ id, rec }: { id: string; rec: InstitutionalClassRecordVersion }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const op: ClassOperation = rec.administrativeStatus === "ativa" ? "inactivate" : "reactivate";
  const verb = op === "inactivate" ? "Inativar" : "Reativar";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try {
      await recordClassVersion({ classId: id, baseVersionId: rec.id, operation: op, code: rec.code, name: rec.name,
        status: op === "inactivate" ? "inativa" : "ativa", validFrom: String(f.get("from")), validUntil: null,
        reason: String(f.get("reason")), actRef: String(f.get("act")) });
      setOpen(false); await qc.invalidateQueries();
    } catch (err) { setError(errText(err)); }
  }
  return (
    <div className="mt-3">
      <Button size="sm" variant={op === "inactivate" ? "destructive" : "outline"} onClick={() => setOpen(true)}>{verb} turma</Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form onSubmit={submit} className="grid gap-3">
            <AlertDialogHeader>
              <AlertDialogTitle>{verb} {rec.name}?</AlertDialogTitle>
              <AlertDialogDescription>Uma nova versão será registrada a partir da data informada. O histórico anterior é preservado.</AlertDialogDescription>
            </AlertDialogHeader>
            <Field label="A partir de" name="from" type="date" required />
            <Field label="Motivo" name="reason" required />
            <Field label="Referência documental/fonte (opcional)" name="act" />
            <ErrorLine text={error} />
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
              <AlertDialogAction type="submit" onClick={(e) => { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RecordHistory({ items }: { items: InstitutionalClassRecordVersion[] }) {
  if (!items.length) return <Missing>Nenhuma versão cadastral registrada.</Missing>;
  return (
    <ol className="grid gap-2">
      {[...items].reverse().map((v) => (
        <li key={v.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            Versão {v.version} · {v.name}
            <StatusBadge tone={presentState("turma", v.administrativeStatus).tone}>{presentState("turma", v.administrativeStatus).label}</StatusBadge>
          </div>
          <p className="text-muted-foreground">Vale de {fmtStart(v.validFrom)} a {fmt(v.validUntil)} · registrada em {formatAcademicDate(civilDateOf(v.createdAt))}</p>
          <p className="text-muted-foreground">{v.changeReason ? `Motivo: ${v.changeReason} · ` : "Registro inicial · "}Ato: {v.originatingActRef}</p>
        </li>
      ))}
    </ol>
  );
}

// ───────── Vínculo Turma → Organização ─────────
function PeriodLinkPanel({ s, canLink }: { s: InstitutionalClassSummary; canLink: boolean }) {
  const qc = useQueryClient();
  const history = useQuery({ queryKey: ["inst-class-links", s.classId], queryFn: () => classLinkHistory(s.classId) });
  const orgs = useQuery({ queryKey: ["inst-orgs", s.academicYearId], queryFn: () => organizationsForYear(s.academicYearId), enabled: canLink });
  const [mode, setMode] = useState<LinkOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = history.data ?? [];
  const superseded = new Set(items.map((v) => v.supersedesId).filter(Boolean));
  const head = items.filter((v) => !superseded.has(v.id));
  const base: ClassPeriodOrganizationLinkVersion | null = s.link.kind === "one" ? s.link.value : head.length === 1 ? head[0]! : null;
  const initial = items.length === 0;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!mode) return; const f = new FormData(e.currentTarget);
    try {
      await recordPeriodLink({ classId: s.classId, baseVersionId: mode === "register" ? null : base?.id ?? null, operation: mode,
        organizationId: String(f.get("org")), validFrom: String(f.get("from")), validUntil: String(f.get("until") || "") || null,
        reason: String(f.get("reason")), actRef: String(f.get("act")) });
      setMode(null); setError(null); await qc.invalidateQueries();
    } catch (err) { setError(errText(err)); }
  }
  return (
    <Section title="Organização de períodos letivos" icon={<CalendarRange className="size-4" />}
      actions={canLink ? (
        <div className="flex gap-1">
          {initial ? <Button size="sm" variant="outline" onClick={() => setMode("register")}>Registrar associação</Button> : null}
          {!initial && base ? <><Button size="sm" variant="outline" onClick={() => setMode("correct")}>Corrigir</Button><Button size="sm" variant="outline" onClick={() => setMode("switch")}>Trocar</Button></> : null}
        </div>
      ) : undefined}>
      <p className="text-sm">
        {s.link.kind === "one"
          ? <><Layers className="mr-1 inline size-4" />{s.link.organizationName ?? "Organização sem nome registrado"} · {fmt(s.link.value.validFrom)} – {fmt(s.link.value.validUntil)}</>
          : <Missing>{s.link.kind === "ambiguous" ? "Vínculo inconsistente na data." : "Nenhuma organização de períodos registrada para hoje. Não é inferida de nenhum outro dado."}</Missing>}
      </p>
      {mode ? (
        <form onSubmit={submit} className="mt-3 grid gap-2 rounded-md border border-border p-3" aria-label="Vínculo com organização">
          <p className="text-xs text-muted-foreground">{mode === "register" ? "Associação inicial." : mode === "switch" ? "Troca: a nova organização passa a valer a partir da data informada." : "Correção da versão vigente do vínculo."}</p>
          <div className="grid gap-1">
            <Label htmlFor="f-org" className="text-xs">Organização</Label>
            <select id="f-org" name="org" required className="h-9 rounded-md border border-input bg-background px-2 text-sm" defaultValue={mode === "correct" ? base?.organizationId : undefined}>
              {(orgs.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name ?? "Organização sem nome registrado"}</option>)}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Início" name="from" type="date" required defaultValue={mode === "correct" ? base?.validFrom : undefined} />
            <Field label="Término (opcional)" name="until" type="date" defaultValue={mode === "correct" ? base?.validUntil ?? undefined : undefined} />
          </div>
          <Field label="Motivo" name="reason" required />
          <Field label="Referência documental/fonte (opcional)" name="act" />
          <ErrorLine text={error} />
          <div className="flex gap-2"><Button type="submit" size="sm">Registrar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancelar</Button></div>
        </form>
      ) : null}
      <h3 className="mt-4 text-xs font-semibold text-muted-foreground">Histórico do vínculo</h3>
      {items.length === 0 ? <Missing>Nenhum vínculo registrado.</Missing> : (
        <ol className="mt-1 grid gap-1 text-sm">
          {[...items].reverse().map((v) => (
            <li key={v.id} className="text-muted-foreground">Versão {v.version}: {fmtStart(v.validFrom)} – {fmt(v.validUntil)}{v.changeReason ? ` · ${v.changeReason}` : ""} · Ato {v.originatingActRef}</li>
          ))}
        </ol>
      )}
    </Section>
  );
}

// ───────── Correção cadastral ─────────
export function InstitutionalClassEditPage({ id }: { id: string }) {
  const caps = useCaps();
  const c = useClass(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  if (c.isLoading) return <SkeletonState label="Carregando turma" />;
  if (!c.data) return <NotAvailable />;
  const s = c.data;
  const rec = s.record.kind === "one" ? s.record.value : null;
  if (!canMaintainRegistry(caps, s.schoolId) || !rec)
    return (
      <div className="grid gap-4">
        <OperationalPageHeader title="Corrigir cadastro" description="Correção institucional." parent={{ label: "Turmas", to: "/turmas" }} />
        <p role="alert" className="text-sm text-muted-foreground">
          {rec ? "Sua atuação vigente não concede a manutenção do cadastro de turmas nesta escola." : "Não há cadastro vigente para corrigir na data de hoje."}
        </p>
      </div>
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try {
      await recordClassVersion({ classId: id, baseVersionId: rec!.id, operation: "correct", code: String(f.get("code") ?? ""),
        name: String(f.get("name")), status: rec!.administrativeStatus, validFrom: String(f.get("from")),
        validUntil: String(f.get("until") || "") || null, reason: String(f.get("reason")), actRef: String(f.get("act")) });
      await qc.invalidateQueries();
      navigate({ to: "/turmas/$id", params: { id } });
    } catch (err) { setError(errText(err)); }
  }
  return (
    <div className="grid gap-4">
      <OperationalPageHeader title={`Corrigir cadastro — ${rec.name}`} description="Gera nova versão; a versão anterior permanece no histórico." parent={{ label: "Turmas", to: "/turmas" }} />
      <form onSubmit={submit} className="grid max-w-2xl gap-3 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Escola ({s.schoolName ?? "não registrada"}) e ano letivo ({s.academicYearName ?? "não registrado"}) são identidade da turma e não são alterados por correção.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" name="name" required defaultValue={rec.name} />
          <Field label="Código" name="code" defaultValue={rec.code ?? ""} />
          <Field label="Vigência — início" name="from" type="date" required defaultValue={rec.validFrom ?? undefined} />
          <Field label="Vigência — término" name="until" type="date" defaultValue={rec.validUntil ?? ""} />
        </div>
        <Field label="Motivo da correção" name="reason" required />
        <Field label="Referência documental/fonte (opcional)" name="act" />
        <ErrorLine text={error} />
        <div><Button type="submit">Registrar correção</Button></div>
      </form>
    </div>
  );
}

export { CLASS_PERIOD_ORGANIZATION_CAPABILITY };
