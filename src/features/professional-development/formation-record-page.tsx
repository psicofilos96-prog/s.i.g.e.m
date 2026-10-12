/** L17 — "Meu histórico formativo" e consulta administrativa com finalidade. Lê só após sessão, por funções do banco. */
import { useEffect, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { callRpc } from "@/lib/rpc-call";
import { formatHours } from "./certificates";
import { itemSituation, type FormationRecord } from "./formation-record";
import { supabase } from "@/integrations/supabase/client";
import { PROGRESSION_NOTE } from "./external-trainings";
import { externalHistory, type ExternalHistoryItem } from "./development-flow";
import { readPages } from "@/lib/list-paging";

export function FormationRecordPage() {
  const a = useSessionAuthority();
  if (a.status === "signed-out") return <SignInRequired title="Histórico formativo" what="o seu histórico de formação" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  return <Body />;
}

function Body() {
  const [own, setOwn] = useState<{ r?: FormationRecord | null; err?: string } | null>(null);
  const [adm, setAdm] = useState<{ r?: FormationRecord; err?: string } | null>(null);
  const [person, setPerson] = useState("");
  const [purpose, setPurpose] = useState("");
  useEffect(() => {
    let live = true;
    callRpc<FormationRecord | null>("dev_my_formation_record").then((r) => live && setOwn({ r }))
      .catch(() => live && setOwn({ err: "Histórico indisponível para a sua conta." }));
    return () => { live = false; };
  }, []);
  const consult = async () => {
    setAdm(null);
    try { setAdm({ r: await callRpc<FormationRecord>("dev_formation_record", { _person: person.trim(), _purpose: purpose }) }); }
    catch { setAdm({ err: "Consulta recusada: exige capacidade de consulta e finalidade (mín. 10 caracteres)." }); }
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Histórico formativo" description="Cursos, cargas, trilhas e certificados, com o vínculo da época de cada inscrição." />
      <section aria-labelledby="own-h" className="space-y-2">
        <h2 id="own-h" className="text-lg font-semibold">Meu histórico</h2>
        {!own ? <SkeletonState label="Carregando histórico" /> : own.err ? <p role="alert" className="text-destructive">{own.err}</p>
          : !own.r ? <p className="text-muted-foreground">Sua conta não está ligada a uma pessoa do cadastro; não há histórico a mostrar.</p>
          : <RecordView r={own.r} />}
      </section>
      {own?.r ? <ExternalSection personId={own.r.person_id} /> : null}
      <section aria-labelledby="adm-h" className="space-y-2 rounded-md border border-border p-4">
        <h2 id="adm-h" className="text-lg font-semibold">Consulta administrativa</h2>
        <p className="text-sm text-muted-foreground">Só com capacidade própria; a finalidade fica registrada e o titular pode ver quem consultou.</p>
        <label className="block text-sm">Identificador da pessoa
          <input className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1" value={person} onChange={(e) => setPerson(e.target.value)} /></label>
        <label className="block text-sm">Finalidade
          <input className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
        <button type="button" className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!person.trim() || purpose.trim().length < 10} onClick={consult}>Consultar</button>
        {adm?.err && <p role="alert" className="text-destructive">{adm.err}</p>}
        {adm?.r && <RecordView r={adm.r} />}
      </section>
    </div>
  );
}

