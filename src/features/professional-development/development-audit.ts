/**
 * SIGEM Desenvolvimento — Formação Continuada e Desenvolvimento Profissional — L01: auditoria.
 * Mapeia 47 seções + 18 critérios sobre o que JÁ existe. Nada cria cadastro: lacunas apontam a
 * estrutura a ESTENDER. Nenhum status "homologado" existe: homologação exige ato humano real.
 * Títulos derivam do pedido; o texto integral da especificação deve ser reconciliado.
 */
export type DevStatus = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface DevRow { n: number; title: string; status: DevStatus; source: string[]; evidence: string[]; gap: string }

const D = "drizzle/migrations";
const S = "supabase/migrations";
const P = "src/features/professionals";

/** Fontes canônicas — o módulo só LÊ/REFERENCIA estas; nunca copia. */
export const CANONICAL_DEV_SOURCES = {
  pessoas: { tables: ["institutional_persons"], migration: `${S}/20260929005850_39761935-6524-45ac-a91b-3237c9d90f23.sql`, note: "Pessoa natural única; participante = pessoa canônica." },
  atuacoes: { tables: ["institutional_engagements"], migration: `${S}/20260929005850_39761935-6524-45ac-a91b-3237c9d90f23.sql`, note: "Atuação vigente autoriza; cargo não." },
  vinculos: { tables: ["professional_functional_links"], migration: `${S}/20260929045405_7655c6e3-0baf-4ce4-9b7a-76ff8498c136.sql`, note: "Vínculo funcional do DP; formação nunca altera vínculo." },
  habilitacoes: { tables: ["professional_qualifications"], migration: `${D}/0076_functional_life_exercise_qualification_process.sql`, note: "Titulação oficial; formação nunca vira titulação." },
  escolas: { tables: ["institutional_schools"], migration: `${S}/20260929031130_3348d211-7583-485d-94db-42a059e1a09b.sql`, note: "Escola canônica." },
  calendarios: { tables: ["calendar_versions"], migration: `${D}/0023_b4_6_1_calendar_structure.sql`, note: "Datas só do calendário aplicável homologado." },
  documentos: { tables: ["docserv_document_versions", "admin_case_files"], migration: `${D}/0362_0362_docserv_documents.sql`, note: "Certificados/atos pelo SIGEM Documentos." },
  avaliacao: { tables: ["assessment_instruments"], migration: `${S}/20260929012036_8bb77c73-fdac-428d-9271-38244b3e28b0.sql`, note: "Instrumento de avaliação existente; avaliação de formação reusa o motor." },
  formacaoSemed: { tables: ["semed_t10_formation_versions"], migration: `${D}/0351_semed_t10_staff_formation.sql`, note: "Formação declarada (SEMED T10) é fonte de leitura, não oferta." },
  tarefas: { tables: ["operational_tasks"], migration: `${D}/0095_operational_tasks.sql`, note: "Pendência vira tarefa da central única." },
  notificacoes: { tables: ["notification_events"], migration: `${D}/0077_notifications_infrastructure.sql`, note: "Avisos pela camada única." },
  emissoes: { tables: ["report_emissions"], migration: `${D}/0288_report_emissions_ledger.sql`, note: "Exportação auditada." },
} as const;
const C_ = CANONICAL_DEV_SOURCES;

/** Plataformas externas (EAD, MEC, universidades): nenhuma integrada sem contrato e decisão. */
export const EXTERNAL_PLATFORMS = { found: [] as string[], requirement: "Integração só com plataforma identificada, termo/contrato, credencial e decisão competente." } as const;
export const FORBIDDEN_DUPLICATE_TABLES = ["teachers", "professores", "servidores", "staff", "dev_people", "dev_schools", "certificates_copy", "titulacoes"] as const;

const CE = `${P}/continuing-education.ts`;
const R = (n: number, title: string, status: DevStatus, source: string[] = [], evidence: string[] = [], gap = ""): DevRow => ({ n, title, status, source, evidence, gap });
const pe = [...C_.pessoas.tables];

