/**
 * Ficha de Matrícula — modelo geométrico único (mm, A4 retrato). Os desenhadores SVG (pré-visualização e
 * impressão) e PDF (jsPDF) só traduzem estas primitivas; quebra de linha e paginação são decididas aqui,
 * com a mesma métrica de fonte, para que as três saídas coincidam. Nada é cortado: o que não cabe passa
 * inteiro para uma página de continuação.
 */
import { DOCUMENTS, SAEB, SPECIAL_ED, SPECIAL_ED_LEGEND, type EnrollmentFormData, type FormOptions, type PersonBlock, type Yn } from "./model";

export type ImgKey = "brasao" | "sigem" | "photo";
export type Prim =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; r?: number; dash?: boolean }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; lw: number; dash?: boolean }
  | { k: "text"; x: number; y: number; s: string; size: number; bold?: boolean; color: string; align?: "left" | "center" | "right" }
  | { k: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; lw?: number }
  | { k: "poly"; pts: [number, number][]; fill?: string; stroke?: string; lw?: number; closed?: boolean }
  | { k: "image"; x: number; y: number; w: number; h: number; img: ImgKey };
export type Page = { prims: Prim[] };
export type Layout = { pages: Page[] };
/** Largura em mm do texto em Helvetica/Arial no tamanho (pt) dado. */
export type Measure = (s: string, sizePt: number, bold: boolean) => number;

export const PAGE = { w: 210, h: 297, m: 12 } as const;
export const CW = PAGE.w - 2 * PAGE.m;
/** Último y útil do conteúdo (o rodapé vive entre BOTTOM e a margem inferior). */
export const BOTTOM = 276;
export const C = { blue: "#164780", navy: "#10386B", band: "#D9EAF8", panel: "#F2F7FC", border: "#B9D1E5", text: "#172B45", label: "#33475F", white: "#FFFFFF" } as const;
const PT = 0.3528; // mm por ponto
const LBL = 7.8, VAL = 8.8;

type Block = { h: number; draw: (y: number) => Prim[] };
type Section = { n: number | null; title: string; icon: Icon; blocks: Block[] };
type Icon = "person" | "group" | "doc" | "heart" | "image" | "book" | "check" | "refresh" | "special";

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

export function wrap(text: string, maxW: number, size: number, bold: boolean, measure: Measure): string[] {
  const t = clean(text);
  if (!t) return [""];
  const out: string[] = [];
  let cur = "";
  const push = (w: string) => {
    // palavra maior que a linha: parte por caracteres, sem perder nada
    let rest = w;
    while (measure(rest, size, bold) > maxW) {
      let i = rest.length - 1;
      while (i > 1 && measure(rest.slice(0, i), size, bold) > maxW) i--;
      out.push(rest.slice(0, i)); rest = rest.slice(i);
    }
    return rest;
  };
  for (const word of t.split(" ")) {
    const cand = cur ? `${cur} ${word}` : word;
    if (measure(cand, size, bold) <= maxW) { cur = cand; continue; }
    if (cur) out.push(cur);
    cur = push(word);
  }
  if (cur) out.push(cur);
  return out;
}

