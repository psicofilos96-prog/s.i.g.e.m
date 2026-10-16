import { STATE_REGISTRY, labelsOf } from "@/config/state-presentation";
/**
 * N4.3 — Mapa Estatístico em seis estruturas (I–VI), vocabulário do fluxo e documento oficial A4.
 * Puro: só reorganiza células já montadas pelo servidor; nunca calcula, nunca cria segunda fonte.
 */
import type { MapCell, MapSnapshot } from "./map-domain";
import { MONTH_NAMES_LOWER } from "@/lib/format-ptbr";

export type StructureId = "I" | "II" | "III" | "IV" | "V" | "VI";
export const MAP_STRUCTURES: readonly { id: StructureId; title: string; action: string }[] = [
  { id: "I", title: "Identificação da Unidade", action: "Conferir dados da unidade" },
  { id: "II", title: "Movimentação Estatística", action: "Conferir movimentação do mês" },
  { id: "III", title: "Turmas e Matrícula + Projetos", action: "Conferir turmas e matrículas" },
  { id: "IV", title: "Entrada e Saída de Alunos", action: "Conferir entradas e saídas" },
  { id: "V", title: "Relação de Pessoal e/ou Alteração", action: "Conferir pessoal" },
  { id: "VI", title: "Visitas Recebidas", action: "Conferir visitas" },
];

const ENTRY_EXIT = /(entrada|saida|saída|transfer|movimenta[cç][aã]o-tipo|admitid|desligad)/i;

/** Distribui células nas seis estruturas. IV recebe as células de entrada/saída antes de II. */
export function structureOf(c: Pick<MapCell, "cellId" | "sectionId">): StructureId {
  switch (c.sectionId) {
    case "identificacao": return "I";
    case "movimentacao": return ENTRY_EXIT.test(c.cellId) ? "IV" : "II";
    case "turmas": return ENTRY_EXIT.test(c.cellId) ? "IV" : "III";
    case "entrada-saida": return "IV";
    case "pessoal": return "V";
    case "visitas": return "VI";
    default: return ENTRY_EXIT.test(c.cellId) ? "IV" : "II";
  }
}

export function groupByStructure(cells: readonly MapCell[]): { id: StructureId; title: string; action: string; cells: MapCell[]; needsReview: number }[] {
  return MAP_STRUCTURES.map((s) => {
    const cs = cells.filter((c) => structureOf(c) === s.id);
    return { ...s, cells: cs, needsReview: cs.filter((c) => c.state === "ausente" || c.state === "indeterminado").length };
  });
}

/** Rótulo de origem em linguagem cotidiana. Ajuste manual não existe até haver writer próprio. */
export function originBadge(c: MapCell): "Calculado pelo SIGEM" | "Precisa revisar" | "Sem fonte no SIGEM" | "Declarado pela escola" | "Herdado do Mapa aprovado anterior" | "Ajustado pela escola" | "Ajustado pela Estatística (CIECE)" {
  if (c.adjustment) return c.adjustment.side === "escola" ? "Ajustado pela escola" : "Ajustado pela Estatística (CIECE)";
  if (c.state === "ausente" || c.state === "indeterminado") return "Precisa revisar";
  if (c.origin === "sem-fonte" || c.state === "sem-fonte") return "Sem fonte no SIGEM";
  if (c.origin === "declaracao") return "Declarado pela escola";
  if (c.origin === "herdado") return "Herdado do Mapa aprovado anterior";
  return "Calculado pelo SIGEM";
}

/**
 * Vocabulário do fluxo decidido (Secretaria envia → Estatística aprova ou devolve) sobre a cadeia
 * persistida: conferência = envio; oficialização = aprovação; abertura de correção antes de
 * aprovar = devolução; depois de aprovar = retificação (nova revisão, anterior preservada).
 */
