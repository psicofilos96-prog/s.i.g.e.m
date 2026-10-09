/**
 * CAL.EXT.4 — Painel "Camadas": lista, ordem, visibilidade, trava, duplicar/remover e inspetor por tipo
 * (imagem, onda vetorial, texto). Só aparência; textos aceitam apenas {ano}, {titulo} e {subtitulo}.
 */
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { FONT_OPTIONS } from "./calendar-external-model";
import type { FreeLayout } from "./calendar-external-free";
import { LAYER_KIND_LABEL, MAX_LAYERS, duplicateLayer, moveLayer, reorderLayer, type Layer } from "./calendar-external-layers";

const field = "w-full rounded-md border border-input bg-background px-2 py-1 text-xs";
function N({ label, value, min, max, step = 1, onChange, disabled }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return <label className="block text-xs">{label}<input type="number" className={field} value={Math.round(value * 100) / 100} min={min} max={max} step={step} disabled={disabled}
    onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); }} /></label>;
}
function C({ label, value, onChange, allowNone }: { label: string; value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  return <label className="block text-xs">{label}<span className="flex items-center gap-1"><input type="color" className="h-7 w-full" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} />
    {allowNone && value && <button type="button" className="text-xs underline" onClick={() => onChange(null)}>nenhuma</button>}</span></label>;
}

