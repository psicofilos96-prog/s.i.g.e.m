import { STATE_REGISTRY, labelsOf } from "@/config/state-presentation";
/**
 * N4.3 — Mapa Estatístico em seis estruturas (I–VI), vocabulário do fluxo e documento oficial A4.
 * Puro: só reorganiza células já montadas pelo servidor; nunca calcula, nunca cria segunda fonte.
 */
import type { MapCell, MapSnapshot } from "./map-domain";
import { MONTH_NAMES_LOWER } from "@/lib/format-ptbr";
import { esc, mapTheme, type MapDocumentModel } from "./map-print-theme";

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

const MONTHS = MONTH_NAMES_LOWER;

function cellValue(c: MapCell): string {
  if (c.state === "disponivel") return `${c.value ?? "—"}${c.unit ? ` ${c.unit}` : ""}`;
  return ({ ausente: "Sem registro", indeterminado: "Indeterminado", "nao-aplicavel": "Não se aplica", "sem-regra": "Sem regra homologada", "sem-fonte": "Sem fonte no SIGEM" } as Record<string, string>)[c.state] ?? "Não disponível";
}

export type { MapDocumentModel };
export type MapDocumentInput = {
  headerLines: readonly string[]; schoolName: string; snapshot: MapSnapshot;
  statusLabel: string; revision: number | null; signatures: readonly string[]; generatedAt: string;
  /** Modelo visual; ambos mostram exatamente os mesmos dados. Padrão: premium. */
  model?: MapDocumentModel; cover?: boolean; emblemUrl?: string | null;
};

/** HTML autocontido A4 paisagem; mesma entrada (snapshot da revisão) ⇒ mesmo documento. */
export function renderMapDocument(d: MapDocumentInput): string {
  const s = d.snapshot; const comp = `${MONTHS[s.competence.month - 1] ?? s.competence.month}/${s.competence.year}`;
  const t = mapTheme({ model: d.model, cover: d.cover, emblemUrl: d.emblemUrl, headerLines: d.headerLines, schoolName: d.schoolName, competence: comp, signatures: d.signatures.length });
  const sections = groupByStructure(s.cells).map((g) => `
    <section>${t.h2(`${g.id} — ${g.title}`)}${g.cells.length === 0 ? `<p class="empty">Nenhum dado com fonte no SIGEM para esta estrutura.</p>` : `
    <table><thead><tr><th>Item</th><th class="n">Valor</th><th>Origem</th></tr></thead><tbody>${g.cells.map((c) => `
      <tr><td>${esc(c.label)}${c.groups?.length ? `<table class="sub"><tbody>${c.groups.map((x) => `<tr><td>${esc(x.key ?? "(sem valor)")}</td><td class="n">${esc(x.value ?? "—")}</td></tr>`).join("")}</tbody></table>` : ""}</td><td class="n">${esc(cellValue(c))}${c.adjustment ? `<br><small>Calculado pelo SIGEM: ${esc(c.adjustment.calculated ?? "—")}</small>` : ""}</td><td>${esc(originBadge(c))}${c.adjustment ? `<br><small>Motivo: ${esc(c.adjustment.reason)}</small>` : ""}</td></tr>`).join("")}
    </tbody></table>`}</section>`).join("");
  const obs = s.declarations.observations.trim();
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Mapa Estatístico ${esc(comp)}</title><style>
${t.css}</style></head><body>
${t.coverHtml}${t.runHead}
<dl><div><dt>Unidade: </dt><dd>${esc(d.schoolName)}</dd></div><div><dt>Competência: </dt><dd>${esc(comp)}</dd></div><div><dt>Situação: </dt><dd>${esc(d.statusLabel)}</dd></div>
<div><dt>Revisão: </dt><dd>${d.revision ? esc(d.revision) : "sem revisão aprovada"}</dd></div><div><dt>Data de referência: </dt><dd>${esc(s.snapshotDate ?? "não definida")}</dd></div><div><dt>Regra: </dt><dd>${s.rule ? `versão ${esc(s.rule.version)}` : "sem regra homologada"}</dd></div></dl>
${sections}
<section class="final">${t.h2("Observações da escola")}<div class="obs">${obs ? esc(obs) : '<span class="empty">Sem observações.</span>'}</div>
${t.signatures(d.signatures)}</section>
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