export const DEV_SECTIONS: readonly DevRow[] = [
  R(1, "Auditoria do módulo existente", "existente", [], ["src/features/professional-development/development-audit.ts"]),
  R(2, "Participante = pessoa canônica", "existente", pe, [CE, C_.pessoas.migration]),
  R(3, "Vínculos e atuações do participante", "existente", [...C_.vinculos.tables, ...C_.atuacoes.tables], [C_.vinculos.migration]),
  R(4, "Escola e unidade de exercício", "existente", [...C_.escolas.tables], [C_.escolas.migration]),
  R(5, "Diagnóstico de necessidades formativas", "lacuna", [], [], "Sem levantamento registrado; nunca inferir de cargo."),
  R(6, "Plano municipal de formação", "bloqueado", [], [], "Plano exige decisão da Secretaria."),
  R(7, "Programas formativos", "lacuna", [], [], "Programa versionado a persistir."),
  R(8, "Cursos e ações", "parcial", [], [CE], "Núcleo puro; sem persistência."),
  R(9, "Turmas/ofertas", "parcial", [], [CE], "Oferta só em memória."),
  R(10, "Vagas", "parcial", [], [CE], "Vagas configuradas; ausência ⇒ recusa."),
  R(11, "Público-alvo e elegibilidade", "bloqueado", [], [], "Critério configurado e aprovado; nunca por cargo textual."),
  R(12, "Inscrição", "parcial", [], [CE], "Sem writer com pessoa da sessão."),
  R(13, "Lista de espera", "parcial", [], [CE]),
  R(14, "Seleção e homologação de inscritos", "lacuna", [], [], "Decisão humana por pessoa competente."),
  R(15, "Formadores", "lacuna", [], [], "Formador = pessoa canônica ou externo identificado."),
  R(16, "Carga horária", "parcial", [], [CE], "Carga ausente ⇒ null."),
  R(17, "Calendário da formação", "parcial", [...C_.calendarios.tables], [C_.calendarios.migration], "Encontros não ligados ao calendário aplicável."),
  R(18, "Encontros/sessões", "parcial", [], [CE]),
  R(19, "Frequência", "parcial", [], [CE], "Encontro sem registro não é falta."),
  R(20, "Frequência mínima", "parcial", [], [CE], "Mínimo só configurado."),
  R(21, "Atividades e entregas", "lacuna"),
  R(22, "Avaliação de aprendizagem", "parcial", [...C_.avaliacao.tables], [C_.avaliacao.migration], "Reusar instrumentos; sem vínculo."),
  R(23, "Avaliação de reação", "lacuna"),
  R(24, "Conclusão", "parcial", [], [CE]),
  R(25, "Certificados", "parcial", [], [CE], "Emissão só por SIGEM Documentos."),
  R(26, "Verificação pública de certificado", "parcial", [], [CE], "Sem CPF/matrícula."),
  R(27, "Formação externa e reconhecimento", "parcial", [], [CE], "Validação por outra pessoa."),
  R(28, "Equivalência de cargas", "bloqueado", [], [], "Regra de equivalência não aprovada."),
  R(29, "Histórico formativo individual", "parcial", [], [CE, C_.formacaoSemed.migration]),
  R(30, "Formação declarada SEMED T10", "existente", [...C_.formacaoSemed.tables], [C_.formacaoSemed.migration]),
  R(31, "Titulação oficial (separada)", "existente", [...C_.habilitacoes.tables], [C_.habilitacoes.migration]),
  R(32, "Efeito funcional (progressão)", "bloqueado", [], [], "Efeito só por regra legal homologada do DP."),
  R(33, "Desenvolvimento profissional: trilhas", "lacuna"),
  R(34, "Plano individual de desenvolvimento", "lacuna", [], [], "Privado ao titular e à competência."),
  R(35, "Acompanhamento pedagógico pós-formação", "lacuna"),
  R(36, "Ponte com Orientação Pedagógica", "lacuna"),
  R(37, "Ponte com Gestão de Pessoas", "parcial", [], [`${P}/continuing-education.test.ts`]),
  R(38, "Materiais e repositório", "lacuna", [...C_.documentos.tables], [], "Arquivos pelo SIGEM Documentos."),
  R(39, "Documentos e atos", "existente", [...C_.documentos.tables], [C_.documentos.migration]),
  R(40, "Comunicação e avisos", "existente", [...C_.notificacoes.tables], [C_.notificacoes.migration]),
  R(41, "Tarefas e pendências", "existente", [...C_.tarefas.tables], [C_.tarefas.migration]),
  R(42, "Plataformas externas/EAD", "bloqueado", [], [], EXTERNAL_PLATFORMS.requirement),
  R(43, "Custos e financiamento", "bloqueado", [], [], "Custo só de fonte contábil real."),
  R(44, "Indicadores", "lacuna", [], [], "Indicador sem fórmula aprovada fica bloqueado."),
  R(45, "Relatórios", "parcial", [...C_.emissoes.tables], [C_.emissoes.migration], "Catálogo do módulo a criar."),
  R(46, "Painel e telas", "lacuna"),
  R(47, "Fechamento e evidências", "lacuna", [], [], "Lote 24."),
];

