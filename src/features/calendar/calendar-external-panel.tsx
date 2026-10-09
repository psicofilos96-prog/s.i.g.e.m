import { isTypingTarget } from "@/lib/keyboard";
import { prepareImageFile } from "./calendar-image-asset";
import { userErrorText } from "@/lib/observability/governed-errors";
/**
 * CAL.EXT.1 — Seletor "Modelo de apresentação" + prévia/impressão dos externos + editor visual.
 * O modelo interno é renderizado pelo chamador exatamente como antes; este painel só entra quando
 * um externo é escolhido. O conteúdo é sempre o mesmo `PrintModel` recebido.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  ANCHORS, ASSET_MAX_CHARS, moveBlock, nextFitStep, TYPE_KEYS, TYPE_MIN, TYPE_MAX, PAD_MIN, PAD_MAX, LINE_MIN, LINE_MAX, INFO_BLOCKS, type InfoBlock, type TypeKey, buildExternalViewModel, defaultProfile, FONT_OPTIONS, PRESENTATION_TEMPLATES, safeQrUrl, sanitizeBands, sanitizeProfile, SCRIPT_FONT_OPTIONS,
  type ExternalProfile, type ExternalTemplateCode, type PresentationTemplateCode,
} from "./calendar-external-model";
import { ExternalCalendarPrint, ExternalSheet, sheetIssues } from "./calendar-external-sheets";
import { readExternalProfile, saveExternalProfile, type ExternalProfileRead } from "./calendar-external-profile";
import { buildPrintModel, type PrintModel } from "./institutional-calendar-presentation";
import { externalPresentation } from "./calendar-visual-resolver";
import type { CalendarDayRead } from "./institutional-calendar-readers";
import { readCouncilConfiguration, type CouncilConfiguration } from "./institutional-calendar-councils";
import { institutionalIdentity, isFreeTemplate } from "./calendar-external-model";
import { FreeLayoutEditor } from "./calendar-external-free-editor";
import { moveLayer } from "./calendar-external-layers";
import { ExternalPresetsBar } from "./calendar-external-presets-bar";
import { resetSection, validateImage } from "./calendar-external-sections";
import { shrinkImage } from "./calendar-image-shrink";
import { readCalendarList } from "./institutional-calendar-readers";
import { historyPush, historyRedo, historyUndo, layoutIssues, moveFreeBlock, moveSticker, type FreeBlockId, type History } from "./calendar-external-free";

/** Resumo, em palavras, do que "Ajustar para caber" mudou. */
function fitSummary(a: ExternalProfile, b: ExternalProfile): string {
  const parts: string[] = [];
  if (b.bands.info !== a.bands.info) parts.push(`altura da faixa de informações ${a.bands.info}% → ${b.bands.info}%`);
  if (b.bands.banner !== a.bands.banner) parts.push(`altura do título ${a.bands.banner}% → ${b.bands.banner}%`);
  if (b.bands.footer !== a.bands.footer) parts.push(`altura do rodapé ${a.bands.footer}% → ${b.bands.footer}%`);
  if (b.minFitPt !== a.minFitPt) parts.push(`menor fonte permitida ${a.minFitPt} pt → ${b.minFitPt} pt`);
  return parts.length ? `Ajustado para caber: ${parts.join("; ")}. Confira a prévia e salve.` : "Tudo cabe.";
}

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

const pickImage = prepareImageFile;

const SHOW_LABEL: Record<keyof ExternalProfile["show"], string> = {
  cabecalho: "Nome da Prefeitura", legenda: "Legenda", feriados: "Feriados", periodos: "Períodos", conselhos: "Conselhos", assinaturas: "Assinaturas",
  branding: "Rodapé", totaisMensais: "Total de cada mês", imagemTopo: "Foto da cidade no topo", slogan: "Slogan", numeroMes: "Número do mês",
  pilares: "Pilares do rodapé", qr: "QR Code", ilustracao: "Desenho da cidade", totaisColuna: "Linha de totais",
};
const BLOCK_LABEL: Record<InfoBlock, string> = { legenda: "Legenda", periodos: "Períodos letivos", feriados: "Feriados", conselhos: "Conselhos de Classe", assinaturas: "Assinaturas" };
const TYPE_LABEL: Record<TypeKey, string> = { blockTitle: "Títulos das caixas", periodName: "Nomes dos períodos", periodText: "Datas dos períodos",
  months: "Nomes dos meses", days: "Dias do calendário (números e siglas)", periodNumber: "Números de dias letivos", legend: "Legenda", holidays: "Feriados",
  councils: "Conselhos de Classe", signatures: "Assinaturas", footer: "Rodapé e slogan" };
const PAD_LABEL: Record<InfoBlock, string> = { legenda: "Legenda", periodos: "Períodos letivos", feriados: "Feriados", conselhos: "Conselhos de Classe", assinaturas: "Assinaturas" };
const field = "w-full rounded-md border border-input bg-background px-2 py-1 text-xs";
const chip = (on: boolean) => `rounded-md border px-2 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`;

