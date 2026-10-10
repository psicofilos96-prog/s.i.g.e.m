import { ReviewPanel } from "@/features/teacher-review/review-panel";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { ReferencePicker } from "@/features/curricular-reference/reference-picker";
import { readCatalog } from "@/features/curricular-reference/reference-source";
import { copyDraft, dailyBlocks, filterPlans, planTargetDate, parseBlocks, parseRefs, planHeads, planHistory, planMessage, plansOn, STATUS_LABEL, type PlanBlock, type PlanStatus, type PlanVersion } from "./planning-model";
import { attachmentUrl, classPositions, planPeriods, itemsOfMatrix, matrixItemKeys, myAssignments, planAttachments, revokeAttachment, savePlan, uploadAttachment, visiblePlans, type Assignment } from "./planning-source";
import { formatDateTime, operationalToday } from "@/lib/academic-date";

const today = () => operationalToday();
type Draft = { planId: string | null; head: string | null; assignmentId: string; title: string; levelValueId: string | null; coversFrom: string; coversUntil: string; blocks: PlanBlock[]; itemKeys: string[]; refIds: string[]; refPos: Record<string, string>; periodId: string | null; status: PlanStatus; copiedFrom: string | null };
const fromVersion = (v: PlanVersion): Draft => {
  const refs = parseRefs(v.curricular_refs);
  return { planId: v.plan_id, head: v.id, assignmentId: v.assignment_id, title: v.title, levelValueId: v.level_value_id, coversFrom: v.covers_from ?? "", coversUntil: v.covers_until ?? "", blocks: parseBlocks(v.blocks),
    itemKeys: refs.flatMap((r) => (r.kind === "matrix-item" ? [r.item_key] : [])), refIds: refs.flatMap((r) => (r.kind === "reference-item" ? [r.item_id] : [])),
    refPos: Object.fromEntries(refs.flatMap((r) => (r.kind === "reference-item" && r.position_key ? [[r.item_id, r.position_key]] : []))), periodId: v.period_id ?? null, status: v.status, copiedFrom: null };
};

