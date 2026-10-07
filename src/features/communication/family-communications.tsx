import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { commMessage } from "./communication-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);

type Item = { communication_id: string; version_id: string; version: number; title: string; body: string; published_at: string; rectified: boolean; requires_acknowledgement: boolean; read_at: string | null; acknowledged_at: string | null };

/** Comunicados publicados para o educando; leitura e ciência são registros distintos feitos pelo próprio responsável. */
export function FamilyCommunications({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await rpc("family_communications", { _student: studentId });
    if (r.error) { setMsg(commMessage(r.error.message)); setItems([]); } else setItems((r.data as Item[]) ?? []);
  }, [studentId]);
  useEffect(() => { void load(); }, [load]);
  const mark = async (it: Item, kind: "leitura" | "ciencia") => {
    const r = await rpc("record_family_communication_receipt", { _student: studentId, _version: it.version_id, _kind: kind });
    if (r.error) setMsg(commMessage(r.error.message)); else await load();
  };
  if (!items) return <SkeletonState label="Carregando" />;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{msg ?? "Ainda não há comunicados publicados para a família."}</p>;
  return (
    <ul className="space-y-3 text-sm">
      {items.map((it) => (
        <li key={it.version_id} className="space-y-1">
          <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !it.read_at) void mark(it, "leitura"); }}>
            <summary className="cursor-pointer font-medium">{it.title}{!it.read_at && <span className="ml-2 text-xs text-primary">novo</span>}</summary>
            <p className="mt-1 whitespace-pre-wrap">{it.body}</p>
            <p className="text-xs text-muted-foreground">Publicado em {new Date(it.published_at).toLocaleString("pt-BR")}{it.rectified ? " · versão corrigida" : ""}</p>
            {it.requires_acknowledgement && (it.acknowledged_at
              ? <p className="text-xs">Ciência registrada em {new Date(it.acknowledged_at).toLocaleString("pt-BR")}.</p>
              : <Button size="sm" variant="outline" onClick={() => void mark(it, "ciencia")}>Declarar ciência</Button>)}
          </details>
        </li>))}
      {msg && <p role="status">{msg}</p>}
    </ul>
  );
}
