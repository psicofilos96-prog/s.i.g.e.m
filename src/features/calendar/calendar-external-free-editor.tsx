import { importTooLarge, IMPORT_TOO_LARGE_TEXT } from "@/features/data-import/import-kernel";
import { validateImage } from "./calendar-external-sections";
import { shrinkImage } from "./calendar-image-shrink";
/**
 * CAL.EXT.3 — Editor do layout livre (modelos Fotográfico e Quadro anual): blocos em mm, tipografia por bloco,
 * dimensionamento da tabela, fotos, encaixe na grade, JSON exportar/importar. Só aparência.
 */
import { LayersSection } from "./calendar-external-layers-editor";
import { applyPremium, PREMIUM_NAME } from "./calendar-external-premium";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ASSET_MAX_CHARS, FONT_OPTIONS, type ExternalProfile } from "./calendar-external-model";
import {
  FREE_BLOCKS, FREE_BLOCK_LABEL, LIMITS, MAX_STICKERS, layoutIssues, moveFreeBlock, moveSticker, sanitizeFree,
  type BlockStyle, type FreeBlockId, type FreeLayout, type ImgAdjust, type Sticker, type TableCfg, type PhotoCfg,
} from "./calendar-external-free";

const field = "w-full rounded-md border border-input bg-background px-2 py-1 text-xs";
function Num({ label, value, min, max, step = 0.5, unit, onChange, disabled }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="block text-xs">{label}{unit ? ` (${unit})` : ""}
      <input type="number" className={field} value={value} min={min} max={max} step={step} disabled={disabled}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}
