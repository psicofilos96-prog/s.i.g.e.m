/**
 * "Personalização do Calendário" — editor de diagramação e aparência com
 * pré-visualização real do documento (Tela | A4/Impressão), desfazer/refazer
 * e restauração. Edita SOMENTE `document.layout` e `symbology`; os dados,
 * as regras e o conteúdo do calendário nunca são tocados.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Redo2, RotateCcw, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarDocument, DocumentFrame } from "./calendar-document";
import { deriveCalendarProjection } from "./calendar-engine";
import { DAY_TYPES } from "./calendar-catalog";
import { DayMark } from "./calendar-mark";
import { A4OverflowNotice } from "./calendar-a4-notice";
import { SymbologyEditor } from "./calendar-symbology-editor";
import type { SymbologyMap } from "./calendar-symbology";
import { FONT_OPTIONS } from "./calendar-typography";
import type { DayTypeCode, NetworkCalendar } from "./calendar-types";
import {
  DEFAULT_LOGOS,
  resize,
  type CalendarLogo,
  type LogoPosition as CalLogoPosition,
  type LogoFit,
} from "./calendar-logos";
import {
  LAYOUT_BLOCKS,
  LAYOUT_LIMITS,
  SPACING_PRESETS,
  adoptLegacyTypography,
  applySpacingPreset,
  cleanLayout,
  layoutBlock,
  presetOf,
  validateLayout,
  type BlockLayout,
  type DocumentLayout,
  type LayoutLayer,
  type LayoutBox,
  type LayoutLimitKey,
  type LayoutRows,
  type LayoutText,
  type SpacingPreset,
} from "./calendar-layout";

type Draft = { layout: DocumentLayout; symbology: SymbologyMap | undefined; vacationDisplay: "texto" | "marcador" };
type History = { past: Draft[]; present: Draft; future: Draft[]; lastKey: string | null };

const inputCls =
  "h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60";

/** Histórico do rascunho: alterações seguidas do mesmo campo formam um passo só. */
function useDraftHistory(initial: () => Draft) {
  const [h, setH] = useState<History>(() => ({ past: [], present: initial(), future: [], lastKey: null }));
  return {
    draft: h.present,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    reset: (d: Draft) => setH({ past: [], present: d, future: [], lastKey: null }),
    update: (key: string, fn: (d: Draft) => Draft) =>
      setH((s) => {
        const next = fn(s.present);
        const merge = key === s.lastKey && s.past.length > 0;
        return { past: merge ? s.past : [...s.past, s.present], present: next, future: [], lastKey: key };
      }),
    undo: () =>
      setH((s) =>
        s.past.length
          ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1]!, future: [s.present, ...s.future], lastKey: null }
          : s,
      ),
    redo: () =>
      setH((s) =>
        s.future.length
          ? { past: [...s.past, s.present], present: s.future[0]!, future: s.future.slice(1), lastKey: null }
          : s,
      ),
  };
}

// ------------------------------------------------------------- campos

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid min-w-0 gap-1 text-xs", className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Num({
  label,
  unit,
  value,
  limit,
  step = 0.5,
  onChange,
}: {
  label: string;
  unit: string;
  value: number | undefined;
  limit: LayoutLimitKey;
  step?: number;
  onChange: (v: number | undefined) => void;
}) {
  const { min, max } = LAYOUT_LIMITS[limit];
  const bad = value !== undefined && (value < min || value > max || !Number.isFinite(value));
  return (
    <Field label={`${label} (${unit})`}>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="herda"
        aria-invalid={bad || undefined}
        aria-label={`${label} (${unit})`}
        className={cn(inputCls, bad && "border-destructive")}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
      {bad ? <span className="text-destructive">Use de {min} a {max}.</span> : null}
    </Field>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: Array<[T, string]>;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        value={value ?? ""}
        className={inputCls}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      >
        <option value="">Herdar</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Tri({ label, value, onChange, yes, no }: { label: string; value: boolean | undefined; yes: string; no: string; onChange: (v: boolean | undefined) => void }) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        value={value === undefined ? "" : value ? "1" : "0"}
        className={inputCls}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "1")}
      >
        <option value="">Herdar</option>
        <option value="1">{yes}</option>
        <option value="0">{no}</option>
      </select>
    </Field>
  );
}

