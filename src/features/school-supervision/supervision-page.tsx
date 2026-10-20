import { LoadingState } from "@/components/sigem/states";
import { humanizeForScreen } from "@/config/technical-codes";
import { knownLabel } from "@/config/ui-vocabulary";
import { MoreFilters } from "@/components/sigem/more-filters";
import { operationalToday } from "@/lib/academic-date";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { supervisionHome, TOOL_STATE_LABEL } from "./supervision-home";
import { useQuery } from "@tanstack/react-query";
import { withListTimeout } from "@/lib/server-page";
import { readSupervisionContext, supervisionReadKey, canRecordSupervision } from "./supervision-read";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { yearStateLabel } from "@/features/school-secretariat/secretariat";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { SUPERVISAO_ACOMPANHAMENTO } from "@/features/reports/report-registry";
import { STATE_LABEL, buildPanel } from "@/features/school-management/management-panel";
import { readManagementInputs } from "@/features/school-management/management-source";
import { ACTIONS, NATURE_LABEL, NATURE_ORDER, classifyPending, recordStateLine, supervisionError, supervisionRows, type SupervisionRecord } from "./supervision-model";
import { readCatalog, readSupervisionRecords, recordSupervision } from "./supervision-source";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { journeyState, filterRecords } from "./supervision-journey";
import { SupervisionNetworkPanel } from "./supervision-network-panel";

const field = "mt-1 block w-full rounded-md border border-input bg-background p-2";
const today = () => operationalToday();

export function SupervisionPage() {
  const authority = useSessionAuthority();
  const sessionKey = supervisionReadKey(authority);
  if (!sessionKey) return <StatePanel tone="info" title={authority.status === "loading" ? "Conferindo acesso…" : "Não disponível"} description="A consulta exige acesso confirmado à Supervisão." />;
  return <SupervisionWorkspace key={sessionKey} sessionKey={sessionKey} />;
}