export function LayersSection({ f, setF, selected, onSelect, readImg }: {
  f: FreeLayout; setF: (f: FreeLayout) => void; selected: string | null; onSelect: (id: string | null) => void;
  readImg: (e: ChangeEvent<HTMLInputElement>, done: (u: string) => void) => void;
}) {
  const layers = [...f.layers].sort((a, b) => b.z - a.z);
  const l = f.layers.find((x) => x.id === selected) ?? null;
  const set = (patch: Partial<Layer>) => l && setF({ ...f, layers: f.layers.map((x) => (x.id === l.id ? ({ ...x, ...patch } as Layer) : x)) });
  const pos = (patch: { x?: number; y?: number; w?: number; h?: number }) => l && setF({ ...f, layers: moveLayer(f.layers, l.id, patch, { snap: false, stepMm: f.stepMm, guides: false }) });
  const add = (layer: Layer) => { if (f.layers.length >= MAX_LAYERS) return; setF({ ...f, layers: [...f.layers, layer] }); onSelect(layer.id); };
  const nid = (k: string) => `${k}-${Date.now().toString(36)}`;
  const common = { visible: true, locked: false, opacity: 100, rot: 0 };
  return (
    <details open className="rounded-md border border-border bg-card">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Camadas (fotos, logos, ondas e textos)</summary>
      <div className="space-y-2 border-t border-border px-3 py-3">
        <p className="text-xs text-muted-foreground">Cada camada é independente: arraste na prévia, mude tamanho, cor e ordem sem mexer nos dados. Datas, totais e feriados vêm sempre do calendário interno.</p>
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => add({ ...common, id: nid("texto"), name: "Novo texto", kind: "texto", text: "Texto", x: 100, y: 20, w: 80, h: 10, z: 14, font: null, pt: 12, bold: false, italic: false, color: "#FFFFFF", accent: "#E3B04B", tracking: 0, align: "centro", shadow: false, lh: 1 })}>+ Texto</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => add({ ...common, id: nid("onda"), name: "Nova onda", kind: "onda", x: 0, y: 150, w: 285, h: 20, z: 3, side: "baixo", amp: 40, crest: 50, tilt: 0, fill: "#0A2F63", fill2: null, stroke: "#E3B04B", strokeMm: 0.6 })}>+ Onda</Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-2 text-xs">+ Imagem<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
            onChange={(e) => readImg(e, (u) => add({ ...common, id: nid("img"), name: "Nova imagem", kind: "imagem", src: u, x: 20, y: 20, w: 40, h: 30, z: 12, fit: "conter", fx: 50, fy: 50, zoom: 100, brightness: 100, contrast: 100, saturate: 100, fade: "nenhum", fadeMm: 12 }))} /></label>
        </div>
        {layers.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma camada. Use “Aplicar modelo Itaperuna Premium” ou adicione acima.</p> :
          <ul className="space-y-1" aria-label="Camadas">{layers.map((x) => (
            <li key={x.id} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${selected === x.id ? "border-primary bg-primary/10" : "border-input"}`}>
              <button type="button" className={`min-w-0 flex-1 truncate text-left ${x.visible ? "" : "line-through opacity-60"}`} onClick={() => onSelect(x.id)} aria-pressed={selected === x.id}>
                {x.name} <span className="text-muted-foreground">· {LAYER_KIND_LABEL[x.kind]}{x.locked ? " · travada" : ""}</span></button>
              <button type="button" title="Trazer para frente" aria-label={`Trazer ${x.name} para frente`} onClick={() => setF({ ...f, layers: reorderLayer(f.layers, x.id, "frente") })}>▲</button>
              <button type="button" title="Enviar para trás" aria-label={`Enviar ${x.name} para trás`} onClick={() => setF({ ...f, layers: reorderLayer(f.layers, x.id, "tras") })}>▼</button>
            </li>))}</ul>}
        {l && <div className="space-y-2 rounded-md border border-border p-2">
          <label className="block text-xs">Nome da camada<input className={field} value={l.name} onChange={(e) => set({ name: e.target.value.slice(0, 60) })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <N label="Esquerda (mm)" value={l.x} min={0} max={285} step={0.5} disabled={l.locked} onChange={(v) => pos({ x: v })} />
            <N label="Topo (mm)" value={l.y} min={0} max={197} step={0.5} disabled={l.locked} onChange={(v) => pos({ y: v })} />
            <N label="Largura (mm)" value={l.w} min={4} max={285} step={0.5} disabled={l.locked} onChange={(v) => pos({ w: v })} />
            <N label="Altura (mm)" value={l.h} min={4} max={197} step={0.5} disabled={l.locked} onChange={(v) => pos({ h: v })} />
            <N label="Camada (z)" value={l.z} min={0} max={60} onChange={(v) => set({ z: Math.round(v) })} />
            <N label="Opacidade (%)" value={l.opacity} min={0} max={100} step={5} onChange={(v) => set({ opacity: v })} />
            <N label="Rotação (°)" value={l.rot} min={-180} max={180} onChange={(v) => set({ rot: v })} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={l.visible} onChange={(e) => set({ visible: e.target.checked })} />Visível</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={l.locked} onChange={(e) => set({ locked: e.target.checked })} />Travada</label>
          </div>
          {l.kind === "texto" && <>
            <label className="block text-xs">Texto (use {"{ano}"}, {"{titulo}"} ou {"{subtitulo}"} para puxar do calendário)<input className={field} value={l.text} onChange={(e) => set({ text: e.target.value.slice(0, 200) })} /></label>
            <label className="block text-xs">Fonte<select className={field} value={l.font ?? ""} onChange={(e) => set({ font: e.target.value || null })}>
              <option value="">Fonte do modelo</option>{FONT_OPTIONS.map((x) => <option key={x} value={x}>{x.split(",")[0]!.replace(/'/g, "")}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2">
              <N label="Tamanho (pt)" value={l.pt} min={3} max={90} step={0.5} onChange={(v) => set({ pt: v })} />
              <N label="Espaço entre letras (em)" value={l.tracking} min={-0.1} max={1} step={0.01} onChange={(v) => set({ tracking: v })} />
              <C label="Cor" value={l.color} onChange={(v) => v && set({ color: v })} />
              <C label="Cor do ano" value={l.accent} onChange={(v) => v && set({ accent: v })} />
            </div>
            <label className="block text-xs">Alinhamento<select className={field} value={l.align} onChange={(e) => set({ align: e.target.value as "esquerda" | "centro" | "direita" })}>
              <option value="esquerda">À esquerda</option><option value="centro">Centralizado</option><option value="direita">À direita</option></select></label>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={l.bold} onChange={(e) => set({ bold: e.target.checked })} />Negrito</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={l.italic} onChange={(e) => set({ italic: e.target.checked })} />Itálico</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={l.shadow} onChange={(e) => set({ shadow: e.target.checked })} />Sombra</label>
            </div>
          </>}
          {l.kind === "onda" && <div className="grid grid-cols-2 gap-2">
            <N label="Altura da curva (%)" value={l.amp} min={0} max={100} onChange={(v) => set({ amp: v })} />
            <N label="Posição da crista (%)" value={l.crest} min={0} max={100} onChange={(v) => set({ crest: v })} />
            <N label="Inclinação (%)" value={l.tilt} min={-100} max={100} onChange={(v) => set({ tilt: v })} />
            <N label="Contorno (mm)" value={l.strokeMm} min={0} max={3} step={0.1} onChange={(v) => set({ strokeMm: v })} />
            <C label="Cor" value={l.fill} onChange={(v) => v && set({ fill: v })} />
            <C label="Cor final (degradê)" value={l.fill2} allowNone onChange={(v) => set({ fill2: v })} />
            <C label="Cor do contorno" value={l.stroke} allowNone onChange={(v) => set({ stroke: v })} />
            <label className="block text-xs">Preenche<select className={field} value={l.side} onChange={(e) => set({ side: e.target.value as "baixo" | "cima" })}>
              <option value="baixo">Abaixo da curva</option><option value="cima">Acima da curva</option></select></label>
          </div>}
          {l.kind === "imagem" && <>
            <label className="block text-xs">Trocar imagem<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => readImg(e, (u) => set({ src: u }))} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">Encaixe<select className={field} value={l.fit} onChange={(e) => set({ fit: e.target.value as "cobrir" | "conter" })}>
                <option value="cobrir">Cobrir a área</option><option value="conter">Mostrar inteira</option></select></label>
              <N label="Zoom (%)" value={l.zoom} min={100} max={400} step={5} onChange={(v) => set({ zoom: v })} />
              <N label="Foco horizontal (%)" value={l.fx} min={0} max={100} onChange={(v) => set({ fx: v })} />
              <N label="Foco vertical (%)" value={l.fy} min={0} max={100} onChange={(v) => set({ fy: v })} />
              <N label="Brilho (%)" value={l.brightness} min={30} max={170} step={5} onChange={(v) => set({ brightness: v })} />
              <N label="Contraste (%)" value={l.contrast} min={30} max={170} step={5} onChange={(v) => set({ contrast: v })} />
              <N label="Saturação (%)" value={l.saturate} min={0} max={200} step={5} onChange={(v) => set({ saturate: v })} />
              <N label="Esmaecer (mm)" value={l.fadeMm} min={0} max={80} onChange={(v) => set({ fadeMm: v })} />
            </div>
            <label className="block text-xs">Borda esmaecida<select className={field} value={l.fade} onChange={(e) => set({ fade: e.target.value as "nenhum" | "baixo" | "cima" | "ambos" })}>
              <option value="nenhum">Nenhuma</option><option value="baixo">Embaixo</option><option value="cima">Em cima</option><option value="ambos">Em cima e embaixo</option></select></label>
          </>}
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setF({ ...f, layers: duplicateLayer(f.layers, l.id) })}>Duplicar</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setF({ ...f, layers: f.layers.filter((x) => x.id !== l.id) }); onSelect(null); }}>Remover camada</Button>
          </div>
        </div>}
      </div>
    </details>
  );
}
