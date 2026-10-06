/**
 * CAL.EXT.1 — Seletor "Modelo de apresentação" + prévia/impressão dos externos + editor visual.
 * O modelo interno é renderizado pelo chamador exatamente como antes; este painel só entra quando
 * um externo é escolhido. O conteúdo é sempre o mesmo `PrintModel` recebido.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ASSET_MAX_CHARS, buildExternalViewModel, defaultProfile, FONT_OPTIONS, PRESENTATION_TEMPLATES, safeQrUrl, sanitizeProfile,
  type ExternalProfile, type ExternalTemplateCode, type PresentationTemplateCode,
} from "./calendar-external-model";
import { ExternalCalendarPrint, ExternalSheet } from "./calendar-external-sheets";
import { readExternalProfile, saveExternalProfile, type ExternalProfileRead } from "./calendar-external-profile";
import { buildPrintModel, type PrintModel } from "./institutional-calendar-presentation";
import { externalPresentation } from "./calendar-visual-resolver";
import type { CalendarDayRead } from "./institutional-calendar-readers";
import { readCouncilConfiguration, type CouncilConfiguration } from "./institutional-calendar-councils";
import { institutionalIdentity } from "./calendar-external-model";

export function TemplateSelector({ value, onChange }: { value: PresentationTemplateCode; onChange: (v: PresentationTemplateCode) => void }) {
  return (
    <div role="radiogroup" aria-label="Modelo de apresentação" className="flex flex-wrap gap-1">
      <span className="mr-1 self-center text-xs font-medium">Modelo de apresentação:</span>
      {PRESENTATION_TEMPLATES.map((t) => (
        <Button key={t.code} type="button" size="sm" role="radio" aria-checked={value === t.code}
          variant={value === t.code ? "default" : "outline"} onClick={() => onChange(t.code)}>{t.label}</Button>
      ))}
    </div>
  );
}

const fileToDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
async function pickImage(f: File | undefined): Promise<{ ok: string } | { error: string }> {
  if (!f) return { error: "Nenhum arquivo." };
  if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) return { error: "Use PNG, JPEG ou WEBP." };
  const url = await fileToDataUrl(f);
  if (url.length > ASSET_MAX_CHARS) return { error: "Imagem maior que o limite (≈1,1 MB)." };
  return { ok: url };
}

const field = "w-full rounded border border-input bg-background px-2 py-1 text-xs";

export function ExternalEditor({ template, profile, onChange, types, presentation }: {
  template: ExternalTemplateCode; profile: ExternalProfile; onChange: (p: ExternalProfile) => void; types: { code: string; label: string }[];
  presentation?: Record<string, unknown> | null;
}) {
  const inherited = institutionalIdentity(presentation).logos;
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ExternalProfile>(k: K, v: ExternalProfile[K]) => onChange({ ...profile, [k]: v });
  const img = async (f: File | undefined, apply: (u: string) => void) => { const r = await pickImage(f); if ("error" in r) setErr(r.error); else { setErr(null); apply(r.ok); } };
  const color = (k: "primary" | "secondary" | "headerColor" | "borderColor" | "cardColor" | "pageColor", label: string) => (
    <label className="flex items-center gap-1 text-xs">{label}<input type="color" value={profile[k]} onChange={(e) => set(k, e.target.value)} aria-label={label} /></label>);
  const range = (k: "coverFocusY" | "coverOverlay" | "cardRadius" | "cardShadow" | "borderWidth" | "density", label: string, min: number, max: number, step: number) => (
    <label className="block text-xs">{label}: {profile[k]}<input className="w-full" type="range" min={min} max={max} step={step} value={profile[k]} onChange={(e) => set(k, Number(e.target.value))} /></label>);
  const text = (k: "visualTitle" | "subtitle" | "slogan" | "footerText", label: string) => (
    <label className="block text-xs">{label}<input className={field} value={profile[k] ?? ""} maxLength={200} onChange={(e) => set(k, e.target.value || null)} /></label>);
  return (
    <fieldset className="space-y-2 rounded border border-border p-2" aria-label="Personalizar modelo externo">
      <legend className="px-1 text-sm font-medium">Personalizar modelo externo</legend>
      <p className="text-xs text-muted-foreground">Só aparência. Datas, tipos, efeitos e totais continuam os do calendário institucional.</p>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs">Imagem panorâmica do topo<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void img(e.target.files?.[0], (u) => set("coverImage", u))} /></label>
          {profile.coverImage && <Button type="button" size="sm" variant="outline" onClick={() => set("coverImage", null)}>Remover imagem do topo</Button>}
          {range("coverFocusY", "Foco vertical da imagem (%)", 0, 100, 1)}
          {range("coverOverlay", "Véu sobre a imagem (%)", 0, 90, 1)}
          <label className="block text-xs">Imagem decorativa do rodapé<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void img(e.target.files?.[0], (u) => set("footerImage", u))} /></label>
          {profile.footerImage && <Button type="button" size="sm" variant="outline" onClick={() => set("footerImage", null)}>Remover imagem do rodapé</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {color("primary", "Principal")}{color("secondary", "Secundária")}{color("headerColor", "Cabeçalhos")}
          {color("borderColor", "Bordas")}{color("cardColor", "Cartões")}{color("pageColor", "Fundo")}
        </div>
        <div className="space-y-1">
          {(["titleFont", "bodyFont"] as const).map((k) => (
            <label key={k} className="block text-xs">{k === "titleFont" ? "Fonte do título" : "Fonte do corpo"}
              <select className={field} value={profile[k]} onChange={(e) => set(k, e.target.value)}>{FONT_OPTIONS.map((f) => <option key={f} value={f}>{f.split(",")[0]!.replace(/'/g, "")}</option>)}</select></label>))}
          {text("visualTitle", "Título visual (vazio = CALENDÁRIO ESCOLAR + ano)")}{text("subtitle", "Subtítulo (vazio = título do calendário)")}
          {text("slogan", "Slogan")}{text("footerText", "Texto do rodapé")}
          <label className="block text-xs">Endereço do QR/link (https)<input className={field} value={profile.qrUrl ?? ""} onChange={(e) => set("qrUrl", safeQrUrl(e.target.value) ?? (e.target.value ? profile.qrUrl : null))} placeholder="https://..." /></label>
        </div>
        <div className="space-y-1">
          {range("cardRadius", "Raio dos cartões (mm)", 0, 8, 0.5)}{range("cardShadow", "Sombra", 0, 3, 1)}
          {range("borderWidth", "Espessura da borda (mm)", 0, 1, 0.1)}{range("density", "Densidade", 0.85, 1.1, 0.05)}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(profile.show) as (keyof ExternalProfile["show"])[]).map((k) => (
              <label key={k} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={profile.show[k]} onChange={(e) => set("show", { ...profile.show, [k]: e.target.checked })} />{k}</label>))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">Logos e imagens institucionais</p>
        {profile.logos.map((l, i) => (
          <div key={l.id} className="flex flex-wrap items-center gap-1 text-xs">
            {l.src ? <img src={l.src} alt={l.alt} className="h-6" /> : (() => {
              const b = inherited.find((x) => x.id === l.ref);
              if (!b) return <span role="note" className="text-destructive">Logo herdada não encontrada no documento institucional ({l.alt}).</span>;
              if (b.source.kind === "none") return <span role="note" className="text-destructive">Logo herdada sem imagem resolvível ({b.label}).</span>;
              return <span>Herdada do documento institucional: {b.label}</span>;
            })()}
            <select className={field + " w-auto"} value={l.position} aria-label="Posição" onChange={(e) => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, position: e.target.value as "esquerda" | "direita" } : x))}><option value="esquerda">esquerda</option><option value="direita">direita</option></select>
            <input type="number" className={field + " w-16"} aria-label="Altura (mm)" min={6} max={30} value={l.heightMm} onChange={(e) => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, heightMm: Number(e.target.value) } : x))} />
            <Button type="button" size="sm" variant="outline" onClick={() => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, hidden: !x.hidden } : x))}>{l.hidden ? "Mostrar" : "Ocultar"}</Button>
            <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => { const a = [...profile.logos]; [a[i - 1], a[i]] = [a[i]!, a[i - 1]!]; set("logos", a); }}>Subir</Button>
            <label className="text-xs">Substituir<input type="file" className="w-28" accept="image/png,image/jpeg,image/webp" onChange={(e) => void img(e.target.files?.[0], (u) => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, src: u } : x)))} /></label>
            {l.src && l.ref && <Button type="button" size="sm" variant="outline" onClick={() => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, src: null } : x))}>Voltar à herdada</Button>}
            <Button type="button" size="sm" variant="outline" onClick={() => set("logos", profile.logos.filter((x) => x.id !== l.id))}>Remover</Button>
          </div>))}
        <label className="block text-xs">Adicionar logo<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void img(e.target.files?.[0], (u) => set("logos", [...profile.logos, { id: `logo-${Date.now()}`, ref: null, src: u, alt: "Logo institucional", hidden: false, heightMm: 16, position: "esquerda" }]))} /></label>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">Cores dos símbolos (só visual; código e efeito não mudam)</p>
        <div className="flex flex-wrap gap-2">{types.map((t) => (
          <label key={t.code} className="flex items-center gap-1 text-xs">{t.label}
            <input type="color" aria-label={`Fundo de ${t.label}`} value={profile.symbolOverrides[t.code]?.background ?? "#ffffff"} onChange={(e) => set("symbolOverrides", { ...profile.symbolOverrides, [t.code]: { ...profile.symbolOverrides[t.code], background: e.target.value } })} />
          </label>))}</div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange(defaultProfile(template, presentation))}>Restaurar padrão deste modelo</Button>
    </fieldset>
  );
}

/** Painel do externo: lê o perfil institucional, prévia, impressão e gravação governada. */
export function ExternalPresentationPanel({ template, model: rawModel, presentation: rawPresentation, calendarId, versionId, days, on, knownAt, canEdit = true }: {
  template: ExternalTemplateCode; model: PrintModel; presentation: Record<string, unknown>; calendarId: string;
  versionId: string; days: readonly CalendarDayRead[]; on: string; knownAt: string; canEdit?: boolean;
}) {
  // Mesma fonte (dias/períodos); só o vínculo visual é normalizado (calendar-visual-resolver).
  const presentation = useMemo(() => externalPresentation(rawPresentation), [rawPresentation]);
  const model = useMemo(() => buildPrintModel(presentation, days, rawModel.periods.map((x) => ({ name: x.name, startsOn: x.startsOn, endsOn: x.endsOn }))), [presentation, days, rawModel]);
  const [council, setCouncil] = useState<CouncilConfiguration | null>(null);
  useEffect(() => { let alive = true; void readCouncilConfiguration({ versionId, on, knownAt }).then((c) => { if (alive) setCouncil(c); }); return () => { alive = false; }; }, [versionId, on, knownAt]);
  const vm = useMemo(() => buildExternalViewModel(model, presentation, { versionId, config: council, days }), [model, presentation, versionId, council, days]);
  const [read, setRead] = useState<ExternalProfileRead | null>(null);
  const [draft, setDraft] = useState<ExternalProfile>(defaultProfile(template, presentation));
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const [overflowMm, setOverflowMm] = useState<number | null>(null);
  useEffect(() => {
    // Fit medido (nunca compacta): 1 mm em px pela largura declarada da folha (285 mm); área útil A4 = 198 mm.
    const f = screenRef.current?.querySelector<HTMLElement>(".cx-folha"); if (!f) return;
    const mm = f.offsetWidth / 285; if (!mm) return;
    const over = Math.max(f.scrollHeight - f.clientHeight, f.scrollWidth - f.clientWidth) / mm;
    setOverflowMm(over > 0.5 ? Math.ceil(over) : null);
  }, [draft, vm, template]);
  const load = async () => {
    const r = await readExternalProfile({ calendarId, template, on, knownAt: new Date().toISOString() > knownAt ? new Date().toISOString() : knownAt, presentation });
    setRead(r); setDraft(r.kind === "lido" || r.kind === "padrao" ? r.profile : defaultProfile(template, presentation));
  };
  useEffect(() => { void load(); }, [calendarId, template]); // eslint-disable-line react-hooks/exhaustive-deps
  const types = vm.legendCodes.map((c) => ({ code: c, label: String((presentation["dayTypeCatalog"] as Record<string, { label?: string }> | undefined)?.[c]?.label ?? c) }));
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const head = read && read.kind === "lido" ? read.headId : null;
      const r = await saveExternalProfile({ calendarId, template, expectedHead: head, profile: sanitizeProfile(template, draft, presentation), reason: null });
      setMsg(`Personalização salva (revisão ${r.revision}).`); await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Falha ao salvar."); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      {read?.kind === "negado" && <p className="text-xs text-muted-foreground">Perfil visual institucional indisponível para sua atuação; exibindo o padrão do modelo.</p>}
      {read?.kind === "erro" && <p role="alert" className="text-xs text-destructive">{read.message} Exibindo o padrão do modelo.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>Imprimir / PDF</Button>
        {canEdit && <Button type="button" size="sm" variant="outline" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>Personalizar modelo externo</Button>}
        {editing && <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>Salvar personalização</Button>}
        {editing && <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Descartar alterações</Button>}
      </div>
      {vm.unmappedTypes.length > 0 && <p role="alert" className="text-xs text-destructive">Tipos sem vínculo visual nesta versão: {vm.unmappedTypes.join(", ")}. Revise o vínculo de tipos antes de imprimir.</p>}
      {msg && <p role="status" className="text-xs">{msg}</p>}
      {canEdit && editing && <ExternalEditor template={template} profile={draft} onChange={setDraft} types={types} presentation={presentation} />}
      {overflowMm !== null && <p role="alert" className="text-xs text-destructive">A folha excede a área A4 em ≈{overflowMm} mm; nada é cortado nem reduzido automaticamente. Reduza a densidade ou oculte blocos opcionais.</p>}
      <div ref={screenRef} className="cx-tela overflow-auto"><ExternalSheet template={template} vm={vm} p={draft} presentation={presentation} /></div>
      <ExternalCalendarPrint><ExternalSheet template={template} vm={vm} p={draft} presentation={presentation} /></ExternalCalendarPrint>
    </div>
  );
}
