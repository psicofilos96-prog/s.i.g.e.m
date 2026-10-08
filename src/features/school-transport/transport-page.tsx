import { readPages } from "@/lib/list-paging";
import { operationalToday } from "@/lib/academic-date";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { DateInput } from "@/components/sigem/date-input";
import { ExportButtons } from "@/features/performance/station-sections";
import { runReport, toCsv, toPrintableHtml } from "@/features/reports/report-engine";
import { TRANSPORTE_ROTAS, transportReportRows, duplicatedStudents, transportMessage, transportPicture, type TransportFact } from "./transport-model";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
const field = "mt-1 block w-full rounded border bg-background p-2";
const today = () => operationalToday();
const CAPS = ["consultar-transporte-escolar", "manter-transporte-escolar"];

type School = { id: string; name: string; canWrite: boolean };

export function TransportPage() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [school, setSchool] = useState("");
  const [on, setOn] = useState(today());
  useEffect(() => {
    (async () => {
      const { data: caps, error } = await db.rpc("effective_scope_capabilities", {});
      if (error) throw new Error(error.message);
      const mine = (caps ?? []).filter((c: any) => c.policy_id && CAPS.includes(c.capability_id));
      if (!mine.length) return [];
      const { data } = await db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false });
      const names = new Map<string, string>(); for (const r of data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
      const net = mine.some((c: any) => c.scope_level === "rede");
      const ids = net ? [...names.keys()] : [...new Set<string>(mine.map((c: any) => c.school_id).filter(Boolean))];
      const write = (id: string) => mine.some((c: any) => c.capability_id === "manter-transporte-escolar" && (c.school_id === id || c.scope_level === "rede"));
      return ids.map((id) => ({ id, name: names.get(id) ?? "Escola sem nome registrado", canWrite: write(id) })).sort((a, b) => a.name.localeCompare(b.name));
    })().then((s) => { setSchools(s); if (s.length === 1) setSchool(s[0]!.id); }, (e: Error) => setErr(transportMessage(e.message)));
  }, []);
  const current = schools?.find((s) => s.id === school);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Serviços da escola" title="Transporte escolar" description="Rotas, pontos e estudantes atendidos, como registrados pela escola. O SIGEM não calcula quem tem direito ao transporte: isso depende de regra institucional ainda não configurada." />
      {err ? <StatePanel tone="danger" title="Não foi possível abrir" description={err} />
        : !schools ? <SkeletonState label="Carregando escolas" />
        : schools.length === 0 ? <EmptyState title="Sem acesso ao transporte escolar" description="Sua conta não tem permissão vigente para consultar o transporte de nenhuma escola. Peça a atribuição à administração." />
        : <>
            <div className="grid gap-3 text-sm sm:grid-cols-2 print:hidden">
              <label>Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Situação na data<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
            </div>
            {current && on && <SchoolTransport key={current.id} school={current} on={on} />}
          </>}
    </div>
  );
}

