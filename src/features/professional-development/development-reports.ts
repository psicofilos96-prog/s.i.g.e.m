/**
 * SIGEM Desenvolvimento L23 — 20 relatórios no motor comum (`report-engine`), perspectivas por papel e exportação auditada.
 * Cada relatório declara fonte canônica (lida com a RLS de quem gera), filtros, metodologia e data de referência obrigatória;
 * natureza sempre "projeção" (nunca oficial). Exportação só pela trilha `report_emissions` com SHA-256 e capacidade.
 */
import type { ColumnDef, ParamDef, ReportDefinition } from "@/features/reports/report-engine";
import { auditedOpsExport, type OpsEmissionRecorder } from "@/features/operations-center/operations-closure";

export type Perspective = "coordenacao" | "formador" | "participante";
export const DEV_EXPORT_CAPABILITY = "exportar-relatorios-de-formacao";

const BASE_PARAMS: readonly ParamDef[] = [
  { id: "asOf", label: "Data de referência", type: "date", required: true },
  { id: "ano", label: "Ano", type: "integer", required: false, min: 2000, max: 2100 },
  { id: "escola", label: "Escola", type: "text", required: false, maxLength: 64 },
];
const COLS = (extra: readonly ColumnDef[]): readonly ColumnDef[] => [
  { id: "referencia", label: "Data de referência", kind: "date" }, ...extra,
  { id: "estado", label: "Estado", kind: "text" }, { id: "motivo", label: "Motivo", kind: "text" }, { id: "proveniencia", label: "Proveniência", kind: "text" },
];
const C = (id: string, label: string, kind: ColumnDef["kind"] = "text", sensitive = false): ColumnDef => ({ id, label, kind, sensitive });

type Spec = Readonly<{ id: string; title: string; source: string; methodology: string; perspectives: readonly Perspective[]; cols: readonly ColumnDef[]; extraParams?: readonly ParamDef[]; dependency?: string }>;

const SPECS: readonly Spec[] = [
  { id: "dev-necessidades", title: "Necessidades formativas", source: "dev_need_submissions + consolidação (L04)", methodology: "Lista submissões por origem com evidência; prioridade só se consolidada com motivo.", perspectives: ["coordenacao"], cols: [C("origem", "Origem"), C("tema", "Tema"), C("prioridade", "Prioridade")] },
  { id: "dev-plano-anual", title: "Plano anual e metas", source: "dev_annual_plan_contents + ledger (L05)", methodology: "Metas com unidade e observação; meta sem observação = não monitorada.", perspectives: ["coordenacao"], cols: [C("meta", "Meta"), C("valor", "Observado", "number"), C("unidade", "Unidade")] },
  { id: "dev-catalogo", title: "Catálogo de cursos", source: "dev_catalog_course_versions (L07)", methodology: "Versão vigente por código com carga e frequência mínima.", perspectives: ["coordenacao", "formador", "participante"], cols: [C("curso", "Curso"), C("versao", "Versão", "number"), C("carga_min", "Carga (min)", "number")] },
  { id: "dev-turmas", title: "Turmas e vagas", source: "dev_classes + dev_class_status_events (L08)", methodology: "Vagas configuradas menos inscrições confirmadas; sem vaga configurada = desconhecido.", perspectives: ["coordenacao", "formador"], cols: [C("turma", "Turma"), C("vagas", "Vagas", "number"), C("confirmadas", "Confirmadas", "number")] },
  { id: "dev-calendario", title: "Calendário formativo", source: "dev_class_meeting_versions (L09)", methodology: "Última versão de cada encontro; choque com calendário letivo só se lido.", perspectives: ["coordenacao", "formador", "participante"], cols: [C("turma", "Turma"), C("data", "Data", "date"), C("situacao", "Situação")] },
  { id: "dev-inscricoes", title: "Inscrições e lista de espera", source: "dev_enrollments + análise/colocação (L10)", methodology: "Pedido, análise e colocação separados; pedido nunca ocupa vaga.", perspectives: ["coordenacao"], cols: [C("turma", "Turma"), C("pedidos", "Pedidos", "number"), C("espera", "Em espera", "number")] },
  { id: "dev-formadores", title: "Formadores designados", source: "dev_trainer_designations (L11)", methodology: "Designações vigentes na data, internas e externas.", perspectives: ["coordenacao"], cols: [C("turma", "Turma"), C("formador", "Formador", "text", true), C("janela", "Janela")] },
  { id: "dev-frequencia", title: "Frequência por turma", source: "dev_attendance_records (L12)", methodology: "Percentual só fecha com todos os encontros lançados; não lançado fica fora.", perspectives: ["coordenacao", "formador"], cols: [C("turma", "Turma"), C("lancados", "Lançados", "number"), C("pendentes", "Pendentes", "number")] },
  { id: "dev-minha-frequencia", title: "Minha frequência", source: "dev_attendance_records (RLS do titular)", methodology: "Encontros lançados da própria inscrição.", perspectives: ["participante"], cols: [C("turma", "Turma"), C("presencas", "Presenças", "number"), C("lancados", "Lançados", "number")] },
  { id: "dev-entregas", title: "Entregas e atividades", source: "dev_activity_submissions (L13)", methodology: "Entregas versionadas por atividade; acesso a material não conta.", perspectives: ["coordenacao", "formador"], cols: [C("atividade", "Atividade"), C("entregas", "Entregas", "number")] },
  { id: "dev-resultados", title: "Resultados por rubrica (agregado)", source: "dev_learning_results (L14)", methodology: "Distribuição por desfecho só com limiar configurado; individual nunca.", perspectives: ["coordenacao"], cols: [C("curso", "Curso"), C("desfecho", "Desfecho"), C("n", "Quantidade", "number")], dependency: "limiar de agregação aprovado" },
  { id: "dev-conclusoes", title: "Conclusões confirmadas", source: "dev_completion_confirmations (L15)", methodology: "Só apurações confirmadas por competente; indeterminado listado à parte.", perspectives: ["coordenacao", "formador"], cols: [C("turma", "Turma"), C("concluidos", "Concluídos", "number"), C("indeterminados", "Indeterminados", "number")] },
  { id: "dev-certificados", title: "Certificados emitidos", source: "dev_certificate_issuances (L16)", methodology: "Emissões vigentes; revogadas e substituídas listadas com motivo. Sem efeito funcional.", perspectives: ["coordenacao"], cols: [C("curso", "Curso"), C("emitidos", "Emitidos", "number"), C("revogados", "Revogados", "number")] },
  { id: "dev-meu-historico", title: "Meu histórico formativo", source: "dev_person_formation_history (L17, titular)", methodology: "Carga concluída soma só conclusões confirmadas.", perspectives: ["participante"], cols: [C("curso", "Curso"), C("carga_min", "Carga (min)", "number"), C("certificado", "Certificado")] },
  { id: "dev-externas", title: "Formações externas em análise", source: "dev_external_training_versions (L18)", methodology: "Situação por etapa; validado não é reconhecimento para progressão.", perspectives: ["coordenacao", "participante"], cols: [C("situacao", "Situação"), C("n", "Quantidade", "number")] },
  { id: "dev-competencias", title: "Cursos por competência", source: "dev_course_competency_links (L19)", methodology: "Relação 'contribui para'; não comprova domínio.", perspectives: ["coordenacao", "formador"], cols: [C("competencia", "Competência"), C("cursos", "Cursos", "number")] },
  { id: "dev-avaliacao-reacao", title: "Avaliação da formação (agregado)", source: "dev_survey_aggregate (L20)", methodology: "Distribuição de escala acima do limiar aprovado; texto livre nunca exposto.", perspectives: ["coordenacao"], cols: [C("questionario", "Questionário"), C("item", "Item"), C("n", "Respostas", "number")], dependency: "limiar de agregação aprovado" },
  { id: "dev-impacto", title: "Indicadores antes/depois", source: "dev_impact_observations (L20)", methodology: "Mesmo escopo e indicador aprovado; sem causalidade atribuída.", perspectives: ["coordenacao"], cols: [C("indicador", "Indicador"), C("antes", "Antes", "number"), C("depois", "Depois", "number")] },
  { id: "dev-trilhas-funcao", title: "Trilhas por função", source: "dev_role_track_targets (L21)", methodology: "Alvos por tipo de atuação canônica; retirados excluídos.", perspectives: ["coordenacao", "participante"], cols: [C("grupo", "Grupo"), C("atuacao", "Tipo de atuação"), C("trilha", "Trilha")] },
  { id: "dev-parceiros", title: "Parceiros e cursos vinculados", source: "dev_partner_versions + dev_partner_course_links (L22)", methodology: "Só versões aprovadas e vigentes na data de referência.", perspectives: ["coordenacao"], cols: [C("parceiro", "Parceiro"), C("papel", "Papel"), C("cursos", "Cursos", "number")] },
];

