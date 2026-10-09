/**
 * CAL.EXT.4 — Modelo visual "Itaperuna Premium — Cinematográfico". Reconstrói a arte de referência com camadas
 * independentes (fotos, ondas vetoriais, logos, textos) e reposiciona os blocos de dados. NÃO contém nenhuma
 * data, tipo, total ou período: tabela, legenda, feriados, períodos, conselhos e assinaturas continuam vindo do
 * calendário interno. Aplicar o modelo só troca a aparência do rascunho; nada é salvo sem o usuário salvar.
 */
import fotoTopo from "@/assets/calendar-premium/foto-topo.jpg.asset.json";
import fotoRodape from "@/assets/calendar-premium/foto-rodape.jpg.asset.json";
import brasao from "@/assets/calendar-premium/brasao.png.asset.json";
import logoPrefeitura from "@/assets/calendar-premium/logo-prefeitura.png.asset.json";
import logoEducacao from "@/assets/calendar-premium/logo-educacao.png.asset.json";
import type { ExternalProfile } from "./calendar-external-model";
import type { BlockBox, BlockStyle, FreeLayout } from "./calendar-external-free";
import type { ImageLayer, Layer, TextLayer, WaveLayer } from "./calendar-external-layers";

export const PREMIUM_NAME = "Itaperuna Premium — Cinematográfico";
const NAVY = "#0A2F63", NAVY2 = "#123F80", GOLD = "#E3B04B", PANEL = "#FFFFFF", GLASS = "#F2F7FD";
const SERIF = "'Playfair Display', Georgia, serif", SANS = "'Montserrat', 'Segoe UI', sans-serif";

const base = { visible: true, locked: false, opacity: 100, rot: 0 };
const img = (id: string, name: string, src: string, x: number, y: number, w: number, h: number, z: number, o: Partial<ImageLayer> = {}): ImageLayer =>
  ({ ...base, id, name, kind: "imagem", src, x, y, w, h, z, fit: "cobrir", fx: 50, fy: 50, zoom: 100, brightness: 100, contrast: 100, saturate: 100, fade: "nenhum", fadeMm: 12, ...o });
const wave = (id: string, name: string, x: number, y: number, w: number, h: number, z: number, o: Partial<WaveLayer> = {}): WaveLayer =>
  ({ ...base, id, name, kind: "onda", x, y, w, h, z, side: "baixo", amp: 40, crest: 50, tilt: 0, fill: NAVY, fill2: null, stroke: null, strokeMm: 0.6, ...o });
const text = (id: string, name: string, t: string, x: number, y: number, w: number, h: number, z: number, o: Partial<TextLayer> = {}): TextLayer =>
  ({ ...base, id, name, kind: "texto", text: t, x, y, w, h, z, font: SANS, pt: 10, bold: false, italic: false, color: "#FFFFFF", accent: GOLD, tracking: 0, align: "centro", shadow: false, lh: 1, ...o });

export function premiumLayers(): Layer[] {
  return [
    img("foto-topo", "Foto do topo (Cristo e pôr do sol)", fotoTopo.url, 0, 0, 285, 66, 1, { fy: 40, fade: "baixo", fadeMm: 10 }),
    img("foto-rodape", "Foto do rodapé (rio e ponte)", fotoRodape.url, 0, 160, 285, 37, 1, { fy: 55, fade: "cima", fadeMm: 14 }),
    wave("onda-brilho", "Curva dourada de fundo", 0, 36, 285, 22, 2, { amp: 55, crest: 62, tilt: 22, fill: GOLD, fill2: "#F6D98A", opacity: 55 }),
    wave("onda-topo", "Onda azul do título", 0, 39, 285, 27, 3, { amp: 55, crest: 58, tilt: 22, fill: NAVY, fill2: NAVY2, stroke: GOLD, strokeMm: 0.8 }),
    wave("faixa-tabela", "Faixa azul atrás da tabela", 0, 64, 285, 74, 2, { amp: 0, fill: NAVY, opacity: 94 }),
    wave("onda-rodape", "Onda azul do rodapé", 0, 176, 285, 21, 3, { amp: 40, crest: 65, tilt: -20, fill: NAVY, fill2: NAVY2, stroke: GOLD, strokeMm: 0.6 }),
    img("brasao", "Brasão de Itaperuna", brasao.url, 6, 5, 22, 22, 12, { fit: "conter" }),
    img("logo-prefeitura", "Logo da Prefeitura", logoPrefeitura.url, 31, 6, 60, 15, 12, { fit: "conter" }),
    text("orgao", "Secretaria / Supervisão", "SECRETARIA MUNICIPAL DE EDUCAÇÃO\nSUPERVISÃO DE ENSINO", 32, 21, 70, 7, 13, { pt: 6.5, bold: true, align: "esquerda", color: NAVY, lh: 1.1 }),
    img("logo-educacao", "Logo da Educação", logoEducacao.url, 222, 6, 57, 18, 12, { fit: "conter" }),
    text("titulo", "Título", "CALENDÁRIO ESCOLAR {ano}", 30, 44, 225, 13, 14, { font: SERIF, pt: 30, bold: true, shadow: true }),
    text("subtitulo", "Subtítulo", "{subtitulo}", 40, 57, 205, 5, 14, { pt: 9, tracking: 0.4, color: "#FFFFFF" }),
  ];
}

