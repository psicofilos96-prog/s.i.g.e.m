/**
 * Frente V — "Organização da oferta" da turma: jornada, grade semanal, atribuições docentes,
 * substituições, horários da escola e prontidão para o Diário. Edição só aparece para quem tem a
 * capacidade na data-alvo (início do ano letivo); o banco revalida tudo. IDs ficam fora do texto principal.
 */
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Grid3x3, Users, Repeat, Clock, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatAcademicDate } from "@/lib/academic-date";
import { locateProfessional } from "@/features/year-transition/year-transition-source";
import type { ProfessionalLookupKind } from "@/features/year-transition/year-transition";
import {
  WEEKDAYS, balanceText, humanOfferError, journeyDraftIssues, readinessResult, readinessText, scheduleDraftIssues, weekdayLabel,
  type DraftBlock, type Interval,
} from "./offer-model";
import {
  OFFER_CAPS, candidateEngagements, capabilitiesOn, journeyHead, readApplicableElements, readAssignments, readJourney, readOfferContext,
  readReadiness, readSchedule, readSchoolLoad, readSchoolSchedule, readSubstitutions, recordAssignment, recordJourney, recordSchedule,
  recordSubstitution, scheduleHead, type CurricularElement, type OfferContext, type Window,
} from "./offer-source";

const YEAR_STATE_TEXT: Record<string, string> = {
  "historico-importado": "Histórico importado (somente leitura)",
  "em-preparacao": "Em preparação",
  operacional: "Operacional",
  encerrado: "Encerrado",
};

function Box({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>
      {children}
    </section>
  );
}
const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;
const Err = ({ e }: { e: unknown }) => <p role="alert" className="text-sm text-destructive">{humanOfferError(e)}</p>;

function WindowFields({ w, set, needsReason, requireEnd }: { w: Window; set: (w: Window) => void; needsReason: boolean; requireEnd?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div><Label htmlFor="w-from">Início da vigência</Label><Input id="w-from" type="date" value={w.validFrom} onChange={(e) => set({ ...w, validFrom: e.target.value })} /></div>
      <div><Label htmlFor="w-until">Término{requireEnd ? "" : " (opcional)"}</Label><Input id="w-until" type="date" value={w.validUntil ?? ""} onChange={(e) => set({ ...w, validUntil: e.target.value || null })} /></div>
      <div><Label htmlFor="w-src">Referência/fonte (opcional)</Label><Input id="w-src" value={w.sourceRef ?? ""} onChange={(e) => set({ ...w, sourceRef: e.target.value || null })} /></div>
      {needsReason ? <div><Label htmlFor="w-reason">Motivo</Label><Input id="w-reason" value={w.reason ?? ""} onChange={(e) => set({ ...w, reason: e.target.value || null })} /></div> : null}
    </div>
  );
}

export function OfferOrganizationPage({ classId }: { classId: string }) {
  const [knownAt] = useState(() => new Date().toISOString());
  const ctx = useQuery({ queryKey: ["offer-ctx", classId], queryFn: () => readOfferContext(classId) });
  if (ctx.isLoading) return <Muted>Carregando organização da turma…</Muted>;
  if (ctx.error) return <Err e={ctx.error} />;
  if (!ctx.data) return <Muted>Turma não encontrada ou sem acesso.</Muted>;
  return <OfferBody c={ctx.data} knownAt={knownAt} />;
}