export type WorkflowEvent = { kind: string; at: string; reason?: string | null };
export type WorkflowStage = "rascunho" | "enviado" | "devolvido" | "reenviado" | "aprovado" | "em-retificacao";
export const STAGE_LABEL: Record<WorkflowStage, string> = labelsOf(STATE_REGISTRY.mapa);
export function projectWorkflow(opened: boolean, events: readonly WorkflowEvent[], approvedVersions: number): { stage: WorkflowStage; revision: number; returnReason: string | null } {
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));
  let stage: WorkflowStage = "rascunho"; let returned = false; let reason: string | null = null; let approvals = 0;
  for (const e of ordered) {
    if (e.kind === "conferencia") { stage = returned ? "reenviado" : "enviado"; }
    else if (e.kind === "devolucao") { if (stage !== "aprovado") { stage = "devolvido"; returned = true; reason = e.reason ?? null; } }
    else if (e.kind === "abertura-correcao") {
      if (approvals > 0 && stage === "aprovado") stage = "em-retificacao";
      else { stage = "devolvido"; returned = true; }
      reason = e.reason ?? null;
    } else if (e.kind === "oficializacao") { stage = "aprovado"; approvals++; returned = false; reason = null; }
  }
  if (!opened) stage = "rascunho";
  return { stage, revision: Math.max(approvedVersions, approvals), returnReason: stage === "devolvido" || stage === "em-retificacao" ? reason : null };
}

/** Próxima competência só abre se a anterior estiver aprovada (quando a regra exigir). */
export function canOpenNext(previousStage: WorkflowStage | null, ruleRequiresPreviousApproval: boolean): boolean {
  if (!ruleRequiresPreviousApproval) return true;
  return previousStage === "aprovado";
}

// ---------------- Documento oficial A4 paisagem (gerador dedicado, não captura de tela) ----------------

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const MONTHS = MONTH_NAMES_LOWER;

function cellValue(c: MapCell): string {
  if (c.state === "disponivel") return `${c.value ?? "—"}${c.unit ? ` ${c.unit}` : ""}`;
  return ({ ausente: "Sem registro", indeterminado: "Indeterminado", "nao-aplicavel": "Não se aplica", "sem-regra": "Sem regra homologada", "sem-fonte": "Sem fonte no SIGEM" } as Record<string, string>)[c.state] ?? "Não disponível";
}

export type MapDocumentModel = "premium" | "administrativo";
export type MapDocumentInput = {
  headerLines: readonly string[]; schoolName: string; snapshot: MapSnapshot;
  statusLabel: string; revision: number | null; signatures: readonly string[]; generatedAt: string;
  /** Modelo visual; ambos mostram exatamente os mesmos dados. Padrão: premium. */
  model?: MapDocumentModel; cover?: boolean; emblemUrl?: string | null;
};

const PALETTE = { navy: "#0f2a52", mid: "#1f5fa8", light: "#e8f0fa", gray: "#f5f7fa", line: "#c9d6e8", gold: "#b8932f", ink: "#14213d" };

