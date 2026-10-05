import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { ConcurrencyConflictNotice, DangerAction, ErrorState, LoadingState, VersionStateBadge, type VersionState } from "@/components/sigem/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { capabilityFor, useSessionAuthority } from "@/features/authority/session-authority";
import { listPublicationsInternal, recordPublication } from "./portal-source";
import { isValidSlug, KIND_LABEL, PUBLISHABLE_KINDS, type PublishableKind, type PublicationState } from "./portal-model";

const CAP = "publicar-conteudo-publico";
const STATE_VIEW: Record<PublicationState, VersionState> = { rascunho: "rascunho", publicado: "efetivo", revogado: "revogado" };

export function PublicationsAdminPage() {
  const authority = useSessionAuthority();
  const allowed = authority.status === "signed-in" && !!capabilityFor(authority.capabilities, CAP, {});
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["publications-internal"], queryFn: listPublicationsInternal, enabled: allowed });
  const [form, setForm] = useState({ kind: "comunicado" as PublishableKind, slug: "", title: "", summary: "", body: "", reason: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const current = useMemo(() => {
    const p = q.data?.publications.find((x) => x.slug === form.slug);
    const v = p ? q.data!.versions.filter((x) => x.publication_id === p.id) : [];
    return { pub: p ?? null, versions: v, head: v[0] ?? null };
  }, [q.data, form.slug]);

  if (authority.status !== "signed-in") return <EmptyState title="Entre para gerenciar publicações" description="Esta área exige autenticação." />;
  if (!allowed) return <EmptyState title="Sem permissão para publicar" description={`Sua conta não tem a capacidade "${CAP}" em política homologada.`} />;

  async function save(state: PublicationState) {
    setMsg(null); setConflict(false);
    if (!isValidSlug(form.slug)) { setMsg("Endereço inválido: use letras minúsculas, números e hífens (3 a 120)."); return; }
    try {
      const r = await recordPublication({ kind: current.pub ? (current.pub.kind as PublishableKind) : form.kind, slug: form.slug, state,
        title: form.title, summary: form.summary || null, body: form.body, reason: form.reason || null, expectedVersion: current.head?.version ?? 0 });
      setMsg(`Versão ${r.version} registrada (${state}).`);
      await qc.invalidateQueries({ queryKey: ["publications-internal"] });
      await qc.invalidateQueries({ queryKey: ["public-portal"] });
    } catch (e) { if ((e as Error).message === "conflito") setConflict(true); else setMsg((e as Error).message); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Publicações do portal público" description="Só o que for publicado aqui aparece sem login. Cada mudança é uma nova versão; revogar retira do portal sem apagar o histórico." />
      {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState description="Não foi possível ler as publicações." onRetry={() => q.refetch()} /> : (
        <ul className="space-y-2">
          {(q.data?.publications ?? []).length === 0 && <EmptyState compact title="Nenhuma publicação" description="Crie a primeira no formulário abaixo." />}
          {q.data?.publications.map((p) => {
            const h = q.data.versions.find((v) => v.publication_id === p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-sm">
                {h && <VersionStateBadge state={STATE_VIEW[h.state]} version={h.version} />}
                <span className="font-medium">{h?.title}</span>
                <span className="text-muted-foreground">{KIND_LABEL[p.kind as PublishableKind]} · /publico/{p.slug}</span>
                <Button size="sm" variant="ghost" onClick={() => h && setForm({ kind: p.kind as PublishableKind, slug: p.slug, title: h.title, summary: h.summary ?? "", body: h.body, reason: "" })}>Editar</Button>
                {h?.state === "publicado" && <Button size="sm" variant="ghost" asChild><Link to="/publico/$slug" params={{ slug: p.slug }}>Ver público</Link></Button>}
              </li>
            );
          })}
        </ul>
      )}
      <section className="space-y-3 rounded-md border border-border p-4" aria-labelledby="form-pub">
        <h2 id="form-pub" className="font-semibold">{current.pub ? `Nova versão de "${form.slug}" (atual: v${current.head?.version})` : "Nova publicação"}</h2>
        {conflict && <ConcurrencyConflictNotice onReload={() => { setConflict(false); q.refetch(); }} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="pub-kind">Tipo</Label>
            <select id="pub-kind" disabled={!!current.pub} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PublishableKind })}>
              {PUBLISHABLE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select></div>
          <div><Label htmlFor="pub-slug">Endereço (/publico/…)</Label><Input id="pub-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.trim() })} /></div>
        </div>
        <div><Label htmlFor="pub-title">Título</Label><Input id="pub-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label htmlFor="pub-summary">Resumo</Label><Input id="pub-summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
        <div><Label htmlFor="pub-body">Texto</Label><Textarea id="pub-body" rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">Não inclua nomes de estudantes, servidores, contatos privados, notas ou frequência: o texto publicado fica acessível a qualquer pessoa.</p>
        <div><Label htmlFor="pub-reason">Motivo (obrigatório para revogar)</Label><Input id="pub-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => save("rascunho")}>Salvar rascunho</Button>
          <Button onClick={() => save("publicado")}>Publicar</Button>
          {current.head?.state === "publicado" && (
            <DangerAction trigger="Revogar" title="Revogar esta publicação?" confirmLabel="Revogar"
              consequence="Ela deixa de aparecer no portal público imediatamente. O histórico de versões é preservado."
              disabled={!form.reason.trim()} onConfirm={() => save("revogado")} />
          )}
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </section>
    </div>
  );
}