function OfferBody({ c, knownAt }: { c: OfferContext; knownAt: string }) {
  const on = c.yearStart ?? new Date().toISOString().slice(0, 10);
  const caps = useQuery({ queryKey: ["offer-caps", c.schoolId, on], queryFn: () => capabilitiesOn(on, c.schoolId) });
  const writableYear = c.yearState === "em-preparacao" || c.yearState === "operacional";
  const can = (cap: string) => writableYear && !!caps.data?.has(cap);
  return (
    <div className="space-y-4">
      <OperationalPageHeader
        title={`Organização da oferta — ${c.className}`}
        description={`Ano letivo: ${c.yearState ? YEAR_STATE_TEXT[c.yearState] ?? c.yearState : "sem estado operacional (não aberto)"} · data de referência ${formatAcademicDate(on)}.`}
        parent={{ label: "Turmas", to: "/turmas" }}
      />
      {!writableYear ? (
        <p role="status" className="rounded border border-border bg-muted p-3 text-sm">
          Nenhuma alteração é possível: a organização só pode ser preparada quando o ano letivo estiver em preparação ou operacional.
        </p>
      ) : null}
      <Tabs defaultValue="jornada">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="grade">Grade semanal</TabsTrigger>
          <TabsTrigger value="atribuicoes">Atribuições docentes</TabsTrigger>
          <TabsTrigger value="substituicoes">Substituições</TabsTrigger>
          <TabsTrigger value="horarios">Horários</TabsTrigger>
          <TabsTrigger value="prontidao">Prontidão para o Diário</TabsTrigger>
        </TabsList>
        <TabsContent value="jornada"><JourneyTab c={c} on={on} knownAt={knownAt} canEdit={can(OFFER_CAPS.journey)} /></TabsContent>
        <TabsContent value="grade"><ScheduleTab c={c} on={on} knownAt={knownAt} canEdit={can(OFFER_CAPS.schedule)} /></TabsContent>
        <TabsContent value="atribuicoes"><AssignmentsTab c={c} on={on} knownAt={knownAt} canEdit={can(OFFER_CAPS.assignment)} /></TabsContent>
        <TabsContent value="substituicoes"><SubstitutionsTab c={c} on={on} knownAt={knownAt} canEdit={can(OFFER_CAPS.assignment)} /></TabsContent>
        <TabsContent value="horarios"><SchoolScheduleTab c={c} on={on} knownAt={knownAt} /></TabsContent>
        <TabsContent value="prontidao"><ReadinessTab c={c} on={on} knownAt={knownAt} /></TabsContent>
      </Tabs>
    </div>
  );
}

type TabProps = { c: OfferContext; on: string; knownAt: string; canEdit?: boolean };

