import { operationalToday } from "@/lib/academic-date";
import { ReviewPanel } from "@/features/teacher-review/review-panel";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { ReferencePicker } from "@/features/curricular-reference/reference-picker";
import { readCatalog } from "@/features/curricular-reference/reference-source";
import { myAssignments } from "@/features/teaching-planning/planning-source";
import {
  authoringMessage, heads, itemType, itemTypes, parseInstrumentItems, parseOptions, parseRandomization, parseRefIds, printFingerprint, printProjection, refStatus,
  type InstrumentVersion, type ItemOption, type ItemVersion,
} from "./authoring-model";
import { itemKey, itemMedia, mediaUrl, saveInstrument, saveItem, schoolsOfAssignments, uploadItemMedia, visibleInstruments, visibleItems } from "./authoring-source";

const today = () => operationalToday();
const input = "w-full rounded border border-input bg-background p-2 text-sm";
type Tab = "itens" | "instrumentos";

export function AuthoringPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);
  const assignments = useQuery({ queryKey: ["ta-assign"], queryFn: () => myAssignments(today()) });
  const schools = useQuery({ queryKey: ["ta-schools", assignments.data?.length], enabled: !!assignments.data, queryFn: () => schoolsOfAssignments([...new Set(assignments.data!.map((a) => a.class_id))]) });
  const items = useQuery({ queryKey: ["ta-items"], queryFn: visibleItems });
  const instruments = useQuery({ queryKey: ["ta-ins"], queryFn: visibleInstruments });
  const catalog = useQuery({ queryKey: ["ref-catalog"], queryFn: readCatalog });
  const [tab, setTab] = useState<Tab>("itens");
  const [msg, setMsg] = useState<{ err: boolean; text: string } | null>(null);
  const run = async (f: () => Promise<unknown>, ok: string) => { try { await f(); await Promise.all([qc.invalidateQueries({ queryKey: ["ta-items"] }), qc.invalidateQueries({ queryKey: ["ta-ins"] })]); setMsg({ err: false, text: ok }); return true; } catch (e) { setMsg({ err: true, text: authoringMessage((e as Error).message) }); return false; } };

  if (assignments.isError || items.isError || instruments.isError) return <StatePanel tone="danger" title="Não foi possível abrir" description="Tente novamente em instantes." />;
  if (!assignments.data || !items.data || !instruments.data) return <SkeletonState label="Carregando" />;
  const schoolIds = [...new Set((schools.data ?? []).map((s) => s.school_id))];
  return (
    <div className="space-y-6">
      <PageHeader title="Avaliações do professor" description="Monte itens e instrumentos para suas regências. Gabarito fica separado do enunciado; instrumento publicado fica congelado. Pesos, escalas e notas não são definidos aqui: o resultado é lançado na Pauta." />
      {msg && <div role={msg.err ? "alert" : "status"} className={`rounded border p-3 text-sm ${msg.err ? "border-destructive text-destructive" : "border-border"}`}>{msg.text}</div>}
      <div role="tablist" className="flex gap-2">
        {(["itens", "instrumentos"] as Tab[]).map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)}>{t === "itens" ? "Banco de itens" : "Instrumentos"}</Button>)}
      </div>
      {assignments.data.length === 0 && <EmptyState title="Nenhuma regência vigente" description="Sem regência vigente você só pode ler o que já criou." />}
      {tab === "itens" ? <ItemsTab items={items.data} uid={uid} schoolIds={schoolIds} catalog={catalog.data} run={run} />
        : <InstrumentsTab instruments={instruments.data} items={items.data} uid={uid} assignments={assignments.data} run={run} />}
    </div>
  );
}

type Run = (f: () => Promise<unknown>, ok: string) => Promise<boolean>;
type ItemDraft = { itemId: string | null; head: string | null; typeId: string; stem: string; options: ItemOption[]; refIds: string[]; schoolId: string; visibility: "pessoal" | "compartilhado"; keyShared: boolean; answer: string; criteria: string; copiedFrom: string | null };

