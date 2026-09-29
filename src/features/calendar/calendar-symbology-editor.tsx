/**
 * Editor "Personalizar marcador" — edita a simbologia de UM tipo de dia com
 * pré-visualização imediata. Não cria tipo, não altera significado nem
 * contagem: grava apenas a aparência em `NetworkCalendar.symbology`.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DAY_TYPES } from "./calendar-catalog";
import { DayMark } from "./calendar-mark";
import {
  DEFAULT_SYMBOLOGY,
  MARKER_SHAPES,
  SYMBOLOGY_LIMITS,
  symbologyFor,
  validateSymbology,
  type MarkerShape,
  type MarkerSymbology,
  type SymbologyMap,
} from "./calendar-symbology";
import type { DayTypeCode } from "./calendar-types";

const SHAPE_LABEL: Record<MarkerShape, string> = {
  nenhuma: "Sem forma (só a sigla)",
  retangulo: "Retângulo",
  "retangulo-arredondado": "Retângulo arredondado",
  circulo: "Círculo",
  elipse: "Elipse",
  triangulo: "Triângulo",
};

const inputCls =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">{title}</legend>
      <div className="grid min-w-0 grid-cols-2 gap-2">{children}</div>
    </fieldset>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`grid min-w-0 gap-1 text-xs ${wide ? "col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  limit,
  step = 1,
  onChange,
}: {
  label: string;
  value: number | undefined;
  limit: { min: number; max: number };
  step?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <Field label={`${label} (${limit.min}–${limit.max})`}>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        placeholder="Padrão"
        className={inputCls}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </Field>
  );
}

/** Cor com alternativa não-hexadecimal (transparente / herdada). */
function ColorField({
  label,
  value,
  alt,
  altLabel,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  alt: "transparent" | "currentColor" | undefined;
  altLabel: string;
  fallback: string;
  onChange: (v: string | undefined) => void;
}) {
  const isAlt = value === undefined || value === alt || !value.startsWith("#");
  return (
    <Field label={label}>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={isAlt ? fallback : value}
          disabled={isAlt}
          className="h-9 w-12 shrink-0 disabled:opacity-40"
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <label className="flex min-w-0 items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={isAlt}
            onChange={(e) => onChange(e.target.checked ? alt : fallback)}
          />
          <span className="truncate">{altLabel}</span>
        </label>
      </div>
    </Field>
  );
}