function JourneyTab({ c, on, knownAt, canEdit }: TabProps) {
  const qc = useQueryClient();
  const j = useQuery({ queryKey: ["offer-journey", c.classId, on, knownAt], queryFn: () => readJourney(c.classId, on, knownAt) });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Interval[]>([]);
  const [w, setW] = useState<Window>({ kind: "constituicao", validFrom: on, validUntil: null, sourceRef: null, reason: null });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const start = () => {
    const has = j.data?.kind === "vigente";
    setDraft(has ? j.data!.intervals.map((i) => ({ ...i })) : [{ weekday: 1, startsAt: "07:00", endsAt: "11:30" }]);
    setW({ kind: has ? "sucessao" : "constituicao", validFrom: on, validUntil: null, sourceRef: null, reason: null });
    setErr(null); setEditing(true);
  };
  const issues = journeyDraftIssues(draft);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const h = await journeyHead(c.classId);
      await recordJourney(c.classId, h?.id ?? null, w, draft);
      setEditing(false); await qc.invalidateQueries({ queryKey: ["offer-journey", c.classId] });
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Box title="Jornada da turma" icon={<CalendarClock className="size-4" />}>
      <Muted>Jornada é o funcionamento semanal recorrente da turma. Não é turno, calendário, grade nem aula.</Muted>
      <div className="mt-3">
        {j.isLoading ? <Muted>Carregando…</Muted> : j.error ? <Err e={j.error} /> : j.data?.kind === "negado" ? <Muted>Sem acesso à jornada desta turma.</Muted>
          : j.data?.kind === "ausente" ? <Muted>Jornada não registrada.</Muted> : (
            <ul className="grid gap-1 text-sm">
              {j.data!.intervals.map((i, k) => <li key={k}>{weekdayLabel(i.weekday)}: {i.startsAt}–{i.endsAt}</li>)}
              <li className="text-muted-foreground">Versão {j.data!.version} · desde {formatAcademicDate(j.data!.validFrom!)}</li>
            </ul>)}
      </div>
      {canEdit && !editing ? <Button className="mt-3" size="sm" onClick={start}>{j.data?.kind === "vigente" ? "Registrar nova versão" : "Registrar jornada"}</Button> : null}
      {!canEdit ? <p className="mt-3 text-xs text-muted-foreground">Somente leitura para o seu perfil.</p> : null}
      {editing ? (
        <div className="mt-4 space-y-3 rounded border border-border p-3">
          {j.data?.kind === "vigente" ? (
            <div className="flex gap-2 text-sm">
              <Button size="sm" variant={w.kind === "sucessao" ? "default" : "outline"} onClick={() => setW({ ...w, kind: "sucessao" })}>Sucessão (a partir de nova data)</Button>
              <Button size="sm" variant={w.kind === "retificacao" ? "default" : "outline"} onClick={() => setW({ ...w, kind: "retificacao" })}>Retificação (corrige a versão)</Button>
            </div>) : null}
          {draft.map((i, k) => (
            <div key={k} className="flex flex-wrap items-end gap-2">
              <div><Label htmlFor={`jd-${k}`}>Dia</Label>
                <select id={`jd-${k}`} className="h-9 rounded border border-input bg-background px-2 text-sm" value={i.weekday}
                  onChange={(e) => setDraft(draft.map((x, n) => n === k ? { ...x, weekday: Number(e.target.value) } : x))}>
                  {WEEKDAYS.map((d) => <option key={d.n} value={d.n}>{d.label}</option>)}
                </select></div>
              <div><Label htmlFor={`js-${k}`}>Início</Label><Input id={`js-${k}`} type="time" value={i.startsAt} onChange={(e) => setDraft(draft.map((x, n) => n === k ? { ...x, startsAt: e.target.value } : x))} /></div>
              <div><Label htmlFor={`je-${k}`}>Fim</Label><Input id={`je-${k}`} type="time" value={i.endsAt} onChange={(e) => setDraft(draft.map((x, n) => n === k ? { ...x, endsAt: e.target.value } : x))} /></div>
              <Button size="icon" variant="ghost" aria-label="Remover intervalo" onClick={() => setDraft(draft.filter((_, n) => n !== k))}><Trash2 className="size-4" /></Button>
            </div>))}
          <Button size="sm" variant="outline" onClick={() => setDraft([...draft, { weekday: 1, startsAt: "13:00", endsAt: "17:00" }])}><Plus className="size-4" />Intervalo</Button>
          <WindowFields w={w} set={setW} needsReason={w.kind !== "constituicao"} />
          {issues.length ? <ul className="text-sm text-destructive">{issues.map((x) => <li key={x}>{x}</li>)}</ul> : null}
          {err ? <Err e={err} /> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || issues.length > 0 || (w.kind !== "constituicao" && !w.reason)} onClick={save}>Salvar versão</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>) : null}
    </Box>
  );
}

