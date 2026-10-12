import { userErrorText } from "@/lib/observability/governed-errors";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, NoteBox } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/features/authority/session-authority";
import {
  ANALYSIS_LABEL, analysisProblems, applicationHistory, listApplications, pageInfo, PAGE_SIZE, recordAnalysis, rowStatus,
  type AdminApplication, type AnalysisKind,
} from "./admin-panel";
import { PROTOCOL_IS_NOT_VACANCY } from "./application-protocol";
import { NON_BLOCKING_NOTICE } from "./application-documents";
import { SignalsSection } from "./signals-section";

export function AdminPanelPage() {
  const { loading, user } = useSessionUser();
  if (loading) return <p role="status" className="text-sm text-muted-foreground">Verificando sessão…</p>;
  if (!user) return <SignInRequired title="Inscrições de matrícula" what="as inscrições do portal" />;
  return <Panel userId={user.id} />;
}

function Panel({ userId }: { userId: string }) {
  const [campaign, setCampaign] = useState("");
  const [school, setSchool] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<AdminApplication | null>(null);
  const filters = { c: campaign.trim() || null, s: school.trim() || null };
  const q = useQuery({
    queryKey: ["enr-admin", userId, filters.c, filters.s, offset],
    queryFn: () => listApplications(filters.c, filters.s, offset),
    retry: 1,
  });
  const info = pageInfo(q.data ?? [], offset);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SIGEM Matrículas" title="Inscrições de matrícula" description="Pedidos recebidos pelo portal, no alcance da sua competência por campanha e escola." />
      <NoteBox>{PROTOCOL_IS_NOT_VACANCY} {NON_BLOCKING_NOTICE}</NoteBox>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setOffset(0); }}>
        <label className="grid gap-1 text-sm text-foreground">Campanha (identificador)
          <input className="h-10 rounded-md border border-input bg-background px-2" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm text-foreground">Escola (código)
          <input className="h-10 rounded-md border border-input bg-background px-2" value={school} onChange={(e) => setSchool(e.target.value)} />
        </label>
      </form>
      {q.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando inscrições…</p>}
      {q.isError && <p role="alert" className="text-sm text-destructive">{(q.error as Error).message} <Button variant="link" onClick={() => q.refetch()}>Tentar novamente</Button></p>}
      {q.isSuccess && info.total === 0 && <NoteBox>Nenhuma inscrição no seu alcance com estes filtros.</NoteBox>}
      {q.isSuccess && info.total > 0 && (
        <>
          <p className="text-sm text-muted-foreground">Mostrando {info.from}–{info.to} de {info.total}.</p>
          <ul className="grid gap-2">
            {q.data.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{r.student_name}</span>
                  <span className="text-muted-foreground">{r.protocol_number ?? r.application_code} · {rowStatus(r)}</span>
                </div>
                <p className="text-muted-foreground">Etapa {r.stage_id} · {r.modality_id} · Escolas: {r.school_preferences.join(" › ")}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(open?.id === r.id ? null : r)}>{open?.id === r.id ? "Fechar" : "Analisar"}</Button>
                {open?.id === r.id && <Detail app={r} />}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Anteriores</Button>
            <Button variant="outline" disabled={!info.hasMore} onClick={() => setOffset(offset + PAGE_SIZE)}>Próximas</Button>
          </div>
        </>
      )}
    </div>
  );
}

function Detail({ app }: { app: AdminApplication }) {
  const qc = useQueryClient();
  const h = useQuery({ queryKey: ["enr-admin-history", app.id], queryFn: () => applicationHistory(app.id) });
  const [kind, setKind] = useState<AnalysisKind>("anotacao");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const seq = (h.data ?? []).filter((x) => x.kind in ANALYSIS_LABEL).length;
  async function save() {
    const p = analysisProblems({ subject, note });
    if (p.length) return setMsg(p.join(" "));
    try {
      await recordAnalysis(app.id, seq, kind, subject, note, `${key}-${seq}`);
      setSubject(""); setNote(""); setMsg("Registrado.");
      await qc.invalidateQueries({ queryKey: ["enr-admin-history", app.id] });
      await qc.invalidateQueries({ queryKey: ["enr-admin"] });
    } catch (e) { setMsg(userErrorText(e)); }
  }
  return (
    <div className="mt-3 grid gap-3 border-t border-border pt-3">
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Quem pede</dt><dd>{app.requester_name} ({app.requester_kind === "responsavel" ? `declarou: ${app.declared_kinship}` : "estudante adulto"})</dd></div>
        <div><dt className="text-muted-foreground">Contato</dt><dd>{app.requester_email ?? "—"} · {app.requester_phone ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Nascimento</dt><dd>{app.student_birth_date}</dd></div>
        <div><dt className="text-muted-foreground">Documentos</dt><dd>{app.docs_total} tipo(s), {app.docs_pending} a conferir</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Parentesco é só declarado; não cria vínculo de responsável.</p>
      <SignalsSection appId={app.id} />
      <section aria-label="Histórico">
        <h3 className="text-sm font-medium text-foreground">Histórico</h3>
        {h.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando…</p>}
        {h.isError && <p role="alert" className="text-sm text-destructive">{(h.error as Error).message}</p>}
        <ol className="grid gap-1 text-sm">{(h.data ?? []).map((x, i) => <li key={i}><span className="text-muted-foreground">{new Date(x.at).toLocaleString("pt-BR")}</span> · {x.detail}</li>)}</ol>
      </section>
      <section aria-label="Registrar análise" className="grid gap-2">
        <select aria-label="Tipo de registro" className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as AnalysisKind)}>
          {Object.entries(ANALYSIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input aria-label="Assunto" placeholder="Assunto (ex.: comprovante de residência)" className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea aria-label="Texto" className="min-h-20 rounded-md border border-input bg-background p-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" onClick={save}>Registrar</Button>
        {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
      </section>
    </div>
  );
}