/** CAL.EXT.2 — grupo recolhível do configurador; nomes simples, uma intenção por grupo. */
/**
 * Prévia inteira à vista: reduz a folha (só visualmente, por `transform`) para caber na largura disponível.
 * Medidas de encaixe usam tamanhos sem transformação, então avisos e PDF não mudam.
 */
function FitPreview({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ k: number; h: number }>({ k: 1, h: 0 });
  useEffect(() => {
    const o = outer.current, i = inner.current; if (!o || !i || typeof ResizeObserver === "undefined") return;
    const run = () => { const w = i.scrollWidth, avail = o.clientWidth; if (!w || !avail) return; const k = Math.min(1, avail / w); setBox((b) => (Math.abs(b.k - k) < 0.001 && Math.abs(b.h - i.scrollHeight * k) < 1 ? b : { k, h: i.scrollHeight * k })); };
    const ro = new ResizeObserver(run); ro.observe(o); ro.observe(i); run();
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} style={{ height: box.h || undefined }}>
      <div ref={inner} style={{ width: "max-content", transform: box.k < 1 ? `scale(${box.k})` : undefined, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

function Group({ title, hint, open, children, onReset }: { title: string; hint: string; open?: boolean; children: ReactNode; onReset?: () => void }) {
  return (
    <details open={open} className="group rounded-md border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
        <span aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-3 border-t border-border px-3 py-3">{children}
        {onReset && <Button type="button" size="sm" variant="ghost" onClick={onReset}>Restaurar esta seção</Button>}</div>
    </details>
  );
}
function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1"><p className="text-xs font-medium">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((o) => <button key={String(o.v)} type="button" role="radio" aria-checked={value === o.v} className={chip(value === o.v)} onClick={() => onChange(o.v)}>{o.l}</button>)}
      </div></div>);
}

export function ExternalEditor({ template, profile, onChange, types, presentation }: {
  template: ExternalTemplateCode; profile: ExternalProfile; onChange: (p: ExternalProfile) => void; types: { code: string; label: string }[];
  presentation?: Record<string, unknown> | null;
}) {
  const inherited = institutionalIdentity(presentation).logos;
  const def = defaultProfile(template, presentation);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ExternalProfile>(k: K, v: ExternalProfile[K]) => onChange({ ...profile, [k]: v });
  const img = async (f: File | undefined, apply: (u: string) => void) => { const r = await pickImage(f); if ("error" in r) setErr(r.error); else { setErr(null); apply(r.ok); } };
  const color = (k: "primary" | "secondary" | "headerColor" | "borderColor" | "gridColor" | "cardColor" | "pageColor" | "accent" | "lightColor" | "holidayColor" | "textColor", label: string) => (
    <label className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs">{label}<input type="color" value={profile[k]} onChange={(e) => set(k, e.target.value)} aria-label={label} /></label>);
  const range = (k: "pageFocusX" | "pageFocusY" | "pageZoom" | "pageOpacity" | "coverFocusY" | "coverFocusX" | "coverZoom" | "coverOpacity" | "coverOverlay" | "cardRadius" | "cardShadow" | "borderWidth" | "density" | "titlePt" | "subtitlePt" | "textScale" | "minFitPt" | "gapMm" | "gridWidth", label: string, min: number, max: number, step: number, unit = "") => (
    <label className="block text-xs"><span className="flex justify-between"><span>{label}</span><span className="text-muted-foreground">{profile[k]}{unit}</span></span>
      <input className="w-full" type="range" min={min} max={max} step={step} value={profile[k]} onChange={(e) => set(k, Number(e.target.value))} /></label>);
  const text = (k: "visualTitle" | "subtitle" | "slogan" | "footerText", label: string, ph?: string) => (
    <label className="block text-xs">{label}<input className={field} value={profile[k] ?? ""} placeholder={ph} maxLength={200} onChange={(e) => set(k, e.target.value || null)} /></label>);
  const fixed = (k: "footerPhrase" | "qrText" | "feriasText", label: string) => (
    <label className="block text-xs">{label}<input className={field} value={profile[k]} maxLength={200} onChange={(e) => set(k, e.target.value)} /></label>);
  const band = (k: "banner" | "info" | "footer", label: string, min: number, max: number) => (
    <label className="block text-xs"><span className="flex justify-between"><span>{label}</span><span className="text-muted-foreground">{profile.bands[k]}%</span></span><input className="w-full" type="range" min={min} max={max} step={0.5} value={profile.bands[k]}
      onChange={(e) => set("bands", sanitizeBands({ ...profile.bands, [k]: Number(e.target.value) }, profile.bands))} /></label>);
  const width = (k: keyof ExternalProfile["infoWidths"], label: string) => (
    <label className="block text-xs"><span className="flex justify-between"><span>{label}</span><span className="text-muted-foreground">{profile.infoWidths[k]}</span></span>
      <input className="w-full" type="range" min={10} max={60} step={1} value={profile.infoWidths[k]} onChange={(e) => set("infoWidths", { ...profile.infoWidths, [k]: Number(e.target.value) })} /></label>);
  const toggle = (k: keyof ExternalProfile["show"]) => (
    <label key={k} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={profile.show[k]} onChange={(e) => set("show", { ...profile.show, [k]: e.target.checked })} />{SHOW_LABEL[k]}</label>);
  const nudge = (k: "coverFocusX" | "coverFocusY", d: number) => set(k, Math.min(100, Math.max(0, profile[k] + d)));
  const per = profile.periods; const setPer = (v: Partial<typeof per>) => set("periods", { ...per, ...v });
  const imageInput = (label: string, apply: (u: string) => void) => (
    <label className="block text-xs">{label}<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void img(e.target.files?.[0], apply)} /></label>);
  return (
    <section className="space-y-2" aria-label="Personalizar modelo externo">
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <h3 className="text-sm font-semibold">Personalizar modelo externo</h3>
        <p className="text-xs text-muted-foreground">Só aparência: datas, tipos de dia, efeitos e totais continuam os do calendário institucional. A prévia ao lado muda na hora.</p>
      </div>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}

      <Group onReset={() => onChange(resetSection(profile, def, "identidade"))} title="1. Modelo e identidade" hint="Título, subtítulo, frase e logos" open>
        {text("visualTitle", "Título principal", "CALENDÁRIO ESCOLAR + ano")}{text("subtitle", "Subtítulo", "título do calendário")}
        {text("slogan", "Frase institucional")}{text("footerText", "Texto ao lado do logo SIGEM")}
        {fixed("footerPhrase", "Frase do rodapé")}{false && fixed("feriasText", "Texto da faixa de férias")}
        <div className="space-y-1"><p className="text-xs font-medium">Logos</p>
          {profile.logos.map((l, i) => (
            <div key={l.id} className="flex flex-wrap items-center gap-1 rounded-md border border-border p-1 text-xs">
              {l.src ? <img src={l.src} alt={l.alt} className="h-6" /> : (() => {
                const b = inherited.find((x) => x.id === l.ref);
                if (!b) return <span role="note" className="text-destructive">Logo herdada não encontrada no documento institucional ({l.alt}).</span>;
                if (b.source.kind === "none") return <span role="note" className="text-destructive">Logo herdada sem imagem resolvível ({b.label}).</span>;
                return <span>Herdada: {b.label}</span>;
              })()}
              <select className={field + " w-auto"} value={l.position} aria-label="Posição" onChange={(e) => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, position: e.target.value as "esquerda" | "direita" } : x))}><option value="esquerda">esquerda</option><option value="direita">direita</option></select>
              <input type="number" className={field + " w-16"} aria-label="Altura (mm)" min={6} max={30} value={l.heightMm} onChange={(e) => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, heightMm: Number(e.target.value) } : x))} />
              <Button type="button" size="sm" variant="outline" onClick={() => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, hidden: !x.hidden } : x))}>{l.hidden ? "Mostrar" : "Ocultar"}</Button>
              <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => { const a = [...profile.logos]; [a[i - 1], a[i]] = [a[i]!, a[i - 1]!]; set("logos", a); }}>Subir</Button>
              <label className="text-xs">Substituir<input type="file" className="w-28" accept="image/png,image/jpeg,image/webp" onChange={(e) => void img(e.target.files?.[0], (u) => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, src: u } : x)))} /></label>
              {l.src && l.ref && <Button type="button" size="sm" variant="outline" onClick={() => set("logos", profile.logos.map((x) => x.id === l.id ? { ...x, src: null } : x))}>Voltar à herdada</Button>}
              <Button type="button" size="sm" variant="outline" onClick={() => set("logos", profile.logos.filter((x) => x.id !== l.id))}>Remover</Button>
            </div>))}
          {imageInput("Adicionar logo", (u) => set("logos", [...profile.logos, { id: `logo-${Date.now()}`, ref: null, src: u, alt: "Logo institucional", hidden: false, heightMm: 16, position: "esquerda" }]))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...profile, logos: def.logos, visualTitle: null, subtitle: null, slogan: def.slogan, footerText: null, footerPhrase: def.footerPhrase })}>Voltar à identidade herdada</Button>
      </Group>

      <Group onReset={() => onChange(resetSection(profile, def, "fundo"))} title="2. Plano de fundo" hint="Imagem do topo e imagens decorativas">
        {toggle("imagemTopo")}
        {imageInput(profile.coverImage ? "Trocar imagem do topo" : "Escolher imagem do topo", (u) => set("coverImage", u))}
        <div className="flex flex-wrap gap-1">
          {profile.coverImage && <Button type="button" size="sm" variant="outline" onClick={() => set("coverImage", null)}>Remover imagem (volta à padrão)</Button>}
        </div>
        {false && imageInput("Imagem de fundo da folha", (u) => set("pageImage", u))}
        {profile.pageImage && <Button type="button" size="sm" variant="outline" onClick={() => set("pageImage", null)}>Remover fundo da folha</Button>}
        {false && profile.pageImage && <>{range("pageFocusX", "Fundo: posição horizontal", 0, 100, 1, "%")}{range("pageFocusY", "Fundo: posição vertical", 0, 100, 1, "%")}{range("pageZoom", "Fundo: zoom", 100, 250, 5, "%")}{range("pageOpacity", "Fundo: opacidade", 0, 100, 5, "%")}
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...profile, pageFocusX: def.pageFocusX, pageFocusY: def.pageFocusY, pageZoom: def.pageZoom, pageOpacity: def.pageOpacity })}>Resetar posição do fundo</Button></>}
        {imageInput("Imagem decorativa do rodapé", (u) => set("footerImage", u))}
        {profile.footerImage && <Button type="button" size="sm" variant="outline" onClick={() => set("footerImage", null)}>Remover imagem do rodapé</Button>}
      </Group>

      <Group onReset={() => onChange(resetSection(profile, def, "posicaoFundo"))} title="3. Posição da imagem de fundo" hint="Mover, aproximar e centralizar sem trocar a arte">
        <Choice label="Ajuste" value={profile.coverFit} onChange={(v) => set("coverFit", v)}
          options={[{ v: "cobrir", l: "Cobrir área" }, { v: "conter", l: "Imagem inteira" }, { v: "manual", l: "Ajuste manual" }] as const} />
        {profile.coverFit !== "cobrir" && range("coverZoom", "Zoom", 100, 250, 5, "%")}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="space-y-2">
            {range("coverFocusX", "Horizontal (esquerda → direita)", 0, 100, 1, "%")}
            {range("coverFocusY", "Vertical (topo → base)", 0, 100, 1, "%")}
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => nudge("coverFocusX", -5)}>← Esquerda</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge("coverFocusX", 5)}>Direita →</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge("coverFocusY", -5)}>↑ Subir</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => nudge("coverFocusY", 5)}>↓ Descer</Button>
            </div>
          </div>
          <div role="radiogroup" aria-label="Ponto de ancoragem" className="grid shrink-0 grid-cols-3 gap-1 self-start">
            {ANCHORS.map((a) => { const on = profile.coverFocusX === a.x && profile.coverFocusY === a.y;
              return <button key={a.label} type="button" role="radio" aria-checked={on} aria-label={a.label} title={a.label}
                className={`h-6 w-6 rounded-sm border ${on ? "border-primary bg-primary" : "border-input bg-background"}`} onClick={() => onChange({ ...profile, coverFocusX: a.x, coverFocusY: a.y })} />; })}
          </div>
        </div>
        {range("coverOpacity", "Opacidade da imagem", 0, 100, 5, "%")}{range("coverOverlay", "Intensidade do véu", 0, 90, 1, "%")}
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...profile, coverFit: def.coverFit, coverFocusX: def.coverFocusX, coverFocusY: def.coverFocusY, coverZoom: def.coverZoom, coverOpacity: def.coverOpacity, coverOverlay: def.coverOverlay })}>Resetar posição da imagem</Button>
      </Group>

      <Group onReset={() => onChange(resetSection(profile, def, "cores"))} title="4. Cores e aparência" hint="Cores, cartões e bordas">
        <div className="grid gap-1 sm:grid-cols-2">
          {color("primary", "Principal")}{color("secondary", "Secundária")}{color("accent", "Destaque")}{color("headerColor", "Títulos")}
          {color("textColor", "Textos")}{color("cardColor", "Blocos e caixas")}{color("borderColor", "Bordas")}{color("gridColor", "Linhas da grade do calendário")}{color("lightColor", "Legenda e fundos claros")}
          {color("pageColor", "Fundo da folha")}{color("holidayColor", "Datas de feriado")}
        </div>
        {range("cardRadius", "Arredondamento", 0, 8, 0.5, " mm")}{range("cardShadow", "Sombra", 0, 3, 1)}{range("borderWidth", "Espessura da borda", 0, 1, 0.1, " mm")}
        {types.length > 0 && <div className="space-y-1"><p className="text-xs font-medium">Cores dos tipos de dia (só aparência)</p>
          <div className="grid gap-1 sm:grid-cols-2">{types.map((t) => (
            <label key={t.code} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs"><span className="min-w-0 truncate">{t.label}</span>
              <input type="color" aria-label={`Fundo de ${t.label}`} value={profile.symbolOverrides[t.code]?.background ?? "#ffffff"} onChange={(e) => set("symbolOverrides", { ...profile.symbolOverrides, [t.code]: { ...profile.symbolOverrides[t.code], background: e.target.value } })} />
            </label>))}</div></div>}
      </Group>

      <Group onReset={() => onChange(resetSection(profile, def, "tipografia"))} title="5. Tipografia" hint="Fontes e tamanhos">
        {(["titleFont", "bodyFont"] as const).map((k) => (
          <label key={k} className="block text-xs">{k === "titleFont" ? "Fonte dos títulos" : "Fonte dos textos"}
            <select className={field} value={profile[k]} onChange={(e) => set(k, e.target.value)}>{FONT_OPTIONS.map((f) => <option key={f} value={f}>{f.split(",")[0]!.replace(/'/g, "")}</option>)}</select></label>))}
        <label className="block text-xs">Fonte da frase manuscrita<select className={field} value={profile.scriptFont} onChange={(e) => set("scriptFont", e.target.value)}>{SCRIPT_FONT_OPTIONS.map((f) => <option key={f} value={f}>{f.split(",")[0]!.replace(/'/g, "")}</option>)}</select></label>
        {range("titlePt", "Tamanho do título", 16, 40, 1, " pt")}{range("subtitlePt", "Tamanho do subtítulo", 6, 14, 0.5, " pt")}
        <div className="flex gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...profile, titlePt: def.titlePt, subtitlePt: def.subtitlePt })}>Repor título e subtítulo</Button></div>
        <div className="space-y-2 rounded-md border border-border p-2"><p className="flex items-center justify-between text-xs font-medium"><span>Tamanho da fonte por bloco (50% a 200%; 100% = padrão do modelo)</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => set("typeScale", { ...def.typeScale })}>Repor todos</Button></p>
          {TYPE_KEYS.map((k) => (
            <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <label className="block text-xs"><span className="flex justify-between"><span>{TYPE_LABEL[k]}</span><span className="text-muted-foreground">{Math.round(profile.typeScale[k] * 100)}%</span></span>
                <input className="w-full" type="range" min={TYPE_MIN} max={TYPE_MAX} step={0.05} value={profile.typeScale[k]} onChange={(e) => set("typeScale", { ...profile.typeScale, [k]: Number(e.target.value) })} /></label>
              <Button type="button" size="sm" variant="ghost" aria-label={`Repor ${TYPE_LABEL[k]}`} title="Repor" disabled={profile.typeScale[k] === def.typeScale[k]} onClick={() => set("typeScale", { ...profile.typeScale, [k]: def.typeScale[k] })}>↺</Button>
            </div>))}
        </div>
        <div className="space-y-2 rounded-md border border-border p-2"><p className="flex items-center justify-between text-xs font-medium"><span>Espaço interno das caixas (margem do texto)</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => set("boxPad", { ...def.boxPad })}>Repor todos</Button></p>
          {INFO_BLOCKS.map((k) => (
            <label key={k} className="block text-xs"><span className="flex justify-between"><span>{PAD_LABEL[k]}</span><span className="text-muted-foreground">{profile.boxPad[k].toFixed(1)} mm</span></span>
              <input className="w-full" type="range" min={PAD_MIN} max={PAD_MAX} step={0.1} value={profile.boxPad[k]} onChange={(e) => set("boxPad", { ...profile.boxPad, [k]: Number(e.target.value) })} /></label>))}
        </div>
        <div className="space-y-2 rounded-md border border-border p-2"><p className="flex items-center justify-between text-xs font-medium"><span>Espaçamento entre linhas</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => set("lineGap", { ...def.lineGap })}>Repor todos</Button></p>
          {INFO_BLOCKS.map((k) => (
            <label key={k} className="block text-xs"><span className="flex justify-between"><span>{PAD_LABEL[k]}</span><span className="text-muted-foreground">{profile.lineGap[k].toFixed(2)}×</span></span>
              <input className="w-full" type="range" min={LINE_MIN} max={LINE_MAX} step={0.05} value={profile.lineGap[k]} onChange={(e) => set("lineGap", { ...profile.lineGap, [k]: Number(e.target.value) })} /></label>))}
        </div>
        {range("textScale", "Tamanho dos blocos (legenda, períodos, feriados)", 0.8, 1.25, 0.05, "×")}
        {range("minFitPt", "Menor fonte permitida no ajuste automático", 4, 7, 0.5, " pt")}
      </Group>

      <Group onReset={() => onChange(resetSection(profile, def, "estrutura"))} title="6. Estrutura e blocos" hint="O que aparece, larguras e Períodos letivos">
        <div className="space-y-1"><p className="text-xs font-medium">Ordem dos blocos de informação</p>
          <ol aria-label="Ordem dos blocos" className="space-y-1">{profile.blockOrder.map((b, i) => (
            <li key={b} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs">
              <span className={`min-w-0 truncate ${profile.show[b] ? "" : "text-muted-foreground line-through"}`}>{i + 1}. {BLOCK_LABEL[b]}{profile.show[b] ? "" : " (oculto)"}</span>
              <span className="flex shrink-0 gap-1">
                <Button type="button" size="sm" variant="outline" aria-label={`Subir ${BLOCK_LABEL[b]}`} disabled={i === 0} onClick={() => set("blockOrder", moveBlock(profile.blockOrder, b, -1))}>↑</Button>
                <Button type="button" size="sm" variant="outline" aria-label={`Descer ${BLOCK_LABEL[b]}`} disabled={i === profile.blockOrder.length - 1} onClick={() => set("blockOrder", moveBlock(profile.blockOrder, b, 1))}>↓</Button>
              </span></li>))}</ol>
          {false && <p className="text-xs text-muted-foreground">No Mosaico, Legenda e Feriados ficam na lateral; os demais, na faixa inferior — sempre nesta ordem.</p>}
        </div>
        <div className="grid gap-1 sm:grid-cols-2">{(Object.keys(profile.show) as (keyof ExternalProfile["show"])[]).filter((k) => k !== "imagemTopo").map(toggle)}</div>
        {false && <div className="space-y-2"><p className="text-xs font-medium">Largura dos blocos da faixa de informações</p>
          {width("legenda", "Legenda")}{width("periodos", "Períodos letivos")}{width("feriados", "Feriados")}{width("extra", "Conselhos / Assinaturas")}</div>}
        <div className="space-y-2 rounded-md border border-border p-2">
          <p className="text-xs font-medium">Períodos letivos</p>
          <Choice label="Disposição" value={per.layout} onChange={(v) => setPer({ layout: v })} options={[{ v: "horizontal", l: "Em linha" }, { v: "grade", l: "Grade" }, { v: "empilhado", l: "Empilhado" }] as const} />
          {per.layout !== "empilhado" && <Choice label="Colunas" value={per.cols} onChange={(v) => setPer({ cols: v })} options={[{ v: "auto", l: "Automático" }, { v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 4, l: "4" }] as const} />}
          <Choice label="Alinhamento" value={per.align} onChange={(v) => setPer({ align: v })} options={[{ v: "centro", l: "Centralizado" }, { v: "esquerda", l: "À esquerda" }] as const} />
          <Choice label="Espaçamento" value={per.density} onChange={(v) => setPer({ density: v })} options={[{ v: "confortavel", l: "Confortável" }, { v: "media", l: "Médio" }, { v: "compacta", l: "Compacto" }] as const} />
          <label className="block text-xs"><span className="flex justify-between"><span>Altura mínima de cada período</span><span className="text-muted-foreground">{per.minHmm ? `${per.minHmm} mm` : "automática"}</span></span>
            <input className="w-full" type="range" min={0} max={30} step={1} value={per.minHmm} onChange={(e) => setPer({ minHmm: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={per.wrap} onChange={(e) => setPer({ wrap: e.target.checked })} />Quebrar nomes longos em linhas</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={per.autoScale} onChange={(e) => setPer({ autoScale: e.target.checked })} />Reduzir a letra só se necessário para não sobrepor</label>
        </div>
        {range("gridWidth", "Espessura das linhas da grade", 0.1, 0.6, 0.05, " mm")}{range("density", "Compactação geral", 0.85, 1.1, 0.05, "×")}{range("gapMm", "Respiro entre blocos", 0.5, 5, 0.5, " mm")}
        {band("banner", "Altura do topo", 10, 25)}{band("info", false ? "Altura da faixa inferior" : "Altura da faixa de informações", 8, 28)}{band("footer", "Altura do rodapé", 0, 14)}
        <p className="text-xs text-muted-foreground">{false ? "Matriz" : "Grade de meses"}: {profile.bands.body}% (ajusta sozinha; soma sempre 100%).</p>
        {profile.pillars.map((pl, i) => (
          <div key={i} className="flex gap-1">
            <input className={field} aria-label={`Pilar ${i + 1}: título`} value={pl.title} maxLength={40} onChange={(e) => set("pillars", profile.pillars.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
            <input className={field} aria-label={`Pilar ${i + 1}: subtítulo`} value={pl.subtitle} maxLength={40} onChange={(e) => set("pillars", profile.pillars.map((x, j) => j === i ? { ...x, subtitle: e.target.value } : x))} />
            <Button type="button" size="sm" variant="outline" onClick={() => set("pillars", profile.pillars.map((x, j) => j === i ? { ...x, hidden: !x.hidden } : x))}>{pl.hidden ? "Mostrar" : "Ocultar"}</Button>
          </div>))}
        <label className="block text-xs">Endereço do QR Code (https)<input className={field} value={profile.qrUrl ?? ""} onChange={(e) => set("qrUrl", safeQrUrl(e.target.value) ?? (e.target.value ? profile.qrUrl : null))} placeholder="https://..." /></label>
        {fixed("qrText", "Texto do QR Code")}
      </Group>

      <Group onReset={() => onChange(resetSection(profile, def, "impressao"))} title="7. Impressão" hint="A4 paisagem, uma página">
        <p className="text-xs text-muted-foreground">A prévia é a mesma folha A4 paisagem que vai para o PDF. Se algo passar da página, um aviso aparece acima da prévia; nada é cortado.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(def)}>Restaurar padrão deste modelo</Button>
      </Group>
    </section>
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
  const [hist, setHist] = useState<History<ExternalProfile>>(() => ({ past: [], present: defaultProfile(template, presentation), future: [] }));
  const draft = hist.present;
  const setDraft = (p: ExternalProfile) => setHist((h) => historyPush(h, p));
  const resetDraft = (p: ExternalProfile) => setHist({ past: [], present: p, future: [] });
  const free = isFreeTemplate(template);
  const [selected, setSelected] = useState<FreeBlockId | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  useEffect(() => {
    if (!free || !selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const d = e.shiftKey ? 5 : 1; const b = hist.present.free.blocks[selected];
      const patch = e.key === "ArrowLeft" ? { x: b.x - d } : e.key === "ArrowRight" ? { x: b.x + d } : e.key === "ArrowUp" ? { y: b.y - d } : e.key === "ArrowDown" ? { y: b.y + d } : null;
      if (!patch) return; e.preventDefault();
      const moved = moveFreeBlock({ ...hist.present.free, snap: false }, selected, patch);
      setDraft({ ...hist.present, free: { ...moved, snap: hist.present.free.snap } });
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [free, selected, hist]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(false);
  // CAL.EXT.3.1: desfazer/refazer da sessão (Ctrl+Z / Ctrl+Shift+Z ou Ctrl+Y), fora de campos de texto.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); setHist(historyUndo); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); setHist(historyRedo); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [editing]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const screenRef = useRef<HTMLDivElement>(null);
  const [overflowMm, setOverflowMm] = useState<number | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  // "Ajustar para caber": laço explícito (clique do usuário), um passo por renderização medida.
  const [fitting, setFitting] = useState<{ steps: number; start: ExternalProfile } | null>(null);
  useEffect(() => {
    // Fit medido (nunca compacta): 1 mm em px pela largura declarada da folha (285 mm); área útil A4 = 198 mm.
    const f = screenRef.current?.querySelector<HTMLElement>(".cx-folha"); if (!f) return;
    const mm = f.offsetWidth / 285; if (!mm) return;
    const over = Math.max(f.scrollHeight - f.clientHeight, f.scrollWidth - f.clientWidth) / mm;
    const found = sheetIssues(f);
    setOverflowMm(over > 0.5 ? Math.ceil(over) : null);
    setIssues(found);
    if (!fitting) return;
    if (!found.length && over <= 0.5) { setFitting(null); setMsg(fitSummary(fitting.start, draft)); return; }
    const next = fitting.steps < 40 ? nextFitStep(draft, found) : null;
    if (!next) { setFitting(null); setMsg("Não foi possível caber só com espaço e fonte mínima legível. Oculte um bloco opcional, aumente a largura do bloco indicado ou reduza a altura da faixa do título."); return; }
    setFitting({ ...fitting, steps: fitting.steps + 1 }); setDraft(next);
  }, [draft, vm, template, fitting]); // eslint-disable-line react-hooks/exhaustive-deps
  // Instante de leitura nunca anterior à última gravação feita nesta tela (relógio local pode estar atrás do servidor).
  const lastSavedAt = useRef<string | null>(null);
  const load = async () => {
    const now = new Date().toISOString();
    const at = [now, knownAt, lastSavedAt.current ?? ""].sort().at(-1)!;
    const r = await readExternalProfile({ calendarId, template, on, knownAt: at, presentation });
    setRead(r); resetDraft(r.kind === "lido" || r.kind === "padrao" ? r.profile : defaultProfile(template, presentation));
  };
  useEffect(() => { void load(); }, [calendarId, template]); // eslint-disable-line react-hooks/exhaustive-deps
  const types = vm.legendCodes.map((c) => ({ code: c, label: String((presentation["dayTypeCatalog"] as Record<string, { label?: string }> | undefined)?.[c]?.label ?? c) }));
  const freeIssues = free ? layoutIssues(draft.free) : null;
  const blocked = overflowMm !== null || issues.length > 0 || (!!freeIssues && (freeIssues.overlaps.length > 0 || freeIssues.tableOverflow));
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const head = read && read.kind === "lido" ? read.headId : null;
      const saved = sanitizeProfile(template, draft, presentation);
      const r = await saveExternalProfile({ calendarId, template, expectedHead: head, profile: saved, reason: null });
      // Mantém na tela exatamente o que foi gravado (não relê: uma releitura com relógio local atrasado
      // devolvia a revisão anterior e parecia desfazer as alterações).
      const recordedAt = new Date().toISOString();
      lastSavedAt.current = recordedAt;
      setRead({ kind: "lido", headId: r.revisionId, revision: r.revision, profile: saved, recordedAt });
      resetDraft(saved);
      let extra = "";
      if (applyAll) {
        // Decisão do usuário: o layout vale para TODOS os calendários externos deste modelo.
        let ok = 0, fail = 0;
        try {
          const list = await readCalendarList({ knownAt: recordedAt });
          const ids = list.kind === "lido" ? [...new Set(list.versions.map((v) => v.calendarId))].filter((x) => x !== calendarId) : [];
          for (const id of ids) {
            try {
              const cur = await readExternalProfile({ calendarId: id, template, on, knownAt: recordedAt, presentation });
              const h = cur.kind === "lido" ? cur.headId : null;
              await saveExternalProfile({ calendarId: id, template, expectedHead: h, profile: saved, reason: null }); ok++;
            } catch { fail++; }
          }
        } catch { fail++; }
        extra = ` Aplicada também a ${ok} outro(s) calendário(s)${fail ? `; ${fail} não puderam ser gravados` : ""}.`;
      }
      setMsg(`Personalização salva (revisão ${r.revision}).${extra}${blocked ? " A impressão continua bloqueada até todos os blocos caberem." : ""}`);
    } catch (e) { setMsg(userErrorText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      {read?.kind === "negado" && <p className="text-xs text-muted-foreground">Perfil visual institucional indisponível para sua atuação; exibindo o padrão do modelo.</p>}
      {read?.kind === "erro" && <p role="alert" className="text-xs text-destructive">{read.message} Exibindo o padrão do modelo.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={blocked} title={blocked ? "Corrija os avisos antes de imprimir" : undefined} onClick={() => window.print()}>Imprimir / PDF</Button>
        {canEdit && <Button type="button" size="sm" variant="outline" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>Personalizar modelo externo</Button>}
        {editing && <Button type="button" size="sm" disabled={busy || !!fitting} onClick={() => void save()}>Salvar personalização</Button>}
        {editing && <label className="flex items-center gap-1 self-center text-xs"><input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />Aplicar a todos os calendários</label>}
        {editing && <Button type="button" size="sm" variant="outline" disabled={!hist.past.length} aria-keyshortcuts="Control+Z" onClick={() => setHist(historyUndo)}>Desfazer</Button>}
        {editing && <Button type="button" size="sm" variant="outline" disabled={!hist.future.length} aria-keyshortcuts="Control+Shift+Z" onClick={() => setHist(historyRedo)}>Refazer</Button>}
        {editing && <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Descartar alterações</Button>}
        {editing && <Button type="button" size="sm" variant="outline" onClick={() => setDraft(defaultProfile(template, presentation))}>Restaurar padrão</Button>}
        {editing && free && <span className="self-center text-xs text-muted-foreground">Salvar grava este layout como o padrão do município para este modelo.</span>}
      </div>
      {vm.unmappedTypes.length > 0 && <p role="alert" className="text-xs text-destructive">Tipos sem vínculo visual nesta versão: {vm.unmappedTypes.join(", ")}. Revise o vínculo de tipos antes de imprimir.</p>}
      {msg && <p role="status" className="text-xs">{msg}</p>}
      <div className={canEdit && editing ? "grid gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]" : ""}>
        {canEdit && editing && <div className="space-y-2 xl:max-h-[85vh] xl:overflow-y-auto xl:pr-1">
          <ExternalPresetsBar template={template} draft={draft} defaults={defaultProfile(template, presentation)} presentation={presentation} onApply={setDraft} />
          {free && <FreeLayoutEditor profile={draft} onChange={setDraft} selected={selected} onSelect={setSelected} defaults={defaultProfile(template, presentation).free} selectedLayer={selectedLayer} onSelectLayer={setSelectedLayer}
            canUndo={hist.past.length > 0} canRedo={hist.future.length > 0} onUndo={() => setHist(historyUndo)} onRedo={() => setHist(historyRedo)} />}
          <ExternalEditor template={template} profile={draft} onChange={setDraft} types={types} presentation={presentation} /></div>}
        {/* Em telas estreitas a prévia vem primeiro e fica presa no topo: cada ajuste do editor aparece na hora, sem rolar. */}
        <div className={canEdit && editing ? "sticky top-16 z-20 order-first min-w-0 max-h-[58vh] space-y-2 overflow-auto border-b border-border bg-background pb-2 xl:order-last xl:max-h-[90vh] xl:border-0" : "min-w-0 space-y-2"}>
          {issues.length > 0 && <div role="alert" className="space-y-1 text-xs text-destructive">
            <p>Não coube: {issues.map((b) => BLOCK_LABEL[b as InfoBlock] ?? (b === "cabecalho" ? "Cabeçalho" : b === "branding" ? "Rodapé" : b)).join(", ")}. Mesmo na menor fonte permitida o texto não cabe; reduzir o tamanho não basta — é preciso mais espaço. A impressão fica bloqueada até caber; você pode salvar normalmente.</p>
            {canEdit && editing && <Button type="button" size="sm" variant="outline" disabled={!!fitting} onClick={() => { setMsg(null); setFitting({ steps: 0, start: draft }); }}>{fitting ? "Ajustando…" : "Ajustar para caber"}</Button>}
          </div>}
          {overflowMm !== null && <p role="alert" className="text-xs text-destructive">A folha excede a área A4 em ≈{overflowMm} mm; nada é cortado nem reduzido automaticamente. Reduza a compactação ou oculte blocos opcionais.</p>}
          <div ref={screenRef} className="cx-tela overflow-hidden"><FitPreview><ExternalSheet template={template} vm={vm} p={draft} presentation={presentation}
            {...(free && canEdit && editing ? { selected, onSelect: setSelected, onMove: (b: FreeBlockId, patch: { x?: number; y?: number; w?: number; h?: number }) => setDraft({ ...draft, free: moveFreeBlock(draft.free, b, patch) }), onMoveSticker: (sid: string, patch: { x?: number; y?: number; w?: number; h?: number }) => setDraft({ ...draft, free: moveSticker(draft.free, sid, patch) }), selectedLayer, onSelectLayer: setSelectedLayer, onMoveLayer: (lid: string, patch: { x?: number; y?: number; w?: number; h?: number }) => setDraft({ ...draft, free: { ...draft.free, layers: moveLayer(draft.free.layers, lid, patch, { snap: draft.free.snap, stepMm: draft.free.stepMm }) } }) } : {})} /></FitPreview></div>
        </div>
      </div>
      <ExternalCalendarPrint><ExternalSheet template={template} vm={vm} p={draft} presentation={presentation} /></ExternalCalendarPrint>
    </div>
  );
}