function SchoolTransport({ school, on }: { school: School; on: string }) {
  const [rows, setRows] = useState<TransportFact[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    setErr(null);
    readPages<any>((a, b) => db.from("school_transport_facts").select("*").eq("school_id", school.id).order("id").range(a, b), 20000)
      .then(({ data, error }: any) => error ? setErr(transportMessage(error.message)) : setRows(data ?? []));
  }, [school.id]);
  useEffect(load, [load]);
  if (err) return <StatePanel tone="danger" title="Não foi possível consultar o transporte" description={err} />;
  if (!rows) return <SkeletonState label="Carregando transporte" />;
  const pic = transportPicture(rows, school.id, on);
  const dup = duplicatedStudents(pic);
  return (
    <section className="space-y-4" aria-labelledby={`transporte-${school.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`transporte-${school.id}`} className="text-lg font-semibold">{school.name}</h2>
        {pic.length > 0 && <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => window.print()}>Imprimir rotas</button>
          <ExportButtons name={`transporte-${school.id}-${on}`} make={() => { const b = { headerLines: [school.name], title: `${TRANSPORTE_ROTAS.title} — ${on}` }; const r = runReport(TRANSPORTE_ROTAS, { params: { on } }, transportReportRows(pic)); const m = ["Quantidade como registrada; não é cálculo de direito ao transporte.", "\"não disponível\" = ponto não registrado; não é zero."]; return { ok: true as const, csv: toCsv(r, b, m), html: toPrintableHtml(r, b, m) }; }} />
        </div>}
      </div>
      {dup.length > 0 && <StatePanel tone="warning" title="Estudante em mais de um ponto" description={`${dup.length} estudante(s) aparecem em mais de um ponto vigente. Nenhum é escolhido automaticamente: corrija o vínculo.`} />}
      {pic.length === 0 ? <EmptyState title="Nenhuma rota vigente nesta data" description="A escola ainda não registrou rotas válidas para esta data. Ausência de registro não significa que não há transporte." />
        : <ol className="space-y-3">{pic.map((p) => (
            <li key={p.route.logical_id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{p.route.label ?? "Rota sem nome"}</p>
              {p.stops.length === 0 ? <p className="text-muted-foreground">Nenhum ponto registrado.</p>
                : <ul className="mt-1 list-disc pl-5">{p.stops.map((s) => <li key={s.stop.logical_id}>{s.stop.label ?? "Ponto sem nome"} — {s.students.length} estudante(s) vinculado(s)</li>)}</ul>}
              {school.canWrite && <StopForm school={school.id} route={p.route.logical_id} onDone={load} />}
            </li>))}</ol>}
      {school.canWrite && <RouteForm school={school.id} onDone={load} />}
      {school.canWrite && <StudentLinkForm school={school.id} onDone={load} stops={pic.flatMap((p) => p.stops.map((s) => ({ id: s.stop.logical_id, label: `${p.route.label ?? "Rota"} — ${s.stop.label ?? "Ponto"}` })))} />}
    </section>
  );
}

function useRecord(onDone: () => void) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (args: Record<string, unknown>) => {
    setBusy(true); setMsg(null);
    const { error } = await db.rpc("record_school_transport_fact", { _expected_version: 0, _route: null, _stop: null, _student: null, _valid_until: null, _revoked: false, _logical: crypto.randomUUID(), ...args });
    setBusy(false);
    if (error) setMsg(transportMessage(error.message)); else { setMsg("Registrado."); onDone(); }
  };
  return { msg, busy, run };
}

function RouteForm({ school, onDone }: { school: string; onDone: () => void }) {
  const [label, setLabel] = useState(""); const [from, setFrom] = useState(today());
  const r = useRecord(onDone);
  return (
    <form className="grid gap-2 rounded-md border border-dashed p-3 text-sm sm:grid-cols-3 print:hidden" onSubmit={(e) => { e.preventDefault(); if (label.trim()) void r.run({ _school: school, _kind: "rota", _label: label.trim(), _valid_from: from }); }}>
      <label>Nova rota<input className={field} value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} /></label>
      <label>Vale a partir de<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <div className="flex items-end gap-2"><button disabled={r.busy || !label.trim()} className="rounded bg-primary px-3 py-2 text-primary-foreground">Registrar rota</button><span role="status">{r.msg}</span></div>
    </form>
  );
}

function StopForm({ school, route, onDone }: { school: string; route: string; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const r = useRecord(onDone);
  return (
    <form className="mt-2 flex flex-wrap items-end gap-2 print:hidden" onSubmit={(e) => { e.preventDefault(); if (label.trim()) void r.run({ _school: school, _kind: "ponto", _route: route, _label: label.trim(), _valid_from: today() }); }}>
      <label className="text-xs">Novo ponto<input className={field} value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)} /></label>
      <button disabled={r.busy || !label.trim()} className="rounded border px-3 py-2 text-xs">Adicionar ponto</button><span role="status" className="text-xs">{r.msg}</span>
    </form>
  );
}

/** Vínculo estudante↔ponto: a busca usa o cadastro canônico com o acesso da própria conta;
 * o banco recusa estudante sem matrícula na escola (record_school_transport_fact). */
export function StudentLinkForm({ school, stops, onDone }: { school: string; stops: { id: string; label: string }[]; onDone: () => void }) {
  const [q, setQ] = useState(""); const [stop, setStop] = useState(""); const [student, setStudent] = useState("");
  const [found, setFound] = useState<{ id: string; display_name: string | null; institutional_identifier: string | null }[]>([]);
  const r = useRecord(onDone);
  const search = async () => {
    const term = q.trim(); if (term.length < 3) return;
    const { data } = await db.from("institutional_students").select("id, display_name, institutional_identifier")
      .or(`display_name.ilike.%${term.replace(/[%,()]/g, "")}%,institutional_identifier.eq.${term.replace(/[^0-9A-Za-z-]/g, "")}`).limit(20);
    setFound(data ?? []); setStudent("");
  };
  if (!stops.length) return null;
  return (
    <form className="grid gap-2 rounded-md border border-dashed p-3 text-sm sm:grid-cols-4 print:hidden" onSubmit={(e) => { e.preventDefault(); if (stop && student) void r.run({ _school: school, _kind: "vinculo-estudante", _stop: stop, _student: student, _valid_from: today() }); }}>
      <label>Buscar estudante (nome ou número)<input className={field} value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => void search()} /></label>
      <label>Estudante<select className={field} value={student} onChange={(e) => setStudent(e.target.value)}><option value="">{found.length ? "Escolha…" : "Busque primeiro"}</option>{found.map((s) => <option key={s.id} value={s.id}>{s.display_name ?? "Sem nome registrado"}{s.institutional_identifier ? ` — nº ${s.institutional_identifier}` : ""}</option>)}</select></label>
      <label>Ponto<select className={field} value={stop} onChange={(e) => setStop(e.target.value)}><option value="">Escolha…</option>{stops.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <div className="flex items-end gap-2"><button disabled={r.busy || !stop || !student} className="rounded bg-primary px-3 py-2 text-primary-foreground">Vincular estudante</button><span role="status">{r.msg}</span></div>
    </form>
  );
}