export function PlanningPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);
  const assignments = useQuery({ queryKey: ["plan-assignments"], queryFn: () => myAssignments(today()) });
  const plans = useQuery({ queryKey: ["plans"], queryFn: visiblePlans });
  const catalog = useQuery({ queryKey: ["ref-catalog"], queryFn: readCatalog });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [day, setDay] = useState(today());
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ classId: string; itemKey: string; periodId: string }>({ classId: "", itemKey: "", periodId: "" });

  const all = plans.data ?? [];
  const heads = useMemo(() => planHeads(all), [all]);
  const mine = filterPlans(heads.filter((p) => p.author_user_id === uid), filter);
  const others = heads.filter((p) => p.author_user_id !== uid);
  const current = new Map((assignments.data ?? []).map((a) => [a.assignment_id, a]));

  const assignment = draft ? current.get(draft.assignmentId) : undefined;
  const matrixVersion = useQuery({ queryKey: ["plan-mv", assignment?.version_id], enabled: !!assignment, queryFn: async () => (await matrixItemKeys([assignment!.version_id]))[0]?.matrix_version_id ?? null });
  const refDate = draft ? planTargetDate(draft.coversFrom || null, day) : day;
  const periods = useQuery({ queryKey: ["plan-periods", draft?.assignmentId, refDate], enabled: !!assignment, queryFn: () => planPeriods(draft!.assignmentId, refDate) });
  const draftClass = draft ? all.find((v) => v.id === draft.head)?.school_id ?? null : null;
  const positions = useQuery({ queryKey: ["plan-positions", assignment?.class_id, refDate, draftClass], enabled: !!assignment && !!draftClass, queryFn: () => classPositions(draftClass!, assignment!.class_id, refDate) });
  const items = useQuery({ queryKey: ["plan-items", matrixVersion.data], enabled: !!matrixVersion.data, queryFn: () => itemsOfMatrix(matrixVersion.data!) });

  const edit = (patch: Partial<Draft>) => { setDraft((d) => (d ? { ...d, ...patch } : d)); setDirty(true); };
  const saving = useRef(false);
  async function save(status?: PlanStatus, silent = false) {
    if (!draft || saving.current || !draft.title.trim()) return;
    saving.current = true;
    try {
      const st = status ?? draft.status;
      const id = await savePlan({ planId: draft.planId, expectedHead: draft.head, assignmentId: draft.assignmentId, title: draft.title, levelValueId: draft.levelValueId, coversFrom: draft.coversFrom || null, coversUntil: draft.coversUntil || null,
        blocks: draft.blocks, refs: [...draft.itemKeys.map((k) => ({ kind: "matrix-item" as const, item_key: k, ...(matrixVersion.data ? { matrix_version_id: matrixVersion.data } : {}) })),
          ...draft.refIds.map((i) => ({ kind: "reference-item" as const, item_id: i, ...(draft.refPos[i] ? { position_key: draft.refPos[i] } : {}) }))],
        status: st, copiedFrom: draft.copiedFrom, reason: null, targetDate: planTargetDate(draft.coversFrom || null, day), periodId: draft.periodId });
      const fresh = await visiblePlans(); qc.setQueryData(["plans"], fresh);
      const v = fresh.find((x) => x.id === id)!; setDraft(fromVersion(v)); setDirty(false);
      if (!silent) setMsg({ tone: "ok", text: st === "publicado" ? "Compartilhado. Nova versão registrada." : "Salvo como nova versão." });
    } catch (e) { setMsg({ tone: "err", text: planMessage((e as Error).message) }); if (silent) setDirty(false); }
    finally { saving.current = false; }
  }
  // Autosave seguro: só rascunho existente, após 4s parado, com cabeça esperada (conflito vira aviso, nunca sobrescreve).
  useEffect(() => {
    if (!draft || !dirty || draft.status !== "rascunho" || !draft.head) return;
    const t = setTimeout(() => save(undefined, true), 4000); return () => clearTimeout(t);
  }, [draft, dirty]);

  if (assignments.isError || plans.isError) return <StatePanel tone="danger" title="Não foi possível abrir o planejamento" description="Tente novamente em instantes." />;
  if (!assignments.data || !plans.data) return <SkeletonState label="Carregando" />;

  const newPlan = (a: Assignment) => { setDraft({ planId: null, head: null, assignmentId: a.assignment_id, title: "", levelValueId: null, coversFrom: "", coversUntil: "", blocks: [{ kindValueId: null, heading: "", body: "" }], itemKeys: [a.item_key], refIds: [], refPos: {}, periodId: null, status: "rascunho", copiedFrom: null }); setDirty(false); setMsg(null); };
  const copy = async (src: PlanVersion, a: Assignment) => {
    const mv = (await matrixItemKeys([a.version_id]))[0]?.matrix_version_id; const keys = mv ? (await itemsOfMatrix(mv)).map((i) => i.item_key) : [];
    const c = copyDraft(src, a.assignment_id, keys);
    setDraft({ planId: null, head: null, assignmentId: c.assignmentId, title: c.title, levelValueId: c.levelValueId, coversFrom: c.coversFrom ?? "", coversUntil: c.coversUntil ?? "", blocks: c.blocks, itemKeys: c.refs.flatMap((r) => (r.kind === "matrix-item" ? [r.item_key] : [])), refIds: c.refs.flatMap((r) => (r.kind === "reference-item" ? [r.item_id] : [])), refPos: {}, periodId: null, status: "rascunho", copiedFrom: c.copiedFrom });
    setMsg({ tone: "ok", text: `Cópia preparada; salve para criar o novo planejamento.${c.droppedRefs ? ` ${c.droppedRefs} elemento(s) fora da matriz desta regência foram retirados.` : ""}` });
  };

  const readOnly = !!draft && (!assignment || (draft.head !== null && all.find((v) => v.id === draft.head)?.author_user_id !== uid));
  const agenda = plansOn(heads, day);

  return (
    <div className="space-y-6">
      <PageHeader title="Planejamento" description="Planeje para suas regências vigentes. Rascunho só você vê; compartilhar cria nova versão visível a quem tem permissão de consulta. Planejar não registra aula nem marca conteúdo como dado." />
      {msg && <div role={msg.tone === "err" ? "alert" : "status"} className={`rounded border p-3 text-sm ${msg.tone === "err" ? "border-destructive text-destructive" : "border-border"}`}>{msg.text}</div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <aside className="space-y-5">
          <section aria-labelledby="reg" className="space-y-2">
            <h2 id="reg" className="font-semibold">Minhas regências vigentes</h2>
            {assignments.data.length === 0 ? <EmptyState title="Nenhuma regência vigente" description="Sem atribuição docente vigente não há onde planejar. Planejamentos antigos continuam abaixo." />
              : <ul className="space-y-2">{assignments.data.map((a) => (
                <li key={a.assignment_id} className="rounded border border-border p-2 text-sm">
                  <div className="font-medium">{a.component_label_snapshot}</div>
                  <div className="text-xs text-muted-foreground">Turma {a.class_id} · desde {a.effective_from}</div>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => newPlan(a)}>Novo planejamento</Button>
                </li>))}</ul>}
          </section>
          <section aria-labelledby="meus" className="space-y-2">
            <h2 id="meus" className="font-semibold">Meus planejamentos</h2>
            <div className="grid gap-1 text-xs">
              <label>Turma <select className="w-full rounded border bg-background p-1" value={filter.classId} onChange={(e) => setFilter({ ...filter, classId: e.target.value })}>
                <option value="">Todas</option>{[...new Set(heads.filter((p) => p.author_user_id === uid).map((p) => p.class_id))].map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              <label>Elemento <select className="w-full rounded border bg-background p-1" value={filter.itemKey} onChange={(e) => setFilter({ ...filter, itemKey: e.target.value })}>
                <option value="">Todos</option>{[...new Set(assignments.data.map((a) => a.item_key))].map((k) => <option key={k} value={k}>{assignments.data.find((a) => a.item_key === k)?.component_label_snapshot ?? k}</option>)}</select></label>
              <label>Período <select className="w-full rounded border bg-background p-1" value={filter.periodId} onChange={(e) => setFilter({ ...filter, periodId: e.target.value })}>
                <option value="">Todos</option>{[...new Set(heads.filter((p) => p.author_user_id === uid && p.period_id).map((p) => p.period_id!))].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            </div>
            {mine.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ainda.</p> : <ul className="space-y-1">{mine.map((p) => (
              <li key={p.id}><button type="button" className="w-full rounded p-2 text-left text-sm hover:bg-muted" onClick={() => { setDraft(fromVersion(p)); setDirty(false); setMsg(null); }}>
                <span className="font-medium">{p.title}</span><span className="block text-xs text-muted-foreground">{STATUS_LABEL[p.status]} · v{p.version}{current.has(p.assignment_id) ? "" : " · regência encerrada (somente leitura)"}</span></button></li>))}</ul>}
          </section>
          {others.length > 0 && (
            <section aria-labelledby="outros" className="space-y-2">
              <h2 id="outros" className="font-semibold">Compartilhados que você pode ver</h2>
              <p className="text-xs text-muted-foreground">Ver não permite editar. Você pode copiar para uma regência sua.</p>
              <ul className="space-y-1">{others.map((p) => <li key={p.id}><button type="button" className="w-full rounded p-2 text-left text-sm hover:bg-muted" onClick={() => { setDraft(fromVersion(p)); setDirty(false); }}>{p.title} <span className="text-xs text-muted-foreground">· turma {p.class_id}</span></button></li>)}</ul>
            </section>)}
          <section aria-labelledby="agenda" className="space-y-2">
            <h2 id="agenda" className="font-semibold">Por data</h2>
            <DateInput value={day} onChange={(e) => setDay(e.target.value)} aria-label="Data" />
            {agenda.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum planejamento com período que inclua esta data. Planos sem datas não aparecem aqui.</p>
              : <ul className="text-sm">{agenda.map((p) => <li key={p.id}>{p.title}</li>)}</ul>}
          </section>
        </aside>

        <section aria-label="Editor" className="space-y-4">
          {!draft ? <EmptyState title="Escolha ou crie um planejamento" description="Selecione uma regência para começar ou abra um planejamento existente." /> : (
            <div className="space-y-4 rounded-lg border border-border p-4">
              {readOnly && <StatePanel tone="neutral" title="Somente leitura" description={assignment ? "Este planejamento é de outra pessoa." : "A regência deste planejamento não está vigente para você. O histórico é preservado; você pode copiá-lo para uma regência atual."} />}
              <label className="block text-sm font-medium">Título
                <input className="mt-1 w-full rounded border border-input bg-background p-2" value={draft.title} disabled={readOnly} onChange={(e) => edit({ title: e.target.value })} maxLength={200} /></label>
              <div className="flex flex-wrap gap-3">
                <label className="text-sm">Cobre de <DateInput value={draft.coversFrom} disabled={readOnly} onChange={(e) => edit({ coversFrom: e.target.value })} /></label>
                <label className="text-sm">até <DateInput value={draft.coversUntil} disabled={readOnly} onChange={(e) => edit({ coversUntil: e.target.value })} /></label>
              </div>
              <label className="block text-sm">Período oficial (opcional)
                {!assignment ? <span className="block text-muted-foreground">{draft.periodId ?? "Sem período"}</span>
                  : periods.isLoading ? <span className="block" role="status">Carregando…</span>
                  : (periods.data ?? []).length === 0 ? <span className="block text-muted-foreground">A turma não tem períodos oficiais vigentes nesta data; o plano pode ser salvo sem período.</span>
                  : <select className="mt-1 w-full rounded border bg-background p-2" disabled={readOnly} value={draft.periodId ?? ""} onChange={(e) => { const p = periods.data!.find((x) => x.period_id === e.target.value); edit({ periodId: p?.period_id ?? null, ...(p && !draft.coversFrom ? { coversFrom: p.starts_on, coversUntil: p.ends_on } : {}) }); }}>
                      <option value="">Sem período (plano anual/sequência)</option>
                      {periods.data!.map((p) => <option key={p.period_id} value={p.period_id}>{p.label} ({p.starts_on} a {p.ends_on})</option>)}</select>}
              </label>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Blocos (você define os títulos: objetivos, estratégias, recursos… o que fizer sentido)</legend>
                {draft.blocks.map((b, i) => (
                  <div key={i} className="space-y-1 rounded border border-border p-2">
                    <input aria-label={`Título do bloco ${i + 1}`} placeholder="Título do bloco" className="w-full rounded border border-input bg-background p-2 text-sm" value={b.heading} disabled={readOnly} onChange={(e) => edit({ blocks: draft.blocks.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)) })} />
                    <textarea aria-label={`Texto do bloco ${i + 1}`} rows={4} className="w-full rounded border border-input bg-background p-2 text-sm" value={b.body} disabled={readOnly} onChange={(e) => edit({ blocks: draft.blocks.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
                    {!readOnly && <Button size="sm" variant="ghost" onClick={() => edit({ blocks: draft.blocks.filter((_, j) => j !== i) })}>Remover bloco</Button>}
                  </div>))}
                {!readOnly && <Button size="sm" variant="outline" onClick={() => edit({ blocks: [...draft.blocks, { kindValueId: null, heading: "", body: "" }] })}>Adicionar bloco</Button>}
                {!readOnly && <Button size="sm" variant="outline" disabled={!draft.coversFrom || !draft.coversUntil} onClick={() => edit({ blocks: dailyBlocks(draft.coversFrom, draft.coversUntil, draft.blocks) })}>Criar um bloco por dia (datas de “Cobre de/até”)</Button>}
              </fieldset>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Elementos da matriz desta regência</legend>
                {!assignment ? <p className="text-sm text-muted-foreground">{draft.itemKeys.join(", ") || "Nenhum"} (registrado na versão)</p>
                  : !items.data ? <SkeletonState label="Carregando" />
                  : items.data.length === 0 ? <p className="text-sm text-muted-foreground">A matriz não tem itens registrados.</p>
                  : items.data.map((it) => <label key={it.item_key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={readOnly} checked={draft.itemKeys.includes(it.item_key)} onChange={() => edit({ itemKeys: draft.itemKeys.includes(it.item_key) ? draft.itemKeys.filter((k) => k !== it.item_key) : [...draft.itemKeys, it.item_key] })} />{it.component_label_snapshot ?? it.item_key}</label>)}
              </fieldset>
              {catalog.data ? (readOnly ? <p className="text-sm">Habilidades/descritores: {draft.refIds.length || "nenhum"}</p>
                : <div className="space-y-2"><ReferencePicker catalog={catalog.data} selected={draft.refIds} onChange={(ids) => edit({ refIds: ids })} />
                    {draft.refIds.length > 0 && (positions.data ?? []).length > 1 && (
                      <fieldset className="space-y-1 text-sm"><legend className="font-medium">Turma multietapa: posição curricular de cada habilidade (opcional)</legend>
                        {draft.refIds.map((id) => <label key={id} className="flex items-center gap-2">{id.slice(0, 8)}…
                          <select className="rounded border bg-background p-1" value={draft.refPos[id] ?? ""} onChange={(e) => edit({ refPos: { ...draft.refPos, [id]: e.target.value } })}>
                            <option value="">Sem posição específica</option>{positions.data!.map((p) => <option key={p.position_logical_id} value={p.position_logical_id}>{p.position_logical_id}</option>)}</select></label>)}
                      </fieldset>)}</div>)
                : <p className="text-sm text-muted-foreground">Base BNCC/SAEB não disponível; o planejamento funciona sem ela.</p>}
              {draft.planId && <Attachments planId={draft.planId} uid={uid} readOnly={readOnly} />}
              {draft.planId && draft.head && <ReviewPanel kind="plano" subjectId={draft.planId} versionId={draft.head} isAuthor={all.find((v) => v.id === draft.head)?.author_user_id === uid} print={{ title: all.find((v) => v.id === draft.head)?.title ?? draft.title, sections: parseBlocks(all.find((v) => v.id === draft.head)?.blocks).map((b) => ({ heading: b.heading, body: b.body })) }} />}
              {!readOnly && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => save("rascunho")} disabled={!draft.title.trim()}>Salvar rascunho</Button>
                  <Button variant="outline" onClick={() => save("publicado")} disabled={!draft.title.trim()}>Compartilhar</Button>
                  {draft.head && <Button variant="ghost" onClick={() => save("arquivado")}>Arquivar</Button>}
                  <span className="self-center text-xs text-muted-foreground" aria-live="polite">{dirty ? (draft.status === "rascunho" && draft.head ? "Alterações não salvas — salvamento automático em instantes" : "Alterações não salvas") : "Tudo salvo"}</span>
                </div>)}
              {draft.head && assignments.data.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">Copiar para:
                  {assignments.data.map((a) => <Button key={a.assignment_id} size="sm" variant="outline" onClick={() => copy(all.find((v) => v.id === draft.head)!, a)}>{a.component_label_snapshot} · {a.class_id}</Button>)}</div>)}
              {draft.planId && <Button size="sm" variant="ghost" aria-expanded={historyOf === draft.planId} onClick={() => setHistoryOf(historyOf ? null : draft.planId)}>Histórico de versões</Button>}
              {historyOf && <ol className="space-y-1 text-xs">{planHistory(all, historyOf).map((v) => <li key={v.id}>v{v.version} · {STATUS_LABEL[v.status]} · {formatDateTime(v.recorded_at)}{v.copied_from_version_id ? " · copiado de outro planejamento" : ""}</li>)}</ol>}
            </div>)}
        </section>
      </div>
    </div>
  );
}

