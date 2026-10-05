import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { sha256Hex } from "@/features/data-import/import-engine";
import {
  diffEditions, glossaryEntry, headEdition, referenceMessage, searchItems, validateSource,
  type Catalog, type SourceFile,
} from "./reference-engine";
import { readCatalog, recordEdition, recordRelation, recordSimplification } from "./reference-source";

export function ReferencePage() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => { try { setCat(await readCatalog()); setErr(null); } catch (e) { setErr(referenceMessage((e as Error).message)); } }, []);
  useEffect(() => { void load(); }, [load]);
  const sources = useMemo(() => [...new Map((cat?.editions ?? []).map((e) => [e.source_id, e.source_label])).entries()], [cat]);
  const results = useMemo(() => cat ? searchItems(cat, sourceId ? { text, sourceId } : { text }).slice(0, 200) : [], [cat, text, sourceId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Referências curriculares" description="Glossário das fontes oficiais (como BNCC e SAEB), com texto integral, descrição simplificada e relações. O texto oficial nunca é reescrito." />
      {err ? <StatePanel tone="danger" title="Não foi possível ler as referências" description={err} />
        : !cat ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : cat.editions.length === 0 ? <EmptyState title="Nenhuma fonte registrada" description="Os textos oficiais da BNCC e do SAEB ainda não foram fornecidos ao SIGEM. Nenhum conteúdo foi presumido." />
        : (
          <section className="space-y-3" aria-labelledby="glossario">
            <h2 id="glossario" className="font-semibold">Glossário</h2>
            <div className="flex flex-wrap gap-2">
              <input aria-label="Buscar" className="flex-1 rounded border bg-background p-2 text-sm" placeholder="Código, palavra ou descrição" value={text} onChange={(e) => setText(e.target.value)} />
              <select aria-label="Fonte" className="rounded border bg-background p-2 text-sm" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Todas as fontes</option>{sources.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select>
            </div>
            {results.length === 0 ? <p className="text-sm">Nada encontrado.</p> : (
              <ul className="divide-y rounded border text-sm">{results.map((i) => (
                <li key={i.id} className="p-2">
                  <button className="text-left w-full" aria-expanded={openId === i.id} onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                    <span className="font-mono text-xs">{i.code}</span> {i.official_text}
                  </button>
                  {openId === i.id && <Entry cat={cat} itemId={i.id} onSaved={load} />}
                </li>))}</ul>)}
          </section>)}
      {cat && <SourceUpload cat={cat} onSaved={load} />}
    </div>
  );
}

function Entry({ cat, itemId, onSaved }: { cat: Catalog; itemId: string; onSaved: () => Promise<void> }) {
  const g = glossaryEntry(cat, itemId)!;
  const [simp, setSimp] = useState(""); const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [rel, setRel] = useState({ to: "", nature: "", confidence: "", provenance: "" });
  async function save() {
    try { await recordSimplification(itemId, g.simplified?.id ?? null, simp, reason || null); setSimp(""); setReason(""); await onSaved(); }
    catch (e) { setMsg(referenceMessage((e as Error).message)); }
  }
  async function saveRel() {
    const to = cat.items.find((i) => i.code === rel.to.trim() && i.id !== itemId);
    if (!to) { setMsg("Item de destino não encontrado."); return; }
    try { await recordRelation({ from: itemId, to: to.id, nature: rel.nature, confidence: rel.confidence, provenance: rel.provenance }); await onSaved(); }
    catch (e) { setMsg(referenceMessage((e as Error).message)); }
  }
  return (
    <div className="mt-2 space-y-2 rounded bg-muted/40 p-3">
      <p className="text-xs">{g.edition ? `${g.edition.source_label} — ${g.edition.edition_label}` : "Edição desconhecida"}{g.item.source_locator ? ` · ${g.item.source_locator}` : ""}</p>
      <div><h3 className="text-xs font-semibold">Texto integral (oficial)</h3><p>{g.officialText}</p></div>
      <div><h3 className="text-xs font-semibold">Descrição simplificada (SIGEM)</h3><p>{g.simplified?.simplified_text ?? "Sem descrição simplificada."}</p>
        {g.simplificationHistory.length > 1 && <p className="text-xs text-muted-foreground">{g.simplificationHistory.length} versões registradas.</p>}</div>
      <div><h3 className="text-xs font-semibold">Relações</h3>
        {g.relations.length === 0 ? <p>Nenhuma relação registrada.</p> : <ul>{g.relations.map(({ relation, other, direction }) => (
          <li key={relation.id}>{direction === "saida" ? "→" : "←"} {other?.code ?? "item desconhecido"} · natureza {relation.nature} · confiança {relation.confidence} · fonte: {relation.provenance}</li>))}</ul>}</div>
      {g.bindings.length > 0 && <p className="text-xs">Vínculos: {g.bindings.map((b) => `${b.scheme_id}/${b.value_id}`).join(", ")}</p>}
      <details><summary className="text-xs cursor-pointer">Registrar descrição simplificada</summary>
        <textarea aria-label="Descrição simplificada" className="mt-1 w-full rounded border bg-background p-2" value={simp} onChange={(e) => setSimp(e.target.value)} />
        {g.simplified && <input aria-label="Motivo da nova versão" placeholder="Motivo da nova versão" className="mt-1 w-full rounded border bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)} />}
        <Button size="sm" className="mt-1" disabled={!simp.trim() || (!!g.simplified && !reason.trim())} onClick={() => void save()}>Registrar</Button>
      </details>
      <details><summary className="text-xs cursor-pointer">Registrar relação</summary>
        {(["to", "nature", "confidence", "provenance"] as const).map((k) => (
          <input key={k} aria-label={{ to: "Código do outro item", nature: "Natureza (identificador)", confidence: "Confiança (identificador)", provenance: "Proveniência" }[k]}
            placeholder={{ to: "Código do outro item", nature: "Natureza (identificador)", confidence: "Confiança (identificador)", provenance: "Proveniência (fonte da relação)" }[k]}
            className="mt-1 w-full rounded border bg-background p-2" value={rel[k]} onChange={(e) => setRel({ ...rel, [k]: e.target.value })} />))}
        <Button size="sm" className="mt-1" disabled={Object.values(rel).some((v) => !v.trim())} onClick={() => void saveRel()}>Registrar</Button>
      </details>
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </div>
  );
}

function SourceUpload({ cat, onSaved }: { cat: Catalog; onSaved: () => Promise<void> }) {
  const [p, setP] = useState<{ file: SourceFile; sha: string } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [ref, setRef] = useState(""); const [msg, setMsg] = useState<string | null>(null); const [ok, setOk] = useState(false);
  async function onFile(f: File) {
    setP(null); setProblems([]); setMsg(null); setOk(false);
    try {
      const buf = await f.arrayBuffer();
      const v = validateSource(JSON.parse(new TextDecoder().decode(buf)));
      if (!v.ok) { setProblems(v.problems); return; }
      setP({ file: v.file, sha: await sha256Hex(buf) });
    } catch { setProblems(["Arquivo não é JSON válido."]); }
  }
  const head = p ? headEdition(cat.editions, p.file.source.id) : null;
  const diff = p && head && head !== "ambigua" ? diffEditions(cat.items.filter((i) => i.edition_id === head.id), p.file.items) : null;
  async function save() {
    if (!p || head === "ambigua") return;
    try { await recordEdition(p.file, p.sha, ref.trim() || null, head?.id ?? null); setMsg("Edição registrada; a anterior continua no histórico."); setP(null); await onSaved(); }
    catch (e) { setMsg(referenceMessage((e as Error).message)); }
  }
  return (
    <section className="rounded-lg border bg-card p-4 space-y-2" aria-labelledby="fonte">
      <h2 id="fonte" className="font-semibold">Registrar edição de fonte</h2>
      <p className="text-sm text-muted-foreground">Arquivo no formato do SIGEM, transcrito da fonte oficial. Veja a prévia antes de registrar.</p>
      <input type="file" accept=".json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      {problems.length > 0 && <StatePanel tone="danger" title="Arquivo recusado" description={problems.slice(0, 20).join(" ")} />}
      {p && (
        <div className="space-y-2 text-sm">
          <p>{p.file.source.label} — {p.file.edition.label}: {p.file.items.length} itens. Impressão digital <code className="break-all">{p.sha}</code>.</p>
          {head === "ambigua" ? <StatePanel tone="danger" title="Histórico ambíguo" description="Esta fonte tem mais de uma edição vigente; nada será registrado." />
            : diff ? <p>Em relação à edição "{head && typeof head === "object" ? head.edition_label : ""}": {diff.added.length} novos, {diff.changed.length} com texto alterado, {diff.removed.length} ausentes.</p>
            : <p>Primeira edição desta fonte.</p>}
          <input aria-label="Referência documental/fonte (opcional)" placeholder="Referência documental/fonte (opcional)" className="w-full rounded border bg-background p-2" value={ref} onChange={(e) => setRef(e.target.value)} />
          <label className="flex gap-2"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />Conferi a prévia.</label>
          <Button disabled={!ok || head === "ambigua"} onClick={() => void save()}>Registrar edição</Button>
        </div>)}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