export function SymbologyEditor({
  code,
  overrides,
  open,
  onOpenChange,
  onSave,
}: {
  code: DayTypeCode | null;
  overrides: SymbologyMap | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = restaurar o padrão do sistema. */
  onSave: (code: DayTypeCode, value: MarkerSymbology | null) => void;
}) {
  const [draft, setDraft] = useState<MarkerSymbology>({ shape: "nenhuma" });
  useEffect(() => {
    if (code) setDraft(structuredClone(symbologyFor(code, overrides)));
  }, [code, overrides, open]);
  if (!code) return null;
  const info = DAY_TYPES[code];
  const set = (patch: Partial<MarkerSymbology>) => setDraft((d) => ({ ...d, ...patch }));
  const issues = validateSymbology(draft);
  const L = SYMBOLOGY_LIMITS;
  const cell = (scale: number) => (
    <div
      className="grid place-items-center border border-foreground/40 font-bold"
      style={{
        width: 30,
        height: 22,
        zoom: scale,
        backgroundColor: info.background,
        color: info.foreground,
        fontSize: "7pt",
        fontFamily: "Calibri, Carlito, sans-serif",
      }}
    >
      <DayMark code={code} text={info.mark} symbology={draft} overrides={overrides} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar marcador — {info.label}</DialogTitle>
          <DialogDescription>
            Muda só a aparência do marcador. O tipo do dia, a cor do dia no calendário e a
            contagem de dias letivos não mudam.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 md:grid-cols-[1fr_14rem]">
          <div className="grid min-w-0 gap-3">
            <Group title="Conteúdo">
              <Field label="Sigla na grade">
                <input
                  value={draft.text ?? ""}
                  placeholder={info.mark}
                  maxLength={L.textLength.max + 2}
                  className={inputCls}
                  onChange={(e) => set({ text: e.target.value || undefined })}
                />
              </Field>
              <Field label="Sigla na legenda">
                <input
                  value={draft.legendText ?? ""}
                  placeholder="Igual à grade"
                  maxLength={L.textLength.max + 2}
                  className={inputCls}
                  onChange={(e) => set({ legendText: e.target.value || undefined })}
                />
              </Field>
            </Group>
            <Group title="Forma">
              <Field label="Forma" wide>
                <select
                  value={draft.shape}
                  className={inputCls}
                  onChange={(e) => set({ shape: e.target.value as MarkerShape })}
                >
                  {MARKER_SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {SHAPE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </Group>
            <Group title="Cores">
              <ColorField
                label="Fundo do marcador"
                value={draft.fillColor}
                alt="transparent"
                altLabel="Transparente"
                fallback="#FFFFFF"
                onChange={(v) => set({ fillColor: v })}
              />
              <ColorField
                label="Cor do texto"
                value={draft.textColor}
                alt={undefined}
                altLabel="Cor do dia"
                fallback={info.foreground}
                onChange={(v) => set({ textColor: v })}
              />
            </Group>
            <Group title="Borda">
              <ColorField
                label="Cor da borda"
                value={draft.borderColor}
                alt="currentColor"
                altLabel="Igual ao texto"
                fallback="#000000"
                onChange={(v) => set({ borderColor: v })}
              />
              <NumberField
                label="Espessura px"
                value={draft.borderWidthPx}
                limit={L.borderWidthPx}
                step={0.5}
                onChange={(v) => set({ borderWidthPx: v })}
              />
              <Field label="Estilo da borda">
                <select
                  value={draft.borderStyle ?? "solid"}
                  className={inputCls}
                  onChange={(e) =>
                    set({ borderStyle: e.target.value as MarkerSymbology["borderStyle"] })
                  }
                >
                  <option value="solid">Contínua</option>
                  <option value="dashed">Tracejada</option>
                  <option value="dotted">Pontilhada</option>
                </select>
              </Field>
            </Group>
            <Group title="Tipografia">
              <NumberField
                label="Tamanho pt"
                value={draft.fontSizePt}
                limit={L.fontSizePt}
                step={0.5}
                onChange={(v) => set({ fontSizePt: v })}
              />
              <Field label="Peso">
                <select
                  value={draft.fontWeight ?? ""}
                  className={inputCls}
                  onChange={(e) =>
                    set({ fontWeight: e.target.value ? (Number(e.target.value) as 400 | 700) : undefined })
                  }
                >
                  <option value="">Padrão</option>
                  <option value="400">Normal</option>
                  <option value="700">Negrito</option>
                </select>
              </Field>
              <Field label="Estilo">
                <select
                  value={draft.fontStyle ?? ""}
                  className={inputCls}
                  onChange={(e) =>
                    set({ fontStyle: (e.target.value || undefined) as MarkerSymbology["fontStyle"] })
                  }
                >
                  <option value="">Padrão</option>
                  <option value="normal">Normal</option>
                  <option value="italic">Itálico</option>
                </select>
              </Field>
            </Group>
            <Group title="Dimensões">
              <NumberField label="Largura px" value={draft.widthPx} limit={L.widthPx} onChange={(v) => set({ widthPx: v })} />
              <NumberField label="Altura px" value={draft.heightPx} limit={L.heightPx} onChange={(v) => set({ heightPx: v })} />
              <NumberField label="Espaço interno px" value={draft.paddingPx} limit={L.paddingPx} onChange={(v) => set({ paddingPx: v })} />
            </Group>
          </div>
          <aside className="sticky top-0 z-10 order-first grid content-start gap-3 bg-background md:order-none" aria-label="Pré-visualização">
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Pré-visualização</p>
              <div className="grid justify-items-center gap-3" data-testid="symbology-preview">
                {cell(3)}
                <div className="flex items-center gap-2 text-xs">
                  {cell(1)} <span>tamanho real</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="rounded px-1 font-bold"
                    style={{ backgroundColor: info.background, color: info.foreground }}
                  >
                    <DayMark code={code} text={info.mark} symbology={draft} where="legenda" />
                  </span>
                  <span>na legenda</span>
                </div>
              </div>
            </div>
            {issues.length > 0 ? (
              <ul role="alert" className="grid gap-1 text-xs text-destructive">
                {issues.map((i) => (
                  <li key={i.field + i.message}>{i.message}</li>
                ))}
              </ul>
            ) : null}
          </aside>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={!overrides?.[code]}
            onClick={() => onSave(code, null)}
          >
            Restaurar padrão{DEFAULT_SYMBOLOGY[code] ? "" : " (só a sigla)"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={issues.length > 0} onClick={() => onSave(code, draft)}>
              Salvar marcador
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