/** HTML autocontido A4 paisagem; mesma entrada (snapshot da revisão) ⇒ mesmo documento. */
export function renderMapDocument(d: MapDocumentInput): string {
  const s = d.snapshot; const comp = `${MONTHS[s.competence.month - 1] ?? s.competence.month}/${s.competence.year}`;
  const model: MapDocumentModel = d.model ?? "premium"; const premium = model === "premium";
  const cover = premium && d.cover !== false;
  const P = PALETTE; const COMP = comp.toUpperCase();
  const emblem = d.emblemUrl && /^https:\/\//.test(d.emblemUrl) ? `<img class="emb" src="${esc(d.emblemUrl)}" alt="Brasão">` : "";
  const runHead = `<div class="rh">${emblem}<div class="rh-l">${d.headerLines.map((l) => `<p>${esc(l)}</p>`).join("")}</div><div class="rh-r"><strong>MAPA ESTATÍSTICO</strong><span>${esc(COMP)}</span></div></div>`;
  const sections = groupByStructure(s.cells).map((g) => `
    <section><h2><span>${g.id} — ${esc(g.title.toUpperCase())}</span></h2>${g.cells.length === 0 ? `<p class="empty">Nenhum dado com fonte no SIGEM para esta estrutura.</p>` : `
    <table><thead><tr><th>Item</th><th class="n">Valor</th><th>Origem</th></tr></thead><tbody>${g.cells.map((c) => `
      <tr><td>${esc(c.label)}${c.groups?.length ? `<table class="sub"><tbody>${c.groups.map((x) => `<tr><td>${esc(x.key ?? "(sem valor)")}</td><td class="n">${esc(x.value ?? "—")}</td></tr>`).join("")}</tbody></table>` : ""}</td><td class="n">${esc(cellValue(c))}${c.adjustment ? `<br><small>Calculado pelo SIGEM: ${esc(c.adjustment.calculated ?? "—")}</small>` : ""}</td><td>${esc(originBadge(c))}${c.adjustment ? `<br><small>Motivo: ${esc(c.adjustment.reason)}</small>` : ""}</td></tr>`).join("")}
    </tbody></table>`}</section>`).join("");
  const obs = s.declarations.observations.trim();
  const footLabel = `${esc(d.schoolName)} · ${esc(comp)} · SIGEM`;
  const coverHtml = cover ? `<div class="cover">${emblem ? `<div class="cv-emb">${emblem}</div>` : ""}<div class="cv-org">${d.headerLines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
<div class="cv-mid"><h1>MAPA ESTATÍSTICO</h1><p class="cv-sub">DA UNIDADE ESCOLAR</p><p class="cv-school">${esc(d.schoolName)}</p><p class="cv-comp">${esc(COMP)}</p></div>
<div class="cv-wave"></div><p class="cv-foot">Sistema Integrado de Gestão Educacional Municipal</p></div>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Mapa Estatístico ${esc(comp)}</title><style>
@page{size:A4 landscape;margin:12mm 12mm 14mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:7.5pt sans-serif;color:#556}@bottom-left{content:"${footLabel.replace(/"/g, "'")}";font:7.5pt sans-serif;color:#556}}
${cover ? "@page :first{margin:0;@bottom-left{content:none}@bottom-right{content:none}}" : ""}
*{box-sizing:border-box}body{font:${premium ? "9pt/1.4" : "8.5pt/1.3"} "Source Sans 3","Inter",Arial,sans-serif;color:${P.ink};margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cover{width:297mm;height:210mm;position:relative;overflow:hidden;break-after:page;background:linear-gradient(160deg,${P.light} 0%,#fff 45%,${P.light} 100%);padding:16mm 18mm}
.cv-emb .emb{height:22mm}.cv-org{position:absolute;top:16mm;left:${emblem ? "46mm" : "18mm"}}.cv-org p{margin:0;font-weight:700;color:${P.navy};font-size:10pt;text-transform:uppercase}
.cv-mid{position:absolute;top:62mm;left:0;right:0;text-align:center}.cv-mid h1{font-size:40pt;letter-spacing:.02em;color:${P.navy};margin:0}.cv-sub{font-size:16pt;color:${P.mid};margin:2mm 0 8mm}
.cv-school{font-size:15pt;font-weight:700;margin:0 0 5mm}.cv-comp{display:inline-block;background:${P.mid};color:#fff;font-size:15pt;padding:2mm 12mm;border-radius:6mm;margin:0}
.cv-wave{position:absolute;left:-10%;right:-10%;bottom:-28mm;height:62mm;border-radius:50% 50% 0 0;background:linear-gradient(90deg,${P.navy},${P.mid});border-top:1.2mm solid ${P.gold}}
.cv-foot{position:absolute;bottom:9mm;right:18mm;margin:0;color:#fff;font-size:9pt;letter-spacing:.06em;text-transform:uppercase}
.rh{display:flex;align-items:center;gap:4mm;border-bottom:${premium ? `0.6mm solid ${P.mid}` : "0.3mm solid #888"};padding-bottom:2mm;margin-bottom:4mm}.rh .emb{height:11mm}
.rh-l p{margin:0;font-size:7.5pt;font-weight:700;text-transform:uppercase;color:${P.navy}}.rh-r{margin-left:auto;text-align:right;color:${P.mid}}.rh-r strong{display:block;font-size:10pt;color:${P.navy}}.rh-r span{font-size:8.5pt}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5mm 6mm;margin:0 0 4mm;font-size:8.5pt;background:${premium ? P.gray : "transparent"};border:0.2mm solid ${P.line};border-radius:${premium ? "2mm" : "0"};padding:2.5mm 4mm}
dt{font-weight:700;display:inline;color:${P.navy}}dd{display:inline;margin:0}
h2{font-size:11.5pt;margin:5mm 0 2mm;break-after:avoid}h2 span{display:block;${premium ? `background:linear-gradient(90deg,${P.navy},${P.mid});color:#fff;padding:1.6mm 4mm;border-radius:1.5mm;border-left:1.2mm solid ${P.gold}` : `border-bottom:0.3mm solid #666;padding-bottom:1mm`}}
section{break-inside:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5pt}
thead{display:table-header-group}th,td{border:0.2mm solid ${P.line};padding:1.4mm 2.2mm;vertical-align:top;overflow-wrap:anywhere}th{background:${premium ? P.light : "#eee"};color:${P.navy};text-align:left;font-weight:700}
tbody tr:nth-child(even)>td{background:${premium ? "#fafcff" : "transparent"}}td.n,th.n{text-align:right;width:22%}th:last-child,td:last-child{width:24%}tr{break-inside:avoid}
table.sub{margin-top:1mm;font-size:8pt}table.sub td{border:0;border-top:0.15mm dotted ${P.line};padding:.6mm 1mm;background:transparent!important}table.sub td.n{width:30%}
.empty{font-style:italic;color:#556}.obs{border:0.2mm solid ${P.line};border-radius:1.5mm;padding:2.5mm 4mm;min-height:14mm}
.final{break-inside:avoid}.sig{display:grid;grid-template-columns:repeat(${Math.max(1, Math.min(3, d.signatures.length))},1fr);gap:12mm;margin-top:16mm}.sig div{border-top:0.3mm solid ${P.ink};text-align:center;padding-top:1.5mm;font-size:8.5pt}
.date{margin-top:8mm;font-size:8.5pt}footer{margin-top:5mm;font-size:7.5pt;color:#556}</style></head><body>
${coverHtml}${runHead}
<dl><div><dt>Unidade: </dt><dd>${esc(d.schoolName)}</dd></div><div><dt>Competência: </dt><dd>${esc(comp)}</dd></div><div><dt>Situação: </dt><dd>${esc(d.statusLabel)}</dd></div>
<div><dt>Revisão: </dt><dd>${d.revision ? esc(d.revision) : "sem revisão aprovada"}</dd></div><div><dt>Data de referência: </dt><dd>${esc(s.snapshotDate ?? "não definida")}</dd></div><div><dt>Regra: </dt><dd>${s.rule ? `versão ${esc(s.rule.version)}` : "sem regra homologada"}</dd></div></dl>
${sections}
<section class="final"><h2><span>OBSERVAÇÕES DA ESCOLA</span></h2><div class="obs">${obs ? esc(obs) : '<span class="empty">Sem observações.</span>'}</div>
<p class="date">Data de entrega: ____/____/________</p>
<div class="sig">${d.signatures.map((x) => `<div>${esc(x)}</div>`).join("")}</div></section>
<footer>Documento gerado pelo SIGEM em ${esc(d.generatedAt)} a partir da fotografia ${d.revision ? "aprovada" : "dinâmica (não oficial)"} desta competência. Assinaturas são manuais; o SIGEM não insere assinatura digital.</footer>
</body></html>`;
}

/** NMAP.UX — valor em tela: zero lido é "0"; ausência nunca vira zero nem traço mudo. */
export function cellValueText(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

/** NMAP.UX — próxima ação por etapa do fluxo; só orienta, não decide nem libera ato. */
export const STAGE_NEXT_STEP: Record<WorkflowStage, string> = {
  rascunho: "A escola revisa as estruturas I–VI e envia o Mapa para a Estatística.",
  enviado: "Aguardando a Estatística aprovar ou devolver.",
  reenviado: "Reenviado após ajuste. Aguardando a Estatística.",
  devolvido: "A escola corrige o que o motivo da devolução aponta e envia de novo.",
  aprovado: "Mapa aprovado. Mudanças só por retificação (nova revisão).",
  "em-retificacao": "Retificação aberta: revise, envie e aguarde nova aprovação.",
};