export function layoutEnrollmentForm(data: EnrollmentFormData, opt: FormOptions, measure: Measure, hasPhoto = false): Layout {
  const blank = opt.mode === "branco";
  const d: EnrollmentFormData = blank ? { header: data.header, yearLabel: data.yearLabel ?? null, student: {} } : data;
  const RH = blank ? 6.6 : 5.4; // altura da linha de campo (branco = espaço para escrever à mão)
  const IX = PAGE.m + 3, IW = CW - 6; // área interna das seções
  const v = (s: string | null | undefined) => (blank ? "" : clean(s));

  // ---------- campos ----------
  type F = { label: string; w: number; value?: string | null; choice?: { options: string[]; selected?: string | null } };
  const text = (label: string, w: number, value?: string | null): F => ({ label, w, value: v(value) });
  const choice = (label: string, w: number, options: string[], selected?: string | null): F => ({ label, w, choice: { options, selected: blank ? null : selected ?? null } });
  const yn = (b: Yn) => (b === true ? "Sim" : b === false ? "Não" : null);

  function fieldPrims(f: F, x: number, y: number, fw: number): { h: number; prims: Prim[] } {
    const prims: Prim[] = [];
    const base = y + RH - 1.5;
    const lw = f.label ? measure(f.label, LBL, false) + 1.6 : 0;
    if (f.label) prims.push({ k: "text", x, y: base, s: f.label, size: LBL, color: C.label });
    if (f.choice) {
      let cx = x + lw; let cy = base; let rows = 1;
      for (const o of f.choice.options) {
        const ow = 3.2 + 1.2 + measure(o, LBL, false) + 3.2;
        if (cx + ow > x + fw && cx > x + lw) { rows++; cx = x + lw; cy += RH; }
        prims.push(...box(cx, cy - 2.75, 3.2, f.choice.selected === o));
        prims.push({ k: "text", x: cx + 4.4, y: cy, s: o, size: LBL, color: C.text });
        cx += ow;
      }
      return { h: rows * RH, prims };
    }
    const first = Math.max(fw - lw - 2, 8);
    const lines = f.value ? wrapFirst(f.value, first, fw - 2) : [""];
    lines.forEach((ln, i) => {
      const lx = i === 0 ? x + lw : x; const ly = base + i * RH;
      prims.push({ k: "line", x1: lx, y1: ly + 0.7, x2: x + fw - 1.5, y2: ly + 0.7, stroke: C.border, lw: 0.22 });
      if (ln) prims.push({ k: "text", x: lx + 0.8, y: ly, s: ln, size: VAL, color: C.navy });
    });
    return { h: lines.length * RH, prims };
  }
  function wrapFirst(s: string, firstW: number, restW: number): string[] {
    const head = wrap(s, firstW, VAL, false, measure);
    if (head.length === 1) return head;
    const firstLine = head[0]!;
    const rest = clean(s).slice(firstLine.length).trim();
    return [firstLine, ...wrap(rest, restW, VAL, false, measure)];
  }
  function row(fields: F[]): Block {
    const total = fields.reduce((a, f) => a + f.w, 0);
    let x = IX; const parts = fields.map((f) => { const fw = (f.w / total) * IW; const p = { f, x, fw }; x += fw; return p; });
    const h = Math.max(...parts.map((p) => fieldPrims(p.f, p.x, 0, p.fw - 1.5).h));
    return { h, draw: (y) => parts.flatMap((p) => fieldPrims(p.f, p.x, y, p.fw - 1.5).prims) };
  }
  function checkGrid(items: readonly (readonly [string, string])[], checked: Set<string>, cols: number, x0 = IX, width = IW): Block[] {
    const colW = width / cols; const out: Block[] = [];
    for (let i = 0; i < items.length; i += cols) {
      const slice = items.slice(i, i + cols);
      const lines = slice.map(([, l]) => wrap(l, colW - 6, LBL + 0.4, false, measure));
      const h = Math.max(...lines.map((l) => l.length)) * 3.8 + 1.6;
      out.push({ h, draw: (y) => slice.flatMap(([id], j) => {
        const x = x0 + j * colW;
        return [...box(x, y + 0.9, 3.2, !blank && checked.has(id)), ...lines[j]!.map((ln, k): Prim => ({ k: "text", x: x + 4.6, y: y + 3.6 + k * 3.8, s: ln, size: LBL + 0.4, color: C.text }))];
      }) });
    }
    return out;
  }
  function writeLines(label: string | null, value: string | null | undefined, min: number): Block[] {
    const out: Block[] = [];
    if (label) out.push({ h: 4.6, draw: (y) => [{ k: "text", x: IX, y: y + 3.4, s: label, size: LBL, color: C.label }] });
    const lines = v(value) ? wrap(v(value), IW - 2, VAL, false, measure) : [];
    const n = Math.max(min, lines.length);
    for (let i = 0; i < n; i++) {
      const s = lines[i] ?? "";
      out.push({ h: RH + 0.4, draw: (y) => [{ k: "line", x1: IX, y1: y + RH - 0.6, x2: IX + IW, y2: y + RH - 0.6, stroke: C.border, lw: 0.22 }, ...(s ? [{ k: "text", x: IX + 0.8, y: y + RH - 1.4, s, size: VAL, color: C.navy } as Prim] : [])] });
    }
    return out;
  }
  const gap = (h: number): Block => ({ h, draw: () => [] });

  const person = (p: PersonBlock | undefined): Block[] => [
    row([text("Nome completo:", 1, p?.name)]),
    row([text("Data de nascimento:", 0.42, p?.birth), text("CPF:", 0.58, p?.cpf)]),
    row([text("Endereço:", 0.68, p?.address), text("Telefone:", 0.32, p?.phone)]),
    row([text("Nacionalidade:", 0.45, p?.nationality), text("Profissão:", 0.55, p?.profession)]),
    row([text("Município de nascimento:", 0.78, p?.birthCity), text("UF:", 0.22, p?.birthUf)]),
    row([text("Identidade nº:", 0.36, p?.idNumber), text("Órgão/UF:", 0.3, p?.idIssuer), text("Data de expedição:", 0.34, p?.idIssuedOn)]),
  ];

  const s = d.student;
  const sec1: Section = { n: 1, title: "DADOS DO ALUNO(A)", icon: "person", blocks: [
    row([text("Nome completo:", 1, s.name)]),
    row([text("Data de nascimento:", 0.3, s.birth), text("Ano de escolaridade:", 0.34, s.grade), choice("Sexo:", 0.36, ["Masculino", "Feminino"], s.sex)]),
    row([choice("Cor / raça:", 1, ["Branca", "Parda", "Preta", "Amarela", "Indígena", "Não declarada"], s.race)]),
    row([text("Etnia:", 0.5, s.ethnicity), text("Nacionalidade:", 0.5, s.nationality)]),
    row([text("Município de nascimento:", 0.78, s.birthCity), text("UF:", 0.22, s.birthUf)]),
    row([choice("NEE (Necessidades Educacionais Especiais):", 0.64, ["Não", "Sim (anexar caracterização)"], s.nee === true ? "Sim (anexar caracterização)" : s.nee === false ? "Não" : null), choice("Laudo:", 0.36, ["Sim", "Não"], yn(s.report))]),
    row([text("Endereço:", 0.68, s.address), text("Telefone:", 0.32, s.phone)]),
    row([choice("Zona de residência:", 0.42, ["Urbana", "Rural"], s.zone), text("Distrito:", 0.58, s.district)]),
    row([text("Identidade nº:", 0.36, s.idNumber), text("Órgão/UF:", 0.3, s.idIssuer), text("Data de expedição:", 0.34, s.idIssuedOn)]),
    row([text("CPF:", 0.42, s.cpf), text("NIS:", 0.58, s.nis)]),
    row([text("Nº da matrícula (certidão nova):", 1, s.birthCertificate)]),
    row([text("Nome social:", 1, s.socialName)]),
  ] };
  const sec2: Section = { n: 2, title: "DADOS DO PAI", icon: "person", blocks: person(d.father) };
  const sec3: Section = { n: 3, title: "DADOS DA MÃE", icon: "person", blocks: person(d.mother) };
  const sec4: Section = { n: 4, title: "DADOS DO REPRESENTANTE LEGAL", icon: "person", blocks: person(d.guardian) };

  const docs = new Set(d.documents ?? []);
  const sec5: Section = { n: 5, title: "DOCUMENTAÇÃO OFICIAL APRESENTADA", icon: "doc", blocks: [gap(0.6), ...checkGrid(DOCUMENTS, docs, 2)] };

  const h = d.health ?? {};
  const sec6: Section = { n: 6, title: "INFORMAÇÕES DE SAÚDE", icon: "heart", blocks: [
    row([choice("Possui alergia alimentar?", 0.4, ["Não", "Sim"], yn(h.foodAllergy)), text("Qual?", 0.34, h.foodAllergyWhich), choice("Possui diabetes?", 0.26, ["Não", "Sim"], yn(h.diabetes))]),
    row([choice("Possui outros tipos de alergia?", 0.4, ["Não", "Sim"], yn(h.otherAllergy)), text("Quais?", 0.34, h.otherAllergyWhich), choice("Laudo médico?", 0.26, ["Não", "Sim"], yn(h.medicalReport))]),
    ...writeLines("Observações (ex.: contato de emergência, informações relevantes, medida protetiva, entre outras):", h.notes, 3),
  ] };

  const consentText = wrap("Autorizo a divulgação gratuita de imagem de meu filho(a) para atividades pedagógicas da Escola/SEMED, conforme documento em anexo.", IW - 32, LBL + 0.6, false, measure);
  const consent = blank ? null : yn(d.imageConsent);
  const sec7: Section = { n: 7, title: "AUTORIZAÇÃO DE USO DE IMAGEM", icon: "image", blocks: [{
    h: Math.max(consentText.length * 4, 6) + 1.5,
    draw: (y) => [
      ...consentText.map((ln, i): Prim => ({ k: "text", x: IX, y: y + 3.6 + i * 4, s: ln, size: LBL + 0.6, color: C.text })),
      ...box(IX + IW - 27, y + 1.2, 3.4, consent === "Sim"), { k: "text", x: IX + IW - 22.6, y: y + 4, s: "Sim", size: LBL + 0.6, color: C.text },
      ...box(IX + IW - 12, y + 1.2, 3.4, consent === "Não"), { k: "text", x: IX + IW - 7.6, y: y + 4, s: "Não", size: LBL + 0.6, color: C.text },
    ],
  }] };

  const dec = blank ? null : d.decision ?? null;
  const legal = wrap("Diante das informações prestadas, a Direção Escolar se reserva o direito de analisá-las e proceder pelo deferimento ou indeferimento da matrícula pleiteada pelo representante legal.", IW, LBL, false, measure);
  const sigH = blank ? 13 : 11;
  const sec10: Section = { n: 10, title: "ASSINATURAS E PARECER", icon: "check", blocks: [
    { h: sigH, draw: (y) => [
      { k: "text", x: IX, y: y + 3.6, s: "Assinatura do Responsável Legal:", size: LBL, color: C.label },
      { k: "line", x1: IX, y1: y + sigH - 1.5, x2: IX + IW * 0.52, y2: y + sigH - 1.5, stroke: C.text, lw: 0.25 },
      { k: "text", x: IX + IW * 0.58, y: y + sigH - 2.2, s: "Itaperuna, ______ de ____________________ de 20______.", size: LBL + 0.4, color: C.text },
    ] },
    ...legal.map((ln): Block => ({ h: 3.6, draw: (y) => [{ k: "text", x: IX, y: y + 2.9, s: ln, size: LBL, color: C.label }] })),
    { h: sigH + 3, draw: (y) => [
      { k: "line", x1: IX + 4, y1: y + sigH - 1, x2: IX + IW * 0.44, y2: y + sigH - 1, stroke: C.text, lw: 0.25 },
      { k: "text", x: IX + 4 + (IW * 0.44 - 4) / 2, y: y + sigH + 2.4, s: "Secretário(a) Escolar", size: LBL, color: C.text, align: "center" },
      { k: "line", x1: IX + IW * 0.56, y1: y + sigH - 1, x2: IX + IW - 4, y2: y + sigH - 1, stroke: C.text, lw: 0.25 },
      { k: "text", x: IX + IW * 0.56 + (IW * 0.44 - 4) / 2, y: y + sigH + 2.4, s: "Direção", size: LBL, color: C.text, align: "center" },
    ] },
    gap(1.5),
    { h: 6.2, draw: (y) => [
      { k: "rect", x: IX - 1, y, w: IW + 2, h: 5.6, fill: C.band, r: 1 },
      { k: "text", x: IX + 1, y: y + 3.9, s: "USO EXCLUSIVO DA ESCOLA", size: LBL, bold: true, color: C.navy },
    ] },
    row([choice("", 0.42, ["DEFERIMENTO", "INDEFERIMENTO"], dec === "deferido" ? "DEFERIMENTO" : dec === "indeferido" ? "INDEFERIMENTO" : null), text("Observações:", 0.58, d.decisionNotes)]),
    ...writeLines(null, null, 1),
  ] };

  const se = new Set(d.specialEd?.items ?? []);
  const legendW = 54, gridW = IW - legendW - 3;
  const grid8 = checkGrid(SPECIAL_ED, se, 2, IX, gridW);
  const legendH = 6 + SPECIAL_ED_LEGEND.length * 3.4 + 2;
  const gridH = grid8.reduce((a, b) => a + b.h, 0);
  const sec8: Section = { n: 8, title: "ANEXO – CARACTERIZAÇÃO DO ALUNO NA EDUCAÇÃO ESPECIAL", icon: "special", blocks: [
    { h: Math.max(gridH, legendH) + 1, draw: (y) => {
      const out: Prim[] = []; let yy = y + 0.5;
      for (const b of grid8) { out.push(...b.draw(yy)); yy += b.h; }
      const lx = IX + IW - legendW;
      out.push({ k: "rect", x: lx, y, w: legendW, h: legendH, fill: C.panel, stroke: C.border, lw: 0.25, r: 1.2, dash: true });
      out.push({ k: "text", x: lx + 2.5, y: y + 4.2, s: "ORIENTAÇÕES (SIGLAS)", size: 7.4, bold: true, color: C.blue });
      SPECIAL_ED_LEGEND.forEach((l, i) => out.push({ k: "text", x: lx + 2.5, y: y + 8 + i * 3.4, s: l, size: 6.8, color: C.text }));
      return out;
    } },
    ...writeLines("Outras Necessidades Especiais (especificar):", d.specialEd?.other, 2),
  ] };
  const sec9: Section = { n: 9, title: "RECURSOS NECESSÁRIOS PARA AVALIAÇÕES (SAEB)", icon: "book", blocks: [gap(0.6), ...checkGrid(SAEB, new Set(d.saeb ?? []), 3)] };

  // ---------- Controle de Renovação (quadro original: 2ª página da ficha da rede) ----------
  const cols = [["ANO LETIVO", 17], ["SÉRIE/ANO", 20], ["SIM", 11], ["NÃO", 11], ["MUDANÇA DE ENDEREÇO", 52], ["ASSINATURA DO RESPONSÁVEL", 47], ["RUBRICA DO SERVIDOR", 22]] as const;
  const colX: number[] = []; { let x = IX; for (const [, w] of cols) { colX.push(x); x += w; } }
  const tableW = cols.reduce((a, [, w]) => a + w, 0);
  const headH = 13; const rowH = blank ? 10 : 9;
  const renewals = blank ? [] : d.renewals ?? [];
  const nRows = Math.max(10, renewals.length);
  const cellText = (s: string, x: number, w: number, y: number): Prim[] => wrap(s, w - 2, LBL, false, measure).map((ln, i) => ({ k: "text", x: x + w / 2, y: y + 3.6 + i * 3.4, s: ln, size: LBL, color: C.navy, align: "center" }));
  const renewalRows: Block[] = Array.from({ length: nRows }, (_, i) => {
    const r = renewals[i];
    const addr = clean(r?.addressChange);
    const addrLines = addr ? wrap(addr, cols[4][1] - 2, LBL, false, measure).length : 1;
    const hh = Math.max(rowH, addrLines * 3.4 + 2.4);
    return { h: hh, draw: (y) => {
      const out: Prim[] = [{ k: "rect", x: IX, y, w: tableW, h: hh, stroke: C.border, lw: 0.25 }];
      colX.slice(1).forEach((x) => out.push({ k: "line", x1: x, y1: y, x2: x, y2: y + hh, stroke: C.border, lw: 0.25 }));
      const yr = clean(r?.year);
      if (yr) out.push(...cellText(yr, colX[0]!, cols[0][1], y)); else out.push({ k: "text", x: colX[0]! + 2, y: y + hh - 2.4, s: "20____", size: LBL, color: C.label });
      if (clean(r?.grade)) out.push(...cellText(clean(r?.grade), colX[1]!, cols[1][1], y));
      out.push(...box(colX[2]! + cols[2][1] / 2 - 1.6, y + hh / 2 - 1.6, 3.2, r?.image === true));
      out.push(...box(colX[3]! + cols[3][1] / 2 - 1.6, y + hh / 2 - 1.6, 3.2, r?.image === false));
      if (addr) wrap(addr, cols[4][1] - 2, LBL, false, measure).forEach((ln, k) => out.push({ k: "text", x: colX[4]! + 1, y: y + 3.6 + k * 3.4, s: ln, size: LBL, color: C.navy }));
      return out;
    } };
  });
  const renewalHead: Block = { h: headH, draw: (y) => {
    const out: Prim[] = [{ k: "rect", x: IX, y, w: tableW, h: headH, fill: C.band, stroke: C.border, lw: 0.25 }];
    colX.slice(1).forEach((x, i) => { if (i !== 2) out.push({ k: "line", x1: x, y1: i === 1 ? y : y, x2: x, y2: y + headH, stroke: C.border, lw: 0.25 }); });
    out.push({ k: "line", x1: colX[3]!, y1: y + 8.4, x2: colX[3]!, y2: y + headH, stroke: C.border, lw: 0.25 });
    out.push({ k: "line", x1: colX[2]!, y1: y + 8.4, x2: colX[4]!, y2: y + 8.4, stroke: C.border, lw: 0.25 });
    const hd = (s: string, x: number, w: number, yy: number, size = 6.8) => wrap(s, w - 1.5, size, true, measure).forEach((ln, i, a) => out.push({ k: "text", x: x + w / 2, y: yy - (a.length - 1) * 1.5 + i * 3, s: ln, size, bold: true, color: C.navy, align: "center" }));
    hd("ANO LETIVO", colX[0]!, cols[0][1], y + 7.6); hd("SÉRIE/ANO", colX[1]!, cols[1][1], y + 7.6);
    hd("AUTORIZA IMAGEM", colX[2]!, cols[2][1] + cols[3][1], y + 4.6, 6.4);
    hd("SIM", colX[2]!, cols[2][1], y + 11.6, 6.4); hd("NÃO", colX[3]!, cols[3][1], y + 11.6, 6.4);
    hd("MUDANÇA DE ENDEREÇO", colX[4]!, cols[4][1], y + 7.6); hd("ASSINATURA DO RESPONSÁVEL", colX[5]!, cols[5][1], y + 7.6); hd("RUBRICA DO SERVIDOR", colX[6]!, cols[6][1], y + 7.6);
    return out;
  } };
  const sec11: Section = { n: 11, title: "CONTROLE DE RENOVAÇÃO DE MATRÍCULA", icon: "refresh", blocks: [gap(1), renewalHead, ...renewalRows] };

  // ---------- paginação determinística ----------
  const groups: Section[][] = [[sec1, sec2, sec3, sec4], [sec5, sec6, sec7, sec10]];
  if (opt.specialEdAnnex) groups.push([sec8, sec9]);
  if (opt.renewal) groups.push([sec11]);

  const pages: Page[] = [];
  let cur: Page; let y = 0; let curIsSpill = false;
  const newPage = (first: boolean, spill: boolean) => {
    cur = { prims: [] }; pages.push(cur);
    y = first ? fullHeader(cur.prims, d, blank, hasPhoto, measure) : compactHeader(cur.prims, d, blank, measure);
    curIsSpill = spill;
  };
  const BAND = 7.4, PADT = 2.2, PADB = 2.2, GAP = 3.2;
  const area = (top: number) => BOTTOM - top;
  groups.forEach((g, gi) => {
    if (gi === 0) newPage(true, false);
    else if (!curIsSpill) newPage(false, false);
    for (const sec of g) {
      let blocks = sec.blocks; let cont = false;
      while (blocks.length) {
        const need = BAND + PADT + PADB + blocks.reduce((a, b) => a + b.h, 0);
        const room = BOTTOM - y;
        let take = blocks.length;
        if (need > room) {
          const freshRoom = area(compactTop());
          if (need <= freshRoom || room < BAND + PADT + PADB + blocks[0]!.h + 12) { newPage(false, true); continue; }
          let acc = BAND + PADT + PADB; take = 0;
          while (take < blocks.length && acc + blocks[take]!.h <= room) { acc += blocks[take]!.h; take++; }
        }
        const part = blocks.slice(0, take);
        y = drawSection(cur!.prims, sec, part, y, cont, BAND, PADT, PADB) + GAP;
        blocks = blocks.slice(take); cont = true;
        if (blocks.length) newPage(false, true);
      }
    }
  });
  const total = pages.length;
  pages.forEach((p, i) => footer(p.prims, i + 1, total, d));
  return { pages };
}

