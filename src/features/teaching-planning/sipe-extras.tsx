/** SIPE.1 — modelos da Secretaria, compartilhamento seletivo, copiar e adaptar, e impressão A4 com cabeçalho automático. */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DEFAULT_DAY_FIELDS, parseBlocks, parseRefs, templateHeads, type PlanTemplate, type PlanVersion } from "./planning-model";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => any };
const must = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };
export const planTemplates = () => must<PlanTemplate[]>(db.from("sipe_plan_template_versions").select("*").order("version", { ascending: false }));
export const sharedWithMe = () => must<PlanVersion[]>(db.rpc("teaching_plans_shared_with_me"));
export const colleagues = () => must<{ user_id: string; display_name: string; school_id: string }[]>(db.rpc("sipe_colleagues"));
export const shareEvents = (planId: string) => must<{ recipient_user_id: string; event: string; recorded_at: string }[]>(db.from("teaching_plan_share_events").select("recipient_user_id, event, recorded_at").eq("plan_id", planId).order("recorded_at"));
export const sharePlan = (planId: string, recipient: string, revoke: boolean) => must<string>(db.rpc("share_teaching_plan", { _plan: planId, _recipient: recipient, _revoke: revoke }));
export const recordSharedCopy = (newPlanId: string, sourceVersionId: string) => must<string>(db.rpc("record_shared_plan_copy", { _new_plan: newPlanId, _source_version: sourceVersionId }));
const schoolName = async (id: string) => (await must<{ official_name: string }[]>(db.from("institutional_school_record_versions").select("official_name").eq("school_id", id).order("version_number", { ascending: false }).limit(1)))[0]?.official_name ?? null;

const ERR: Record<string, string> = {
  "sipe:template-capability-missing": "Sua conta não tem permissão para configurar modelos de planejamento (Secretaria).",
  "sipe:stale-head": "O modelo foi alterado em outra janela; recarregue.", "sipe:reason-required": "Nova versão do modelo exige motivo.", "sipe:invalid-fields": "Campos do dia inválidos (1 a 20, até 60 caracteres).",
  "sipe:only-author-shares": "Só quem escreveu o planejamento compartilha.", "sipe:recipient-not-colleague": "O destinatário precisa ter atuação vigente na mesma escola.",
  "sipe:already-shared": "Já compartilhado com essa pessoa.", "sipe:not-shared": "Não estava compartilhado.", "sipe:source-not-shared": "O plano de origem não está mais compartilhado com você.",
};
export const sipeMessage = (raw: string) => { const k = Object.keys(ERR).find((x) => raw.includes(x)); return k ? ERR[k]! : "Não foi possível concluir. Tente novamente."; };
/** Projeção do ledger: compartilhamento ativo = último evento "compartilhado". */
export const activeShares = (ev: readonly { recipient_user_id: string; event: string }[]) => { const m = new Map<string, string>(); for (const e of ev) m.set(e.recipient_user_id, e.event); return [...m].filter(([, e]) => e === "compartilhado").map(([u]) => u); };

