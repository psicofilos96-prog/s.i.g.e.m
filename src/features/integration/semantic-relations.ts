/** Camada semântica do SIGEM: relações tipadas entre entidades, com chave, cardinalidade,
 * vigência, origem e estado. "comprovada" = chave real no banco; "lacuna" = não há chave
 * determinística e o vínculo NUNCA é inferido por nome. Execução só por `report_custom_query`
 * (catálogo fechado, SECURITY INVOKER) e reconciliação por `integration_reconciliation_at`. */
export type Cardinality = "1:1" | "1:N" | "N:1" | "N:M";
export type RelationState = "comprovada" | "lacuna" | "setorial";
export interface SemanticRelation {
  key: string; from: string; to: string;
  fromKey: string; toKey: string;
  cardinality: Cardinality;
  validity: string; origin: string; state: RelationState;
  /** fonte/join correspondente no catálogo do gerador, quando consultável */
  catalogJoin?: string; note?: string;
}

export const SEMANTIC_RELATIONS: readonly SemanticRelation[] = [
  { key: "escola->turma", from: "escolas", to: "turmas", fromKey: "institutional_schools.id", toKey: "institutional_classes.school_id", cardinality: "1:N", validity: "valid_from/valid_until da turma", origin: "carga oficial 2026", state: "comprovada", catalogJoin: "turmas→escolas" },
  { key: "escola->matricula", from: "escolas", to: "matriculas", fromKey: "institutional_schools.id", toKey: "school_enrollments.school_id", cardinality: "1:N", validity: "opened_on declarado (ausente = não declarado, nunca a data da carga)", origin: "carga oficial 2026 + declaração da secretaria", state: "comprovada", catalogJoin: "matriculas→escolas" },
  { key: "estudante->matricula", from: "estudantes", to: "matriculas", fromKey: "student_id", toKey: "school_enrollments.student_id", cardinality: "1:N", validity: "por ciclo", origin: "carga oficial 2026", state: "comprovada", catalogJoin: "matriculas→estudantes" },
  { key: "matricula->enturmacao", from: "matriculas", to: "enturmacoes", fromKey: "school_enrollments.id", toKey: "class_enrollment_episodes.enrollment_id", cardinality: "1:N", validity: "valid_from do episódio (data técnica da carga)", origin: "carga oficial 2026", state: "comprovada", catalogJoin: "vinculos→matriculas" },
  { key: "enturmacao->turma", from: "enturmacoes", to: "turmas", fromKey: "class_enrollment_episodes.class_id", toKey: "institutional_classes.id", cardinality: "N:1", validity: "episódio", origin: "carga oficial 2026", state: "comprovada", catalogJoin: "vinculos→turmas" },
  { key: "docente->turma", from: "docentes", to: "turmas", fromKey: "institutional_engagement_scope_classes.engagement_id", toKey: "institutional_classes.id", cardinality: "N:M", validity: "vigência da atuação", origin: "atuações SIGEM", state: "comprovada", catalogJoin: "atuacoes" },
  { key: "estudante->jornada", from: "estudantes", to: "jornadas", fromKey: "student_id", toKey: "jornada declarada", cardinality: "1:N", validity: "declaração", origin: "declaração da escola", state: "comprovada", catalogJoin: "jornadas" },
  { key: "turma->frequencia", from: "turmas", to: "frequencia", fromKey: "institutional_classes.id", toKey: "attendance_record_versions.class_id", cardinality: "1:N", validity: "data da aula", origin: "Diário", state: "comprovada", catalogJoin: "frequencia" },
  { key: "instrumento->avaliacao", from: "turmas", to: "avaliacoes", fromKey: "assessment_instruments.id", toKey: "assessment_entry_versions.instrument_id", cardinality: "1:N", validity: "versão do resultado", origin: "Pauta", state: "comprovada", catalogJoin: "avaliacoes" },
  { key: "servidor->atuacao", from: "servidores", to: "docentes", fromKey: "staff_administrative_records", toKey: "institutional_engagements", cardinality: "N:M", validity: "—", origin: "planilha de pessoal 2026", state: "lacuna", note: "planilha não traz chave da pessoa; casar por nome criaria vínculo falso" },
  { key: "servidor->jornada-trabalho", from: "servidores", to: "jornadas", fromKey: "—", toKey: "—", cardinality: "1:N", validity: "—", origin: "inexistente", state: "lacuna", note: "não há registro de jornada de trabalho do servidor" },
  { key: "escola->alimentacao", from: "escolas", to: "alimentacao", fromKey: "institutional_schools.id", toKey: "meal_order_versions.school_id", cardinality: "1:N", validity: "competência do pedido", origin: "Alimentação", state: "setorial", note: "lida só pelas funções do setor; não entra na consulta livre" },
];

export const isQueryable = (r: SemanticRelation) => r.state === "comprovada" && !!r.catalogJoin;

/** Duas relações formam caminho só se a ponta coincide e ambas são comprovadas. */
export function path(keys: string[]): { ok: boolean; reason?: string } {
  const rs = keys.map((k) => SEMANTIC_RELATIONS.find((r) => r.key === k));
  for (const [i, r] of rs.entries()) {
    if (!r) return { ok: false, reason: `relação desconhecida: ${keys[i]}` };
    if (!isQueryable(r)) return { ok: false, reason: `${r.key}: ${r.note ?? r.state}` };
    const prev = rs[i - 1];
    if (prev && prev.to !== r.from && prev.to !== r.to && prev.from !== r.from) return { ok: false, reason: `${prev.key} não encadeia com ${r.key}` };
  }
  return { ok: true };
}