function RecordView({ r }: { r: FormationRecord }) {
  return (
    <div className="space-y-3 text-sm">
      <p>Carga cumprida (só conclusões confirmadas): <strong>{formatHours(r.completed_hours_minutes)}</strong></p>
      {r.items.length === 0 ? <p className="text-muted-foreground">Nenhuma inscrição registrada.</p> : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {r.items.map((i) => (
            <li key={i.enrollment_id} className="p-3">
              <p className="font-medium">{i.course_title} <span className="text-muted-foreground">v{i.course_version} · {i.class_label}</span></p>
              <p>{i.starts_on} a {i.ends_on} · {itemSituation(i)} · carga {i.hours_minutes == null ? `prevista ${formatHours(i.nominal_hours_minutes)}` : formatHours(i.hours_minutes)}</p>
              <p className="text-muted-foreground">Vínculo na época: {i.link_at_time?.registration ?? "não informado"}</p>
              {i.certificate && <p>Certificado {i.certificate.code} (v{i.certificate.version}, {i.certificate.status === "valido" ? "válido" : "revogado"})</p>}
            </li>
          ))}
        </ul>
      )}
      {r.tracks.length > 0 && <div><h3 className="font-semibold">Trilhas</h3>
        <ul>{r.tracks.map((t) => <li key={t.track_version_id}>{t.title} (v{t.version}): {t.steps_done} de {t.steps_total} etapas obrigatórias</li>)}</ul></div>}
    </div>
  );
}

const EXT_STATE: Record<string, string> = { submetida: "Submetida", conferida: "Conferida", analisada: "Analisada", validado: "Validada", indeferido: "Indeferida", devolvido: "Devolvida" };

function ExternalSection({ personId }: { personId: string }) {
  // Lote 20: só formações da própria pessoa (a RLS pode mostrar mais a quem gere); carga validada à parte da interna.
  const [s, setS] = useState<{ rows?: ExternalHistoryItem[]; minutes?: number; truncated?: boolean; err?: string } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const t = await readPages<{ id: string }>((f, to) => supabase.from("dev_external_trainings").select("id").eq("person_id", personId).order("id").range(f, to), 20000);
      const ids = (t.data ?? []).map((x) => x.id);
      const v = ids.length ? await readPages<{ id: string; training_id: string; version: number; title: string; provider: string; hours_minutes: number; period_start: string; period_end: string }>((f, to) => supabase.from("dev_external_training_versions")
        .select("id, training_id, version, title, provider, hours_minutes, period_start, period_end").in("training_id", ids).order("id").range(f, to), 20000) : { data: [], error: null, truncated: false };
      const vids = (v.data ?? []).map((x) => x.id);
      const r = vids.length ? await readPages<{ version_id: string; seq: number; stage: string; outcome: string }>((f, to) => supabase.from("dev_external_training_reviews")
        .select("version_id, seq, stage, outcome").in("version_id", vids).order("version_id").order("seq").range(f, to), 20000) : { data: [], error: null, truncated: false };
      if (!live) return;
      if (t.error || v.error || r.error) { setS({ err: "Formações externas indisponíveis para a sua conta." }); return; }
      const h = externalHistory(new Set(ids), v.data ?? [], r.data ?? []);
      setS({ rows: h.items, minutes: h.validatedMinutes, truncated: t.truncated || v.truncated || r.truncated });
    })();
    return () => { live = false; };
  }, [personId]);
  return (
    <section aria-labelledby="ext-h" className="space-y-2">
      <h2 id="ext-h" className="text-lg font-semibold">Formações externas</h2>
      <p className="text-sm text-muted-foreground">{PROGRESSION_NOTE}</p>
      {s?.rows && <p className="text-sm">Carga externa validada (separada da carga interna): <strong>{formatHours(s.minutes ?? 0)}</strong>{s.truncated ? " — lista incompleta: limite de leitura atingido" : ""}</p>}
      {!s ? <SkeletonState label="Carregando formações externas" /> : s.err ? <p role="alert" className="text-destructive">{s.err}</p>
        : s.rows!.length === 0 ? <p className="text-muted-foreground">Nenhuma formação externa submetida.</p> : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {s.rows!.map((x) => <li key={x.id} className="p-3"><p className="font-medium">{x.title} <span className="text-muted-foreground">· {x.provider} · v{x.version}</span></p>
            <p>{x.period_start} a {x.period_end} · {formatHours(x.hours_minutes)} · {EXT_STATE[x.state] ?? "Situação não reconhecida"}</p></li>)}
        </ul>)}
    </section>
  );
}