function SupervisionWorkspace({ sessionKey }: { sessionKey: string }) {
  const context = useQuery({ queryKey: ["supervision-context", sessionKey], retry: false,
    queryFn: ({ signal }) => readSupervisionContext(signal), staleTime: 60_000 });
  const schools = context.data?.schools ?? [];
  const years = context.data?.years ?? [];
  const [f, setF] = useState({ school: "", year: "", on: today(), knownAt: "" });
  const [view, setView] = useState("escola");
  const ready = f.school && f.year && f.on;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Supervisão" title="Acompanhar as escolas"
        description="Escolha a escola e veja o que depende de você. Não há ranking." />
      <SupervisionHome />
      {context.isError && <ReadFailure title="Não foi possível carregar escolas e anos" retry={() => void context.refetch()} />}
      <Tabs value={view} onValueChange={setView}>
        <TabsList><TabsTrigger value="rede">Rede</TabsTrigger><TabsTrigger value="escola">Escola</TabsTrigger></TabsList>
        <TabsContent value="rede" className="mt-4">
          {context.isPending ? <LoadingState label="Carregando escolas…" /> : context.isSuccess && <SupervisionNetworkPanel schools={schools} sessionKey={sessionKey} openSchool={(school) => { setF({ ...f, school }); setView("escola"); }} />}
        </TabsContent>
        <TabsContent value="escola" className="mt-4 space-y-6">
      <section aria-label="Contexto" className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">Escola<select className={field} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })}>
          <option value="">{context.isPending ? "Carregando…" : "Escolha a escola"}</option>{(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="text-sm">Ano letivo<select className={field} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}>
          <option value="">Escolha o ano</option>{years.map((y) => <option key={y.id} value={y.id}>{y.label} — {yearStateLabel(y.state)}</option>)}</select></label>
        <label className="text-sm">Data de referência<DateInput value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></label>
        <MoreFilters active={!!f.knownAt}>
          <label className="text-sm">Conhecido até (opcional)<input type="datetime-local" className={field} value={f.knownAt} onChange={(e) => setF({ ...f, knownAt: e.target.value })} /></label>
        </MoreFilters>
      </section>
      {ready && context.isSuccess ? <Station key={JSON.stringify(f)} {...f} sessionKey={sessionKey} schoolName={schools?.find((s) => s.id === f.school)?.name ?? f.school} />
        : <EmptyState title="Escolha a escola para começar" description="Escolha escola, ano e data acima. O que você não alcança aparece como “Não disponível”." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Station({ school, year, on, knownAt, schoolName, sessionKey }: { school: string; year: string; on: string; knownAt: string; schoolName: string; sessionKey: string }) {
  const k = knownAt ? new Date(knownAt).toISOString() : null;
  const query = useQuery({ queryKey: ["supervision-panel", sessionKey, school, year, on, k], retry: false,
    queryFn: ({ signal }) => withListTimeout(signal, async () => buildPanel(await readManagementInputs(school, year, on, k))) });
  const panel = query.data ?? null;
  const grouped = useMemo(() => (panel ? classifyPending(panel.blocks, panel.pending) : null), [panel]);
  const authority = useSessionAuthority();
  const canRecord = canRecordSupervision(authority, school);
  return (
    <div className="space-y-6">
      {k && <StatePanel tone="info" title="Visão histórica" description="Registros da Supervisão e fontes que aceitam “conhecido até” reproduzem o que estava registrado naquele momento." />}
      {query.isError && <ReadFailure title="Não foi possível consultar a situação da escola" retry={() => void query.refetch()} />}
      <Tabs defaultValue="situacao">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="situacao">Situação</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
          <TabsTrigger value="percurso">Percurso da visita</TabsTrigger>
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
        </TabsList>
        <TabsContent value="situacao">
      <section aria-label="Situação da escola" className="space-y-2">
        <h2 className="font-semibold">Situação da escola</h2>
        {!panel ? !query.isError && <p role="status" className="text-sm text-muted-foreground">Lendo as fontes…</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {panel.blocks.map((b) => (
              <Link key={b.id} to={b.link as "/secretaria"} className="rounded-lg border bg-card p-4 space-y-1 hover:bg-accent">
                <div className="flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{b.title}</h3><span className="text-xs text-muted-foreground">{knownLabel(STATE_LABEL, b.state)}</span></div>
                <p className="font-display text-2xl font-semibold tabular-nums">{b.value ?? "—"}</p>
                {b.reason && <p className="text-xs text-muted-foreground">{humanizeForScreen(b.reason)}</p>}
              </Link>))}
            <Link to="/calendario-escolar" className="rounded-lg border border-dashed bg-card p-4 hover:bg-accent"><h3 className="text-sm font-semibold">Calendário e períodos</h3><p className="text-xs text-muted-foreground">Abrir o calendário do ano.</p></Link>
            <Link to="/mapa-estatistico" className="rounded-lg border border-dashed bg-card p-4 hover:bg-accent"><h3 className="text-sm font-semibold">Mapa Estatístico</h3><p className="text-xs text-muted-foreground">Abrir os mapas da escola conforme sua atuação.</p></Link>
          </div>)}
      </section>
        </TabsContent>
        <TabsContent value="pendencias">
      {!grouped ? !query.isError && <p role="status" className="text-sm text-muted-foreground">Lendo as fontes…</p> : (
        <section aria-label="Pendências" className="space-y-3">
          <h2 className="font-semibold">Pendências por natureza</h2>
          <p className="text-xs text-muted-foreground">Cada item vem de um registro existente. Nenhuma pendência é nota da escola ou de pessoas.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {NATURE_ORDER.map((n) => (
              <div key={n} className="rounded-lg border bg-card p-3">
                <h3 className="text-sm font-semibold">{NATURE_LABEL[n]} ({grouped[n].length})</h3>
                {grouped[n].length === 0 ? <p className="text-xs text-muted-foreground">Nada derivável das fontes que você alcança.</p>
                  : <ul className="mt-1 space-y-1 text-sm">{grouped[n].map((p) => <li key={p.id}><Link to={p.link as "/secretaria"} className="underline">{p.text}</Link></li>)}</ul>}
              </div>))}
          </div>
        </section>)}
        </TabsContent>
        <TabsContent value="percurso"><Journey canRecord={canRecord} /></TabsContent>
        <TabsContent value="acompanhamento"><Records school={school} schoolName={schoolName} knownAt={k} sessionKey={sessionKey} canRecord={canRecord} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Journey({ canRecord }: { canRecord: boolean }) {
  const steps = journeyState(canRecord);
  return (
    <section aria-labelledby="sup-journey" className="space-y-3">
      <h2 id="sup-journey" className="font-semibold">Percurso da visita</h2>
      <p className="text-xs text-muted-foreground">Etapas que ainda não gravam aparecem assim por extenso. Nada é simulado.</p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border bg-card p-3">
            <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.title} <span className="font-normal text-muted-foreground">· {s.who === "escola" ? "escola" : "Supervisão"}</span></p>
              <p className="text-xs">{s.state === "disponivel" ? "Disponível" : s.state === "consulta" ? "Só consulta" : "Aguardando decisão"} — {s.note}</p>
              {s.id === "situacao" && s.state === "disponivel" && <p className="text-xs text-muted-foreground">Use a aba “Acompanhamento”.</p>}
            </div>
          </li>))}
      </ol>
    </section>
  );
}

