import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { attentionItems, pictureFacts } from "./functional-attention";
import { functionalMessage, functionalPicture, functionalTimeline, VALIDITY_LABEL, type Sources } from "./functional-life";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
const field = "mt-1 block w-full rounded border bg-background p-2";
const today = () => new Date().toISOString().slice(0, 10);
const br = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "não informado");

async function readAll(t: string, col: string, school: string) {
  const { data, error } = await db.from(t).select("*").eq(col, school).limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function FunctionalLifePage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [school, setSchool] = useState(""); const [on, setOn] = useState(today()); const [known, setKnown] = useState("");
  useEffect(() => {
    (async () => {
      const { data: caps, error } = await db.rpc("effective_scope_capabilities", {});
      if (error) throw new Error(error.message);
      const mine = (caps ?? []).filter((c: any) => c.policy_id && c.capability_id === "consultar-registro-funcional");
      if (!mine.length) return [];
      const { data } = await db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false });
      const names = new Map<string, string>(); for (const r of data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
      const ids = mine.some((c: any) => c.scope_level === "rede") ? [...names.keys()] : [...new Set<string>(mine.map((c: any) => c.school_id).filter(Boolean))];
      return ids.map((id) => ({ id, name: names.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name));
    })().then((s) => { setSchools(s); if (s.length === 1) setSchool(s[0]!.id); }, (e: Error) => setErr(functionalMessage(e.message)));
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Departamento Pessoal" title="Profissionais da escola" description="Consulta por escola. A vida funcional administrativa (vínculos, lotações, eventos, atos, processos) é registrada no SIGEM; folha, previdência, pensão e consignações ficam fora. Vínculo, lotação, presença na escola e regência são fatos distintos — regência nunca vem do DP." />
      {err ? <StatePanel tone="danger" title="Não foi possível abrir" description={err} />
        : !schools ? <p className="text-sm text-muted-foreground" role="status">Carregando…</p>
        : schools.length === 0 ? <EmptyState title="Sem acesso ao registro funcional" description="Sua atuação não tem permissão vigente para consultar o registro funcional de nenhuma escola. Cargo ou vínculo não dão essa permissão." />
        : <>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <label>Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Situação na data<DateInput value={on} onChange={(e) => setOn(e.target.value)} /></label>
              <label>Como era conhecido em (opcional)<DateInput value={known} onChange={(e) => setKnown(e.target.value)} /></label>
            </div>
            {school && on && <SchoolView key={school} school={school} on={on} knownAt={known ? `${known}T23:59:59.999Z` : null} />}
          </>}
    </div>
  );
}

function SchoolView({ school, on, knownAt }: { school: string; on: string; knownAt: string | null }) {
  const [src, setSrc] = useState<Sources | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const [postings, exercises, qualifications, events, processes] = await Promise.all([
        readAll("professional_postings", "school_id", school), readAll("professional_exercises", "school_id", school),
        readAll("professional_qualifications", "school_id", school), readAll("professional_functional_events", "school_id", school),
        readAll("professional_functional_processes", "school_id", school)]);
      const linkIds = [...new Set(postings.map((p: any) => p.functional_link_logical_id))];
      const links = linkIds.length ? (await db.from("professional_functional_links").select("*").in("logical_id", linkIds)).data ?? [] : [];
      const persons = [...new Set<string>(links.map((l: any) => l.person_id))];
      const engagements = persons.length ? (await db.from("institutional_engagements").select("id, person_id, engagement_kind_id, school_id, scope_level, valid_from, valid_until, created_at").in("person_id", persons)).data ?? [] : [];
      const ppl = persons.length ? (await db.from("institutional_persons").select("id, display_name").in("id", persons)).data ?? [] : [];
      setNames(new Map(ppl.map((p: any) => [p.id, p.display_name])));
      setSrc({ links, postings, exercises, qualifications, events, processes, engagements });
    })().catch((e: Error) => setErr(functionalMessage(e.message)));
  }, [school]);
  const picture = useMemo(() => (src ? functionalPicture(src, school, on, knownAt) : null), [src, school, on, knownAt]);
  if (err) return <StatePanel tone="danger" title="Registro funcional indisponível" description={err} />;
  if (!picture) return <p className="text-sm text-muted-foreground" role="status">Carregando registro funcional…</p>;
  if (!picture.length) return <EmptyState title="Nenhuma lotação registrada nesta escola" description="Não há vínculo funcional com lotação nesta escola até a data de conhecimento escolhida. Isso não significa quadro zerado: o registro pode ainda não ter sido feito." />;
  const attention = attentionItems(pictureFacts(picture), on, 30);
  return (
    <div className="space-y-4">
    <section aria-labelledby="dp-atencao" className="rounded border p-4 text-sm">
      <h2 id="dp-atencao" className="font-semibold">O que precisa de atenção (próximos 30 dias)</h2>
      {attention.length === 0 ? <p className="text-muted-foreground">Nenhum término declarado de vínculo ou lotação vencido ou nos próximos 30 dias. Prazos sem regra institucional (probatório, quinquênio, aposentadoria, acúmulo) não são calculados.</p>
        : <ul className="mt-2 space-y-1">{attention.map((a) => <li key={a.factId}>{names.get(a.personId) ?? "Pessoa sem nome disponível"} — {a.label} em {br(a.date)} <em>({a.state === "vencido" ? "já passou" : "em breve"})</em></li>)}</ul>}
    </section>
    <ul className="space-y-4">
      {picture.map((p) => (
        <li key={p.personId} className="rounded border p-4">
          <h2 className="font-semibold">{names.get(p.personId) ?? "Pessoa sem nome disponível"}</h2>
          {p.links.map((l) => (
            <section key={l.link.logical_id} className="mt-3 rounded bg-muted/40 p-3 text-sm" aria-label={`Vínculo ${l.link.functional_registration ?? ""}`}>
              <p><strong>Vínculo</strong> {l.link.functional_registration ? `matrícula ${l.link.functional_registration}` : "sem matrícula funcional"} · natureza {l.link.link_nature_id} · cargo {l.link.position_id ?? "não informado"} · {br(l.link.valid_from)} a {l.link.valid_until ? br(l.link.valid_until) : "em aberto"} — <em>{VALIDITY_LABEL[l.validity]}</em> (v{l.link.version})</p>
              <p><strong>Lotação</strong> {l.postings.length ? l.postings.map((x) => `${br(x.posting.valid_from)} a ${x.posting.valid_until ? br(x.posting.valid_until) : "em aberto"} (${VALIDITY_LABEL[x.validity]})`).join("; ") : "nenhuma"}</p>
              <p><strong>Exercício</strong> {l.exercises.length ? l.exercises.map((e) => `${e.function_id} desde ${br(e.valid_from)}`).join("; ") : "nenhum exercício vigente registrado"}</p>
              {p.exerciseWithoutPosting.includes(l.link.logical_id) && <p className="text-warning-foreground">Exercício vigente sem lotação vigente deste vínculo na escola.</p>}
              <p><strong>Eventos</strong> {l.events.length ? l.events.map((e) => `${e.event_kind_id} em ${br(e.occurred_on)}`).join("; ") : "nenhum"}</p>
              <p><strong>Processos</strong> {l.processes.length ? l.processes.map((x) => `${x.process_kind_id} aberto em ${br(x.opened_on)}${x.closed_on ? `, encerrado em ${br(x.closed_on)}` : ""}`).join("; ") : "nenhum"}</p>
            </section>
          ))}
          <p className="mt-2 text-sm"><strong>Habilitações</strong> {p.qualifications.length ? p.qualifications.map((q) => q.qualification_id).join(", ") : "nenhuma registrada"} <span className="text-muted-foreground">(não dão permissão no sistema)</span></p>
          <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium">Linha do tempo funcional</summary>
            <ol className="mt-2 space-y-1 border-l pl-3">{functionalTimeline(p).map((e, i) => <li key={i}><span className="text-muted-foreground">{e.date ? br(e.date) : "sem data registrada"}</span> — {e.label}</li>)}</ol>
          </details>
          <p className="text-sm"><strong>Atuação no SIGEM</strong> {p.engagements.length ? p.engagements.map((e) => `${e.engagement_kind_id} (${e.scope_level ?? "escopo não informado"})`).join("; ") : "nenhuma atuação vigente — sem permissão no sistema por esta escola"}</p>
        </li>
      ))}
    </ul>
    </div>
  );
}
