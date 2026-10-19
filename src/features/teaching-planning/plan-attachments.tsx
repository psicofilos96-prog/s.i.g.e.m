import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { readAttachmentUrl, readPlanAttachments } from "./attachment-read";
import { revokeAttachment, uploadAttachment } from "./planning-source";

export function PlanAttachments({ planId, readOnly, isAuthor }: { planId: string; readOnly: boolean; isAuthor: boolean }) {
  const authority = useSessionAuthority();
  if (authority.status !== "signed-in" || !isAuthor) return null;
  return <AttachmentList key={`${authority.user.id}:${authority.sessionRevision}:${planId}`} planId={planId} uid={authority.user.id} revision={authority.sessionRevision} readOnly={readOnly} />;
}

function AttachmentList({ planId, uid, revision, readOnly }: { planId: string; uid: string; revision: number; readOnly: boolean }) {
  const q = useQuery({ queryKey: ["plan-att", uid, revision, planId], queryFn: () => readPlanAttachments(planId), retry: false });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = q.isSuccess ? q.data : [];
  const superseded = new Set(rows.map((row) => row.supersedes_id));
  const live = rows.filter((row) => !row.revoked && !superseded.has(row.id));
  const refresh = async () => {
    const result = await q.refetch();
    if (result.isError) setNotice("A alteração foi registrada, mas a lista não pôde ser atualizada.");
  };
  const open = async (path: string) => {
    if (busy || !q.isSuccess) return;
    // Open during the click, before the private URL read, to avoid popup blocking.
    const tab = window.open("about:blank", "_blank");
    if (!tab) { setError("Não foi possível abrir o anexo. Permita a abertura de uma nova aba."); return; }
    tab.opener = null;
    setBusy(true); setError(null);
    try { tab.location.replace(await readAttachmentUrl(path)); }
    catch { tab.close(); setError("Não foi possível abrir o anexo. Tente novamente."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (busy || readOnly || !q.isSuccess) return;
    setBusy(true); setError(null); setNotice(null);
    try { await revokeAttachment(planId, id); setNotice("Anexo removido."); await refresh(); }
    catch { setError("Não foi possível confirmar a remoção. Atualize a lista antes de tentar novamente."); }
    finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    if (busy || readOnly || !q.isSuccess) return;
    if (file.size > 10 * 1024 * 1024) { setError("Arquivo acima de 10 MB."); return; }
    setBusy(true); setError(null); setNotice(null);
    try { await uploadAttachment(uid, planId, file); setNotice("Anexo registrado."); await refresh(); }
    catch { setError("Não foi possível confirmar o envio. Atualize a lista antes de tentar novamente."); }
    finally { setBusy(false); }
  };
  return <fieldset className="space-y-2" aria-label="Anexos do planejamento">
    <legend className="text-sm font-medium">Anexos privados</legend>
    {q.isPending && <p role="status" className="text-sm text-muted-foreground">Carregando anexos…</p>}
    {q.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive"><span>Não foi possível ler os anexos.</span><Button size="sm" variant="outline" disabled={busy} onClick={() => { void q.refetch(); }}>Tentar novamente</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {q.isSuccess && (live.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum anexo.</p> : <ul className="space-y-1 text-sm">{live.map((row) => <li key={row.id} className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="link" className="h-auto max-w-full whitespace-normal break-words text-left" disabled={busy} onClick={() => { void open(row.object_path); }}>{row.label}</Button>
      {!readOnly && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void remove(row.id); }}>Remover</Button>}
    </li>)}</ul>)}
    {!readOnly && <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="Adicionar anexo" disabled={!q.isSuccess || busy} className="max-w-full text-sm" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file);
    }} />}
    {busy && <p role="status" className="text-sm text-muted-foreground">Aguarde…</p>}
  </fieldset>;
}