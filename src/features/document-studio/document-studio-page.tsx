import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader, NoteBox } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/features/authority/session-authority";
import { formatDateTime } from "@/lib/academic-date";
import { ACERVO } from "./acervo";
import { BASE_TEMPLATES, DRAFT_LABEL, SECTOR_DOCUMENTS } from "./base-templates";
import { STATE_LABEL, TOKEN_CATALOG, renderStudio, unresolvableTokens, validateTemplate, type Facts, type PageSetup, type StudioBlock, type TemplateState } from "./studio-engine";
import {
  diffVersions, emissionStatus, emit, factKeys, library, loadEmissions, loadStudio, reproduce, saveVersion, studioMessage, studioPermissions, transition, versionStates, voidEmission,
  type EmissionEvent, type StudioEmission, type StudioEvent, type StudioVersion,
} from "./studio-cloud";

const SAMPLE_NOTE = "Prévia sem dados: campos aparecem como \"sem registro\". A emissão congela os dados informados junto com a versão homologada.";
const TABS = ["Biblioteca", "Editor", "Histórico", "Emitir", "Emitidos", "Acervo"] as const;
type Tab = (typeof TABS)[number];
type Draft = { templateId: string; sector: string; title: string; blocks: StudioBlock[]; page: PageSetup; expected: number; baseTemplateId: string | null; persisted: boolean };
const inp = "w-full rounded-md border border-border bg-background p-2 text-sm";

function printHtml(html: string) { const w = window.open("", "_blank"); if (!w) return false; w.document.write(html); w.document.close(); w.focus(); w.print(); return true; }
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "modelo";