function ScheduleTab({ c, on, knownAt, canEdit }: TabProps) {
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ["offer-schedule", c.classId, on, knownAt], queryFn: () => readSchedule(c.classId, on, knownAt) });
  const j = useQuery({ queryKey: ["offer-journey", c.classId, on, knownAt], queryFn: () => readJourney(c.classId, on, knownAt) });
  const el = useQuery({ queryKey: ["offer-elements", c.classId, on, knownAt], queryFn: () => readApplicableElements(c.schoolId, c.classId, on, knownAt) });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftBlock[]>([]);
  const [w, setW] = useState<Window>({ kind: "constituicao", validFrom: on, validUntil: null, sourceRef: null, reason: null });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const elements = el.data ?? [];
  const elKey = (e: CurricularElement) => `${e.matrixVersionId}|${e.itemKey}`;
  const issues = scheduleDraftIssues(draft, j.data?.intervals ?? []);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const h = await scheduleHead(c.classId);
      await recordSchedule(c.classId, h?.id ?? null, w, draft);
      setEditing(false); await qc.invalidateQueries({ queryKey: ["offer-schedule", c.classId] });
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Box title="Grade semanal" icon={<Grid3x3 className="size-4" />}>
      <Muted>Blocos recorrentes dentro da jornada, cada um ligado a um elemento da matriz aplicável. Quem leciona vem das atribuições docentes.</Muted>
      <div className="mt-3 overflow-x-auto">
        {s.isLoading ? <Muted>Carregando…</Muted> : s.error ? <Err e={s.error} /> : s.data?.kind === "negado" ? <Muted>Sem acesso à grade desta turma.</Muted>
          : s.data?.kind === "ausente" ? <Muted>Grade não registrada.</Muted> : (
            <>
              <p className="mb-2 text-sm">Situação: <Badge variant={s.data!.state === "utilizavel" ? "secondary" : "destructive"}>{s.data!.state === "utilizavel" ? "Utilizável" : "Com pendências"}</Badge> · versão {s.data!.version}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                {WEEKDAYS.slice(0, 5).map((d) => (
                  <div key={d.n} className="rounded border border-border p-2">
                    <p className="mb-1 text-xs font-semibold">{d.label}</p>
                    {s.data!.blocks.filter((b) => b.weekday === d.n).map((b) => (
                      <div key={b.blockId} className="mb-1 rounded bg-muted p-1 text-xs">
                        <div>{b.startsAt}–{b.endsAt}</div>
                        <div className="font-medium">{b.label ?? "Elemento sem rótulo declarado"}</div>
                        {b.state !== "utilizavel" ? <div className="text-destructive">Pendência no bloco</div> : null}
                        {b.coverage !== "comprovada" && b.coverage !== "nao-aplicavel" ? <div className="text-destructive">Referência curricular não comprovada</div> : null}
                        <div className="text-muted-foreground">{b.responsibles ? `${b.responsibles} responsável(is) por atribuição` : "Sem atribuição docente"}</div>
                      </div>))}
                  </div>))}
              </div>
            </>)}
      </div>
      {canEdit && !editing ? <Button className="mt-3" size="sm" onClick={() => {
        setDraft([{ blockKey: "b1", weekday: 1, startsAt: "07:00", endsAt: "07:50", matrixVersionId: null, itemKey: null }]);
        setW({ kind: s.data?.kind === "vigente" ? "sucessao" : "constituicao", validFrom: on, validUntil: null, sourceRef: null, reason: null }); setErr(null); setEditing(true);
      }}>{s.data?.kind === "vigente" ? "Registrar nova versão" : "Montar grade"}</Button> : null}
      {!canEdit ? <p className="mt-3 text-xs text-muted-foreground">Somente leitura para o seu perfil.</p> : null}
      {editing ? (
        <div className="mt-4 space-y-3 rounded border border-border p-3">
          {!elements.length ? <p role="alert" className="text-sm text-destructive">Nenhuma matriz curricular resolvida para a turma: a grade não pode ser montada.</p> : null}
          {draft.map((b, k) => (
            <div key={k} className="flex flex-wrap items-end gap-2">
              <div><Label htmlFor={`bk-${k}`}>Chave</Label><Input id={`bk-${k}`} className="w-20" value={b.blockKey} onChange={(e) => setDraft(draft.map((x, n) => n === k ? { ...x, blockKey: e.target.value } : x))} /></div>
              <div><Label htmlFor={`bd-${k}`}>Dia</Label>
                <select id={`bd-${k}`} className="h-9 rounded border border-input bg-background px-2 text-sm" value={b.weekday}
                  onChange={(e) => setDraft(draft.map((x, n) => n === k ? { ...x, weekday: Number(e.target.value) } : x))}>
                  {WEEKDAYS.map((d) => <option key={d.n} value={d.n}>{d.label}</option>)}
                </select></div>
              <div><Label htmlFor={`bs-${k}`}>Início</Label><Input id={`bs-${k}`} type="time" value={b.startsAt} onChange={(e) => setDraft(draft.map((x, n) => n === k ? { ...x, startsAt: e.target.value } : x))} /></div>
              <div><Label htmlFor={`be-${k}`}>Fim</Label><Input id={`be-${k}`} type="time" value={b.endsAt} onChange={(e) => setDraft(draft.map((x, n) => n === k ? { ...x, endsAt: e.target.value } : x))} /></div>
              <div><Label htmlFor={`bel-${k}`}>Elemento curricular</Label>
                <select id={`bel-${k}`} className="h-9 max-w-64 rounded border border-input bg-background px-2 text-sm" value={b.matrixVersionId ? `${b.matrixVersionId}|${b.itemKey}` : ""}
                  onChange={(e) => { const [mv, ik] = e.target.value.split("|"); setDraft(draft.map((x, n) => n === k ? { ...x, matrixVersionId: mv || null, itemKey: ik || null } : x)); }}>
                  <option value="">Escolha…</option>
                  {elements.map((e) => <option key={elKey(e)} value={elKey(e)}>{e.label ?? "Elemento sem rótulo declarado"}</option>)}
                </select></div>
              <Button size="icon" variant="ghost" aria-label="Remover bloco" onClick={() => setDraft(draft.filter((_, n) => n !== k))}><Trash2 className="size-4" /></Button>
            </div>))}
          <Button size="sm" variant="outline" onClick={() => setDraft([...draft, { blockKey: `b${draft.length + 1}`, weekday: 1, startsAt: "08:00", endsAt: "08:50", matrixVersionId: null, itemKey: null }])}><Plus className="size-4" />Bloco</Button>
          {s.data?.kind === "vigente" ? (
            <div className="flex gap-2 text-sm">
              <Button size="sm" variant={w.kind === "sucessao" ? "default" : "outline"} onClick={() => setW({ ...w, kind: "sucessao" })}>Sucessão</Button>
              <Button size="sm" variant={w.kind === "retificacao" ? "default" : "outline"} onClick={() => setW({ ...w, kind: "retificacao" })}>Retificação</Button>
            </div>) : null}
          <WindowFields w={w} set={setW} needsReason={w.kind !== "constituicao"} />
          {issues.length ? <ul className="text-sm text-destructive">{issues.map((x) => <li key={x}>{x}</li>)}</ul> : null}
          {err ? <Err e={err} /> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || issues.length > 0 || (w.kind !== "constituicao" && !w.reason)} onClick={save}>Salvar versão</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>) : null}
    </Box>
  );
}