function Attachments({ planId, uid, readOnly }: { planId: string; uid: string | null; readOnly: boolean }) {
  const q = useQuery({ queryKey: ["plan-att", planId], queryFn: () => planAttachments(planId) });
  const [err, setErr] = useState<string | null>(null);
  const live = (q.data ?? []).filter((a) => !a.revoked && !(q.data ?? []).some((x) => x.supersedes_id === a.id));
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">Anexos (privados, só o autor)</legend>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      {live.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum anexo.</p> : <ul className="text-sm">{live.map((a) => (
        <li key={a.id} className="flex gap-2"><button type="button" className="underline" onClick={async () => window.open(await attachmentUrl(a.object_path), "_blank", "noopener")}>{a.label}</button>
          {!readOnly && <button type="button" className="text-xs underline" onClick={async () => { try { await revokeAttachment(planId, a.id); q.refetch(); } catch (e) { setErr(planMessage((e as Error).message)); } }}>remover</button>}</li>))}</ul>}
      {!readOnly && uid && <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-label="Adicionar anexo" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 10 * 1024 * 1024) { setErr("Arquivo acima de 10 MB."); return; } try { await uploadAttachment(uid, planId, f); q.refetch(); setErr(null); } catch (x) { setErr(planMessage((x as Error).message)); } e.target.value = ""; }} />}
    </fieldset>
  );
}