export type DevReport = ReportDefinition & Readonly<{ methodology: string; perspectives: readonly Perspective[] }>;
export const DEV_REPORTS: readonly DevReport[] = SPECS.map((s) => ({
  id: s.id, version: 1, title: s.title, description: `${s.methodology} Natureza: projeção, não documento oficial.`, source: s.source,
  params: [...BASE_PARAMS, ...(s.extraParams ?? [])], columns: COLS(s.cols), formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 20000,
  dependency: s.dependency ?? null, methodology: s.methodology, perspectives: s.perspectives,
}));

/** Perspectiva derivada de fatos (capacidade de rede / designação vigente / inscrição), nunca de cargo. */
export function perspectivesOf(a: { caps: ReadonlySet<string>; activeTrainer: boolean; hasEnrollment: boolean }): Perspective[] {
  const p: Perspective[] = [];
  if (a.caps.has("gerir-formacao-continuada")) p.push("coordenacao");
  if (a.activeTrainer) p.push("formador");
  if (a.hasEnrollment) p.push("participante");
  return p;
}
export const reportsFor = (ps: readonly Perspective[]) => DEV_REPORTS.filter((r) => r.perspectives.some((p) => ps.includes(p)));

/** Exportação auditada: capacidade + SHA-256 + registro na trilha de emissões antes do download. */
export function auditedDevExport(a: { caps: ReadonlySet<string>; report: DevReport; format: "csv" | "xlsx" | "pdf"; rows: number; content: string | ArrayBuffer; key: string; record: OpsEmissionRecorder }) {
  if (a.report.dependency) return Promise.reject(new Error(`Relatório bloqueado: falta ${a.report.dependency}.`));
  return auditedOpsExport({ caps: a.caps, exportCap: DEV_EXPORT_CAPABILITY, reportId: a.report.id, version: a.report.version, title: a.report.title, format: a.format, rows: a.rows, content: a.content, key: a.key, record: a.record });
}

/** Notificações e anexos: reaproveitam camadas existentes (sem canal próprio). */
export const DEV_NOTIFICATION_SOURCES = ["dev_meeting_notices"] as const;
export const DEV_PRIVATE_BUCKET = "dev-formacao";
