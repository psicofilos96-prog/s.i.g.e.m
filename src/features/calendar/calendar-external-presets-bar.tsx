import { presentError } from "@/lib/observability/governed-errors";
/** CAL.PRESET.1 — gestão de presets pessoais no editor externo. Só troca o rascunho da tela. */
import { useEffect, useState } from "react";
import { confirmAction } from "@/components/sigem/confirm-action";
import { Button } from "@/components/ui/button";
import type { ExternalProfile, ExternalTemplateCode } from "./calendar-external-model";
import {
  archivePreset, diffFromDefault, duplicatePreset, INSTITUTIONAL_PRESET_DISABLED, listPresets, savePresetAs, updatePreset, type Preset,
} from "./calendar-external-presets";

const field = "rounded-md border border-input bg-background px-2 py-1 text-xs";

export function ExternalPresetsBar({ template, draft, defaults, presentation, onApply }: {
  template: ExternalTemplateCode; draft: ExternalProfile; defaults: ExternalProfile;
  presentation: Record<string, unknown>; onApply: (p: ExternalProfile) => void;
}) {
  const [list, setList] = useState<Preset[] | null>(null);
  const [sel, setSel] = useState<string>("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = async () => { try { setList(await listPresets(template, presentation)); } catch (e) { setMsg(presentError(e)); setList([]); } };
  useEffect(() => { void reload(); }, [template]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = list?.find((p) => p.key === sel) ?? null;
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await f(); await reload(); setMsg(ok); } catch (e) { setMsg(presentError(e)); } finally { setBusy(false); }
  };
  const diff = diffFromDefault(draft, defaults);
  return (
    <section aria-label="Meus presets visuais" className="space-y-2 rounded-md border border-border p-2 text-xs">
      <p className="font-medium">Meus presets visuais</p>
      <p className="text-muted-foreground">Guardam só a aparência. Aplicar não grava nada nem muda a versão ou a homologação do calendário.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Preset" className={field} value={sel} onChange={(e) => { setSel(e.target.value); setName(list?.find((p) => p.key === e.target.value)?.name ?? ""); }}>
          <option value="">{list === null ? "Carregando…" : list.length ? "Escolha um preset" : "Nenhum preset salvo"}</option>
          {list?.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" disabled={!cur} onClick={() => { if (cur) { onApply(cur.profile); setMsg(`"${cur.name}" aplicado à tela. Use "Salvar personalização" se quiser gravar para o município.`); } }}>Aplicar</Button>
        <Button type="button" size="sm" variant="outline" disabled={!cur || busy} onClick={() => cur && void run(() => duplicatePreset(template, cur, list!.map((p) => p.name)), "Preset duplicado.")}>Duplicar</Button>
        <Button type="button" size="sm" variant="outline" disabled={!cur || busy} onClick={() => cur && void run(() => updatePreset(template, cur, { profile: draft }), `"${cur.name}" atualizado com a tela atual.`)}>Atualizar com a tela</Button>
        <Button type="button" size="sm" variant="outline" disabled={!cur || busy} onClick={() => cur && void confirmAction({ title: "Remover preset", consequence: `"${cur.name}" sai da sua lista. O histórico é mantido e o calendário não muda.`, actionLabel: "Remover", destructive: true }).then((ok) => { if (ok) void run(async () => { await archivePreset(template, cur); setSel(""); }, "Preset removido da lista."); })}>Remover</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Nome do preset" className={field} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do preset" />
        <Button type="button" size="sm" disabled={busy || !name.trim()} title={name.trim() ? undefined : "Digite um nome para o preset"} onClick={() => void run(() => savePresetAs(template, name, draft), "Preset pessoal salvo.")}>Salvar como novo</Button>
        <Button type="button" size="sm" variant="outline" disabled={!cur || busy || name.trim() === cur?.name} onClick={() => cur && void run(() => updatePreset(template, cur, { name }), "Preset renomeado.")}>Renomear</Button>
        <Button type="button" size="sm" variant="outline" disabled title={INSTITUTIONAL_PRESET_DISABLED}>Compartilhar com a rede</Button>
      </div>
      <p>Diferenças em relação ao padrão do modelo: {diff.length ? diff.join(", ") : "nenhuma"}.</p>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
