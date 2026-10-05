import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { citation, lexicalRanker, present, statusNote, type Hit } from "@/features/knowledge-base/kb-core";
import { TOPICS } from "@/features/help/help-content";

export const Route = createFileRoute("/base-de-conhecimento")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento — SIGEM" },
      { name: "description", content: "Pesquise documentação, normas e manuais autorizados, com versão e referência de cada trecho." },
      { property: "og:title", content: "Base de conhecimento — SIGEM" },
      { property: "og:description", content: "Pesquisa com fonte, versão e acesso respeitado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

/** Documentação do SIGEM (ajuda pública) entra como fonte local, sem sair do navegador. */
function helpHits(): Hit[] {
  return TOPICS.filter((t) => !t.administrative && !(t.audienceCapabilities?.length)).map((t, i) => ({
    chunkId: `ajuda-${t.id}`, documentId: `ajuda:${t.id}`, versionId: `ajuda-${t.id}`, version: 1, title: t.title["pt-BR"], classification: "publico",
    section: null, page: null, body: `${t.summary["pt-BR"]}\n${t.body["pt-BR"]}`, score: 0, status: "vigente" as const, _i: i,
  }));
}

function Page() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ current: Hit[]; history: Hit[]; dbError: boolean } | null>(null);
  async function search() {
    const r = await supabase.rpc("kb_search", { _q: q, _limit: 30 });
    const db: Hit[] = (r.data ?? []).map((x) => ({ chunkId: x.chunk_id, documentId: x.document_id, versionId: x.version_id, version: x.version, title: x.title, classification: x.classification as Hit["classification"], section: x.section, page: x.page, body: x.body, score: x.rank, status: x.status as Hit["status"] }));
    const local = await lexicalRanker.rank(q, helpHits());
    const ranked = await lexicalRanker.rank(q, db.length ? db : []);
    setRes({ ...present([...ranked, ...local].slice(0, 30)), dbError: !!r.error });
  }
  const Card = ({ h }: { h: Hit }) => (
    <article className="space-y-1 rounded-md border border-border bg-card p-3">
      <p className="text-sm font-medium">{citation(h)}</p>
      {statusNote(h) && <p className="text-xs text-muted-foreground">{statusNote(h)}</p>}
      <p className="whitespace-pre-wrap text-sm">{h.body}</p>
    </article>
  );
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Base de conhecimento</h1>
      <p className="text-sm text-muted-foreground">Pesquisa em documentação do SIGEM, normas e manuais autorizados. Você só vê trechos dos documentos a que sua conta tem acesso. A busca é feita por palavras, sem enviar o conteúdo para fora.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) void search(); }}>
        <Input aria-label="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="Ex.: como homologar o calendário" />
        <Button type="submit">Pesquisar</Button>
      </form>
      {res?.dbError && <p className="text-sm text-muted-foreground">Os documentos institucionais não puderam ser consultados agora; mostrando só a documentação do SIGEM.</p>}
      {res && res.current.length === 0 && res.history.length === 0 && <p>Nada encontrado nas fontes que você pode consultar.</p>}
      {res?.current.map((h) => <Card key={h.chunkId} h={h} />)}
      {res && res.history.length > 0 && (<details><summary className="cursor-pointer text-sm">Versões anteriores ou revogadas ({res.history.length})</summary><div className="mt-2 space-y-2">{res.history.map((h) => <Card key={h.chunkId} h={h} />)}</div></details>)}
    </main>
  );
}