const style = (s: BlockStyle, o: Partial<BlockStyle>): BlockStyle => ({ ...s, ...o });
const place = (b: BlockBox, x: number, y: number, w: number, h: number, o: Partial<BlockStyle> = {}, visible = true): BlockBox =>
  ({ ...b, x, y, w, h, z: 10, visible, locked: false, style: style(b.style, o) });

/** Layout dos blocos de dados no modelo premium (mm). Só posição/estilo; o conteúdo é do calendário interno. */
export function premiumLayout(d: FreeLayout): FreeLayout {
  const B = d.blocks; const panel = { fill: true, bg: GLASS, radiusMm: 3, borderMm: 0, borderColor: null, padMm: 2.2 } as const;
  return {
    ...d, allowOverlap: false,
    blocks: {
      cabecalho: place(B.cabecalho, 0, 0, 30, 10, {}, false),
      matriz: place(B.matriz, 5, 65, 275, 72, { fill: true, bg: PANEL, radiusMm: 1, borderMm: 0.3, borderColor: NAVY, padMm: 0.6 }),
      legenda: place(B.legenda, 5, 140, 92, 39, { ...panel, pt: 6.5, titlePt: 8.5, cols: 1 }),
      feriados: place(B.feriados, 99, 140, 90, 39, { ...panel, pt: 6.2, titlePt: 8.5, cols: 1 }),
      periodos: place(B.periodos, 191, 140, 89, 39, { ...panel, pt: 6.8, titlePt: 8.5, orientation: "lista" }),
      conselhos: place(B.conselhos, 191, 160, 89, 19, { ...panel, pt: 6.2, titlePt: 7.5, cols: 1 }, false),
      assinaturas: place(B.assinaturas, 10, 184, 265, 12, { fill: false, color: "#FFFFFF", pt: 6.5, titlePt: 6, align: "centro" }),
      rodape: place(B.rodape, 0, 190, 20, 7, {}, false),
    },
    photo: { ...d.photo, top: null, bottom: null, useDefaultTop: false, topHmm: 0, bottomHmm: 0, veilStrength: 0, page: null },
    // Folha A4: 7/7.5/6.3 pt equivalem a ~10/10.6/9 pt em A3 (mesma diagramação em mm, razão 1,41).
    table: { ...d.table, mode: "ajustar", headPt: 7, monthPt: 7.5, dayPt: 6.3, monthColMm: 19, totalColMm: 15, dividerMm: 0.15 },
    layers: premiumLayers(),
  };
}

/** Aplica o modelo ao rascunho: camadas + blocos + paleta. Logos/textos institucionais herdados permanecem. */
export function applyPremium(p: ExternalProfile): ExternalProfile {
  return { ...p, free: premiumLayout(p.free), headerColor: NAVY, primary: NAVY, secondary: NAVY2, accent: GOLD, borderColor: "#C9D6E8", titleFont: SERIF,
    subtitle: p.subtitle ?? null };
}