let _compactTop = 0;
const compactTop = () => _compactTop;

function box(x: number, y: number, s: number, checked: boolean): Prim[] {
  const out: Prim[] = [{ k: "rect", x, y, w: s, h: s, fill: C.white, stroke: C.blue, lw: 0.28, r: 0.4 }];
  if (checked) out.push({ k: "line", x1: x + 0.6, y1: y + 0.6, x2: x + s - 0.6, y2: y + s - 0.6, stroke: C.navy, lw: 0.45 }, { k: "line", x1: x + s - 0.6, y1: y + 0.6, x2: x + 0.6, y2: y + s - 0.6, stroke: C.navy, lw: 0.45 });
  return out;
}

function icon(kind: Icon, x: number, y: number): Prim[] {
  const n = C.navy;
  const personAt = (px: number, py: number, k = 1): Prim[] => [
    { k: "circle", cx: px, cy: py - 1.3 * k, r: 1.15 * k, fill: n },
    { k: "poly", pts: [[px - 2 * k, py + 2.2 * k], [px - 1.7 * k, py + 0.6 * k], [px - 0.9 * k, py + 0.1 * k], [px + 0.9 * k, py + 0.1 * k], [px + 1.7 * k, py + 0.6 * k], [px + 2 * k, py + 2.2 * k]], fill: n, closed: true },
  ];
  switch (kind) {
    case "person": return personAt(x + 2.5, y + 2);
    case "group": case "special": return [...personAt(x + 1.3, y + 2.2, 0.8), ...personAt(x + 4.1, y + 2.2, 0.8), ...personAt(x + 2.7, y + 1.6, 0.95)];
    case "doc": return [{ k: "rect", x: x + 0.8, y: y - 0.6, w: 3.8, h: 4.8, stroke: n, lw: 0.4, r: 0.4 }, ...[0.8, 1.9, 3].map((dy): Prim => ({ k: "line", x1: x + 1.6, y1: y + dy, x2: x + 3.8, y2: y + dy, stroke: n, lw: 0.35 }))];
    case "heart": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 32; i++) { const t = (i / 32) * Math.PI * 2; pts.push([x + 2.7 + 0.15 * 16 * Math.sin(t) ** 3, y + 1.4 - 0.15 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
      return [{ k: "poly", pts, fill: n, closed: true }];
    }
    case "image": return [{ k: "rect", x: x + 0.3, y: y - 0.6, w: 4.8, h: 4, stroke: n, lw: 0.4, r: 0.4 }, { k: "poly", pts: [[x + 0.9, y + 2.8], [x + 2.3, y + 1.1], [x + 3.3, y + 2.2], [x + 3.9, y + 1.6], [x + 4.6, y + 2.8]], fill: n, closed: true }, { k: "circle", cx: x + 3.9, cy: y + 0.4, r: 0.45, fill: n }];
    case "book": return [{ k: "rect", x: x + 0.8, y: y - 0.7, w: 3.8, h: 4.9, fill: n, r: 0.4 }, { k: "line", x1: x + 1.6, y1: y + 0.6, x2: x + 3.8, y2: y + 0.6, stroke: C.white, lw: 0.35 }, { k: "line", x1: x + 1.6, y1: y + 1.6, x2: x + 3.8, y2: y + 1.6, stroke: C.white, lw: 0.35 }];
    case "check": return [{ k: "circle", cx: x + 2.7, cy: y + 1.6, r: 2.3, fill: n }, { k: "poly", pts: [[x + 1.6, y + 1.6], [x + 2.4, y + 2.5], [x + 3.9, y + 0.8]], stroke: C.white, lw: 0.5 }];
    case "refresh": return [{ k: "circle", cx: x + 2.7, cy: y + 1.6, r: 2, stroke: n, lw: 0.55 }, { k: "poly", pts: [[x + 4.1, y - 0.8], [x + 4.9, y + 0.9], [x + 3.2, y + 0.9]], fill: n, closed: true }];
  }
}

function drawSection(out: Prim[], sec: Section, blocks: Block[], y: number, cont: boolean, BAND: number, PADT: number, PADB: number): number {
  const body = blocks.reduce((a, b) => a + b.h, 0);
  const bottom = y + BAND + PADT + body + PADB;
  out.push({ k: "rect", x: PAGE.m, y, w: CW, h: bottom - y, fill: C.white, stroke: C.border, lw: 0.3, r: 1.6 });
  out.push({ k: "rect", x: PAGE.m, y, w: CW, h: BAND, fill: C.band, r: 1.6 });
  if (sec.n != null) {
    out.push({ k: "circle", cx: PAGE.m + 4.4, cy: y + BAND / 2, r: 3.3, fill: C.navy });
    out.push({ k: "text", x: PAGE.m + 4.4, y: y + BAND / 2 + 1.25, s: String(sec.n), size: 9.5, bold: true, color: C.white, align: "center" });
  }
  out.push(...icon(sec.icon, PAGE.m + 9.6, y + 2.1));
  out.push({ k: "text", x: PAGE.m + 17.5, y: y + 5.1, s: sec.title + (cont ? " (continuação)" : ""), size: 10.2, bold: true, color: C.navy });
  let yy = y + BAND + PADT;
  for (const b of blocks) { out.push(...b.draw(yy)); yy += b.h; }
  return bottom;
}

function fullHeader(out: Prim[], d: EnrollmentFormData, blank: boolean, hasPhoto: boolean, measure: Measure): number {
  const m = PAGE.m;
  out.push({ k: "image", x: m, y: m, w: 22, h: 24, img: "brasao" });
  out.push({ k: "image", x: m + CW - 26, y: m + 1, w: 26, h: 22, img: "sigem" });
  const cx = PAGE.w / 2; const tw = CW - 56;
  let y = m + 3.6;
  const line = (s: string, size: number, bold: boolean, color: string, step: number) => {
    for (const ln of wrap(s, tw, size, bold, measure)) { out.push({ k: "text", x: cx, y, s: ln, size, bold, color, align: "center" }); y += step; }
  };
  line(d.header.government.toUpperCase(), 11.4, true, C.navy, 4.4);
  line(d.header.department.toUpperCase(), 9.4, false, C.navy, 4.4);
  if (clean(d.header.school)) line(clean(d.header.school).toUpperCase(), 10, true, C.navy, 4.2);
  if (clean(d.header.address)) line(clean(d.header.address), 8.2, false, C.text, 3.6);
  const contact = [clean(d.header.phone) && `Telefone: ${clean(d.header.phone)}`, clean(d.header.email) && `E-mail: ${clean(d.header.email)}`].filter(Boolean).join("  |  ");
  if (contact) line(contact, 8.2, false, C.text, 3.6);
  const top = Math.max(m + 26, y - 1.5);
  // faixa do título
  const bandW = CW - 34;
  out.push({ k: "rect", x: m, y: top, w: bandW, h: 11, fill: C.blue, r: 1.8 });
  out.push({ k: "text", x: m + 6, y: top + 7.9, s: "FICHA DE MATRÍCULA", size: 17.5, bold: true, color: C.white });
  const pillW = 50, px = m + bandW - pillW - 3;
  out.push({ k: "rect", x: px, y: top + 2.3, w: pillW, h: 6.4, fill: C.white, r: 1.4 });
  out.push({ k: "text", x: px + 2.5, y: top + 6.6, s: "ANO LETIVO:", size: 7.4, bold: true, color: C.navy });
  out.push({ k: "line", x1: px + 20, y1: top + 7.2, x2: px + pillW - 2.5, y2: top + 7.2, stroke: C.border, lw: 0.25 });
  if (clean(d.yearLabel)) out.push({ k: "text", x: px + 21, y: top + 6.7, s: clean(d.yearLabel), size: 9.4, bold: true, color: C.navy });
  // foto 3x4
  const fx = m + CW - 30, fy = top;
  out.push({ k: "rect", x: fx, y: fy, w: 30, h: 40, fill: C.white, stroke: C.border, lw: 0.35, r: 1.2, dash: true });
  if (hasPhoto && !blank) out.push({ k: "image", x: fx + 0.6, y: fy + 0.6, w: 28.8, h: 38.8, img: "photo" });
  else { out.push({ k: "text", x: fx + 15, y: fy + 19, s: "FOTO", size: 8, color: C.label, align: "center" }); out.push({ k: "text", x: fx + 15, y: fy + 23, s: "3X4", size: 8, color: C.label, align: "center" }); }
  // requerimento
  const ry = top + 13;
  out.push({ k: "rect", x: m, y: ry, w: bandW, h: 7.4, fill: C.panel, stroke: C.border, lw: 0.25, r: 1.4 });
  const p1 = "Ilmo(a) Senhor(a), eu, abaixo-assinado, venho ", p2 = "REQUERER matrícula", p3 = " nesta Unidade Escolar.";
  let tx = m + 3;
  out.push({ k: "text", x: tx, y: ry + 4.9, s: p1, size: 8.6, color: C.text }); tx += measure(p1, 8.6, false);
  out.push({ k: "text", x: tx, y: ry + 4.9, s: p2, size: 8.6, bold: true, color: C.text }); tx += measure(p2, 8.6, true);
  out.push({ k: "text", x: tx, y: ry + 4.9, s: p3, size: 8.6, color: C.text });
  // repetente / ex-aluno / ID Censo
  const s = d.student; const yy = ry + 13.6;
  const ch = (b: Yn, want: boolean) => !blank && b === want;
  let x = m + 1;
  const lab = (t: string, bold = true) => { out.push({ k: "text", x, y: yy, s: t, size: 8, bold, color: C.navy }); x += measure(t, 8, bold) + 2; };
  const opt = (t: string, on: boolean) => { out.push(...box(x, yy - 2.8, 3.3, on)); out.push({ k: "text", x: x + 4.4, y: yy, s: t, size: 8, color: C.text }); x += 4.4 + measure(t, 8, false) + 3.5; };
  lab("Repetente:"); opt("Sim", ch(s.repeater, true)); opt("Não", ch(s.repeater, false)); x += 3;
  lab("Ex-aluno:"); opt("Sim", ch(s.formerStudent, true)); opt("Não", ch(s.formerStudent, false)); x += 3;
  lab("ID Censo:");
  out.push({ k: "line", x1: x, y1: yy + 0.7, x2: m + bandW, y2: yy + 0.7, stroke: C.border, lw: 0.25 });
  if (!blank && clean(s.censusId)) out.push({ k: "text", x: x + 1, y: yy, s: clean(s.censusId), size: 8.8, color: C.navy });
  return Math.max(fy + 40, yy + 2) + 3;
}

function compactHeader(out: Prim[], d: EnrollmentFormData, blank: boolean, measure: Measure): number {
  const m = PAGE.m;
  out.push({ k: "image", x: m, y: m, w: 10, h: 11, img: "brasao" });
  out.push({ k: "text", x: m + 12.5, y: m + 3.8, s: `${d.header.government.toUpperCase()} · ${d.header.department.toUpperCase()}`, size: 7, color: C.navy });
  const school = clean(d.header.school).toUpperCase();
  if (school) out.push({ k: "text", x: m + 12.5, y: m + 8.4, s: fit(school, 104, 8.6, true, measure), size: 8.6, bold: true, color: C.navy });
  const right = `FICHA DE MATRÍCULA${clean(d.yearLabel) ? ` · ANO LETIVO ${clean(d.yearLabel)}` : ""}`;
  out.push({ k: "text", x: m + CW, y: m + 3.8, s: right, size: 8, bold: true, color: C.blue, align: "right" });
  const name = blank ? "" : clean(d.student.name);
  if (name) out.push({ k: "text", x: m + CW, y: m + 8.4, s: fit(`Aluno(a): ${name}`, 66, 7.6, false, measure), size: 7.6, color: C.text, align: "right" });
  out.push({ k: "line", x1: m, y1: m + 12.6, x2: m + CW, y2: m + 12.6, stroke: C.blue, lw: 0.5 });
  _compactTop = m + 15.6;
  return m + 15.6;
}

/** Só no cabeçalho compacto (repetição do que já consta por extenso na 1ª página). */
function fit(s: string, maxW: number, size: number, bold: boolean, measure: Measure): string {
  if (measure(s, size, bold) <= maxW) return s;
  let t = s; while (t.length > 1 && measure(`${t}…`, size, bold) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function footer(out: Prim[], n: number, total: number, d: EnrollmentFormData) {
  const m = PAGE.m;
  out.push({ k: "line", x1: m, y1: 279.5, x2: m + CW, y2: 279.5, stroke: C.border, lw: 0.3 });
  out.push({ k: "text", x: m, y: 283.6, s: `SIGEM — Sistema Integrado de Gestão e Estatística Escolar · Ficha de Matrícula${clean(d.yearLabel) ? ` ${clean(d.yearLabel)}` : ""}`, size: 7, color: C.label });
  out.push({ k: "text", x: m + CW, y: 283.6, s: `Página ${n} de ${total}`, size: 7.4, bold: true, color: C.navy, align: "right" });
}

/** Encaixe "contain" comum aos dois desenhadores. */
export function fitContain(x: number, y: number, w: number, h: number, nw: number, nh: number) {
  const r = Math.min(w / nw, h / nh); const ww = nw * r, hh = nh * r;
  return { x: x + (w - ww) / 2, y: y + (h - hh) / 2, w: ww, h: hh };
}
export const PT_TO_MM = PT;