export function DocumentStudioPage() {
  const { user } = useSessionUser();
  const [tab, setTab] = useState<Tab>("Biblioteca");
  const [versions, setVersions] = useState<StudioVersion[]>([]);
  const [events, setEvents] = useState<StudioEvent[]>([]);
  const [emissions, setEmissions] = useState<StudioEmission[]>([]);
  const [emEvents, setEmEvents] = useState<EmissionEvent[]>([]);
  const [perm, setPerm] = useState({ editar: false, homologar: false, emitir: false });
  const [msg, setMsg] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sector, setSector] = useState("todos");
  const [draft, setDraft] = useState<Draft>(() => fromBase(BASE_TEMPLATES[0]!));
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [cmp, setCmp] = useState<[string, string] | null>(null);
  const [emitVersion, setEmitVersion] = useState<string | null>(null);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [voidFor, setVoidFor] = useState<{ id: string; kind: "cancelamento" | "substituicao" } | null>(null);
  const [reason, setReason] = useState(""); const [replacedBy, setReplacedBy] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [s, e, p] = await Promise.all([loadStudio(), loadEmissions(), studioPermissions()]);
      setVersions(s.versions); setEvents(s.events); setEmissions(e.emissions); setEmEvents(e.events); setPerm(p);
    } catch (e) { setMsg({ kind: "erro", text: studioMessage(e) }); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);

  const states = useMemo(() => versionStates(versions, events), [versions, events]);
  const lib = useMemo(() => library(versions, states), [versions, states]);
  const sectors = useMemo(() => ["todos", ...new Set([...BASE_TEMPLATES.map((t) => t.sector), ...lib.map((l) => l.sector)])], [lib]);
  const persistedIds = new Set(lib.map((l) => l.templateId));
  const latestState: TemplateState | null = draft.persisted ? states[lib.find((l) => l.templateId === draft.templateId)?.latest.id ?? ""] ?? null : null;
  const latestId = lib.find((l) => l.templateId === draft.templateId)?.latest.id ?? null;

  async function run(f: () => Promise<unknown>, ok: string) {
    setBusy(true); setMsg(null);
    try { await f(); setMsg({ kind: "ok", text: ok }); await refresh(); } catch (e) { setMsg({ kind: "erro", text: studioMessage(e) }); } finally { setBusy(false); }
  }
  const issues = validateTemplate(draft.blocks, draft.page);
  const preview = renderStudio({ title: draft.title, blocks: draft.blocks, page: draft.page, facts: {}, draftLabel: latestState === "homologado" ? null : DRAFT_LABEL });
  const setBlocks = (f: (b: StudioBlock[]) => StudioBlock[]) => setDraft((d) => ({ ...d, blocks: f(d.blocks) }));
  const move = (i: number, d: -1 | 1) => setBlocks((b) => { const n = [...b]; const j = i + d; if (j < 0 || j >= n.length) return b; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const editText = (i: number, text: string) => setBlocks((b) => b.map((x, k) => k !== i ? x : x.type === "title" ? { ...x, text } : x.type === "rich" ? { ...x, runs: [{ text }] } : x));
  const openVersion = (v: StudioVersion) => { setDraft({ templateId: v.template_id, sector: v.sector, title: v.title, blocks: structuredClone(v.blocks), page: structuredClone(v.page), expected: lib.find((l) => l.templateId === v.template_id)?.latest.version_no ?? v.version_no, baseTemplateId: v.base_template_id, persisted: true }); setTab("Editor"); };

  const homologatedList = lib.filter((l) => l.current);
  const emitV = versions.find((v) => v.id === emitVersion) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Documentos institucionais" title="Central de Documentos"
        description="Biblioteca de modelos por setor, editor seguro por blocos, homologação, emissão com QR verificável e reprodução exata do documento emitido." />
      <NoteBox>Estados: {Object.values(STATE_LABEL).join(" → ")}. Os {BASE_TEMPLATES.length} modelos-base continuam rascunhos não homologados até alguém com permissão homologá-los. Versão homologada nunca é editada: editar cria nova versão.</NoteBox>
      {!user && <p className="rounded-md border border-border p-3 text-sm" role="status">Entre na sua conta para salvar, homologar e emitir. Sem login você só vê a biblioteca de modelos-base e a prévia.</p>}
      {user && <p className="text-xs text-muted-foreground">Sua conta: {perm.editar ? "edita modelos" : "não edita modelos"} · {perm.homologar ? "homologa" : "não homologa"} · {perm.emitir ? "emite" : "não emite"}{loading ? " · carregando…" : ""}</p>}
      {msg && <p role={msg.kind === "erro" ? "alert" : "status"} className={`text-sm ${msg.kind === "erro" ? "text-destructive" : "text-primary"}`}>{msg.text}</p>}

      <div role="tablist" aria-label="Seções" className="flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-9 rounded-md px-3 py-1 text-sm pointer-coarse:min-h-11 ${tab === t ? "bg-primary text-primary-foreground" : "border border-border"}`}>{t}</button>)}
      </div>

      {tab === "Biblioteca" && (
        <section className="space-y-4" aria-label="Biblioteca">
          <label className="block max-w-xs text-sm">Setor<select className={inp} value={sector} onChange={(e) => setSector(e.target.value)}>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          {user && <div><h2 className="mb-2 font-semibold">Modelos gravados ({lib.length})</h2>
            {lib.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum modelo gravado ainda. Importe um modelo-base abaixo para começar.</p> :
              <ul className="grid gap-2 md:grid-cols-2">{lib.filter((l) => sector === "todos" || l.sector === sector).map((l) => <li key={l.templateId} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{l.title}</p>
                <p className="text-xs text-muted-foreground">{l.sector} · última versão {l.latest.version_no} ({STATE_LABEL[states[l.latest.id] ?? "rascunho"]}){l.current ? ` · vigente homologada: v${l.current.version_no}` : " · sem versão homologada"}</p>
                <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openVersion(l.latest)}>Abrir no editor</Button><Button size="sm" variant="ghost" onClick={() => { setHistoryOf(l.templateId); setCmp(null); setTab("Histórico"); }}>Histórico</Button>
                  {l.current && <Button size="sm" variant="ghost" onClick={() => { setEmitVersion(l.current!.id); setFacts({}); setTab("Emitir"); }}>Emitir</Button>}</div>
              </li>)}</ul>}
          </div>}
          <div><h2 className="mb-2 font-semibold">Modelos-base ({BASE_TEMPLATES.length}) — {DRAFT_LABEL}</h2>
            <ul className="grid gap-2 md:grid-cols-2">{BASE_TEMPLATES.filter((t) => sector === "todos" || t.sector === sector).map((t) => <li key={t.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.sector} · {t.source ? "com referência no acervo" : "sem modelo no acervo"}{persistedIds.has(t.id) ? " · já gravado" : ""}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDraft(fromBase(t)); setTab("Editor"); }}>Ver no editor</Button>
                {user && perm.editar && !persistedIds.has(t.id) && <Button size="sm" disabled={busy} onClick={() => run(() => saveVersion({ templateId: t.id, expectedVersion: 0, sector: t.sector, title: t.title, blocks: t.blocks, page: t.page, baseTemplateId: t.id }), `"${t.title}" gravado como rascunho (v1).`)}>Gravar como rascunho</Button>}
              </div>
            </li>)}</ul>
          </div>
        </section>)}

      {tab === "Editor" && (
        <section className="grid gap-6 xl:grid-cols-2" aria-label="Editor">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Editor — {draft.title}</h2>
            <p className="text-xs text-muted-foreground">{draft.persisted ? `Modelo gravado · última versão ${draft.expected} · ${latestState ? STATE_LABEL[latestState] : ""}` : "Não gravado (modelo-base em memória)"}</p>
            <label className="block text-sm">Título<input className={inp} value={draft.title} maxLength={160} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label className="text-sm">Orientação{" "}<select className="rounded-md border border-border bg-background p-1" value={draft.page.orientation} onChange={(e) => setDraft({ ...draft, page: { ...draft.page, orientation: e.target.value as PageSetup["orientation"] } })}><option value="retrato">Retrato</option><option value="paisagem">Paisagem</option></select></label>
            <ol className="space-y-2">{draft.blocks.map((b, i) => <li key={i} className="rounded-md border border-border p-2 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{b.type}</span><span className="flex gap-1">
                <button type="button" className="rounded border border-border px-2" onClick={() => move(i, -1)} aria-label={`Subir bloco ${i + 1}`}>↑</button>
                <button type="button" className="rounded border border-border px-2" onClick={() => move(i, 1)} aria-label={`Descer bloco ${i + 1}`}>↓</button>
                <button type="button" className="rounded border border-border px-2" onClick={() => setBlocks((x) => x.filter((_, k) => k !== i))} aria-label={`Remover bloco ${i + 1}`}>✕</button></span></div>
              {(b.type === "title" || b.type === "rich") && <textarea aria-label={`Texto do bloco ${i + 1}`} className="mt-2 w-full rounded border border-border bg-background p-1" value={b.type === "title" ? b.text : b.runs.map((r) => r.text).join("")} onChange={(e) => editText(i, e.target.value)} />}
              {b.type === "field" && <p className="text-xs text-muted-foreground">{b.label} ← {b.fact}</p>}
            </li>)}</ol>
            <div className="flex flex-wrap gap-2 text-sm">
              {([["Parágrafo", { type: "rich", runs: [{ text: "Novo texto" }] }], ["Linha", { type: "line" }], ["Assinatura", { type: "signature", label: "Assinatura" }], ["Quebra de página", { type: "page-break" }], ["Número do documento", { type: "document-number" }], ["QR de verificação", { type: "qr", label: "Verificação" }]] as const)
                .map(([l, blk]) => <button key={l} type="button" className="rounded-md border border-border px-2 py-1" onClick={() => setBlocks((b) => [...b, structuredClone(blk) as StudioBlock])}>+ {l}</button>)}
            </div>
            {issues.length > 0 && <div role="alert" className="text-sm text-destructive">Problemas: {issues.map((x) => `${x.path} ${x.code}`).join("; ")}</div>}
            {unresolvableTokens(draft.blocks).length > 0 && <p className="text-sm">Campos sem leitura automática: {unresolvableTokens(draft.blocks).join(", ")} — na emissão serão informados por quem emite.</p>}
            {user && <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <Button disabled={busy || !perm.editar || issues.length > 0} onClick={() => run(() => saveVersion({ templateId: draft.templateId, expectedVersion: draft.persisted ? draft.expected : 0, sector: draft.sector, title: draft.title, blocks: draft.blocks, page: draft.page, baseTemplateId: draft.baseTemplateId }).then(() => setDraft((d) => ({ ...d, persisted: true, expected: (d.persisted ? d.expected : 0) + 1 }))), "Nova versão gravada como rascunho.")}>{draft.persisted ? "Salvar nova versão" : "Gravar como rascunho"}</Button>
              <Button variant="outline" disabled={busy || !perm.editar} onClick={() => { const id = `${slug(draft.title)}-${crypto.randomUUID().slice(0, 6)}`; run(() => saveVersion({ templateId: id, expectedVersion: 0, sector: draft.sector, title: `${draft.title} (cópia)`.slice(0, 160), blocks: draft.blocks, page: draft.page, baseTemplateId: draft.baseTemplateId }).then(() => setDraft((d) => ({ ...d, templateId: id, title: `${d.title} (cópia)`.slice(0, 160), expected: 1, persisted: true }))), "Cópia gravada como novo modelo (rascunho)."); }}>Duplicar como novo modelo</Button>
              {latestId && latestState === "rascunho" && <Button variant="outline" disabled={busy || !perm.editar} onClick={() => run(() => transition(latestId, "enviar-revisao"), "Enviado para revisão.")}>Enviar para revisão</Button>}
              {latestId && latestState === "em-revisao" && <><Button variant="outline" disabled={busy || !perm.editar} onClick={() => run(() => transition(latestId, "devolver"), "Devolvido para rascunho.")}>Devolver</Button>
                <Button disabled={busy || !perm.homologar} onClick={() => run(() => transition(latestId, "homologar"), "Versão homologada. A anterior, se houver, passou a substituída.")}>Homologar</Button></>}
              {latestId && latestState && latestState !== "arquivado" && <Button variant="ghost" disabled={busy || !perm.editar} onClick={() => run(() => transition(latestId, "arquivar"), "Versão arquivada.")}>Arquivar</Button>}
              {!perm.homologar && latestState === "em-revisao" && <p className="text-xs text-muted-foreground">Homologar exige Admin ou a permissão de homologar modelos.</p>}
            </div>}
          </div>
          <div className="space-y-2"><h2 className="text-lg font-semibold">Prévia de impressão</h2><p className="text-xs text-muted-foreground">{SAMPLE_NOTE}</p>
            <iframe title={`Prévia de ${draft.title}`} sandbox="" srcDoc={preview.html} className="h-[640px] w-full rounded-md border border-border bg-card" /></div>
        </section>)}

      {tab === "Histórico" && (
        <section className="space-y-3" aria-label="Histórico">
          <label className="block max-w-md text-sm">Modelo<select className={inp} value={historyOf ?? ""} onChange={(e) => { setHistoryOf(e.target.value || null); setCmp(null); }}><option value="">Escolha…</option>{lib.map((l) => <option key={l.templateId} value={l.templateId}>{l.title}</option>)}</select></label>
          {historyOf && (() => { const l = lib.find((x) => x.templateId === historyOf); if (!l) return null; return <>
            <table className="w-full text-left text-sm"><caption className="sr-only">Versões</caption><thead><tr><th scope="col" className="p-1">Versão</th><th scope="col" className="p-1">Estado</th><th scope="col" className="p-1">Gravada em</th><th scope="col" className="p-1">Eventos</th><th scope="col" className="p-1">Impressão digital</th><th scope="col" className="p-1"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>{l.versions.map((v) => <tr key={v.id} className="border-t border-border"><td className="p-1">v{v.version_no}</td><td className="p-1">{STATE_LABEL[states[v.id] ?? "rascunho"]}</td><td className="p-1">{formatDateTime(v.created_at)}</td>
                <td className="p-1 text-xs">{events.filter((e) => e.version_id === v.id).map((e) => `${e.kind} em ${formatDateTime(e.at)}`).join("; ") || "—"}</td><td className="p-1 font-mono text-xs">{v.content_sha256.slice(0, 12)}…</td>
                <td className="p-1"><Button size="sm" variant="ghost" onClick={() => openVersion(v)}>Abrir</Button></td></tr>)}</tbody></table>
            {l.versions.length > 1 && <div className="flex flex-wrap items-end gap-2 text-sm">
              <label>Comparar<select className={inp} value={cmp?.[0] ?? ""} onChange={(e) => setCmp([e.target.value, cmp?.[1] ?? l.versions[0]!.id])}>{l.versions.map((v) => <option key={v.id} value={v.id}>v{v.version_no}</option>)}</select></label>
              <label>com<select className={inp} value={cmp?.[1] ?? ""} onChange={(e) => setCmp([cmp?.[0] ?? l.versions[1]!.id, e.target.value])}>{l.versions.map((v) => <option key={v.id} value={v.id}>v{v.version_no}</option>)}</select></label>
              <Button size="sm" variant="outline" onClick={() => setCmp(cmp ?? [l.versions[1]!.id, l.versions[0]!.id])}>Comparar</Button></div>}
            {cmp && (() => { const a = versions.find((v) => v.id === cmp[0]), b = versions.find((v) => v.id === cmp[1]); if (!a || !b) return null; const d = diffVersions(a.blocks, b.blocks).filter((x) => x.change !== "igual");
              return <div className="space-y-1 text-xs"><p className="text-sm font-medium">v{a.version_no} → v{b.version_no}: {d.length} bloco(s) diferente(s){a.title !== b.title ? `; título "${a.title}" → "${b.title}"` : ""}</p>
                <ul className="space-y-1">{d.map((x) => <li key={x.index} className="rounded border border-border p-1"><strong>Bloco {x.index + 1} — {x.change}</strong>{x.before && <pre className="whitespace-pre-wrap break-all text-muted-foreground">− {x.before}</pre>}{x.after && <pre className="whitespace-pre-wrap break-all">+ {x.after}</pre>}</li>)}</ul></div>; })()}
          </>; })()}
        </section>)}

      {tab === "Emitir" && (
        <section className="space-y-3" aria-label="Emitir">
          {!user ? <p className="text-sm">Entre para emitir.</p> : homologatedList.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum modelo homologado ainda. Só versão homologada vigente pode ser emitida.</p> : <>
            <label className="block max-w-md text-sm">Modelo homologado<select className={inp} value={emitVersion ?? ""} onChange={(e) => { setEmitVersion(e.target.value || null); setFacts({}); }}><option value="">Escolha…</option>{homologatedList.map((l) => <option key={l.current!.id} value={l.current!.id}>{l.title} (v{l.current!.version_no})</option>)}</select></label>
            {emitV && <>
              <p className="text-xs text-muted-foreground">Os dados abaixo são informados por quem emite e ficam congelados no documento com a versão do modelo. Campo vazio sai como "sem registro".</p>
              <div className="grid gap-2 md:grid-cols-2">{factKeys(emitV.blocks).filter((k) => !k.startsWith("documento.codigo")).map((k) => <label key={k} className="text-sm">{TOKEN_CATALOG.find((t) => t.key === k)?.label ?? k}<input className={inp} value={facts[k] ?? ""} maxLength={500} onChange={(e) => setFacts({ ...facts, [k]: e.target.value })} /></label>)}</div>
              <Button disabled={busy || !perm.emitir} onClick={() => run(async () => { const f: Facts = Object.fromEntries(Object.entries(facts).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])); const r = await emit(emitV.id, f, null); setTab("Emitidos"); return r; }, "Documento emitido. Código de verificação gerado.")}>Emitir documento</Button>
              {!perm.emitir && <p className="text-xs text-muted-foreground">Emitir exige Admin ou a permissão de emitir documentos institucionais.</p>}
            </>}
          </>}
        </section>)}

      {tab === "Emitidos" && (
        <section className="space-y-3" aria-label="Emitidos">
          {!user ? <p className="text-sm">Entre para ver os documentos que você emitiu.</p> : emissions.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum documento emitido visível à sua conta.</p> :
            <ul className="divide-y divide-border rounded-md border border-border">{emissions.map((e) => { const st = emissionStatus(e, emEvents); return <li key={e.id} className="space-y-1 p-3 text-sm">
              <p className="font-medium">{e.title} <span className="text-xs text-muted-foreground">· v{e.snapshot.version_no} · {formatDateTime(e.issued_at)} · {st === "valido" ? "Válido" : st === "cancelado" ? "Cancelado" : "Substituído"}</span></p>
              <p className="font-mono text-xs">Código {e.verification_code} · {e.snapshot_sha256.slice(0, 16)}…</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { if (!printHtml(reproduce(e, window.location.origin, st).html)) setMsg({ kind: "erro", text: "O navegador bloqueou a janela de impressão." }); }}>Reproduzir PDF</Button>
                <Link className="inline-flex min-h-9 items-center text-xs text-primary underline" to="/verificar/documento/$codigo" params={{ codigo: e.verification_code }} target="_blank">Página de verificação</Link>
                {st === "valido" && <><Button size="sm" variant="ghost" onClick={() => { setVoidFor({ id: e.id, kind: "cancelamento" }); setReason(""); }}>Cancelar</Button><Button size="sm" variant="ghost" onClick={() => { setVoidFor({ id: e.id, kind: "substituicao" }); setReason(""); setReplacedBy(""); }}>Substituir</Button></>}
              </div>
              {voidFor?.id === e.id && <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs">Motivo (obrigatório)<input className={inp} value={reason} maxLength={500} onChange={(x) => setReason(x.target.value)} /></label>
                {voidFor.kind === "substituicao" && <label className="text-xs">Emissão substituta<select className={inp} value={replacedBy} onChange={(x) => setReplacedBy(x.target.value)}><option value="">Escolha…</option>{emissions.filter((o) => o.id !== e.id && o.issued_at >= e.issued_at).map((o) => <option key={o.id} value={o.id}>{o.title} · {o.verification_code}</option>)}</select></label>}
                <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 5 || (voidFor.kind === "substituicao" && !replacedBy)} onClick={() => run(() => voidEmission(e.id, voidFor.kind, reason, voidFor.kind === "substituicao" ? replacedBy : null).then(() => setVoidFor(null)), voidFor.kind === "cancelamento" ? "Documento cancelado." : "Documento marcado como substituído.")}>Confirmar</Button>
                <Button size="sm" variant="ghost" onClick={() => setVoidFor(null)}>Desistir</Button></div>}
            </li>; })}</ul>}
        </section>)}

      {tab === "Acervo" && (
        <section className="space-y-4" aria-label="Acervo">
          <h2 className="text-lg font-semibold">Campos disponíveis</h2>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">{TOKEN_CATALOG.map((t) => <li key={t.key}><code>{`{{${t.key}}}`}</code> — {t.label}{t.reader ? "" : " (sem leitura automática)"}</li>)}</ul>
          <h2 className="text-lg font-semibold">Acervo analisado ({ACERVO.length})</h2>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th scope="col" className="p-2">Documento</th><th scope="col" className="p-2">Setor</th><th scope="col" className="p-2">Finalidade</th><th scope="col" className="p-2">Assinaturas</th><th scope="col" className="p-2">Classe</th></tr></thead>
            <tbody>{ACERVO.map((a) => <tr key={a.file + a.name} className="border-t border-border"><td className="p-2">{a.name}</td><td className="p-2">{a.sector}</td><td className="p-2">{a.purpose}</td><td className="p-2">{a.signatures.join(", ") || "—"}</td><td className="p-2">{a.klass}</td></tr>)}</tbody></table></div>
          <h2 className="text-lg font-semibold">Documentos já emitidos pelos setores</h2>
          <ul className="text-sm">{SECTOR_DOCUMENTS.map((s) => <li key={s.route}><a className="underline" href={s.route}>{s.sector}</a> — {s.document}</li>)}</ul>
        </section>)}
    </div>
  );
}

function fromBase(t: (typeof BASE_TEMPLATES)[number]): Draft {
  return { templateId: t.id, sector: t.sector, title: t.title, blocks: structuredClone(t.blocks), page: structuredClone(t.page), expected: 0, baseTemplateId: t.id, persisted: false };
}