/** Busca exata (matrícula/QP-MEC) → pessoa → vínculo funcional → atuação na escola. Sem diretório livre. */
function ProfessionalPicker({ schoolId, on, onPick }: { schoolId: string; on: string; onPick: (p: { engagementId: string; functionalLinkId: string } | null) => void }) {
  const [kind, setKind] = useState<ProfessionalLookupKind>("matricula");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const [engs, setEngs] = useState<{ engagementId: string; positionLabel: string }[]>([]);
  const [link, setLink] = useState(""); const [eng, setEng] = useState("");
  const search = async () => {
    setMsg(null); setLinks([]); setEngs([]); onPick(null);
    try {
      const r = await locateProfessional(schoolId, kind, value);
      if (r.outcome !== "encontrado" || !r.person_id) { setMsg(r.outcome === "conflito" ? "Identificador ambíguo; nada foi escolhido." : "Profissional não localizado nesta escola."); return; }
      setMsg(r.display_name ?? "Profissional localizado");
      setLinks(r.functional_link_logical_ids ?? []);
      setEngs(await candidateEngagements(schoolId, r.person_id, on));
    } catch (e) { setMsg(humanOfferError(e)); }
  };
  const pick = (l: string, e: string) => { setLink(l); setEng(e); onPick(l && e ? { engagementId: e, functionalLinkId: l } : null); };
  return (
    <div className="space-y-2 rounded border border-border p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div><Label htmlFor="pp-kind">Buscar por</Label>
          <select id="pp-kind" className="h-9 rounded border border-input bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as ProfessionalLookupKind)}>
            <option value="matricula">Matrícula funcional</option><option value="qp-mec">QP-MEC</option>
          </select></div>
        <div><Label htmlFor="pp-v">Identificador exato</Label><Input id="pp-v" value={value} onChange={(e) => setValue(e.target.value)} /></div>
        <Button size="sm" variant="outline" onClick={search} disabled={!value.trim()}>Localizar</Button>
      </div>
      {msg ? <p className="text-sm">{msg}</p> : null}
      {links.length ? (
        <div className="flex flex-wrap gap-2">
          <div><Label htmlFor="pp-l">Vínculo funcional</Label>
            <select id="pp-l" className="h-9 rounded border border-input bg-background px-2 text-sm" value={link} onChange={(e) => pick(e.target.value, eng)}>
              <option value="">Escolha…</option>{links.map((l, i) => <option key={l} value={l}>Vínculo {i + 1}</option>)}
            </select></div>
          <div><Label htmlFor="pp-e">Atuação na escola</Label>
            <select id="pp-e" className="h-9 rounded border border-input bg-background px-2 text-sm" value={eng} onChange={(e) => pick(link, e.target.value)}>
              <option value="">Escolha…</option>{engs.map((x) => <option key={x.engagementId} value={x.engagementId}>{x.positionLabel}</option>)}
            </select></div>
          {!engs.length ? <p className="text-sm text-destructive">Nenhuma atuação vigente desta pessoa nesta escola na data.</p> : null}
        </div>) : null}
    </div>
  );
}