export function SharePanel({ planId, schoolId }: { planId: string; schoolId: string }) {
  const qc = useQueryClient();
  const col = useQuery({ queryKey: ["sipe-col"], queryFn: colleagues });
  const ev = useQuery({ queryKey: ["sipe-share", planId], queryFn: () => shareEvents(planId) });
  const [to, setTo] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const act = activeShares(ev.data ?? []);
  const sameSchool = (col.data ?? []).filter((c) => c.school_id === schoolId);
  const name = (u: string) => (col.data ?? []).find((c) => c.user_id === u)?.display_name ?? "Colega (sem atuação vigente)";
  const run = async (u: string, revoke: boolean) => { try { await sharePlan(planId, u, revoke); setMsg(revoke ? "Compartilhamento retirado." : "Compartilhado."); setTo(""); await qc.invalidateQueries({ queryKey: ["sipe-share", planId] }); } catch (e) { setMsg(sipeMessage((e as Error).message)); } };
  return (
    <fieldset className="space-y-2 rounded border border-border p-3" aria-label="Compartilhar com colegas">
      <legend className="text-sm font-medium">Compartilhar com colegas (só quem você escolher)</legend>
      <p className="text-xs text-muted-foreground">A pessoa lê a versão mais recente e pode copiar para adaptar. O seu original nunca é alterado.</p>
      {act.length > 0 && <ul className="text-sm">{act.map((u) => <li key={u} className="flex items-center gap-2">{name(u)}<Button size="sm" variant="ghost" onClick={() => run(u, true)}>Retirar</Button></li>)}</ul>}
      {col.isError ? <p className="text-xs text-destructive">Não foi possível ler os colegas.</p> : sameSchool.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum colega com atuação vigente nesta escola.</p> : (
        <div className="flex gap-2"><select aria-label="Colega" className="rounded border border-input bg-background p-1 text-sm" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Escolha um colega…</option>{sameSchool.filter((c) => !act.includes(c.user_id)).map((c) => <option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select><Button size="sm" disabled={!to} onClick={() => run(to, false)}>Compartilhar</Button></div>)}
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </fieldset>
  );
}

/** Secretaria: campos do dia por segmento (ex.: anos iniciais = unidocente, anos finais = por componente), versionados; planos antigos não mudam. */
export function TemplatesAdmin({ schoolIds }: { schoolIds: string[] }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sipe-tpl"], queryFn: planTemplates });
  const hs = useMemo(() => templateHeads(q.data ?? []), [q.data]);
  const [d, setD] = useState<{ scope: string; segment: string; head: string | null; mode: "unidocente" | "por-componente"; fields: string; reason: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => { if (!d) return; try {
    await must(db.rpc("record_sipe_plan_template", { _scope: d.scope, _segment: d.segment, _expected_head: d.head, _mode: d.mode, _fields: d.fields.split("\n").map((x) => x.trim()).filter(Boolean), _reason: d.reason || null }));
    setMsg("Modelo gravado (nova versão)."); setD(null); await qc.invalidateQueries({ queryKey: ["sipe-tpl"] }); } catch (e) { setMsg(sipeMessage((e as Error).message)); } };
  const inp = "w-full rounded border border-input bg-background p-2 text-sm";
  return (
    <section aria-label="Modelos de planejamento" className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="font-semibold">Modelos de planejamento (Secretaria)</h2>
      <p className="text-xs text-muted-foreground">Cada gravação cria nova versão. Planejamentos já feitos guardam seus próprios campos e não mudam. Sem modelo, valem os campos do SIPE: {DEFAULT_DAY_FIELDS.join(", ")}.</p>
      {q.isError && <p role="alert" className="text-sm text-destructive">Não foi possível ler os modelos.</p>}
      <ul className="space-y-1 text-sm">{hs.map((t) => <li key={t.id} className="rounded border border-border p-2"><strong>{t.segment_key}</strong> · {t.scope_key === "rede" ? "rede" : "escola"} · {t.plan_mode === "unidocente" ? "um planejamento da turma (professor regente)" : "um por componente"} · v{t.version}<p className="text-xs text-muted-foreground">{t.day_fields.join(" · ")}</p>
        <Button size="sm" variant="outline" onClick={() => setD({ scope: t.scope_key, segment: t.segment_key, head: t.id, mode: t.plan_mode, fields: t.day_fields.join("\n"), reason: "" })}>Nova versão</Button></li>)}</ul>
      {!d && <Button size="sm" onClick={() => setD({ scope: schoolIds[0] ? `escola:${schoolIds[0]}` : "rede", segment: "", head: null, mode: "por-componente", fields: DEFAULT_DAY_FIELDS.join("\n"), reason: "" })}>Novo modelo</Button>}
      {d && <div className="space-y-2">
        <label className="block text-sm">Abrangência<select className={inp} disabled={!!d.head} value={d.scope} onChange={(e) => setD({ ...d, scope: e.target.value })}><option value="rede">Toda a rede</option>{schoolIds.map((s) => <option key={s} value={`escola:${s}`}>Escola {s}</option>)}</select></label>
        <label className="block text-sm">Segmento<input aria-label="Segmento" className={inp} disabled={!!d.head} placeholder="Ex.: Anos iniciais" value={d.segment} onChange={(e) => setD({ ...d, segment: e.target.value })} /></label>
        <label className="block text-sm">Organização<select className={inp} value={d.mode} onChange={(e) => setD({ ...d, mode: e.target.value as "unidocente" })}><option value="unidocente">Um planejamento da turma (anos iniciais)</option><option value="por-componente">Um por componente (anos finais)</option></select></label>
        <label className="block text-sm">Campos de cada dia (um por linha)<textarea aria-label="Campos do dia" rows={8} className={inp} value={d.fields} onChange={(e) => setD({ ...d, fields: e.target.value })} /></label>
        {d.head && <label className="block text-sm">Motivo da nova versão<input aria-label="Motivo" className={inp} value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} /></label>}
        <div className="flex gap-2"><Button size="sm" onClick={save} disabled={!d.segment.trim()}>Gravar modelo</Button><Button size="sm" variant="ghost" onClick={() => setD(null)}>Cancelar</Button></div>
      </div>}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </section>
  );
}

const A4 = `@page{size:A4;margin:16mm}@media print{body *{visibility:hidden}.sipe-sheet,.sipe-sheet *{visibility:visible}.sipe-sheet{position:absolute;left:0;top:0;width:100%;padding:0!important;max-width:none!important}.sipe-sheet section{break-inside:avoid}}`;
/** Impressão A4: cabeçalho com unidade (cadastro), turma, componente e período; conteúdo só do plano gravado. */
export function PlanPrint({ plan, component, onClose }: { plan: PlanVersion; component: string | null; onClose: () => void }) {
  const unit = useQuery({ queryKey: ["sipe-unit", plan.school_id], queryFn: () => schoolName(plan.school_id) });
  const blocks = parseBlocks(plan.blocks); const refs = parseRefs(plan.curricular_refs).length;
  const br = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
  return (
    <div className="space-y-3">
      <style>{A4}</style>
      <div className="flex gap-2 print:hidden"><Button variant="outline" onClick={onClose}>Voltar</Button><Button onClick={() => window.print()}>Imprimir / salvar PDF (A4)</Button></div>
      <article data-testid="sipe-sheet" className="sipe-sheet mx-auto max-w-[210mm] space-y-3 bg-card p-[16mm] text-justify text-sm leading-relaxed text-card-foreground" lang="pt-BR" style={{ hyphens: "auto" }}>
        <header className="flex items-center gap-3 border-b border-border pb-2">
          <img src={brasao.url} alt="Brasão de Itaperuna" className="h-12 w-auto" />
          <div className="flex-1 text-center"><p className="text-xs uppercase">Secretaria Municipal de Educação</p><p className="font-semibold uppercase" data-testid="sipe-unit">{unit.data ?? (unit.isLoading ? "…" : "Unidade não identificada no cadastro")}</p><p className="text-xs">Planejamento docente (SIPE)</p></div>
        </header>
        <table className="w-full text-xs"><tbody>
          <tr><td className="pr-2 font-semibold">Título</td><td>{plan.title}</td><td className="pr-2 font-semibold">Turma</td><td>{plan.class_id}</td></tr>
          <tr><td className="pr-2 font-semibold">Componente</td><td>{component ?? "—"}</td><td className="pr-2 font-semibold">Período</td><td>{br(plan.covers_from)} a {br(plan.covers_until)}</td></tr>
          <tr><td className="pr-2 font-semibold">Versão</td><td>v{plan.version} · {plan.status === "publicado" ? "compartilhado" : plan.status}</td><td className="pr-2 font-semibold">Referências</td><td>{refs}</td></tr>
        </tbody></table>
        {blocks.map((b, i) => <section key={i} className="border-t border-border pt-2"><h2 className="font-semibold">{b.heading || `Bloco ${i + 1}`}</h2><p className="whitespace-pre-wrap">{b.body}</p></section>)}
        <footer className="border-t border-border pt-2 text-2xs text-muted-foreground">Documento de planejamento; não registra aula ministrada. Versão {plan.version} · {plan.id.slice(0, 8)}</footer>
      </article>
    </div>
  );
}
