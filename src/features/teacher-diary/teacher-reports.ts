/**
 * Docente LOTE 16 — Relatórios e documentos do professor (catálogo puro).
 *
 * Cada relatório declara a FONTE OFICIAL (reader canônico já existente) e sai só pelo
 * `report-engine` / `diary-prints` (PDF A4). Nada é recalculado aqui: o catálogo decide
 * se o relatório pode ser gerado (fontes lidas, regra quando exigida), monta o cabeçalho
 * com logos permitidos e define quem pode assinar (pessoa natural autorizada).
 */
import { INSTITUTIONAL_LOGOS } from "@/features/reports/report-analytics";

export type TeacherReportId =
  | "diario-de-classe" | "aulas" | "frequencia-turma" | "frequencia-individual" | "conteudos" | "habilidades"
  | "planejamentos" | "avaliacoes" | "notas" | "recuperacao" | "acompanhamento" | "descritivos-ei" | "pendencias";

export type ReportSpec = { id: TeacherReportId; label: string; sources: readonly string[]; needsRule: boolean; sensitive: boolean };

export const TEACHER_REPORTS: readonly ReportSpec[] = [
  { id: "diario-de-classe", label: "Diário de Classe", sources: ["lesson-versions", "attendance", "assessment-results"], needsRule: false, sensitive: false },
  { id: "aulas", label: "Registro de aulas", sources: ["lesson-versions"], needsRule: false, sensitive: false },
  { id: "frequencia-turma", label: "Frequência da turma", sources: ["attendance", "roster"], needsRule: true, sensitive: false },
  { id: "frequencia-individual", label: "Frequência individual", sources: ["attendance", "roster"], needsRule: true, sensitive: false },
  { id: "conteudos", label: "Conteúdos ministrados", sources: ["lesson-versions"], needsRule: false, sensitive: false },
  { id: "habilidades", label: "Habilidades trabalhadas", sources: ["skill-links", "lesson-versions"], needsRule: false, sensitive: false },
  { id: "planejamentos", label: "Planejamentos", sources: ["teaching-plans"], needsRule: false, sensitive: false },
  { id: "avaliacoes", label: "Instrumentos de avaliação", sources: ["assessment-instruments"], needsRule: false, sensitive: false },
  { id: "notas", label: "Resultados por período", sources: ["assessment-results", "period-result"], needsRule: true, sensitive: false },
  { id: "recuperacao", label: "Recuperação", sources: ["assessment-results", "recovery"], needsRule: true, sensitive: false },
  { id: "acompanhamento", label: "Acompanhamento pedagógico", sources: ["interventions"], needsRule: false, sensitive: true },
  { id: "descritivos-ei", label: "Relatórios descritivos (EI)", sources: ["descriptive-report"], needsRule: false, sensitive: true },
  { id: "pendencias", label: "Pendências do diário", sources: ["lesson-versions", "attendance"], needsRule: false, sensitive: false },
];

export type SourceState = "lida" | "negada" | "erro" | "nao-lida";

export function reportReadiness(id: TeacherReportId, sources: Readonly<Record<string, SourceState>>, ruleHomologated: boolean): { ok: true } | { ok: false; reasons: string[] } {
  const spec = TEACHER_REPORTS.find((r) => r.id === id);
  if (!spec) return { ok: false, reasons: ["Relatório não catalogado."] };
  const reasons: string[] = [];
  for (const s of spec.sources) {
    const st = sources[s] ?? "nao-lida";
    if (st !== "lida") reasons.push(st === "negada" ? `Sem permissão para ler ${s}.` : `Fonte ${s} não disponível (${st}).`);
  }
  if (spec.needsRule && !ruleHomologated) reasons.push("Sem regra homologada: o relatório não calcula totais nem situação.");
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export type HeaderConfig = { title: string; schoolName: string; lines: readonly string[]; logoIds: readonly string[]; coatOfArms: boolean };

export function validateHeader(h: HeaderConfig): string[] {
  const e: string[] = [];
  if (!h.title.trim() || !h.schoolName.trim()) e.push("Cabeçalho exige título e escola.");
  if (h.lines.length > 4) e.push("Use no máximo 4 linhas adicionais no cabeçalho.");
  if (h.logoIds.length > 3) e.push("Use no máximo 3 logos.");
  if (h.logoIds.some((id) => !INSTITUTIONAL_LOGOS.some((l) => l.id === id))) e.push("Logo não está na lista institucional.");
  return e;
}

/** Rodapé A4 legível: "Página X de Y", versão e código de verificação. */
export const pageFooter = (page: number, total: number, version: number, code: string) => `Página ${page} de ${total} · versão ${version} · verificação ${code}`;

/** Assinatura: só pessoa natural, signatária autorizada, do próprio documento, sem rotular como ICP-Brasil sem evidência. */
export function canSign(
  doc: { reportId: TeacherReportId; authorPersonId: string; requiredCapability: string | null },
  signer: { personId: string | null; capabilities: readonly string[]; icpEvidence: boolean },
): { ok: boolean; kind?: "simples" | "qualificada"; reason?: string } {
  if (!signer.personId) return { ok: false, reason: "Assinatura exige pessoa natural; contas técnicas não assinam." };
  if (doc.requiredCapability) {
    if (!signer.capabilities.includes(doc.requiredCapability)) return { ok: false, reason: "Você não tem a autorização exigida para assinar este documento." };
  } else if (signer.personId !== doc.authorPersonId) {
    return { ok: false, reason: "Só quem produziu o documento assina." };
  }
  return { ok: true, kind: signer.icpEvidence ? "qualificada" : "simples" };
}

/** Nova emissão = nova versão; emitido não se edita. */
export function nextEmission(previous: readonly { version: number; hash: string }[], hash: string): { version: number; changed: boolean } {
  const last = previous[previous.length - 1];
  if (last && last.hash === hash) return { version: last.version, changed: false };
  return { version: (last?.version ?? 0) + 1, changed: true };
}
