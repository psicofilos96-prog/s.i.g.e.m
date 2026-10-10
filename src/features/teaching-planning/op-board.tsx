/** LOTE 8 — Quadro Permanente da OP por etapa (rede): versões append-only via `record_op_permanent_board_version`; etapa é texto aberto. */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
export type BoardSection = { heading: string; body: string };
export type BoardVersion = { id: string; stage_key: string; version: number; supersedes_id: string | null; title: string; sections: BoardSection[]; change_reason: string | null; recorded_at: string };

export const boardHeads = (rows: readonly BoardVersion[]) => {
  const m = new Map<string, BoardVersion>();
  for (const r of rows) { const c = m.get(r.stage_key); if (!c || r.version > c.version) m.set(r.stage_key, r); }
  return [...m.values()].sort((a, b) => a.stage_key.localeCompare(b.stage_key, "pt-BR"));
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const boardPrintHtml = (v: BoardVersion) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(v.title)}</title><style>@page{size:A4;margin:18mm}body{font-family:serif;font-size:11pt}h1{font-size:15pt}h2{font-size:12pt;margin-top:12pt}p{white-space:pre-wrap}</style></head><body><h1>${esc(v.title)}</h1><p>Etapa: ${esc(v.stage_key)} · versão ${v.version} · ${esc(new Date(v.recorded_at).toLocaleString("pt-BR"))}</p>${v.sections.map((s) => `<h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p>`).join("")}</body></html>`;
const ERR: Record<string, string> = { "board:capability-missing": "Sua conta não tem permissão para manter o Quadro Permanente.", "board:head-changed": "Outra versão foi gravada; recarregue.", "board:reason-required": "Nova versão exige motivo.", "board:sections-required": "Inclua ao menos uma seção.", "board:fields-required": "Preencha etapa e título." };
const msgOf = (e: unknown) => { const r = e instanceof Error ? e.message : String(e); const k = Object.keys(ERR).find((x) => r.includes(x)); return k ? ERR[k]! : `Não gravado: ${r}`; };

export function OpBoardPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["opboard"], queryFn: async () => { const r = await db.from("op_permanent_board_versions").select("*").order("recorded_at", { ascending: false }); if (r.error) throw new Error(r.error.message); return r.data as BoardVersion[]; } });
  const hs = useMemo(() => boardHeads(q.data ?? []), [q.data]);
  const [d, setD] = useState<{ stage: string; head: string | null; title: string; sections: BoardSection[]; reason: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const print = (v: BoardVersion) => { const w = window.open("", "_blank"); if (!w) return; w.document.write(boardPrintHtml(v)); w.document.close(); w.print(); };
  const save = async () => {
    if (!d) return; setMsg("Gravando…");
    const r = await db.rpc("record_op_permanent_board_version", { _stage: d.stage, _expected_head: d.head, _title: d.title, _sections: d.sections.filter((s) => s.heading.trim() || s.body.trim()), _reason: d.reason || null });
    if (r.error) { setMsg(msgOf(r.error)); return; }
    setMsg("Versão gravada."); setD(null); await qc.invalidateQueries({ queryKey: ["opboard"] });
  };
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <header><h1 className="text-2xl font-semibold text-foreground">Quadro Permanente da OP</h1><p className="text-sm text-muted-foreground">Orientações da rede por etapa, com versões. Cada mudança cria nova versão; as anteriores ficam no histórico. Professores consultam no planejamento.</p></header>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : q.error ? <p role="alert" className="text-sm text-destructive">Entre com sua conta para ver o Quadro Permanente.</p> : (<>
        {hs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum quadro registrado ainda.</p>}
        <ul className="space-y-2">{hs.map((v) => (
          <li key={v.id} className="rounded border border-border p-3"><div className="font-medium">{v.stage_key} — {v.title} <span className="text-xs text-muted-foreground">v{v.version}</span></div>
            <div className="mt-1 flex gap-2"><Button size="sm" variant="outline" onClick={() => setD({ stage: v.stage_key, head: v.id, title: v.title, sections: v.sections, reason: "" })}>Nova versão</Button><Button size="sm" variant="ghost" onClick={() => print(v)}>Imprimir / PDF</Button><Button size="sm" variant="ghost" onClick={() => setHist(hist === v.stage_key ? null : v.stage_key)}>Histórico</Button></div>
            {hist === v.stage_key && <ol className="mt-2 text-xs">{(q.data ?? []).filter((x) => x.stage_key === v.stage_key).sort((a, b) => b.version - a.version).map((x) => <li key={x.id}>v{x.version} · {new Date(x.recorded_at).toLocaleString("pt-BR")}{x.change_reason ? ` · ${x.change_reason}` : ""} <button className="underline" onClick={() => print(x)}>imprimir</button></li>)}</ol>}
          </li>))}</ul>
        {!d && <Button onClick={() => setD({ stage: "", head: null, title: "", sections: [{ heading: "", body: "" }], reason: "" })}>Novo quadro de etapa</Button>}
      </>)}
      {d && (
        <section className="space-y-2 rounded border border-border p-4" aria-label="Editor do quadro">
          <label className="block text-sm">Etapa <input aria-label="Etapa" disabled={!!d.head} className="ml-1 w-full rounded border border-input bg-background p-1" value={d.stage} onChange={(e) => setD({ ...d, stage: e.target.value })} placeholder="Ex.: Fundamental I — 3º ano" /></label>
          <label className="block text-sm">Título <input aria-label="Título" className="ml-1 w-full rounded border border-input bg-background p-1" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
          {d.sections.map((s, i) => (<div key={i} className="space-y-1"><input aria-label={`Seção ${i + 1}`} placeholder="Título da seção" className="w-full rounded border border-input bg-background p-1 text-sm" value={s.heading} onChange={(e) => setD({ ...d, sections: d.sections.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)) })} /><textarea aria-label={`Texto da seção ${i + 1}`} rows={4} className="w-full rounded border border-input bg-background p-1 text-sm" value={s.body} onChange={(e) => setD({ ...d, sections: d.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} /></div>))}
          <Button size="sm" variant="outline" onClick={() => setD({ ...d, sections: [...d.sections, { heading: "", body: "" }] })}>Adicionar seção</Button>
          {d.head && <label className="block text-sm">Motivo da nova versão <input aria-label="Motivo" className="ml-1 w-full rounded border border-input bg-background p-1" value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} /></label>}
          <div className="flex gap-2"><Button onClick={save} disabled={!d.stage.trim() || !d.title.trim()}>Gravar versão</Button><Button variant="ghost" onClick={() => setD(null)}>Cancelar</Button></div>
        </section>)}
      {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
    </main>
  );
}