function ItemsTab({ items, uid, schoolIds, catalog, run }: { items: ItemVersion[]; uid: string | null; schoolIds: string[]; catalog: Awaited<ReturnType<typeof readCatalog>> | undefined; run: Run }) {
  const hs = heads(items);
  const [d, setD] = useState<ItemDraft | null>(null);
  const known = useMemo(() => new Set((catalog?.items ?? []).map((i) => i.id)), [catalog]);
  const open = async (v: ItemVersion, copy: boolean) => {
    const k = (await itemKey(v.id).catch(() => []))[0];
    const answer = k ? (typeof k.answer === "string" ? k.answer : Array.isArray(k.answer) ? k.answer.join(",") : "") : "";
    setD({ itemId: copy ? null : v.item_id, head: copy ? null : v.id, typeId: v.item_type_id, stem: v.stem, options: parseOptions(v.options), refIds: parseRefIds(v.curricular_refs), schoolId: copy ? schoolIds[0] ?? "" : v.school_id, visibility: copy ? "pessoal" : v.visibility, keyShared: copy ? false : v.key_shared, answer, criteria: k?.criteria ?? "", copiedFrom: copy ? v.id : null });
  };
  const mine = (v: ItemVersion) => v.author_user_id === uid;
  const save = (status: "rascunho" | "publicado") => d && run(async () => {
    const t = itemType(d.typeId);
    const id = await saveItem({ itemId: d.itemId, head: d.head, typeId: d.typeId, stem: d.stem, options: t?.usesOptions ? d.options : [], refIds: d.refIds, schoolId: d.schoolId, visibility: d.visibility, status, keyShared: d.keyShared,
      answer: d.answer.trim() ? (t?.usesOptions ? d.answer.split(",").map((x) => x.trim()).filter(Boolean) : d.answer.trim()) : null, criteria: d.criteria.trim() || null, copiedFrom: d.copiedFrom });
    const fresh = await visibleItems(); const v = fresh.find((x) => x.id === id)!; setD((p) => p && { ...p, itemId: v.item_id, head: v.id, copiedFrom: null });
  }, status === "publicado" ? "Item publicado (nova versão)." : "Rascunho salvo (nova versão).");
  const readOnly = !!d?.head && !mine(items.find((x) => x.id === d.head)!);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <aside className="space-y-2">
        {schoolIds.length > 0 && <Button onClick={() => setD({ itemId: null, head: null, typeId: itemTypes()[0]!.id, stem: "", options: [{ key: "A", text: "" }, { key: "B", text: "" }], refIds: [], schoolId: schoolIds[0]!, visibility: "pessoal", keyShared: false, answer: "", criteria: "", copiedFrom: null })}>Novo item</Button>}
        {hs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item visível.</p> : <ul className="space-y-1">{hs.map((v) => (
          <li key={v.id} className="rounded border border-border p-2 text-sm">
            <p className="line-clamp-2">{v.stem}</p>
            <p className="text-xs text-muted-foreground">{itemType(v.item_type_id)?.label ?? v.item_type_id} · v{v.version} · {v.status === "publicado" ? "publicado" : "rascunho"} · {v.visibility}{mine(v) ? "" : " · de outra pessoa"}</p>
            <div className="mt-1 flex gap-2"><Button size="sm" variant="outline" onClick={() => open(v, false)}>{mine(v) ? "Abrir" : "Ver"}</Button>{schoolIds.length > 0 && <Button size="sm" variant="ghost" onClick={() => open(v, true)}>Reutilizar</Button>}</div>
          </li>))}</ul>}
      </aside>
      <section aria-label="Editor de item">
        {!d ? <EmptyState title="Escolha ou crie um item" description="Itens publicados podem entrar em instrumentos; reutilizar cria cópia com origem registrada." /> : (
          <div className="space-y-3 rounded-lg border border-border p-4">
            {readOnly && <StatePanel tone="neutral" title="Somente leitura" description="Item compartilhado por outra pessoa. Use Reutilizar para criar sua versão." />}
            {d.copiedFrom && <p className="text-xs text-muted-foreground">Cópia de outra versão; a origem fica registrada.</p>}
            <label className="block text-sm">Tipo
              <select className={input} value={d.typeId} disabled={readOnly || !!d.head} onChange={(e) => setD({ ...d, typeId: e.target.value })}>{itemTypes().map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}{!itemType(d.typeId) && <option value={d.typeId}>{d.typeId}</option>}</select></label>
            <label className="block text-sm">Enunciado (texto puro)
              <textarea rows={5} className={input} value={d.stem} disabled={readOnly} maxLength={20000} onChange={(e) => setD({ ...d, stem: e.target.value })} /></label>
            {itemType(d.typeId)?.usesOptions && (
              <fieldset className="space-y-2"><legend className="text-sm font-medium">Alternativas</legend>
                {d.options.map((o, i) => <div key={i} className="flex gap-2"><input aria-label={`Rótulo da alternativa ${i + 1}`} className="w-16 rounded border border-input bg-background p-2 text-sm" value={o.key} disabled={readOnly} maxLength={4} onChange={(e) => setD({ ...d, options: d.options.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} /><input aria-label={`Texto da alternativa ${i + 1}`} className={input} value={o.text} disabled={readOnly} onChange={(e) => setD({ ...d, options: d.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} /></div>)}
                {!readOnly && <Button size="sm" variant="outline" onClick={() => setD({ ...d, options: [...d.options, { key: String.fromCharCode(65 + d.options.length), text: "" }] })}>Adicionar alternativa</Button>}
              </fieldset>)}
            <fieldset className="space-y-2 rounded border border-dashed border-border p-2"><legend className="text-sm font-medium">Gabarito e critério (guardados à parte)</legend>
              <input aria-label={itemType(d.typeId)?.answerHint ?? "Resposta"} placeholder={itemType(d.typeId)?.answerHint ?? "Resposta"} className={input} value={d.answer} disabled={readOnly} onChange={(e) => setD({ ...d, answer: e.target.value })} />
              <textarea aria-label="Critério de correção" placeholder="Critério de correção (opcional)" rows={3} className={input} value={d.criteria} disabled={readOnly} onChange={(e) => setD({ ...d, criteria: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.keyShared} disabled={readOnly} onChange={(e) => setD({ ...d, keyShared: e.target.checked })} />Compartilhar gabarito com quem puder ver o item</label>
            </fieldset>
            {catalog ? (readOnly ? null : <ReferencePicker catalog={catalog} selected={d.refIds.filter((id) => known.has(id))} onChange={(ids) => setD({ ...d, refIds: [...ids, ...d.refIds.filter((id) => !known.has(id))] })} />) : <p className="text-sm text-muted-foreground">Base BNCC/SAEB não disponível; o item funciona sem ela.</p>}
            {refStatus(d.refIds, known).filter((r) => !r.found).length > 0 && <p className="text-xs text-muted-foreground">{refStatus(d.refIds, known).filter((r) => !r.found).length} habilidade(s) desta versão não constam na base atual; o vínculo histórico é mantido.</p>}
            <div className="flex flex-wrap gap-3 text-sm">
              {schoolIds.length > 1 && <label>Escola <select className="rounded border border-input bg-background p-2" value={d.schoolId} disabled={readOnly} onChange={(e) => setD({ ...d, schoolId: e.target.value })}>{schoolIds.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}
              <label>Visibilidade <select className="rounded border border-input bg-background p-2" value={d.visibility} disabled={readOnly} onChange={(e) => setD({ ...d, visibility: e.target.value as ItemDraft["visibility"] })}><option value="pessoal">Só eu</option><option value="compartilhado">Banco compartilhado da escola</option></select></label>
            </div>
            {d.itemId && !readOnly && uid && <ItemMedia itemId={d.itemId} uid={uid} />}
            {!readOnly && <div className="flex gap-2"><Button onClick={() => save("rascunho")} disabled={!d.stem.trim()}>Salvar rascunho</Button><Button variant="outline" onClick={() => save("publicado")} disabled={!d.stem.trim()}>Publicar</Button></div>}
          </div>)}
      </section>
    </div>
  );
}

function ItemMedia({ itemId, uid }: { itemId: string; uid: string }) {
  const q = useQuery({ queryKey: ["ta-media", itemId], queryFn: () => itemMedia(itemId) });
  const [err, setErr] = useState<string | null>(null);
  return (
    <fieldset className="space-y-1"><legend className="text-sm font-medium">Imagens/PDF (privados)</legend>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <ul className="text-sm">{(q.data ?? []).map((m) => <li key={m.id}><button type="button" className="underline" onClick={async () => window.open(await mediaUrl(m.object_path), "_blank", "noopener")}>{m.label}</button></li>)}</ul>
      <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" aria-label="Adicionar mídia" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { await uploadItemMedia(uid, itemId, f); setErr(null); q.refetch(); } catch (x) { const m = (x as Error).message; setErr(m === "media-type" ? "Formato não aceito (PNG, JPEG, WEBP ou PDF)." : m === "media-size" ? "Arquivo acima de 10 MB." : authoringMessage(m)); } e.target.value = ""; }} />
    </fieldset>
  );
}

type InsDraft = { instrumentId: string | null; head: string | null; assignmentId: string; title: string; instructions: string; itemIds: string[]; randomize: boolean; seed: string; shuffleOptions: boolean; resultsId: string };

function InstrumentsTab({ instruments, items, uid, assignments, run }: { instruments: InstrumentVersion[]; items: ItemVersion[]; uid: string | null; assignments: { assignment_id: string; class_id: string; component_label_snapshot: string }[]; run: Run }) {
  const hs = heads(instruments);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const published = heads(items).filter((i) => i.status === "publicado");
  const [d, setD] = useState<InsDraft | null>(null);
  const [printing, setPrinting] = useState<InstrumentVersion | null>(null);
  const current = new Set(assignments.map((a) => a.assignment_id));
  const head = d?.head ? instruments.find((x) => x.id === d.head) : undefined;
  const frozen = head?.status === "publicado" || (head && head.author_user_id !== uid) || (!!d && !current.has(d.assignmentId));
  const fromV = (v: InstrumentVersion, copy: boolean): InsDraft => { const rz = parseRandomization(v.randomization); return { instrumentId: copy ? null : v.instrument_id, head: copy ? null : v.id, assignmentId: copy ? assignments[0]?.assignment_id ?? v.assignment_id : v.assignment_id, title: copy ? `${v.title} (cópia)` : v.title, instructions: v.instructions ?? "", itemIds: parseInstrumentItems(v.items), randomize: !!rz, seed: rz?.seed ?? "", shuffleOptions: !!rz?.shuffleOptions, resultsId: copy ? "" : v.results_instrument_id ?? "" }; };
  const save = (status: "rascunho" | "publicado") => d && run(async () => {
    const id = await saveInstrument({ instrumentId: d.instrumentId, head: d.head, assignmentId: d.assignmentId, periodId: null, title: d.title, instructions: d.instructions || null, itemVersionIds: d.itemIds,
      randomization: d.randomize ? { seed: d.seed, shuffleItems: true, shuffleOptions: d.shuffleOptions } : null, status, resultsInstrumentId: d.resultsId.trim() || null });
    const fresh = await visibleInstruments(); const v = fresh.find((x) => x.id === id)!; setD(fromV(v, false));
  }, status === "publicado" ? "Instrumento publicado e congelado." : "Rascunho salvo.");

  if (printing) return <PrintView ins={printing} items={byId} onClose={() => setPrinting(null)} />;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <aside className="space-y-2">
        {assignments.length > 0 && <Button onClick={() => setD({ instrumentId: null, head: null, assignmentId: assignments[0]!.assignment_id, title: "", instructions: "", itemIds: [], randomize: false, seed: "", shuffleOptions: false, resultsId: "" })}>Novo instrumento</Button>}
        {hs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum instrumento.</p> : <ul className="space-y-1">{hs.map((v) => (
          <li key={v.id} className="rounded border border-border p-2 text-sm"><p className="font-medium">{v.title}</p><p className="text-xs text-muted-foreground">v{v.version} · {v.status === "publicado" ? "publicado (congelado)" : "rascunho"} · turma {v.class_id}</p>
            <div className="mt-1 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setD(fromV(v, false))}>Abrir</Button>{assignments.length > 0 && <Button size="sm" variant="ghost" onClick={() => setD(fromV(v, true))}>Copiar</Button>}<Button size="sm" variant="ghost" onClick={() => setPrinting(v)}>Impressão</Button></div></li>))}</ul>}
      </aside>
      <section aria-label="Editor de instrumento">
        {!d ? <EmptyState title="Escolha ou crie um instrumento" description="Aplicação e lançamento de resultado continuam na Pauta." /> : (
          <div className="space-y-3 rounded-lg border border-border p-4">
            {frozen && <StatePanel tone="neutral" title="Somente leitura" description={head?.status === "publicado" ? "Publicado e congelado. Use Copiar para criar nova versão editável." : "Sem regência vigente ou autoria para alterar."} />}
            <label className="block text-sm">Regência<select className={input} value={d.assignmentId} disabled={!!d.head || frozen} onChange={(e) => setD({ ...d, assignmentId: e.target.value })}>{assignments.map((a) => <option key={a.assignment_id} value={a.assignment_id}>{a.component_label_snapshot} · {a.class_id}</option>)}{!current.has(d.assignmentId) && <option value={d.assignmentId}>Regência não vigente</option>}</select></label>
            {d.instrumentId && d.head && <ReviewPanel kind="instrumento" subjectId={d.instrumentId} versionId={d.head} isAuthor={!!head && head.author_user_id === uid} print={{ title: head?.title ?? d.title, sections: [{ heading: "Instruções", body: head?.instructions ?? "" }, ...published.filter((p) => d.itemIds.includes(p.id)).map((p, i) => ({ heading: `Questão ${i + 1}`, body: p.stem }))] }} />}
            <label className="block text-sm">Título<input className={input} value={d.title} disabled={frozen} maxLength={200} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
            <label className="block text-sm">Instruções<textarea rows={3} className={input} value={d.instructions} disabled={frozen} onChange={(e) => setD({ ...d, instructions: e.target.value })} /></label>
            <fieldset className="space-y-1"><legend className="text-sm font-medium">Itens (versões publicadas fixadas)</legend>
              {d.itemIds.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item.</p> : <ol className="list-decimal pl-5 text-sm">{d.itemIds.map((id) => <li key={id} className="flex justify-between gap-2"><span>{byId.get(id)?.stem.slice(0, 120) ?? "Item não acessível"} <span className="text-xs text-muted-foreground">v{byId.get(id)?.version}</span></span>{!frozen && <button type="button" className="text-xs underline" onClick={() => setD({ ...d, itemIds: d.itemIds.filter((x) => x !== id) })}>remover</button>}</li>)}</ol>}
              {!frozen && (published.length === 0 ? <p className="text-sm text-muted-foreground">Publique itens no banco para usá-los aqui.</p>
                : <select aria-label="Adicionar item" className={input} value="" onChange={(e) => e.target.value && setD({ ...d, itemIds: [...d.itemIds, e.target.value] })}><option value="">Adicionar item publicado…</option>{published.filter((p) => !d.itemIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.stem.slice(0, 80)} (v{p.version})</option>)}</select>)}
            </fieldset>
            <fieldset className="space-y-1"><legend className="text-sm font-medium">Randomização (só se você ativar)</legend>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.randomize} disabled={frozen} onChange={(e) => setD({ ...d, randomize: e.target.checked, seed: d.seed || crypto.randomUUID().slice(0, 8) })} />Embaralhar ordem dos itens</label>
              {d.randomize && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.shuffleOptions} disabled={frozen} onChange={(e) => setD({ ...d, shuffleOptions: e.target.checked })} />Embaralhar alternativas</label><label className="text-sm">Semente <input className="rounded border border-input bg-background p-1" value={d.seed} disabled={frozen} onChange={(e) => setD({ ...d, seed: e.target.value })} /></label></>}
            </fieldset>
            <label className="block text-sm">Instrumento da Pauta para resultados (opcional)<input className={input} value={d.resultsId} disabled={frozen} placeholder="ins-…" onChange={(e) => setD({ ...d, resultsId: e.target.value })} /></label>
            <p className="text-xs text-muted-foreground">Pontuação, pesos e escala vêm da configuração avaliativa da Pauta; nada é calculado aqui.</p>
            {!frozen && <div className="flex gap-2"><Button onClick={() => save("rascunho")} disabled={!d.title.trim()}>Salvar rascunho</Button><Button variant="outline" onClick={() => save("publicado")} disabled={!d.title.trim() || d.itemIds.length === 0}>Publicar e congelar</Button></div>}
          </div>)}
      </section>
    </div>
  );
}

export function PrintView({ ins, items, onClose }: { ins: InstrumentVersion; items: ReadonlyMap<string, ItemVersion>; onClose: () => void }) {
  const p = useMemo(() => printProjection(ins, items), [ins, items]);
  const [fp, setFp] = useState("");
  useEffect(() => { printFingerprint(p).then(setFp); }, [p]);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 print:hidden"><Button variant="outline" onClick={onClose}>Voltar</Button><Button onClick={() => window.print()}>Imprimir / salvar PDF</Button></div>
      {ins.status !== "publicado" && <StatePanel tone="warning" title="Rascunho" description="Impressão de rascunho; o conteúdo pode mudar." />}
      {p.missing.length > 0 && <StatePanel tone="warning" title="Itens não acessíveis" description={`${p.missing.length} item(ns) não puderam ser lidos e não aparecem na impressão.`} />}
      <article className="mx-auto max-w-3xl space-y-4 bg-card p-6 text-card-foreground">
        <header className="space-y-1 border-b border-border pb-3"><h1 className="text-xl font-semibold">{p.title}</h1>{p.instructions && <p className="whitespace-pre-wrap text-sm">{p.instructions}</p>}<p className="text-sm">Nome: ______________________________________ Data: ____/____/______</p></header>
        <ol className="space-y-5">{p.questions.map((q) => (
          <li key={q.itemVersionId} className="break-inside-avoid"><p className="whitespace-pre-wrap"><strong>{q.number}.</strong> {q.stem}</p>
            {q.options.length > 0 ? <ul className="mt-2 space-y-1 pl-4">{q.options.map((o) => <li key={o.key}>({o.key}) {o.text}</li>)}</ul> : <div className="mt-2 h-20 border-b border-dashed border-border" aria-hidden />}</li>))}</ol>
        <footer className="border-t border-border pt-2 text-2xs text-muted-foreground">Versão {p.version} · impressão {fp.slice(0, 16)}</footer>
      </article>
    </div>
  );
}