const K = (n: number, title: string, status: DevStatus, evidence: string[] = [], gap = "") => R(n, title, status, [], evidence, gap);
export const DEV_CRITERIA: readonly DevRow[] = [
  K(1, "Pessoa só do cadastro canônico", "existente", [C_.pessoas.migration]),
  K(2, "Nenhum cadastro paralelo", "existente", ["src/features/professional-development/development-audit.ts"]),
  K(3, "Formação nunca vira titulação", "existente", [CE]),
  K(4, "Autoria = pessoa da sessão", "parcial", [CE], "Sem writer persistido."),
  K(5, "Aprovador ≠ autor/solicitante", "parcial", [CE]),
  K(6, "Regra só configurada e aprovada", "existente", [CE]),
  K(7, "Ausência nunca vira zero", "existente", [CE]),
  K(8, "Fatos append-only", "lacuna", [], "Tabelas a criar."),
  K(9, "Escrita só por writer com capacidade", "lacuna"),
  K(10, "Sem DML direto para authenticated", "lacuna"),
  K(11, "Idempotência", "lacuna"),
  K(12, "Certificado só com regra e documento", "parcial", [CE]),
  K(13, "Verificação pública sem dado pessoal", "existente", [CE]),
  K(14, "Datas do calendário aplicável", "parcial", [C_.calendarios.migration]),
  K(15, "Efeito funcional nunca presumido", "existente", [CE]),
  K(16, "Plataforma externa nunca presumida", "existente", ["src/features/professional-development/development-audit.ts"]),
  K(17, "Exportação auditada", "existente", [C_.emissoes.migration]),
  K(18, "Evidência SQL/TS/E2E", "parcial", ["src/features/professional-development/development-audit.test.ts"]),
];

export const devAuditSummary = (rows: readonly DevRow[]) =>
  rows.reduce<Record<DevStatus, number>>((a, r) => ({ ...a, [r.status]: a[r.status] + 1 }), { existente: 0, parcial: 0, lacuna: 0, bloqueado: 0 });

export function devAuditProblems(exists: (p: string) => boolean, read: (p: string) => string): string[] {
  const p: string[] = [];
  if (DEV_SECTIONS.length !== 47 || DEV_CRITERIA.length !== 18) p.push("Esperadas 47 seções e 18 critérios.");
  for (const src of Object.values(C_)) {
    if (!exists(src.migration)) { p.push(`migration ausente ${src.migration}`); continue; }
    const sql = read(src.migration);
    for (const t of src.tables) if (!new RegExp(`CREATE TABLE (IF NOT EXISTS )?public\\.${t}\\b`).test(sql)) p.push(`${t} não nasce em ${src.migration}`);
  }
  for (const r of [...DEV_SECTIONS, ...DEV_CRITERIA]) {
    if ((r.status === "existente" || r.status === "parcial") && r.evidence.length === 0) p.push(`#${r.n} sem evidência`);
    for (const e of r.evidence) if (!exists(e)) p.push(`#${r.n}: evidência ausente ${e}`);
    if ((r.status === "lacuna" || r.status === "bloqueado") && r.n > 0 && r.status === "bloqueado" && !r.gap) p.push(`#${r.n} bloqueado sem motivo`);
  }
  return p;
}
