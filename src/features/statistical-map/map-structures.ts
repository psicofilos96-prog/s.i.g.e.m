/**
 * N4.3 — Mapa Estatístico em seis estruturas (I–VI), vocabulário do fluxo e documento oficial A4.
 * Puro: só reorganiza células já montadas pelo servidor; nunca calcula, nunca cria segunda fonte.
 */
import type { MapCell, MapSnapshot } from "./map-domain";

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
export const STAGE_LABEL: Record<WorkflowStage, string> = {
  rascunho: "Rascunho", enviado: "Enviado à Estatística", devolvido: "Devolvido para ajuste", reenviado: "Reenviado",
  aprovado: "Aprovado (oficial)", "em-retificacao": "Em retificação",
};
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

// ---------------- Documento oficial A4 (gerador dedicado, não captura de tela) ----------------

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function cellValue(c: MapCell): string {
  if (c.state === "disponivel") return `${c.value ?? "—"}${c.unit ? ` ${c.unit}` : ""}`;
  return ({ ausente: "Sem registro", indeterminado: "Indeterminado", "nao-aplicavel": "Não se aplica", "sem-regra": "Sem regra homologada", "sem-fonte": "Sem fonte no SIGEM" } as Record<string, string>)[c.state] ?? "Não disponível";
}

export type MapDocumentInput = {
  headerLines: readonly string[]; schoolName: string; snapshot: MapSnapshot;
  statusLabel: string; revision: number | null; signatures: readonly string[]; generatedAt: string;
};

/** HTML autocontido A4 retrato; mesma entrada (snapshot da revisão) ⇒ mesmo documento. */
export function renderMapDocument(d: MapDocumentInput): string {
  const s = d.snapshot; const comp = `${MONTHS[s.competence.month - 1] ?? s.competence.month}/${s.competence.year}`;
  const sections = groupByStructure(s.cells).map((g) => `
    <section><h2>${g.id} — ${esc(g.title)}</h2>${g.cells.length === 0 ? `<p class="empty">Nenhum dado com fonte no SIGEM para esta estrutura.</p>` : `
    <table><thead><tr><th>Item</th><th class="n">Valor</th><th>Origem</th></tr></thead><tbody>${g.cells.map((c) => `
      <tr><td>${esc(c.label)}${c.groups?.length ? `<ul>${c.groups.map((x) => `<li>${esc(x.key ?? "(sem valor)")}: ${esc(x.value ?? "—")}</li>`).join("")}</ul>` : ""}</td><td class="n">${esc(cellValue(c))}${c.adjustment ? `<br><small>Calculado pelo SIGEM: ${esc(c.adjustment.calculated ?? "—")}</small>` : ""}</td><td>${esc(originBadge(c))}${c.adjustment ? `<br><small>Motivo: ${esc(c.adjustment.reason)}</small>` : ""}</td></tr>`).join("")}
    </tbody></table>`}</section>`).join("");
  const obs = s.declarations.observations.trim();
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Mapa Estatístico ${esc(comp)}</title><style>
@page{size:A4 portrait;margin:14mm 12mm}*{box-sizing:border-box}body{font:10pt/1.35 Georgia,"Times New Roman",serif;color:#111;margin:0}
header{text-align:center;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}header p{margin:0;font-size:9pt;text-transform:uppercase;letter-spacing:.03em}
h1{font-size:14pt;margin:6px 0 2px}dl{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin:6px 0 10px;font-size:9pt}dt{font-weight:bold;display:inline}dd{display:inline;margin:0}
h2{font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #999;break-after:avoid}section{break-inside:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt}
thead{display:table-header-group}th,td{border:1px solid #888;padding:3px 5px;vertical-align:top;overflow-wrap:anywhere}th{background:#eee;text-align:left}td.n,th.n{text-align:right;width:28%}
th:last-child,td:last-child{width:26%}tr{break-inside:avoid}ul{margin:2px 0 0 14px;padding:0}.empty{font-style:italic;color:#444}
.sig{display:grid;grid-template-columns:repeat(${Math.max(1, Math.min(3, d.signatures.length))},1fr);gap:24px;margin-top:36px;break-inside:avoid}.sig div{border-top:1px solid #111;text-align:center;padding-top:3px;font-size:9pt}
footer{margin-top:12px;font-size:8pt;color:#333}</style></head><body>
<header>${d.headerLines.map((l) => `<p>${esc(l)}</p>`).join("")}<h1>MAPA ESTATÍSTICO — ${esc(comp.toUpperCase())}</h1></header>
<dl><div><dt>Unidade: </dt><dd>${esc(d.schoolName)}</dd></div><div><dt>Competência: </dt><dd>${esc(comp)}</dd></div>
<div><dt>Situação: </dt><dd>${esc(d.statusLabel)}</dd></div><div><dt>Revisão: </dt><dd>${d.revision ? esc(d.revision) : "sem revisão aprovada"}</dd></div>
<div><dt>Data de referência: </dt><dd>${esc(s.snapshotDate ?? "não definida")}</dd></div><div><dt>Regra: </dt><dd>${s.rule ? `versão ${esc(s.rule.version)}` : "sem regra homologada"}</dd></div></dl>
${sections}
<section><h2>Observações da escola</h2><p>${obs ? esc(obs) : '<span class="empty">Sem observações.</span>'}</p></section>
<div class="sig">${d.signatures.map((x) => `<div>${esc(x)}</div>`).join("")}</div>
<footer>Documento gerado pelo SIGEM em ${esc(d.generatedAt)} a partir da fotografia ${d.revision ? "aprovada" : "dinâmica (não oficial)"} desta competência.</footer>
</body></html>`;
}
