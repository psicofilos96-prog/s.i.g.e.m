import { SkeletonState } from "@/components/sigem/guidance";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { notifMessage, OPEN_MESSAGE, safeInternalLink, type MyNotification } from "./notifications-model";
import { listMyNotifications, openNotification, setPreference } from "./notifications-source";

export function NotificationCenterPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["notifications", "list"],
    queryFn: ({ pageParam }) => listMyNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.length === 30 ? last[last.length - 1]!.recorded_at : undefined),
    retry: false,
  });
  const items = q.data?.pages.flat() ?? [];
  async function open(n: MyNotification) {
    setMsg(null);
    try {
      const r = await openNotification(n.delivery_id);
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      if (r.status !== "ok") return setMsg(OPEN_MESSAGE[r.status]);
      const link = safeInternalLink(r.link);
      if (link) void navigate({ to: link as "/" });
    } catch (e) { setMsg(notifMessage((e as Error).message)); }
  }
  async function optOut(kind: string) {
    try { await setPreference(kind, true); setMsg("Você não receberá novos avisos opcionais deste tipo."); } catch (e) { setMsg(notifMessage((e as Error).message)); }
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Avisos" description="Avisos enviados a você pelos setores do SIGEM. Ao abrir, o sistema confere se você ainda tem acesso ao conteúdo." />
      {msg && <StatePanel tone="info" title="Aviso" description={msg} />}
      {q.isError ? <StatePanel tone="danger" title="Não foi possível carregar" description={notifMessage((q.error as Error).message)} />
        : q.isLoading ? <SkeletonState label="Carregando" />
        : items.length === 0 ? <EmptyState title="Nenhum aviso" description="Quando um setor emitir um aviso destinado a você, ele aparecerá aqui." />
        : <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.delivery_id} className={`rounded border p-3 ${n.read_at ? "" : "border-primary"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{!n.read_at && <span className="sr-only">Não lido: </span>}{n.title}</p>
                    <p className="text-sm">{n.body}</p>
                    <p className="text-xs text-muted-foreground">{new Date(n.recorded_at).toLocaleString("pt-BR")}{n.mandatory ? " · obrigatório" : ""}{!n.still_authorized ? " · acesso ao conteúdo encerrado" : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={n.read_at ? "outline" : "default"} onClick={() => void open(n)}>{n.has_link ? "Abrir" : "Marcar como lido"}</Button>
                    {!n.mandatory && <Button size="sm" variant="ghost" onClick={() => void optOut(n.event_kind)}>Não receber este tipo</Button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>}
      {q.hasNextPage && <Button variant="outline" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>Carregar mais</Button>}
    </div>
  );
}