function Color({ label, value, onChange }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <Field label={label}>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value ?? "#000000"}
          className="h-8 w-10 shrink-0"
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        {value ? (
          <button type="button" className="text-xs text-primary underline" onClick={() => onChange(undefined)}>
            Herdar
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Herdada</span>
        )}
      </div>
    </Field>
  );
}

function Section({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group min-w-0 rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">{title}</summary>
      <div className="grid min-w-0 grid-cols-2 gap-2 px-3 pb-3">{children}</div>
    </details>
  );
}

function TextControls({ prefix, value, onChange }: { prefix: string; value: LayoutText | undefined; onChange: (patch: Partial<LayoutText>) => void }) {
  const v = value ?? {};
  return (
    <>
      <Field label={`${prefix} — fonte`} className="col-span-2">
        <select
          aria-label={`${prefix} — fonte`}
          value={v.family ?? ""}
          className={inputCls}
          onChange={(e) => onChange({ family: e.target.value || undefined })}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.value ? f.label : "Herdar"}
            </option>
          ))}
        </select>
      </Field>
      <Num label={`${prefix} — tamanho`} unit="pt" limit="sizePt" value={v.sizePt} onChange={(sizePt) => onChange({ sizePt })} />
      <Choice
        label={`${prefix} — peso`}
        value={v.weight === undefined ? undefined : (String(v.weight) as "400" | "700")}
        options={[["400", "Normal"], ["700", "Negrito"]]}
        onChange={(w) => onChange({ weight: w ? (Number(w) as 400 | 700) : undefined })}
      />
      <Tri label={`${prefix} — itálico`} value={v.italic} yes="Itálico" no="Sem itálico" onChange={(italic) => onChange({ italic })} />
      <Tri label={`${prefix} — sublinhado`} value={v.underline} yes="Sublinhado" no="Sem sublinhado" onChange={(underline) => onChange({ underline })} />
      <Color label={`${prefix} — cor`} value={v.color} onChange={(color) => onChange({ color })} />
      <Num label={`${prefix} — altura da linha`} unit="×" step={0.05} limit="lineHeight" value={v.lineHeight} onChange={(lineHeight) => onChange({ lineHeight })} />
      <Num label={`${prefix} — entre caracteres`} unit="pt" step={0.1} limit="letterSpacingPt" value={v.letterSpacingPt} onChange={(letterSpacingPt) => onChange({ letterSpacingPt })} />
      <Choice
        label={`${prefix} — alinhamento`}
        value={v.align}
        options={[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"], ["justify", "Justificado"]]}
        onChange={(align) => onChange({ align })}
      />
      <Choice
        label={`${prefix} — maiúsculas`}
        value={v.transform}
        options={[["none", "Como digitado"], ["uppercase", "MAIÚSCULAS"], ["lowercase", "minúsculas"], ["capitalize", "Iniciais Maiúsculas"]]}
        onChange={(transform) => onChange({ transform })}
      />
    </>
  );
}

function PresetBar({ rows, onPick, label }: { rows: Pick<LayoutRows, "gapPt" | "heightPt"> | undefined; onPick: (p: SpacingPreset) => void; label: string }) {
  const cur = presetOf(rows);
  return (
    <div className="col-span-2 flex flex-wrap items-center gap-1" role="group" aria-label={label}>
      {(Object.keys(SPACING_PRESETS) as SpacingPreset[]).map((k) => (
        <Button key={k} type="button" size="sm" variant={cur === k ? "default" : "outline"} aria-pressed={cur === k} onClick={() => onPick(k)}>
          {SPACING_PRESETS[k].label}
        </Button>
      ))}
      <span className={cn("rounded px-2 py-1 text-xs", cur === "personalizado" ? "bg-muted font-semibold" : "text-muted-foreground")}>
        Personalizado
      </span>
    </div>
  );
}

// ------------------------------------------------------------- editor

const TABS = [
  ["documento", "Documento"],
  ["blocos", "Blocos"],
  ["marcadores", "Marcadores"],
  ["logos", "Logos"],
] as const;
type Tab = (typeof TABS)[number][0];