function AssignmentsTab({ c, on, knownAt, canEdit }: TabProps) {
  const qc = useQueryClient();
  const a = useQuery({ queryKey: ["offer-assign", c.classId, on, knownAt], queryFn: () => readAssignments(c.classId, on, knownAt) });
  const el = useQuery({ queryKey: ["offer-elements", c.classId, on, knownAt], queryFn: () => readApplicableElements(c.schoolId, c.classId, on, knownAt) });
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ engagementId: string; functionalLinkId: string } | null>(null);
  const [elk, setElk] = useState("");
  const [w, setW] = useState<Window>({ kind: "constituicao", validFrom: on, validUntil: c.yearEnd, sourceRef: null, reason: null });
  const [err, setErr] = useState<unknown>(null);
  const element = (el.data ?? []).find((e) => `${e.matrixVersionId}|${e.itemKey}` === elk);
  const save = async () => {
    if (!pick || !element) return;
    setErr(null);
    try {
      await recordAssignment(c.classId, { assignmentId: null, expectedHead: null, w, engagementId: pick.engagementId, functionalLinkId: pick.functionalLinkId, element });
      setOpen(false); await qc.invalidateQueries({ queryKey: ["offer-assign", c.classId] });
    } catch (e) { setErr(e); }
  };
  return (
    <Box title="Atribuições docentes" icon={<Users className="size-4" />}>
      <Muted>Regência só existe por atribuição explícita: lotação, cargo ou função nunca implicam regência.</Muted>
      <div className="mt-3">
        {a.isLoading ? <Muted>Carregando…</Muted> : a.error ? <Err e={a.error} /> : !a.data?.length ? <Muted>Nenhuma atribuição docente vigente na data.</Muted> : (
          <ul className="grid gap-2 text-sm">
            {a.data.map((x) => (
              <li key={x.assignmentId} className="rounded border border-border p-2">
                <span className="font-medium">{x.label ?? "Elemento sem rótulo declarado"}</span>{" "}
                <Badge variant={x.state === "vigente" ? "secondary" : "destructive"}>{x.state === "vigente" ? "Vigente" : "Com pendência"}</Badge>
                {x.co ? <Badge variant="outline" className="ml-1">Corresponsabilidade: +{x.co}</Badge> : null}
                <p className="text-muted-foreground">{formatAcademicDate(x.from)} – {x.until ? formatAcademicDate(x.until) : "sem término"}</p>
              </li>))}
          </ul>)}
      </div>
      {canEdit && !open ? <Button className="mt-3" size="sm" onClick={() => setOpen(true)}>Registrar atribuição</Button> : null}
      {!canEdit ? <p className="mt-3 text-xs text-muted-foreground">Somente leitura para o seu perfil.</p> : null}
      {open ? (
        <div className="mt-4 space-y-3 rounded border border-border p-3">
          <ProfessionalPicker schoolId={c.schoolId} on={on} onPick={setPick} />
          <div><Label htmlFor="as-el">Elemento curricular</Label>
            <select id="as-el" className="h-9 rounded border border-input bg-background px-2 text-sm" value={elk} onChange={(e) => setElk(e.target.value)}>
              <option value="">Escolha…</option>
              {(el.data ?? []).map((e) => <option key={`${e.matrixVersionId}|${e.itemKey}`} value={`${e.matrixVersionId}|${e.itemKey}`}>{e.label ?? "Elemento sem rótulo declarado"}</option>)}
            </select>
            {!el.data?.length ? <p className="text-sm text-destructive">Nenhuma matriz resolvida para a turma.</p> : null}</div>
          <WindowFields w={w} set={setW} needsReason={false} />
          {err ? <Err e={err} /> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={!pick || !element} onClick={save}>Salvar atribuição</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </div>) : null}
    </Box>
  );
}

