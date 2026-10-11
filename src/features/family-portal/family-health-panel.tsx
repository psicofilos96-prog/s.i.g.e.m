import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SkeletonState } from "@/components/sigem/guidance";
import { CONSENT_TEXT, CONSENT_VERSION, HEALTH_KINDS, HEALTH_KIND_LABEL, healthMessage, projectHealth, validateHealthDraft,
  type HealthDraft, type HealthItem, type HealthRow } from "./family-health";
import { readHealthHistory, recordHealth } from "./family-health-source";

import { confirmAction } from "@/components/sigem/confirm-action";
const EMPTY: HealthDraft = { kind: "", description: "", instructions: "", consent: false };
const when = (t: string) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const EVENT: Record<HealthRow["event_kind"], string> = { declaracao: "declarada", retificacao: "retificada", retirada: "retirada" };

/** Família: declara, retifica e retira informações de saúde; cada envio exige ciência e vira nova versão. */
export function FamilyHealth({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<HealthItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<HealthDraft>(EMPTY);
  const [editing, setEditing] = useState<HealthItem | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => readHealthHistory(studentId).then((r) => setItems(projectHealth(r)), (e: Error) => setErr(healthMessage(e.message)));
  useEffect(() => { void load(); }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setErr(null); setNotice(null);
    try { await fn(); setNotice(ok); setDraft(EMPTY); setEditing(null); await load(); } catch (e) { setErr(healthMessage((e as Error).message)); }
    setBusy(false);
  }
  function submit() {
    const v = validateHealthDraft(draft); if (v) { setErr(v); return; }
    void run(() => recordHealth({ student: studentId, base: editing?.head.id ?? null, event: editing ? "retificacao" : "declaracao",
      kind: editing ? null : (draft.kind || null), description: draft.description, instructions: draft.instructions, consentVersion: CONSENT_VERSION }),
      editing ? "Informação retificada; a versão anterior fica no histórico." : "Informação enviada à escola.");
  }
  async function withdraw(it: HealthItem) {
    if (!(await confirmAction({ title: "Retirar esta informação?", consequence: "A escola deixará de vê-la; o histórico permanece.", actionLabel: "Retirar", destructive: true }))) return;
    void run(() => recordHealth({ student: studentId, base: it.head.id, event: "retirada", kind: null, description: null, instructions: null, consentVersion: CONSENT_VERSION }),
      "Informação retirada.");
  }

  if (items === null && !err) return <SkeletonState label="Carregando" />;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Informações sensíveis: só a equipe de alimentação da escola e os responsáveis autorizados as veem.</p>
      {err && <p role="alert" className="text-destructive">{err}</p>}
      {notice && <p role="status">{notice}</p>}
      {items && items.length === 0 && <p className="text-muted-foreground">Nenhuma informação de saúde declarada.</p>}
      {items && items.length > 0 && (
        <ul className="space-y-2" aria-label="Informações declaradas">{items.map((it) => (
          <li key={it.logicalId} className="rounded border p-2">
            <p><strong>{HEALTH_KIND_LABEL[it.head.kind]}</strong>{it.active ? "" : " — retirada"}</p>
            <p>{it.head.description}</p>
            {it.head.instructions && <p className="text-muted-foreground">Orientação: {it.head.instructions}</p>}
            <details><summary className="cursor-pointer text-xs">Histórico ({it.history.length})</summary>
              <ul className="ml-4 list-disc text-xs">{it.history.map((h) => (
                <li key={h.id}>v{h.version} {EVENT[h.event_kind]} em {when(h.recorded_at)} por {h.by_me ? "você" : "outro responsável"}</li>))}</ul></details>
            {it.active && <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" disabled={busy}
                onClick={() => { setEditing(it); setDraft({ kind: it.head.kind, description: it.head.description, instructions: it.head.instructions ?? "", consent: false }); }}>Retificar</Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => withdraw(it)}>Retirar</Button></div>}
          </li>))}</ul>)}
      <fieldset className="space-y-2 rounded border p-3">
        <legend className="px-1 font-medium">{editing ? "Retificar informação" : "Nova informação"}</legend>
        <label className="block">Tipo
          <select className="mt-1 block w-full rounded border bg-background p-2" value={draft.kind} disabled={!!editing}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as HealthDraft["kind"] })}>
            <option value="">Escolha…</option>
            {HEALTH_KINDS.map((k) => <option key={k} value={k}>{HEALTH_KIND_LABEL[k]}</option>)}
          </select></label>
        <label className="block">Descrição<textarea maxLength={600} className="mt-1 block w-full rounded border bg-background p-2" value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <label className="block">Orientação à escola (opcional)<textarea maxLength={600} className="mt-1 block w-full rounded border bg-background p-2" value={draft.instructions}
          onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={draft.consent} onChange={(e) => setDraft({ ...draft, consent: e.target.checked })} />
          <span className="text-xs">{CONSENT_TEXT}</span></label>
        <div className="flex gap-2">
          <Button type="button" disabled={busy} onClick={submit}>{editing ? "Enviar retificação" : "Enviar"}</Button>
          {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setDraft(EMPTY); }}>Cancelar</Button>}
        </div>
      </fieldset>
    </div>
  );
}