export function CalendarAppearanceEditor({
  cal,
  open,
  onOpenChange,
  onSave,
}: {
  cal: NetworkCalendar;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    layout: DocumentLayout | undefined,
    symbology: SymbologyMap | undefined,
    vacationDisplay?: "texto" | "marcador",
  ) => void;
}) {
  const initial = (): Draft => ({
    layout: adoptLegacyTypography(cal.document),
    symbology: cal.symbology,
    vacationDisplay: cal.document.vacationDisplay ?? "texto",
  });
  const h = useDraftHistory(initial);
  const [tab, setTab] = useState<Tab>("blocos");
  const [blockId, setBlockId] = useState("legenda");
  const [mode, setMode] = useState<"tela" | "a4">("tela");
  const [marker, setMarker] = useState<DayTypeCode | null>(null);
  /** Contexto editado: geral (tela + impressão) ou sobrescritas da impressão. */
  const [ctx, setCtx] = useState<"geral" | "impressao">("geral");
  useEffect(() => {
    if (open) h.reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { layout, symbology, vacationDisplay } = h.draft;
  const setVacationDisplay = (v: "texto" | "marcador") =>
    h.update("vacationDisplay", (d) => ({ ...d, vacationDisplay: v }));
  const logos = (layout as unknown as { logos?: CalendarLogo[] }).logos ?? DEFAULT_LOGOS;
  const setLogos = (next: CalendarLogo[]) =>
    h.update("logos", (d) => ({ ...d, layout: { ...(d.layout as object), logos: next } as DocumentLayout }));
  const updateLogo = (id: string, patch: Partial<CalendarLogo>) =>
    setLogos(logos.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const onUploadLogo = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") updateLogo(id, { source: { kind: "asset", assetId: reader.result } });
    };
    reader.readAsDataURL(file);
  };
  const addNewLogo = () =>
    setLogos([
      ...logos,
      {
        id: `logo-${Date.now()}`,
        label: "Nova logo",
        source: { kind: "none" },
        visible: true,
        position: "centro",
        unit: "px",
        keepRatio: true,
        fit: "contain",
      },
    ]);
  const removeLogoItem = (id: string) => setLogos(logos.filter((l) => l.id !== id));
  const moveLogoItem = (id: string, dir: -1 | 1) => {
    const i = logos.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= logos.length) return;
    const next = [...logos];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setLogos(next);
  };
  const restoreLogoItem = (id: string) => {
    const def = DEFAULT_LOGOS.find((l) => l.id === id);
    if (def) setLogos(logos.map((l) => (l.id === id ? { ...def } : l)));
    else updateLogo(id, { source: { kind: "none" } });
  };
  const projection = useMemo(() => deriveCalendarProjection(cal), [cal]);
  const preview = useMemo<NetworkCalendar>(
    () => ({
      ...cal,
      // escopo próprio: a prévia não vaza estilo para o documento da página
      id: `${cal.id}--previa`,
      document: { ...cal.document, typography: undefined, layout },
      symbology,
    }),
    [cal, layout, symbology],
  );
  const issues = validateLayout(layout);

  const separate = !!layout.print?.separate;
  const editingPrint = ctx === "impressao" && separate;
  const layer: LayoutLayer = editingPrint ? (layout.print ?? {}) : layout;
  const setLayout = (key: string, fn: (l: LayoutLayer) => LayoutLayer) =>
    h.update(`${editingPrint ? "p" : "g"}:${key}`, (d) =>
      editingPrint
        ? { ...d, layout: { ...d.layout, print: { ...fn(d.layout.print ?? {}), separate: true } } }
        : { ...d, layout: { ...(fn(d.layout) as DocumentLayout), print: d.layout.print } },
    );
  const setSeparate = (on: boolean) => {
    h.update("print.separate", (d) => ({ ...d, layout: { ...d.layout, print: { ...d.layout.print, separate: on } } }));
    setCtx(on ? "impressao" : "geral");
    if (on) setMode("a4");
  };
  const setGlobal = (key: string, patch: Partial<NonNullable<LayoutLayer["global"]>>) =>
    setLayout(`g.${key}`, (l) => ({ ...l, global: { ...l.global, ...patch } }));
  const setBlock = <K extends keyof BlockLayout>(id: string, part: K, patch: Partial<NonNullable<BlockLayout[K]>>) =>
    setLayout(`b.${id}.${part}.${Object.keys(patch).join(",")}`, (l) => {
      const b = l.blocks?.[id] ?? {};
      return { ...l, blocks: { ...l.blocks, [id]: { ...b, [part]: { ...(b[part] as object | undefined), ...patch } } } };
    });

  const g = layer.global ?? {};
  const def = layoutBlock(blockId)!;
  const b = layer.blocks?.[blockId] ?? {};
  const rows = b.rows ?? {};
  const box = b.box ?? {};
  const setRows = (patch: Partial<LayoutRows>) => setBlock(blockId, "rows", patch);
  const setBox = (patch: Partial<LayoutBox>) => setBlock(blockId, "box", patch);
  const legendTypes = Object.values(DAY_TYPES).filter((x) => x.showInLegend);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[1500px] flex-col gap-3 overflow-hidden p-3 sm:p-4">
        <DialogHeader>
          <DialogTitle>Personalização do Calendário</DialogTitle>
          <DialogDescription>
            Aparência e diagramação do documento. Nada aqui altera datas, dias letivos, regras ou conteúdo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!h.canUndo} onClick={h.undo}>
            <Undo2 /> Desfazer
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!h.canRedo} onClick={h.redo}>
            <Redo2 /> Refazer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => h.update("restaurar-modelo", () => ({ layout: {}, symbology: undefined, vacationDisplay: "texto" }))}
          >
            <RotateCcw /> Restaurar padrão do modelo
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={separate} onChange={(e) => setSeparate(e.target.checked)} aria-label="Personalizar impressão separadamente" />
            Personalizar impressão separadamente
          </label>
          {separate ? (
            <div className="flex items-center gap-1" role="group" aria-label="Contexto editado">
              {(["geral", "impressao"] as const).map((c) => (
                <Button key={c} type="button" size="sm" variant={ctx === c ? "default" : "outline"} aria-pressed={ctx === c} onClick={() => { setCtx(c); if (c === "impressao") setMode("a4"); }}>
                  {c === "geral" ? "Editar: Geral" : "Editar: Impressão (sobrescritas)"}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Modo da pré-visualização">
            {(["tela", "a4"] as const).map((m) => (
              <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === "tela" ? "Tela" : "A4/Impressão"}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[23rem_minmax(0,1fr)] lg:overflow-hidden">
          <div className="min-w-0 space-y-3 lg:overflow-y-auto lg:pr-1">
            <div role="tablist" aria-label="Categorias" className="flex gap-1">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-sm font-semibold",
                    tab === id ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {editingPrint
                ? "Editando só a impressão/A4: campo vazio herda a personalização geral; preencha apenas o que deve ser diferente no papel."
                : separate
                  ? "Editando a personalização geral (tela e, onde não houver sobrescrita, impressão)."
                  : "Aplicar a mesma personalização em Tela e Impressão."}
            </p>
            {tab === "documento" ? (
              <div className="space-y-2" role="tabpanel" aria-label="Documento">
                <Section title="Tipografia padrão do calendário" open>
                  <TextControls
                    prefix="Padrão"
                    value={g.text}
                    onChange={(p) => setGlobal(`text.${Object.keys(p)}`, { text: { ...g.text, ...p } })}
                  />
                </Section>
                <Section title="Espaçamento padrão das linhas">
                  <PresetBar
                    label="Espaçamento padrão"
                    rows={g.rows}
                    onPick={(p) => setGlobal("rows.preset", { rows: applySpacingPreset(g.rows, p) })}
                  />
                  <Num label="Entre linhas" unit="pt" limit="gapPt" value={g.rows?.gapPt} onChange={(gapPt) => setGlobal("rows.gap", { rows: { ...g.rows, gapPt } })} />
                  <Num label="Altura da linha" unit="pt" limit="heightPt" value={g.rows?.heightPt} onChange={(heightPt) => setGlobal("rows.h", { rows: { ...g.rows, heightPt } })} />
                </Section>
                <Section title="Página A4 — margens">
                  {(["top", "right", "bottom", "left"] as const).map((k) => (
                    <Num
                      key={k}
                      label={{ top: "Superior", right: "Direita", bottom: "Inferior", left: "Esquerda" }[k]}
                      unit="mm"
                      limit="pageMarginMm"
                      value={g.pageMarginMm?.[k]}
                      onChange={(v) => {
                        const next = { ...g.pageMarginMm };
                        if (v === undefined) delete next[k];
                        else next[k] = v;
                        setGlobal(`pm.${k}`, { pageMarginMm: next });
                      }}
                    />
                  ))}
                </Section>
                <Section title="Exibição das férias">
                  <Field label="Modo de exibição" className="col-span-2">
                    <select
                      aria-label="Modo de exibição das férias"
                      value={vacationDisplay}
                      className={inputCls}
                      onChange={(e) => setVacationDisplay(e.target.value as "texto" | "marcador")}
                    >
                      <option value="texto">Texto por extenso ("FÉRIAS")</option>
                      <option value="marcador">Marcador por dia ("F")</option>
                    </select>
                  </Field>
                </Section>
                <Section title="Região do rodapé (Legenda · Feriados · Períodos)">
                  <Num label="Distância da grade" unit="pt" limit="marginPt" value={g.footerTopPt} onChange={(footerTopPt) => setGlobal("ft", { footerTopPt })} />
                  <Num label="Entre colunas" unit="pt" limit="gapPt" value={g.footerGapPt} onChange={(footerGapPt) => setGlobal("fg", { footerGapPt })} />
                  {[0, 1, 2].map((i) => (
                    <Num
                      key={i}
                      label={`Largura da coluna ${i + 1}`}
                      unit="pt"
                      step={1}
                      limit="widthPt"
                      value={g.footerColumnsPt?.[i] ?? undefined}
                      onChange={(v) => {
                        const cols = [...(g.footerColumnsPt ?? [undefined, undefined, undefined])] as [number | undefined, number | undefined, number | undefined];
                        cols[i] = v;
                        setGlobal(`fc.${i}`, { footerColumnsPt: cols });
                      }}
                    />
                  ))}
                  <Choice
                    label="Alinhamento vertical"
                    value={g.footerAlignV}
                    options={[["start", "Topo"], ["center", "Centro"], ["end", "Base"], ["stretch", "Esticar"]]}
                    onChange={(footerAlignV) => setGlobal("fa", { footerAlignV })}
                  />
                </Section>
              </div>
            ) : null}

            {tab === "blocos" ? (
              <div className="space-y-2" role="tabpanel" aria-label="Blocos">
                <Field label="Bloco">
                  <select aria-label="Bloco" value={blockId} className={inputCls} onChange={(e) => setBlockId(e.target.value)}>
                    {(["Cabeçalho", "Grade", "Rodapé", "Assinaturas"] as const).map((grp) => (
                      <optgroup key={grp} label={grp}>
                        {LAYOUT_BLOCKS.filter((x) => x.group === grp).map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{layer.blocks?.[blockId] ? "Personalizado" : "Usa o padrão do calendário"}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!layer.blocks?.[blockId]}
                    onClick={() =>
                      setLayout(`restaurar.${blockId}`, (l) => {
                        const blocks = { ...l.blocks };
                        delete blocks[blockId];
                        return { ...l, blocks };
                      })
                    }
                  >
                    <RotateCcw /> Restaurar este bloco
                  </Button>
                </div>
                {def.title ? (
                  <Section title="Tipografia do título">
                    <TextControls prefix="Título" value={b.title} onChange={(p) => setBlock(blockId, "title", p)} />
                  </Section>
                ) : null}
                <Section title="Tipografia do conteúdo" open>
                  <TextControls prefix="Conteúdo" value={b.content} onChange={(p) => setBlock(blockId, "content", p)} />
                </Section>
                {def.row ? (
                  <Section title="Espaçamento das linhas" open>
                    <PresetBar label={`Espaçamento — ${def.label}`} rows={rows} onPick={(p) => setBlock(blockId, "rows", applySpacingPreset(rows, p))} />
                    <Num label="Entre linhas" unit="pt" limit="gapPt" value={rows.gapPt} onChange={(gapPt) => setRows({ gapPt })} />
                    <Num label="Altura da linha" unit="pt" limit="heightPt" value={rows.heightPt} onChange={(heightPt) => setRows({ heightPt })} />
                    <Num label="Padding superior" unit="pt" limit="padPt" value={rows.padTopPt} onChange={(padTopPt) => setRows({ padTopPt })} />
                    <Num label="Padding inferior" unit="pt" limit="padPt" value={rows.padBottomPt} onChange={(padBottomPt) => setRows({ padBottomPt })} />
                    <Num label="Padding esquerdo" unit="pt" limit="padPt" value={rows.padLeftPt} onChange={(padLeftPt) => setRows({ padLeftPt })} />
                    <Num label="Padding direito" unit="pt" limit="padPt" value={rows.padRightPt} onChange={(padRightPt) => setRows({ padRightPt })} />
                  </Section>
                ) : null}
                {def.columns?.length ? (
                  <Section title="Colunas internas" open>
                    <Num
                      label={def.id === "legenda" ? "Marcador ↔ descrição" : def.id === "feriados" || def.id === "conselhos" ? "Data ↔ descrição" : "Entre colunas"}
                      unit="pt"
                      limit="padPt"
                      value={rows.columnGapPt}
                      onChange={(columnGapPt) => setRows({ columnGapPt })}
                    />
                    {def.columns.map((c) => (
                      <Num
                        key={c.id}
                        label={`Largura — ${c.label}`}
                        unit="pt"
                        step={1}
                        limit="columnPt"
                        value={rows.columnsPt?.[c.id]}
                        onChange={(v) => setRows({ columnsPt: { ...rows.columnsPt, [c.id]: v } })}
                      />
                    ))}
                  </Section>
                ) : null}
                {def.box ? (
                  <Section title="Bloco — margens e dimensões">
                    <Num label="Margem superior (bloco anterior)" unit="pt" limit="marginPt" value={box.marginTopPt} onChange={(marginTopPt) => setBox({ marginTopPt })} />
                    <Num label="Margem inferior (bloco seguinte)" unit="pt" limit="marginPt" value={box.marginBottomPt} onChange={(marginBottomPt) => setBox({ marginBottomPt })} />
                    <Num label="Margem esquerda" unit="pt" limit="marginPt" value={box.marginLeftPt} onChange={(marginLeftPt) => setBox({ marginLeftPt })} />
                    <Num label="Margem direita" unit="pt" limit="marginPt" value={box.marginRightPt} onChange={(marginRightPt) => setBox({ marginRightPt })} />
                    <Num label="Padding interno" unit="pt" limit="padPt" value={box.paddingPt} onChange={(paddingPt) => setBox({ paddingPt })} />
                    <Num label="Largura" unit="pt" step={1} limit="widthPt" value={box.widthPt} onChange={(widthPt) => setBox({ widthPt })} />
                    <Num label="Largura mínima" unit="pt" step={1} limit="widthPt" value={box.minWidthPt} onChange={(minWidthPt) => setBox({ minWidthPt })} />
                    <Num label="Largura máxima" unit="pt" step={1} limit="widthPt" value={box.maxWidthPt} onChange={(maxWidthPt) => setBox({ maxWidthPt })} />
                    <Num label="Altura mínima" unit="pt" step={1} limit="widthPt" value={box.heightPt} onChange={(heightPt) => setBox({ heightPt })} />
                    <Choice label="Alinhamento horizontal" value={box.alignH} options={[["start", "Início"], ["center", "Centro"], ["end", "Fim"], ["stretch", "Esticar"]]} onChange={(alignH) => setBox({ alignH })} />
                    <Choice label="Alinhamento vertical" value={box.alignV} options={[["start", "Topo"], ["center", "Centro"], ["end", "Base"], ["stretch", "Esticar"]]} onChange={(alignV) => setBox({ alignV })} />
                  </Section>
                ) : null}
              </div>
            ) : null}

            {tab === "marcadores" ? (
              <div className="space-y-2" role="tabpanel" aria-label="Marcadores">
                <SymbologyEditor
                  code={marker}
                  overrides={symbology}
                  open={marker !== null}
                  onOpenChange={(o) => !o && setMarker(null)}
                  onSave={(code, value) => {
                    h.update(`m.${code}.${Date.now()}`, (d) => {
                      const next = { ...(d.symbology ?? {}) };
                      if (value) next[code] = value;
                      else delete next[code];
                      return { ...d, symbology: next };
                    });
                    setMarker(null);
                  }}
                />
                <ul className="grid gap-1.5">
                  {legendTypes.map((x) => (
                    <li key={x.code} className="flex min-w-0 items-center gap-2 rounded border border-border px-2 py-1.5">
                      <span className="inline-flex min-w-10 justify-center rounded px-1 text-xs font-bold" style={{ backgroundColor: x.background, color: x.foreground }}>
                        <DayMark code={x.code} text={x.mark} overrides={symbology} where="legenda" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{x.label}</span>
                      <Button type="button" size="sm" variant="outline" aria-label={`Personalizar marcador — ${x.label}`} onClick={() => setMarker(x.code)}>
                        Personalizar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tab === "logos" ? (
              <div className="space-y-2" role="tabpanel" aria-label="Logos">
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={addNewLogo}>
                    Adicionar logo
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setLogos(DEFAULT_LOGOS.map((l) => ({ ...l })))}>
                    <RotateCcw /> Restaurar composição do modelo
                  </Button>
                </div>
                <ul className="space-y-2">
                  {logos.map((l) => (
                    <li key={l.id} className="space-y-2 rounded border border-border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          aria-label="Nome da logo"
                          className={inputCls}
                          value={l.label}
                          onChange={(e) => updateLogo(l.id, { label: e.target.value })}
                        />
                        <label className="flex shrink-0 items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={l.visible}
                            aria-label={`Exibir ${l.label}`}
                            onChange={(e) => updateLogo(l.id, { visible: e.target.checked })}
                          />
                          Visível
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          aria-label={`Substituir imagem — ${l.label}`}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onUploadLogo(l.id, f);
                          }}
                        />
                        <Button type="button" size="sm" variant="ghost" onClick={() => restoreLogoItem(l.id)}>
                          <RotateCcw /> Restaurar padrão
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Choice
                          label="Posição"
                          value={l.position}
                          options={[
                            ["esquerda", "Esquerda"],
                            ["centro", "Centro"],
                            ["direita", "Direita"],
                            ["personalizada", "Personalizada"],
                          ]}
                          onChange={(v) => updateLogo(l.id, { position: (v ?? "esquerda") as CalLogoPosition })}
                        />
                        <Choice
                          label="Encaixe"
                          value={l.fit}
                          options={[
                            ["contain", "Conter"],
                            ["cover", "Cobrir"],
                            ["fill", "Preencher"],
                          ]}
                          onChange={(v) => updateLogo(l.id, { fit: (v ?? "contain") as LogoFit })}
                        />
                        <Field label="Largura">
                          <input
                            type="number"
                            aria-label={`Largura — ${l.label}`}
                            className={inputCls}
                            value={l.width ?? ""}
                            onChange={(e) =>
                              setLogos(
                                logos.map((x) =>
                                  x.id === l.id
                                    ? resize(x, "width", e.target.value === "" ? undefined : Number(e.target.value))
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Altura">
                          <input
                            type="number"
                            aria-label={`Altura — ${l.label}`}
                            className={inputCls}
                            value={l.height ?? ""}
                            onChange={(e) =>
                              setLogos(
                                logos.map((x) =>
                                  x.id === l.id
                                    ? resize(x, "height", e.target.value === "" ? undefined : Number(e.target.value))
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <label className="col-span-2 flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={l.keepRatio}
                            aria-label={`Manter proporção — ${l.label}`}
                            onChange={(e) => updateLogo(l.id, { keepRatio: e.target.checked })}
                          />
                          Manter proporção
                        </label>
                        <Field label="Opacidade (0,1 a 1)">
                          <input
                            type="number"
                            min={0.1}
                            max={1}
                            step={0.1}
                            aria-label={`Opacidade — ${l.label}`}
                            className={inputCls}
                            value={l.opacity ?? 1}
                            onChange={(e) => updateLogo(l.id, { opacity: Number(e.target.value) })}
                          />
                        </Field>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => moveLogoItem(l.id, -1)}>
                          Mover para cima
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => moveLogoItem(l.id, 1)}>
                          Mover para baixo
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => removeLogoItem(l.id)}>
                          Remover
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 rounded-md border border-border/70 bg-muted/30 p-2 lg:overflow-y-auto" aria-label="Pré-visualização do documento">
            <DocumentFrame key={mode} baseWidth={mode === "a4" ? 1125 : 1060}>
              {mode === "a4" ? (
                <div className="cd-a4 cd-a4-tela">
                  <CalendarDocument cal={preview} projection={projection} />
                </div>
              ) : (
                <CalendarDocument cal={preview} projection={projection} />
              )}
            </DocumentFrame>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-2">
          <A4OverflowNotice cal={preview} className="mr-auto w-full rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive" />
          {issues.length ? (
            <p role="alert" className="mr-auto text-xs text-destructive">
              {issues.length} valor(es) fora dos limites — corrija antes de salvar.
            </p>
          ) : (
            <p className="mr-auto text-xs text-muted-foreground">Alterações só valem depois de salvar.</p>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={issues.length > 0} onClick={() => onSave(cleanLayout(layout), symbology, vacationDisplay)}>
            Salvar personalização
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
