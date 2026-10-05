/**
 * Frente Y — Repositório curricular: busca, ficha do item e camadas editoriais.
 * Texto oficial (da fonte) e camadas do SIGEM (simplificação, palavras-chave, mapeamento, ausência de correspondência,
 * glossário explicativo) são sempre visualmente separados; relação oficial nunca aparece como editorial e vice-versa.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import { sha256Hex } from "@/features/data-import/import-engine";
import {
  CRITERIA_KEYS, CRITERIA_LABEL, EDITORIAL_NATURES, NATURE_LABEL, activeRelations, diffEditions, glossaryEntry, headEdition, matchedIn,
  previewSummary, referenceMessage, relationOriginLabel, searchItems, validateSource, type Catalog, type SourceFile,
} from "./reference-engine";
import {
  homologate, homologationState, readCatalog, readEditorialLayers, recordEdition, recordKeywords, recordNoCorrespondence, recordRelation,
  recordSimplification, revokeRelation, type EditorialLayers, type HomologationState,
} from "./reference-source";

const todayIso = () => new Date().toLocaleDateString("sv-SE");
const MATCH_LABEL: Record<string, string> = { codigo: "código", "texto-oficial": "texto oficial", simplificacao: "explicação SIGEM", "palavra-chave": "palavra-chave" };
const HOM_LABEL: Record<HomologationState, string> = { homologada: "Homologada", revogada: "Homologação revogada", "nao-homologada": "Não homologada" };
const HomBadge = ({ s }: { s: HomologationState }) => <Badge variant={s === "homologada" ? "secondary" : "outline"}>{HOM_LABEL[s]}</Badge>;
const input = "w-full rounded border bg-background p-2 text-sm";

export function ReferencePage() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [ed, setEd] = useState<EditorialLayers | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ text: "", sourceId: "", editionId: "", kind: "", relation: "", history: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const [c, e] = await Promise.all([readCatalog(), readEditorialLayers()]); setCat(c); setEd(e); setErr(null); }
    catch (e) { setErr(referenceMessage((e as Error).message)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const sources = useMemo(() => [...new Map((cat?.editions ?? []).map((e) => [e.source_id, e.source_label])).entries()], [cat]);
  const kinds = useMemo(() => [...new Set((cat?.items ?? []).map((i) => i.item_kind))].sort(), [cat]);
  const keywordsOf = useCallback((id: string) => (ed?.keywords ?? []).filter((k) => k.item_id === id).sort((a, b) => b.version_no - a.version_no)[0]?.terms ?? [], [ed]);
  const results = useMemo(() => {
    if (!cat) return [];
    const active = activeRelations(cat.relations);
    return searchItems(cat, { ...(f.sourceId ? { sourceId: f.sourceId } : {}), onlyCurrentEditions: !f.history })
      .concat(f.text ? cat.items.filter((i) => keywordsOf(i.id).some(() => true)) : [])
      .filter((i, k, arr) => arr.findIndex((x) => x.id === i.id) === k)
      .filter((i) => !f.editionId || i.edition_id === f.editionId)
      .filter((i) => !f.kind || i.item_kind === f.kind)
      .filter((i) => !f.relation || (f.relation === "com") === active.some((r) => r.from_item_id === i.id || r.to_item_id === i.id))
      .map((i) => ({ i, m: matchedIn(cat, i, f.text, keywordsOf(i.id)) }))
      .filter((x) => !f.text || x.m.length > 0)
      .filter((x) => f.history || cat.editions.some((e) => e.id === x.i.edition_id && headEdition(cat.editions, e.source_id) !== null && !cat.editions.some((s) => s.supersedes_id === e.id)))
      .slice(0, 200);
  }, [cat, f, keywordsOf]);

  return (
    <div className="space-y-6">
      <PageHeader title="Repositório curricular" description="Habilidades, descritores e objetivos das fontes oficiais (como BNCC e SAEB), com texto integral preservado. Explicações, palavras-chave e mapeamentos do SIGEM aparecem à parte e não são oficiais." />
      {err ? <StatePanel tone="danger" title="Não foi possível ler as referências" description={err} />
        : !cat || !ed ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : cat.editions.length === 0 ? <EmptyState title="Nenhuma fonte registrada" description="Os textos oficiais da BNCC e do SAEB ainda não foram fornecidos ao SIGEM. Nenhum conteúdo foi presumido." />
        : (
          <section className="space-y-3" aria-labelledby="busca">
            <h2 id="busca" className="font-semibold">Buscar</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <input aria-label="Buscar" className={input} placeholder="Código, palavra ou descrição" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
              <select aria-label="Fonte" className={input} value={f.sourceId} onChange={(e) => setF({ ...f, sourceId: e.target.value, editionId: "" })}>
                <option value="">Todas as fontes</option>{sources.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select>
              <select aria-label="Edição" className={input} value={f.editionId} onChange={(e) => setF({ ...f, editionId: e.target.value })}>
                <option value="">Todas as edições</option>
                {cat.editions.filter((e) => !f.sourceId || e.source_id === f.sourceId).map((e) => <option key={e.id} value={e.id}>{e.source_label} — {e.edition_label}</option>)}
              </select>
              <select aria-label="Tipo" className={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="">Todos os tipos</option>{kinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <select aria-label="Relações" className={input} value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>
                <option value="">Com ou sem relação</option><option value="com">Com relação ativa</option><option value="sem">Sem relação ativa</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.history} onChange={(e) => setF({ ...f, history: e.target.checked })} />Incluir edições substituídas</label>
            </div>
            {results.length === 0 ? <p className="text-sm">Nada encontrado.</p> : (
              <ul className="divide-y rounded border text-sm">{results.map(({ i, m }) => {
                const e = cat.editions.find((x) => x.id === i.edition_id);
                return (
                  <li key={i.id} className="p-2">
                    <button className="w-full text-left" aria-expanded={openId === i.id} onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                      <span className="font-mono text-xs">{i.code}</span> {i.official_text}
                      <span className="block text-xs text-muted-foreground">{e ? `${e.source_label} — ${e.edition_label}` : ""}{m.length ? ` · encontrado em: ${m.map((x) => MATCH_LABEL[x]).join(", ")}` : ""}</span>
                    </button>
                    {openId === i.id && <Entry cat={cat} ed={ed} itemId={i.id} onSaved={load} />}
                  </li>);
              })}</ul>)}
            <Glossary ed={ed} cat={cat} />
          </section>)}
      {cat && <SourceUpload cat={cat} onSaved={load} />}
    </div>
  );
}

function Entry({ cat, ed, itemId, onSaved }: { cat: Catalog; ed: EditorialLayers; itemId: string; onSaved: () => Promise<void> }) {
  const g = glossaryEntry(cat, itemId)!;
  const [msg, setMsg] = useState<string | null>(null);
  const [on, setOn] = useState(todayIso());
  const run = async (fn: () => Promise<unknown>) => { setMsg(null); try { await fn(); await onSaved(); setMsg("Registrado."); } catch (e) { setMsg(referenceMessage((e as Error).message)); } };
  const simpHom = g.simplified ? homologationState(ed.homologations, "simplificacao", g.simplified.id) : null;
  const edHom = g.edition ? homologationState(ed.homologations, "edicao", g.edition.id) : null;
  const kw = ed.keywords.filter((k) => k.item_id === itemId).sort((a, b) => b.version_no - a.version_no)[0] ?? null;
  const nc = ed.noCorrespondence.filter((n) => n.item_id === itemId && !n.withdrawn && !ed.noCorrespondence.some((s) => s.item_id === itemId && s.target_source_id === n.target_source_id && s.version_no > n.version_no));
  const official = g.relations.filter((r) => r.relation.origin === "oficial-da-fonte");
  const editorial = g.relations.filter((r) => r.relation.origin !== "oficial-da-fonte");
  return (
    <div className="mt-2 space-y-3 rounded bg-muted/40 p-3">
      <section aria-label="Texto oficial" className="rounded border border-border bg-card p-2">
        <h3 className="text-xs font-semibold">Texto integral oficial {edHom ? <HomBadge s={edHom.state} /> : null}</h3>
        <p>{g.officialText}</p>
        <p className="text-xs text-muted-foreground">{g.edition ? `${g.edition.source_label} — ${g.edition.edition_label} (${g.edition.authority})` : "Edição desconhecida"}
          {g.item.source_locator ? ` · ${g.item.source_locator}` : ""}{g.edition ? ` · impressão digital ${g.edition.source_sha256.slice(0, 12)}…` : ""}</p>
        {Object.keys(g.item.source_labels ?? {}).length ? <p className="text-xs">Rótulos da fonte: {Object.entries(g.item.source_labels).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p> : null}
        {g.bindings.length > 0 && <p className="text-xs">Vínculos SIGEM: {g.bindings.map((b) => `${b.scheme_id}/${b.value_id}`).join(", ")}</p>}
      </section>
      <section aria-label="Explicação SIGEM" className="rounded border border-dashed border-border p-2">
        <h3 className="text-xs font-semibold">Explicação simplificada do SIGEM (não oficial) {simpHom ? <HomBadge s={simpHom.state} /> : null}</h3>
        <p>{g.simplified?.simplified_text ?? "Sem explicação simplificada."}</p>
        {kw ? <p className="text-xs">Palavras-chave (SIGEM): {kw.terms.join(", ")}</p> : null}
      </section>
      <section aria-label="Relações">
        <h3 className="text-xs font-semibold">Relações publicadas pela fonte oficial</h3>
        {official.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma.</p> : <RelList rows={official} ed={ed} />}
        <h3 className="mt-2 text-xs font-semibold">Mapeamentos editoriais do SIGEM (não oficiais)</h3>
        {editorial.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum.</p> : <RelList rows={editorial} ed={ed} onRevoke={(id, reason) => run(() => revokeRelation(id, reason, on))} />}
        {nc.map((n) => <p key={n.id} className="text-xs">Sem correspondência identificada com {n.target_source_id} — {n.justification} <HomBadge s={homologationState(ed.homologations, "avaliacao-correspondencia", n.id).state} /></p>)}
      </section>
      <details><summary className="cursor-pointer text-xs">Registrar camada editorial (requer competência curricular de rede)</summary>
        <div className="mt-2 space-y-3">
          <div><label className="text-xs" htmlFor={`on-${itemId}`}>Data declarada da operação</label><DateInput id={`on-${itemId}`} value={on} onChange={(e) => setOn(e.target.value)} /></div>
          <SimplifyForm hasPrev={!!g.simplified} onSubmit={(t, r) => run(() => recordSimplification(itemId, g.simplified?.id ?? null, t, r, on))} />
          <KeywordsForm prev={kw?.terms ?? []} onSubmit={(t, r) => run(() => recordKeywords(itemId, kw?.id ?? null, t, r, on))} />
          <RelationForm cat={cat} itemId={itemId} onSubmit={(a) => run(() => recordRelation({ ...a, from: itemId, effectiveOn: on }))} />
          <NoCorrespondenceForm cat={cat} itemId={itemId} ed={ed} onSubmit={(a) => run(() => recordNoCorrespondence({ ...a, itemId, effectiveOn: on }))} />
          <HomologateBlock ed={ed} targets={[
            ...(g.edition ? [{ kind: "edicao", id: g.edition.id, label: "Edição da fonte" }] : []),
            ...(g.simplified ? [{ kind: "simplificacao", id: g.simplified.id, label: `Explicação v${g.simplified.version_no}` }] : []),
            ...(kw ? [{ kind: "palavras-chave", id: kw.id, label: `Palavras-chave v${kw.version_no}` }] : []),
            ...editorial.map((r) => ({ kind: "relacao", id: r.relation.id, label: `Mapeamento com ${r.other?.code ?? "item"}` })),
            ...nc.map((n) => ({ kind: "avaliacao-correspondencia", id: n.id, label: `Ausência de correspondência (${n.target_source_id})` })),
          ]} onSubmit={(k, id, d, head, reason) => run(() => homologate(k, id, d, head, reason, on))} />
        </div>
      </details>
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </div>
  );
}

function RelList({ rows, ed, onRevoke }: { rows: NonNullable<ReturnType<typeof glossaryEntry>>["relations"]; ed: EditorialLayers; onRevoke?: (id: string, reason: string) => void }) {
  return (
    <ul className="text-xs">{rows.map(({ relation: r, other, direction }) => (
      <li key={r.id} className="py-1">
        {direction === "saida" ? "→" : "←"} <span className="font-mono">{other?.code ?? "item desconhecido"}</span> · {NATURE_LABEL[r.nature] ?? r.nature} · {relationOriginLabel(r)}
        {r.official_locator ? ` · ${r.official_locator}` : ""} <HomBadge s={homologationState(ed.homologations, "relacao", r.id).state} />
        {r.justification ? <span className="block text-muted-foreground">Justificativa: {r.justification}</span> : null}
        {r.criteria && Object.keys(r.criteria).length ? <span className="block text-muted-foreground">{Object.entries(r.criteria).map(([k, v]) => `${CRITERIA_LABEL[k as keyof typeof CRITERIA_LABEL] ?? k}: ${v}`).join(" · ")}</span> : null}
        {onRevoke ? <button className="underline" onClick={() => { const reason = window.prompt("Motivo da revogação"); if (reason?.trim()) onRevoke(r.id, reason); }}>Revogar</button> : null}
      </li>))}</ul>
  );
}

function SimplifyForm({ hasPrev, onSubmit }: { hasPrev: boolean; onSubmit: (t: string, r: string | null) => void }) {
  const [t, setT] = useState(""); const [r, setR] = useState("");
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-semibold">Explicação simplificada (nova versão; o texto oficial não muda)</legend>
      <textarea aria-label="Explicação simplificada" className={input} value={t} onChange={(e) => setT(e.target.value)} />
      {hasPrev && <input aria-label="Motivo da nova versão" placeholder="Motivo da nova versão" className={input} value={r} onChange={(e) => setR(e.target.value)} />}
      <Button size="sm" disabled={!t.trim() || (hasPrev && !r.trim())} onClick={() => onSubmit(t, r || null)}>Registrar explicação</Button>
    </fieldset>
  );
}
function KeywordsForm({ prev, onSubmit }: { prev: string[]; onSubmit: (t: string[], r: string | null) => void }) {
  const [t, setT] = useState(prev.join(", ")); const [r, setR] = useState("");
  const terms = t.split(",").map((x) => x.trim()).filter(Boolean);
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-semibold">Palavras-chave e termos simples (SIGEM)</legend>
      <input aria-label="Palavras-chave separadas por vírgula" className={input} value={t} onChange={(e) => setT(e.target.value)} />
      {prev.length > 0 && <input aria-label="Motivo da revisão das palavras-chave" placeholder="Motivo da revisão" className={input} value={r} onChange={(e) => setR(e.target.value)} />}
      <Button size="sm" disabled={!terms.length || (prev.length > 0 && !r.trim())} onClick={() => onSubmit(terms, r || null)}>Registrar palavras-chave</Button>
    </fieldset>
  );
}
function RelationForm({ cat, itemId, onSubmit }: { cat: Catalog; itemId: string; onSubmit: (a: { to: string; origin: "oficial-da-fonte" | "editorial-sigem"; nature: string; direction: "de-para" | "bidirecional"; justification: string; criteria: Record<string, string> | null; officialLocator: string | null }) => void }) {
  const [q, setQ] = useState(""); const [to, setTo] = useState("");
  const [origin, setOrigin] = useState<"editorial-sigem" | "oficial-da-fonte">("editorial-sigem");
  const [nature, setNature] = useState<string>("parcial"); const [j, setJ] = useState(""); const [loc, setLoc] = useState("");
  const [crit, setCrit] = useState<Record<string, string>>({});
  const own = cat.items.find((i) => i.id === itemId);
  const ownSource = cat.editions.find((e) => e.id === own?.edition_id)?.source_id;
  const candidates = useMemo(() => searchItems(cat, { text: q }).filter((i) => i.id !== itemId).slice(0, 20), [cat, q, itemId]);
  const criteria = Object.fromEntries(Object.entries(crit).filter(([, v]) => v.trim()));
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-semibold">Relação com item de outra fonte ou edição</legend>
      <select aria-label="Origem da relação" className={input} value={origin} onChange={(e) => setOrigin(e.target.value as typeof origin)}>
        <option value="editorial-sigem">Mapeamento editorial do SIGEM (não oficial)</option><option value="oficial-da-fonte">Publicada por documento oficial</option>
      </select>
      <input aria-label="Buscar item relacionado" placeholder="Buscar item relacionado" className={input} value={q} onChange={(e) => setQ(e.target.value)} />
      <select aria-label="Item relacionado" className={input} value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">Escolha…</option>
        {candidates.map((i) => { const e = cat.editions.find((x) => x.id === i.edition_id); return <option key={i.id} value={i.id}>{i.code} — {e?.source_label}{e?.source_id === ownSource ? " (mesma fonte)" : ""}</option>; })}
      </select>
      <select aria-label="Natureza" className={input} value={nature} onChange={(e) => setNature(e.target.value)}>
        {EDITORIAL_NATURES.map((n) => <option key={n} value={n}>{NATURE_LABEL[n]}</option>)}
      </select>
      <textarea aria-label="Justificativa objetiva" placeholder="Justificativa objetiva" className={input} value={j} onChange={(e) => setJ(e.target.value)} />
      {origin === "oficial-da-fonte" && <input aria-label="Localização no documento oficial" placeholder="Localização no documento oficial (página/anexo)" className={input} value={loc} onChange={(e) => setLoc(e.target.value)} />}
      {origin === "editorial-sigem" && CRITERIA_KEYS.map((k) => (
        <input key={k} aria-label={CRITERIA_LABEL[k]} placeholder={`${CRITERIA_LABEL[k]} (opcional)`} className={input} value={crit[k] ?? ""} onChange={(e) => setCrit({ ...crit, [k]: e.target.value })} />))}
      <Button size="sm" disabled={!to || !j.trim() || (origin === "oficial-da-fonte" && !loc.trim())}
        onClick={() => onSubmit({ to, origin, nature, direction: "de-para", justification: j, criteria: Object.keys(criteria).length ? criteria : null, officialLocator: loc || null })}>Registrar relação</Button>
    </fieldset>
  );
}
function NoCorrespondenceForm({ cat, itemId, ed, onSubmit }: { cat: Catalog; itemId: string; ed: EditorialLayers; onSubmit: (a: { targetSourceId: string; expectedHead: string | null; justification: string; criteria: null; withdrawn: boolean; reason: string | null }) => void }) {
  const own = cat.items.find((i) => i.id === itemId);
  const ownSource = cat.editions.find((e) => e.id === own?.edition_id)?.source_id;
  const others = [...new Set(cat.editions.map((e) => e.source_id))].filter((s) => s !== ownSource);
  const [src, setSrc] = useState(""); const [j, setJ] = useState(""); const [r, setR] = useState("");
  const head = ed.noCorrespondence.filter((n) => n.item_id === itemId && n.target_source_id === src).sort((a, b) => b.version_no - a.version_no)[0] ?? null;
  if (!others.length) return null;
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-semibold">Conclusão editorial: sem correspondência identificada</legend>
      <select aria-label="Fonte analisada" className={input} value={src} onChange={(e) => setSrc(e.target.value)}>
        <option value="">Fonte analisada…</option>{others.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <textarea aria-label="Justificativa da ausência" placeholder="Justificativa objetiva" className={input} value={j} onChange={(e) => setJ(e.target.value)} />
      {head && <input aria-label="Motivo da nova versão da conclusão" placeholder="Motivo da nova versão" className={input} value={r} onChange={(e) => setR(e.target.value)} />}
      <div className="flex gap-2">
        <Button size="sm" disabled={!src || !j.trim() || (!!head && !r.trim())} onClick={() => onSubmit({ targetSourceId: src, expectedHead: head?.id ?? null, justification: j, criteria: null, withdrawn: false, reason: r || null })}>Registrar conclusão</Button>
        {head && !head.withdrawn && <Button size="sm" variant="outline" disabled={!r.trim()} onClick={() => onSubmit({ targetSourceId: src, expectedHead: head.id, justification: head.justification, criteria: null, withdrawn: true, reason: r })}>Retirar conclusão</Button>}
      </div>
    </fieldset>
  );
}
function HomologateBlock({ ed, targets, onSubmit }: { ed: EditorialLayers; targets: { kind: string; id: string; label: string }[]; onSubmit: (k: string, id: string, d: "homologada" | "revogada", head: string | null, reason: string | null) => void }) {
  if (!targets.length) return null;
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-semibold">Homologação (por pessoa diferente de quem redigiu)</legend>
      <ul className="text-xs">{targets.map((t) => {
        const h = homologationState(ed.homologations, t.kind, t.id);
        return (
          <li key={t.kind + t.id} className="flex items-center gap-2 py-1">{t.label} <HomBadge s={h.state} />
            {h.state !== "homologada" ? <button className="underline" onClick={() => onSubmit(t.kind, t.id, "homologada", h.head?.id ?? null, null)}>Homologar</button>
              : <button className="underline" onClick={() => { const r = window.prompt("Motivo da revogação"); if (r?.trim()) onSubmit(t.kind, t.id, "revogada", h.head?.id ?? null, r); }}>Revogar homologação</button>}
          </li>);
      })}</ul>
    </fieldset>
  );
}

function Glossary({ ed, cat }: { ed: EditorialLayers; cat: Catalog }) {
  const heads = ed.glossary.filter((g) => !ed.glossary.some((s) => s.term_key === g.term_key && s.version_no > g.version_no));
  if (!heads.length) return null;
  return (
    <section aria-labelledby="glossario" className="space-y-2">
      <h2 id="glossario" className="font-semibold">Glossário</h2>
      <ul className="divide-y rounded border text-sm">{heads.map((g) => {
        const e = cat.editions.find((x) => x.id === g.edition_id);
        return (
          <li key={g.id} className="p-2"><span className="font-medium">{g.term}</span> — {g.definition}
            <span className="block text-xs text-muted-foreground">{g.definition_origin === "oficial-da-fonte" ? `Definição oficial · ${e?.source_label ?? ""} ${e?.edition_label ?? ""} · ${g.source_locator ?? ""}` : "Explicação do SIGEM (não oficial)"}</span>
          </li>);
      })}</ul>
    </section>
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
  const same = p ? cat.editions.find((e) => e.source_id === p.file.source.id && e.source_sha256 === p.sha) : null;
  const diff = p && head && head !== "ambigua" ? diffEditions(cat.items.filter((i) => i.edition_id === head.id), p.file.items) : null;
  const sum = p ? previewSummary(p.file) : null;
  async function save() {
    if (!p || head === "ambigua") return;
    try {
      const r = await recordEdition(p.file, p.sha, ref.trim() || null, head?.id ?? null);
      setMsg(r.idempotent ? "Este mesmo arquivo-fonte já estava registrado; nada foi duplicado." : "Edição registrada; a anterior continua no histórico. Aguarda homologação por outra pessoa.");
      setP(null); await onSaved();
    } catch (e) { setMsg(referenceMessage((e as Error).message)); }
  }
  return (
    <section className="space-y-2 rounded-lg border bg-card p-4" aria-labelledby="fonte">
      <h2 id="fonte" className="font-semibold">Registrar edição de fonte oficial</h2>
      <p className="text-sm text-muted-foreground">Arquivo no formato do SIGEM (v2), transcrito do documento oficial. O texto é registrado exatamente como está; veja a prévia antes.</p>
      <input type="file" accept=".json" aria-label="Arquivo da fonte" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      {problems.length > 0 && <StatePanel tone="danger" title="Arquivo recusado" description={problems.slice(0, 30).join(" ")} />}
      {p && sum && (
        <div className="space-y-2 text-sm">
          <p>{p.file.source.label} — {p.file.edition.label}: {sum.total} itens ({sum.roots} no topo; {Object.entries(sum.byKind).map(([k, n]) => `${n} ${k}`).join(", ")}; {sum.bindings} vínculos). Impressão digital <code className="break-all">{p.sha}</code>.</p>
          {same ? <p>Este arquivo já foi registrado (mesma impressão digital); registrar novamente não duplica nada.</p>
            : head === "ambigua" ? <StatePanel tone="danger" title="Histórico ambíguo" description="Esta fonte tem mais de uma edição vigente; nada será registrado." />
            : diff ? <p>Em relação à edição "{head && typeof head === "object" ? head.edition_label : ""}": {diff.added.length} novos, {diff.changed.length} com texto alterado, {diff.removed.length} ausentes.</p>
            : <p>Primeira edição desta fonte.</p>}
          <input aria-label="Referência documental/fonte (opcional)" placeholder="Referência documental/fonte (opcional)" className={input} value={ref} onChange={(e) => setRef(e.target.value)} />
          <label className="flex gap-2"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />Conferi a prévia com o documento oficial.</label>
          <Button disabled={!ok || head === "ambigua"} onClick={() => void save()}>Registrar edição</Button>
        </div>)}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}