function SubstitutionsTab({ c, on, knownAt, canEdit }: TabProps) {
  const qc = useQueryClient();
  const a = useQuery({ queryKey: ["offer-assign", c.classId, on, knownAt], queryFn: () => readAssignments(c.classId, on, knownAt) });
  const s = useQuery({ queryKey: ["offer-subs", c.classId, on, knownAt], queryFn: () => readSubstitutions(c.classId, on, knownAt) });
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [pick, setPick] = useState<{ engagementId: string; functionalLinkId: string } | null>(null);
  const [w, setW] = useState<Window>({ kind: "constituicao", validFrom: on, validUntil: null, sourceRef: null, reason: null });
  const [err, setErr] = useState<unknown>(null);
  const save = async () => {
    if (!pick || !target || !w.validUntil || !w.reason) return;
    setErr(null);
    try {
      await recordSubstitution({ assignmentId: target, substitutionId: null, expectedHead: null, w: { ...w, validUntil: w.validUntil }, engagementId: pick.engagementId, functionalLinkId: pick.functionalLinkId, withdrawn: false });
      setOpen(false); await qc.invalidateQueries({ queryKey: ["offer-subs", c.classId] });
    } catch (e) { setErr(e); }
  };
  return (
    <Box title="Substituições temporárias" icon={<Repeat className="size-4" />}>
      <Muted>A substituição não encerra nem altera a atribuição titular e não muda carga contratual.</Muted>
      <div className="mt-3">
        {s.isLoading ? <Muted>Carregando…</Muted> : s.error ? <Err e={s.error} /> : !s.data?.length ? <Muted>Nenhuma substituição vigente na data.</Muted> : (
          <ul className="grid gap-2 text-sm">
            {s.data.map((x) => {
              const tit = a.data?.find((y) => y.assignmentId === x.assignmentId);
              return (
                <li key={x.substitutionId} className="rounded border border-border p-2">
                  <span className="font-medium">{tit?.label ?? "Elemento sem rótulo declarado"}</span> — substituição de {formatAcademicDate(x.from)} a {formatAcademicDate(x.until)}
                  <p className="text-muted-foreground">Motivo: {x.reason}</p>
                </li>);
            })}
          </ul>)}
      </div>
      {canEdit && !open ? <Button className="mt-3" size="sm" onClick={() => setOpen(true)} disabled={!a.data?.length}>Registrar substituição</Button> : null}
      {!canEdit ? <p className="mt-3 text-xs text-muted-foreground">Somente leitura para o seu perfil.</p> : null}
      {open ? (
        <div className="mt-4 space-y-3 rounded border border-border p-3">
          <div><Label htmlFor="sb-t">Atribuição titular</Label>
            <select id="sb-t" className="h-9 rounded border border-input bg-background px-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Escolha…</option>
              {(a.data ?? []).map((x) => <option key={x.assignmentId} value={x.assignmentId}>{x.label ?? "Elemento sem rótulo declarado"} ({formatAcademicDate(x.from)})</option>)}
            </select></div>
          <ProfessionalPicker schoolId={c.schoolId} on={w.validFrom || on} onPick={setPick} />
          <WindowFields w={w} set={setW} needsReason requireEnd />
          {err ? <Err e={err} /> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={!pick || !target || !w.validUntil || !w.reason} onClick={save}>Salvar substituição</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </div>) : null}
    </Box>
  );
}

function SchoolScheduleTab({ c, on, knownAt }: TabProps) {
  const s = useQuery({ queryKey: ["offer-school-schedule", c.schoolId, on, knownAt], queryFn: () => readSchoolSchedule(c.schoolId, on, knownAt) });
  const l = useQuery({ queryKey: ["offer-school-load", c.schoolId, on, knownAt], queryFn: () => readSchoolLoad(c.schoolId, on, knownAt) });
  if (s.isLoading) return <Box title="Horários dos profissionais da escola" icon={<Clock className="size-4" />}><Muted>Carregando…</Muted></Box>;
  if (s.error) return <Box title="Horários dos profissionais da escola" icon={<Clock className="size-4" />}><Err e={s.error} /></Box>;
  const byPerson = new Map<string, typeof s.data.rows>();
  for (const r of s.data!.rows) byPerson.set(r.personId, [...(byPerson.get(r.personId) ?? []), r]);
  return (
    <Box title="Horários dos profissionais da escola" icon={<Clock className="size-4" />}>
      <Muted>Projeção das atribuições sobre a grade das turmas; nenhum horário do professor é gravado à parte. Professores consultam o próprio horário em <Link className="underline" to="/horarios/profissionais">Meu horário</Link>.</Muted>
      {s.data!.denied ? <Muted>Sem acesso aos horários desta escola.</Muted> : !s.data!.rows.length ? <Muted>Nenhum bloco atribuído na data.</Muted> : (
        <div className="mt-3 grid gap-3">
          {[...byPerson.entries()].map(([pid, rows], idx) => {
            const load = l.data?.find((x) => x.personId === pid);
            return (
              <div key={pid} className="rounded border border-border p-2 text-sm">
                <p className="font-medium">Profissional {idx + 1}</p>
                <ul>{rows.map((r) => (
                  <li key={r.blockId + r.engagementId}>
                    {weekdayLabel(r.weekday)} {r.startsAt}–{r.endsAt} · {r.className} · {r.label ?? "Elemento sem rótulo declarado"} · {r.origin === "titular" ? "titular" : "substituição"}
                    {r.conflicts.length ? <Badge variant="destructive" className="ml-1">Conflito temporal potencial</Badge> : null}
                  </li>))}</ul>
                <p className="text-muted-foreground">Carga atribuída: {load ? `${load.blocks} bloco(s), ${load.minutes} min` : "indisponível"} · {balanceText(null, load?.minutes ?? null)}</p>
              </div>);
          })}
        </div>)}
    </Box>
  );
}

function ReadinessTab({ c, on, knownAt }: TabProps) {
  const r = useQuery({ queryKey: ["offer-readiness", c.classId, on, knownAt], queryFn: () => readReadiness(c.classId, on, knownAt) });
  const res = r.data ? readinessResult(r.data) : null;
  return (
    <Box title="Prontidão para o Diário" icon={<ClipboardCheck className="size-4" />}>
      <Muted>Painel informativo. O Diário não é aberto aqui; ele dependerá do ano operacional e da atribuição docente.</Muted>
      {r.isLoading ? <Muted>Carregando…</Muted> : r.error ? <Err e={r.error} /> : (
        <>
          <p className="mt-2 text-sm">Resultado: <Badge variant={res === "ready" ? "secondary" : "destructive"}>{res === "ready" ? "Pronta" : res === "blocked" ? "Bloqueada" : "Indisponível"}</Badge></p>
          <ul className="mt-2 grid gap-1 text-sm">
            {r.data!.filter((x) => x.scope !== "resultado").map((x, i) => (
              <li key={i}>{x.scope === "bloco" ? `Bloco ${x.subjectRef}: ` : ""}{readinessText(x.code)}</li>))}
          </ul>
        </>)}
    </Box>
  );
}
