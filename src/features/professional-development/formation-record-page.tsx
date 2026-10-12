/** L17 — "Meu histórico formativo" e consulta administrativa com finalidade. Lê só após sessão, por funções do banco. */
import { useEffect, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { callRpc } from "@/lib/rpc-call";
import { formatHours } from "./certificates";
import { itemSituation, type FormationRecord } from "./formation-record";

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