const blank = { modality: "", subject: "", occurredOn: today(), referral: "", responsible: "", returnOn: "", status: "", schoolVisible: false, reason: "" };

function ReadFailure({ title, retry }: { title: string; retry: () => void }) {
  return <div role="alert" className="space-y-2"><StatePanel tone="info" title={title} description="A consulta não foi concluída. Tente novamente." /><Button variant="outline" onClick={retry}>Tentar novamente</Button></div>;
}

function Records({ school, schoolName, knownAt, sessionKey, canRecord }: { school: string; schoolName: string; knownAt: string | null; sessionKey: string; canRecord: boolean }) {
  const query = useQuery({ queryKey: ["supervision-records", sessionKey, school, knownAt], retry: false,
    queryFn: ({ signal }) => withListTimeout(signal, async () => {
      const [rows, mods, sts] = await Promise.all([readSupervisionRecords(school, knownAt),
        readCatalog("modalidade-de-acompanhamento-da-supervisao"), readCatalog("situacao-de-acompanhamento-da-supervisao")]);
      return { rows, mods, sts };
    }) });
  const rows = query.data?.rows ?? null;
  const mods = query.data?.mods ?? [];
  const sts = query.data?.sts ?? [];
  const denied = query.isError ? supervisionError(query.error.message) : null;
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<{ base: SupervisionRecord; kind: "retificacao" | "anulacao" } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const labels = useMemo(() => new Map([...mods, ...sts].map((o) => [o.value_id, o.label])), [mods, sts]);
  const load = () => query.refetch();

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      const kind = editing?.kind ?? "registro";
      await recordSupervision({ baseId: editing?.base.id ?? null, kind, school, modality: form.modality || null, subject: form.subject || null,
        occurredOn: form.occurredOn || null, referral: form.referral || null, responsible: form.responsible || null, returnOn: form.returnOn || null,
        status: form.status || null, schoolVisible: form.schoolVisible, reason: form.reason || null });
      setForm(blank); setEditing(null); setMsg("Registro gravado."); await load();
    } catch (e) { setMsg(supervisionError((e as Error).message)); } finally { setBusy(false); }
  };
  const startEdit = (r: SupervisionRecord, kind: "retificacao" | "anulacao") => {
    setEditing({ base: r, kind });
    setForm({ modality: r.modality_value_id, subject: r.subject, occurredOn: r.occurred_on, referral: r.referral ?? "", responsible: r.responsible_label ?? "", returnOn: r.return_on ?? "", status: r.status_value_id ?? "", schoolVisible: r.school_visible, reason: "" });
  };
  const exportCsv = () => {
    if (!rows) return;
    const r = runReport(SUPERVISAO_ACOMPANHAMENTO, { params: { school, knownAt: knownAt ?? undefined } }, supervisionRows(rows, schoolName, labels));
    const meta = [`Escola: ${schoolName}`, `Conhecido até: ${knownAt ?? "momento da geração"}`, `Fonte: ${SUPERVISAO_ACOMPANHAMENTO.source}`];
    const blob = new Blob([toCsv(r, { headerLines: ["SIGEM"], title: SUPERVISAO_ACOMPANHAMENTO.title }, meta)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `supervisao-${school}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <section aria-label="Acompanhamento da Supervisão" className="space-y-3">
      <h2 className="font-semibold">Acompanhamento da Supervisão</h2>
      {denied ? <div className="space-y-2"><StatePanel tone="info" title="Não disponível" description={denied} /><Button size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div> : !rows ? <p role="status" className="text-sm text-muted-foreground">Lendo registros…</p> : (
        <>
          {rows.length > 0 && <label className="block text-sm">Buscar nos registros<input type="search" className={field} value={q} onChange={(e) => setQ(e.target.value)} /></label>}
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro da Supervisão para esta escola até o momento consultado.</p> : (
            <ul className="space-y-2">{filterRecords(rows, q).map((r) => (
              <li key={r.id} className="rounded-lg border bg-card p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{r.subject}</strong><span className="text-xs text-muted-foreground">{r.occurred_on} · {labels.get(r.modality_value_id) ?? r.modality_value_id}</span></div>
                {r.referral && <p>Encaminhamento: {r.referral}</p>}
                <p className="text-xs text-muted-foreground">{recordStateLine(r, labels)}{r.return_on ? ` · retorno até ${r.return_on}` : ""}{r.responsible_label ? ` · responsável: ${r.responsible_label}` : ""} · {r.school_visible ? "visível à escola" : "interno da Supervisão"}</p>
                {!knownAt && canRecord && ACTIONS(r).length > 0 && <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(r, "retificacao")}>Corrigir</Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(r, "anulacao")}>Anular</Button></div>}
              </li>))}</ul>)}
          <Button variant="outline" onClick={exportCsv}>Exportar acompanhamento (CSV)</Button>
          {!knownAt && canRecord && (
            <form className="rounded-lg border bg-card p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <h3 className="text-sm font-semibold">{editing ? (editing.kind === "anulacao" ? "Anular registro" : "Corrigir registro (nova versão)") : "Novo registro"}</h3>
              {mods.length === 0 && !editing ? <StatePanel tone="info" title="Falta cadastrar os tipos de visita" description="Peça à SEMED para cadastrar os tipos de acompanhamento." /> : (
                <>
                  {editing?.kind !== "anulacao" && <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">Modalidade<select className={field} value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}><option value="">Escolha</option>{mods.map((m) => <option key={m.value_id} value={m.value_id}>{m.label}</option>)}</select></label>
                    <label className="text-sm">Data<DateInput value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} /></label>
                    <label className="text-sm sm:col-span-2">Assunto<input className={field} maxLength={300} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></label>
                    <label className="text-sm sm:col-span-2">Encaminhamento<textarea className={field} maxLength={4000} value={form.referral} onChange={(e) => setForm({ ...form, referral: e.target.value })} /></label>
                    <label className="text-sm">Responsável (função ou setor)<input className={field} maxLength={200} value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></label>
                    <label className="text-sm">Prazo/retorno<DateInput value={form.returnOn} onChange={(e) => setForm({ ...form, returnOn: e.target.value })} /></label>
                    <label className="text-sm">Situação<select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="">Não declarada</option>{sts.map((m) => <option key={m.value_id} value={m.value_id}>{m.label}</option>)}</select></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.schoolVisible} onChange={(e) => setForm({ ...form, schoolVisible: e.target.checked })} />Visível à escola</label>
                  </div>}
                  {editing && <label className="text-sm block">Motivo<input className={field} value={humanizeForScreen(form.reason)} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>}
                  <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Gravando…" : "Gravar"}</Button>
                    {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(blank); }}>Cancelar</Button>}</div>
                </>)}
              {msg && <p role="status" className="text-sm">{msg}</p>}
            </form>)}
        </>)}
    </section>
  );
}

function SupervisionHome() {
  const authority = useSessionAuthority();
  const held = new Set(authority.status === "signed-in" ? authority.capabilities.map((c) => c.capabilityId) : []);
  // NACL.UI.1: card só aparece se a sessão pode abrir o destino (mesma regra do menu).
  const tools = supervisionHome(held).filter((t) => pathAllowed(authority, t.to));
  return (
    <section aria-labelledby="sup-home" className="space-y-2">
      <h2 id="sup-home" className="font-semibold">O que depende da Supervisão</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.id} className="rounded-md border border-border bg-card p-3">
            <a href={t.to} className="font-medium underline-offset-2 hover:underline">{t.title}</a>
            <p className="text-sm text-muted-foreground">{t.what}</p>
            <p className="mt-1 text-xs">{knownLabel(TOOL_STATE_LABEL, t.state)}</p>
          </li>
        ))}
      </ul>
      <details className="text-sm text-muted-foreground"><summary>Por que algumas ferramentas estão só em consulta?</summary>
        <p className="mt-1">Algumas ferramentas ficam só para consulta até a SEMED liberar quem pode usá-las.</p></details>
    </section>
  );
}