function Color({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return <label className="block text-xs">{label}<span className="flex items-center gap-1"><input type="color" className="h-7 w-full" value={value ?? "#000000"} onChange={(e) => onChange(e.target.value)} />
    {value && <button type="button" className="text-xs underline" onClick={() => onChange(null)}>padrão</button>}</span></label>;
}
function Section({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return <details open={open} className="rounded-md border border-border bg-card"><summary className="cursor-pointer px-3 py-2 text-sm font-medium">{title}</summary><div className="space-y-2 border-t border-border px-3 py-3">{children}</div></details>;
}

export function FreeLayoutEditor({ profile, onChange, selected, onSelect, defaults, canUndo, canRedo, onUndo, onRedo, selectedLayer = null, onSelectLayer = () => {} }: {
  selectedLayer?: string | null; onSelectLayer?: (id: string | null) => void;
  profile: ExternalProfile; onChange: (p: ExternalProfile) => void; selected: FreeBlockId | null; onSelect: (b: FreeBlockId | null) => void;
  defaults: FreeLayout; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void;
}) {
  const f = profile.free;
  const [msg, setMsg] = useState<string | null>(null);
  const setF = (next: FreeLayout) => onChange({ ...profile, free: next });
  const sel = selected ? f.blocks[selected] : null;
  const setBlock = (patch: Partial<{ visible: boolean; locked: boolean; z: number }>) => selected && setF({ ...f, blocks: { ...f.blocks, [selected]: { ...f.blocks[selected], ...patch } } });
  const setStyle = (patch: Partial<BlockStyle>) => selected && setF({ ...f, blocks: { ...f.blocks, [selected]: { ...f.blocks[selected], style: { ...f.blocks[selected].style, ...patch } } } });
  const setTable = (patch: Partial<TableCfg>) => setF({ ...f, table: { ...f.table, ...patch } });
  const setPhoto = (patch: Partial<PhotoCfg>) => setF({ ...f, photo: { ...f.photo, ...patch } });
  const issues = layoutIssues(f);
  const readImg = (e: ChangeEvent<HTMLInputElement>, done: (u: string) => void) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setMsg("Use PNG, JPEG ou WEBP."); return; }
    // CAL.EXT.3.1: confere a assinatura real do arquivo antes de aceitar.
    void file.arrayBuffer().then(async (buf) => { const v = validateImage(file.type, new Uint8Array(buf), { ignoreSize: true }); if ("error" in v) { setMsg(v.error); return; }
      try { const u = await shrinkImage(file); if (u.length > ASSET_MAX_CHARS) setMsg("Não foi possível reduzir a imagem."); else { setMsg(null); done(u); } }
      catch (err) { setMsg("Não foi possível usar esta imagem. Use uma foto PNG, JPEG ou WEBP."); } });
  };
  const pickPhoto = (k: "top" | "bottom" | "page") => (e: ChangeEvent<HTMLInputElement>) => readImg(e, (u) => setPhoto({ [k]: u }));
  const [selSticker, setSelSticker] = useState<string | null>(null);
  const st = f.stickers.find((s) => s.id === selSticker) ?? null;
  const setSticker = (patch: Partial<Sticker>) => st && setF({ ...f, stickers: f.stickers.map((s) => (s.id === st.id ? { ...s, ...patch } : s)) });
  const addSticker = (e: ChangeEvent<HTMLInputElement>) => readImg(e, (u) => {
    if (f.stickers.length >= MAX_STICKERS) { setMsg(`Limite de ${MAX_STICKERS} imagens avulsas.`); return; }
    const id = `img-${Date.now().toString(36)}`;
    setF({ ...f, stickers: [...f.stickers, { id, src: u, x: 10, y: 10, w: 25, h: 25, rot: 0, opacity: 100, z: 5, front: true, locked: false }] }); setSelSticker(id);
  });
  const adjFields = (k: "topAdj" | "bottomAdj" | "pageAdj", label: string) => { const a = f.photo[k]; const set = (patch: Partial<ImgAdjust>) => setPhoto({ [k]: { ...a, ...patch } } as Partial<PhotoCfg>);
    return <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-2"><p className="col-span-2 text-xs font-medium">Ajuste — {label}</p>
      <Num label="Foco horizontal" unit="%" value={a.fx} min={0} max={100} step={1} onChange={(v) => set({ fx: v })} />
      <Num label="Foco vertical" unit="%" value={a.fy} min={0} max={100} step={1} onChange={(v) => set({ fy: v })} />
      <Num label="Zoom" unit="%" value={a.zoom} min={100} max={400} step={5} onChange={(v) => set({ zoom: v })} />
      <Num label="Opacidade" unit="%" value={a.opacity} min={0} max={100} step={5} onChange={(v) => set({ opacity: v })} /></div>; };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ formato: "sigem-calendario-layout/1", free: { ...f, photo: { ...f.photo, top: null, bottom: null, page: null }, stickers: [], layers: f.layers.filter((l) => !(l.kind === "imagem" && l.src.startsWith("data:"))) } }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "layout-calendario.json"; a.click(); URL.revokeObjectURL(a.href);
  };
  const importJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (importTooLarge(file)) { setMsg(IMPORT_TOO_LARGE_TEXT); return; }
    void file.text().then((txt) => {
      try { const j = JSON.parse(txt) as { formato?: string; free?: unknown };
        if (j.formato !== "sigem-calendario-layout/1") { setMsg("Arquivo não é um layout de calendário do SIGEM."); return; }
        setF({ ...sanitizeFree(j.free, defaults, FONT_OPTIONS, ASSET_MAX_CHARS), photo: { ...sanitizeFree(j.free, defaults, FONT_OPTIONS, ASSET_MAX_CHARS).photo, top: f.photo.top, bottom: f.photo.bottom, page: f.photo.page }, stickers: f.stickers });
        setMsg("Layout importado. Confira a prévia e salve.");
      } catch { setMsg("Arquivo de layout ilegível."); }
    });
  };
  return (
    <section className="space-y-2" aria-label="Layout livre">
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <h3 className="text-sm font-semibold">Layout livre</h3>
        <p className="text-xs text-muted-foreground">Clique num bloco da prévia para selecioná-lo; arraste para mover e use o quadradinho do canto para mudar o tamanho. Setas movem 1 mm (Shift: 5 mm).</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" disabled={!canUndo} onClick={onUndo}>Desfazer</Button>
          <Button type="button" size="sm" variant="outline" disabled={!canRedo} onClick={onRedo}>Refazer</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setF(defaults)}>Restaurar layout padrão</Button>
          <Button type="button" size="sm" onClick={() => { onChange(applyPremium(profile)); setMsg(`Modelo “${PREMIUM_NAME}” aplicado ao rascunho. Datas e totais continuam vindo do calendário interno. Confira e salve.`); }}>Aplicar modelo Itaperuna Premium</Button>
          <Button type="button" size="sm" variant="outline" onClick={exportJson}>Exportar layout</Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-2 text-xs">Importar layout<input type="file" accept="application/json" className="sr-only" onChange={importJson} /></label>
        </div>
      </div>
      {msg && <p role="status" className="text-xs">{msg}</p>}
      {(issues.overlaps.length > 0 || issues.tableOverflow) && <div role="alert" className="text-xs text-destructive">
        {issues.overlaps.map(([a, b]) => <p key={a + b}>{FREE_BLOCK_LABEL[a]} está sobre {FREE_BLOCK_LABEL[b]}.</p>)}
        {issues.tableOverflow && <p>A tabela, com o tamanho de célula escolhido, não cabe no bloco. Aumente o bloco, diminua as células ou use “Ajustar ao bloco”.</p>}
      </div>}

      <Section title="Blocos" open>
        <div role="listbox" aria-label="Blocos" className="grid gap-1 sm:grid-cols-2">
          {FREE_BLOCKS.map((id) => (
            <button key={id} type="button" role="option" aria-selected={selected === id} onClick={() => onSelect(id)}
              className={`rounded-md border px-2 py-1 text-left text-xs ${selected === id ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"} ${f.blocks[id].visible ? "" : "line-through opacity-70"}`}>
              {FREE_BLOCK_LABEL[id]}{f.blocks[id].locked ? " (travado)" : ""}
            </button>))}
        </div>
        {selected && sel && <div className="space-y-2 rounded-md border border-border p-2">
          <p className="text-xs font-medium">{FREE_BLOCK_LABEL[selected]}</p>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Esquerda" unit="mm" value={sel.x} min={0} max={285} disabled={sel.locked} onChange={(v) => setF(moveFreeBlock(f, selected, { x: v }))} />
            <Num label="Topo" unit="mm" value={sel.y} min={0} max={197} disabled={sel.locked} onChange={(v) => setF(moveFreeBlock(f, selected, { y: v }))} />
            <Num label="Largura" unit="mm" value={sel.w} min={4} max={285} disabled={sel.locked} onChange={(v) => setF(moveFreeBlock(f, selected, { w: v }))} />
            <Num label="Altura" unit="mm" value={sel.h} min={4} max={197} disabled={sel.locked} onChange={(v) => setF(moveFreeBlock(f, selected, { h: v }))} />
            <Num label="Camada (z)" value={sel.z} min={0} max={50} step={1} onChange={(v) => setBlock({ z: Math.round(v) })} />
            <Num label="Espaço interno" unit="mm" value={sel.style.padMm} min={LIMITS.padMm[0]} max={LIMITS.padMm[1]} step={0.1} onChange={(v) => setStyle({ padMm: v })} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={sel.visible} onChange={(e) => setBlock({ visible: e.target.checked })} />Visível</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sel.locked} onChange={(e) => setBlock({ locked: e.target.checked })} />Travado</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sel.style.fill} onChange={(e) => setStyle({ fill: e.target.checked })} />Com fundo e borda</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sel.style.bold} onChange={(e) => setStyle({ bold: e.target.checked })} />Negrito</label>
          </div>
          <p className="text-xs font-medium">Tipografia do bloco</p>
          <label className="block text-xs">Fonte<select className={field} value={sel.style.font ?? ""} onChange={(e) => setStyle({ font: e.target.value || null })}>
            <option value="">Fonte dos textos do modelo</option>{FONT_OPTIONS.map((x) => <option key={x} value={x}>{x.split(",")[0]!.replace(/'/g, "")}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Tamanho do texto" unit="pt" value={sel.style.pt} min={LIMITS.pt[0]} max={LIMITS.pt[1]} onChange={(v) => setStyle({ pt: v })} />
            <Num label={selected === "cabecalho" ? "Tamanho do título" : "Tamanho do título do bloco"} unit="pt" value={sel.style.titlePt} min={LIMITS.titlePt[0]} max={LIMITS.titlePt[1]} onChange={(v) => setStyle({ titlePt: v })} />
            <Num label="Entrelinha" unit="×" value={sel.style.lh} min={LIMITS.lh[0]} max={LIMITS.lh[1]} step={0.05} onChange={(v) => setStyle({ lh: v })} />
            {(selected === "legenda" || selected === "feriados" || selected === "conselhos") && <Num label="Colunas" value={sel.style.cols} min={1} max={4} step={1} onChange={(v) => setStyle({ cols: Math.round(v) })} />}
          </div>
          <label className="block text-xs">Alinhamento<select className={field} value={sel.style.align} onChange={(e) => setStyle({ align: e.target.value as BlockStyle["align"] })}>
            <option value="esquerda">À esquerda</option><option value="centro">Centralizado</option><option value="direita">À direita</option></select></label>
          {selected === "periodos" && <label className="block text-xs">Cartões dos períodos<select className={field} value={sel.style.orientation} onChange={(e) => setStyle({ orientation: e.target.value as BlockStyle["orientation"] })}>
            <option value="vertical">Empilhados (um abaixo do outro)</option><option value="horizontal">Lado a lado</option></select></label>}
          <div className="grid grid-cols-2 gap-2">
            <Num label="Espaço entre letras" unit="em" value={sel.style.tracking} min={LIMITS.tracking[0]} max={LIMITS.tracking[1]} step={0.01} onChange={(v) => setStyle({ tracking: v })} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={sel.style.italic} onChange={(e) => setStyle({ italic: e.target.checked })} />Itálico</label>
            <Color label="Cor do texto" value={sel.style.color} onChange={(v) => setStyle({ color: v })} />
            <Color label="Cor de fundo" value={sel.style.bg} onChange={(v) => setStyle({ bg: v })} />
            {sel.style.fill && <><Num label="Espessura da borda" unit="mm" value={sel.style.borderMm} min={0} max={2} step={0.05} onChange={(v) => setStyle({ borderMm: v })} />
              <Num label="Arredondamento" unit="mm" value={sel.style.radiusMm} min={0} max={10} step={0.5} onChange={(v) => setStyle({ radiusMm: v })} />
              <Color label="Cor da borda" value={sel.style.borderColor} onChange={(v) => setStyle({ borderColor: v })} /></>}
          </div>
        </div>}
      </Section>

      <LayersSection f={f} setF={setF} selected={selectedLayer} onSelect={onSelectLayer} readImg={readImg} />

      <Section title="Tabela do calendário">
        <label className="block text-xs">Dimensionamento<select className={field} value={f.table.mode} onChange={(e) => setTable({ mode: e.target.value as TableCfg["mode"] })}>
          <option value="ajustar">Ajustar ao bloco (células crescem e diminuem com o bloco)</option><option value="manual">Tamanho manual das células</option></select></label>
        <div className="grid grid-cols-2 gap-2">
          {f.table.mode === "manual" && <><Num label="Largura da célula" unit="mm" value={f.table.cellWmm} min={LIMITS.cellWmm[0]} max={LIMITS.cellWmm[1]} step={0.1} onChange={(v) => setTable({ cellWmm: v })} />
            <Num label="Altura da célula" unit="mm" value={f.table.cellHmm} min={LIMITS.cellHmm[0]} max={LIMITS.cellHmm[1]} step={0.1} onChange={(v) => setTable({ cellHmm: v })} /></>}
          <Num label="Coluna dos meses" unit="mm" value={f.table.monthColMm} min={LIMITS.monthColMm[0]} max={LIMITS.monthColMm[1]} onChange={(v) => setTable({ monthColMm: v })} />
          <Num label="Coluna de totais" unit="mm" value={f.table.totalColMm} min={LIMITS.totalColMm[0]} max={LIMITS.totalColMm[1]} onChange={(v) => setTable({ totalColMm: v })} />
          <Num label="Letra do cabeçalho" unit="pt" value={f.table.headPt} min={LIMITS.headPt[0]} max={LIMITS.headPt[1]} onChange={(v) => setTable({ headPt: v })} />
          <Num label="Letra dos dias" unit="pt" value={f.table.dayPt} min={LIMITS.dayPt[0]} max={LIMITS.dayPt[1]} onChange={(v) => setTable({ dayPt: v })} />
          <Num label="Letra dos meses" unit="pt" value={f.table.monthPt} min={LIMITS.monthPt[0]} max={LIMITS.monthPt[1]} onChange={(v) => setTable({ monthPt: v })} />
          <Num label="Divisórias" unit="mm" value={f.table.dividerMm} min={0} max={1} step={0.05} onChange={(v) => setTable({ dividerMm: v })} />
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.table.showDayNumbers} onChange={(e) => setTable({ showDayNumbers: e.target.checked })} />Mostrar o número do dia em vez da sigla</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={profile.show.totaisMensais} onChange={(e) => onChange({ ...profile, show: { ...profile.show, totaisMensais: e.target.checked } })} />Coluna de total do mês</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={profile.show.totaisColuna} onChange={(e) => onChange({ ...profile, show: { ...profile.show, totaisColuna: e.target.checked } })} />Linha de totais por dia</label>
      </Section>

      <Section title="Fotos e véu">
        <label className="block text-xs">Foto do topo<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto("top")} /></label>
        {f.photo.top && <Button type="button" size="sm" variant="outline" onClick={() => setPhoto({ top: null })}>Remover foto do topo</Button>}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.photo.useDefaultTop} onChange={(e) => setPhoto({ useDefaultTop: e.target.checked })} />Usar a foto institucional da cidade quando não houver foto própria</label>
        <label className="block text-xs">Foto do rodapé<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto("bottom")} /></label>
        {f.photo.bottom && <Button type="button" size="sm" variant="outline" onClick={() => setPhoto({ bottom: null })}>Remover foto do rodapé</Button>}
        <div className="grid grid-cols-2 gap-2">
          <Num label="Altura da foto do topo" unit="mm" value={f.photo.topHmm} min={0} max={110} step={1} onChange={(v) => setPhoto({ topHmm: v })} />
          <Num label="Altura da foto do rodapé" unit="mm" value={f.photo.bottomHmm} min={0} max={90} step={1} onChange={(v) => setPhoto({ bottomHmm: v })} />
          <Num label="Força do véu" unit="%" value={f.photo.veilStrength} min={0} max={100} step={5} onChange={(v) => setPhoto({ veilStrength: v })} />
          <label className="block text-xs">Cor do véu<input type="color" className="block h-7 w-full" value={f.photo.veil} onChange={(e) => setPhoto({ veil: e.target.value })} /></label>
        </div>
        {(f.photo.top || f.photo.useDefaultTop) && adjFields("topAdj", "foto do topo")}
        {f.photo.bottom && adjFields("bottomAdj", "foto do rodapé")}
      </Section>

      <Section title="Imagens avulsas (PNG, selos, ícones)">
        <p className="text-xs text-muted-foreground">Ficam por cima ou por baixo da folha, sem mudar a tabela nem os dados. Arraste na prévia para mover; o quadradinho do canto muda o tamanho.</p>
        <label className="block text-xs">Adicionar imagem<input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={addSticker} /></label>
        {f.stickers.length > 0 && <div className="flex flex-wrap gap-1">{f.stickers.map((s, i) => (
          <button key={s.id} type="button" onClick={() => setSelSticker(s.id)} aria-pressed={selSticker === s.id}
            className={`rounded-md border px-2 py-1 text-xs ${selSticker === s.id ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>Imagem {i + 1}</button>))}</div>}
        {st && <div className="space-y-2 rounded-md border border-border p-2">
          <div className="grid grid-cols-2 gap-2">
            <Num label="Esquerda" unit="mm" value={st.x} min={0} max={285} disabled={st.locked} onChange={(v) => setF(moveSticker(f, st.id, { x: v }))} />
            <Num label="Topo" unit="mm" value={st.y} min={0} max={197} disabled={st.locked} onChange={(v) => setF(moveSticker(f, st.id, { y: v }))} />
            <Num label="Largura" unit="mm" value={st.w} min={4} max={285} disabled={st.locked} onChange={(v) => setF(moveSticker(f, st.id, { w: v }))} />
            <Num label="Altura" unit="mm" value={st.h} min={4} max={197} disabled={st.locked} onChange={(v) => setF(moveSticker(f, st.id, { h: v }))} />
            <Num label="Rotação" unit="°" value={st.rot} min={-180} max={180} step={1} onChange={(v) => setSticker({ rot: v })} />
            <Num label="Opacidade" unit="%" value={st.opacity} min={0} max={100} step={5} onChange={(v) => setSticker({ opacity: v })} />
            <Num label="Camada (z)" value={st.z} min={0} max={50} step={1} onChange={(v) => setSticker({ z: Math.round(v) })} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={st.front} onChange={(e) => setSticker({ front: e.target.checked })} />Por cima dos blocos</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={st.locked} onChange={(e) => setSticker({ locked: e.target.checked })} />Travada</label>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => { setF({ ...f, stickers: f.stickers.filter((s) => s.id !== st.id) }); setSelSticker(null); }}>Remover imagem</Button>
        </div>}
      </Section>

      <Section title="Grade e encaixe">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.snap} onChange={(e) => setF({ ...f, snap: e.target.checked })} />Encaixar na grade</label>
        <Num label="Passo da grade" unit="mm" value={f.stepMm} min={0.5} max={10} onChange={(v) => setF({ ...f, stepMm: v })} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.allowOverlap} onChange={(e) => setF({ ...f, allowOverlap: e.target.checked })} />Permitir blocos sobrepostos</label>
      </Section>
    </section>
  );
}
