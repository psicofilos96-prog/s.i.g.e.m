-- Integração: frequência e resultados de avaliação entram no catálogo fechado (leitura sob a RLS de quem consulta); alimentação e AEE declarados como lacuna.
CREATE OR REPLACE FUNCTION public.rcq_catalog_internal()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $c$
SELECT $j${
 "sources": {
  "escolas": {"label":"Escolas","grain":"uma linha por escola (versão vigente do cadastro)",
   "sql":"SELECT DISTINCT ON (school_id) school_id, official_name AS nome, administrative_dependency AS dependencia, location_kind AS localizacao, district AS bairro, classroom_count AS salas, active AS ativa FROM public.institutional_school_record_versions ORDER BY school_id, version_number DESC",
   "fields":{"school_id":{"label":"ID da escola","type":"id"},"nome":{"label":"Escola","type":"text"},"dependencia":{"label":"Dependência","type":"text"},"localizacao":{"label":"Localização","type":"text"},"bairro":{"label":"Bairro/distrito","type":"text"},"salas":{"label":"Salas","type":"number"},"ativa":{"label":"Ativa","type":"boolean"}}},
  "turmas": {"label":"Turmas","grain":"uma linha por turma registrada",
   "sql":"SELECT id AS class_id, school_id, academic_year_label AS ano_letivo, name AS turma, code AS codigo, stage_label_snapshot AS etapa, valid_from AS inicio, valid_until AS fim FROM public.institutional_classes",
   "fields":{"class_id":{"label":"ID da turma","type":"id"},"school_id":{"label":"ID da escola","type":"id"},"ano_letivo":{"label":"Ano letivo","type":"text"},"turma":{"label":"Turma","type":"text"},"codigo":{"label":"Código","type":"text"},"etapa":{"label":"Etapa","type":"text"},"inicio":{"label":"Início","type":"date"},"fim":{"label":"Fim","type":"date"}}},
  "vinculos": {"label":"Vínculos aluno × turma","grain":"um vínculo de turma corrente (correção substitui o anterior)",
   "sql":"SELECT e.id AS episode_id, e.student_id, e.school_id, e.class_id, e.enrollment_id, e.class_label_snapshot AS turma_rotulo, e.valid_from AS desde, x.ended_on AS encerrado_em, (x.episode_id IS NOT NULL) AS encerrado FROM public.class_enrollment_episodes e LEFT JOIN public.class_enrollment_episode_endings x ON x.episode_id = e.id WHERE NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)",
   "fields":{"episode_id":{"label":"ID do vínculo","type":"id"},"student_id":{"label":"ID do estudante","type":"id"},"school_id":{"label":"ID da escola","type":"id"},"class_id":{"label":"ID da turma","type":"id"},"enrollment_id":{"label":"ID da matrícula","type":"id"},"turma_rotulo":{"label":"Turma (rótulo do vínculo)","type":"text"},"desde":{"label":"Desde","type":"date"},"encerrado_em":{"label":"Encerrado em","type":"date"},"encerrado":{"label":"Encerrado","type":"boolean"}}},
  "matriculas": {"label":"Matrículas","grain":"uma matrícula corrente (sem correção posterior)",
   "sql":"SELECT m.id AS enrollment_id, m.student_id, m.school_id, m.academic_year_id AS ano_letivo, m.educational_offer_value_id AS oferta, m.opened_on AS aberta_em, m.institutional_number AS numero FROM public.school_enrollments m WHERE NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = m.id)",
   "fields":{"enrollment_id":{"label":"ID da matrícula","type":"id"},"student_id":{"label":"ID do estudante","type":"id"},"school_id":{"label":"ID da escola","type":"id"},"ano_letivo":{"label":"Ano letivo","type":"text"},"oferta":{"label":"Oferta","type":"text"},"aberta_em":{"label":"Aberta em","type":"date"},"numero":{"label":"Número de matrícula","type":"text","sensitive":true}}},
  "estudantes": {"label":"Estudantes","grain":"uma linha por estudante (versão vigente da identidade)",
   "sql":"SELECT DISTINCT ON (student_id) student_id, COALESCE(NULLIF(social_name,''), civil_name) AS nome, birth_date AS nascimento, sex_value_id AS sexo FROM public.student_identity_versions ORDER BY student_id, version DESC",
   "fields":{"student_id":{"label":"ID do estudante","type":"id"},"nome":{"label":"Nome do estudante","type":"text","sensitive":true},"nascimento":{"label":"Nascimento","type":"date","sensitive":true},"sexo":{"label":"Sexo","type":"text"}}},
  "servidores": {"label":"Servidores (planilhas de pessoal 2026)","grain":"uma linha por registro administrativo de pessoal; não é atuação no SIGEM",
   "sql":"SELECT id AS record_id, school_id, COALESCE(school_name_source, sector) AS unidade, sector AS setor, cargo, funcao, vinculo, grupo, situacao, full_name AS nome, registration AS matricula, reference_period AS referencia FROM public.staff_administrative_records",
   "fields":{"record_id":{"label":"ID do registro","type":"id"},"school_id":{"label":"ID da escola","type":"id"},"unidade":{"label":"Escola / setor (planilha)","type":"text"},"setor":{"label":"Setor","type":"text"},"cargo":{"label":"Cargo","type":"text"},"funcao":{"label":"Função","type":"text"},"vinculo":{"label":"Vínculo","type":"text"},"grupo":{"label":"Grupo da planilha","type":"text"},"situacao":{"label":"Situação","type":"text"},"nome":{"label":"Nome do servidor","type":"text","sensitive":true},"matricula":{"label":"Matrícula funcional","type":"text","sensitive":true},"referencia":{"label":"Referência","type":"text"}}},
  "jornadas": {"label":"Jornada declarada do estudante 2026","grain":"uma declaração de jornada por estudante × escola × turma (fonte 2026)",
   "sql":"SELECT student_id, school_id, class_id, link_role AS papel, stage_literal AS etapa, schedule_literal AS horario, weekly_load_literal AS carga_semanal FROM public.student_school_day_observations",
   "fields":{"student_id":{"label":"ID do estudante","type":"id"},"school_id":{"label":"ID da escola","type":"id"},"class_id":{"label":"ID da turma","type":"id"},"papel":{"label":"Papel do vínculo","type":"text"},"etapa":{"label":"Etapa declarada","type":"text"},"horario":{"label":"Horário declarado","type":"text"},"carga_semanal":{"label":"Carga semanal declarada","type":"text"}}},
  "atuacoes": {"label":"Atuações no SIGEM","grain":"uma atuação institucional (quem age no sistema)",
   "sql":"SELECT id AS engagement_id, person_id, school_id, class_id, position_label_snapshot AS cargo, engagement_kind_id AS tipo, scope_level AS abrangencia, valid_from AS inicio, valid_until AS fim FROM public.institutional_engagements",
   "fields":{"engagement_id":{"label":"ID da atuação","type":"id"},"person_id":{"label":"ID da pessoa","type":"id"},"school_id":{"label":"ID da escola","type":"id"},"class_id":{"label":"ID da turma","type":"id"},"cargo":{"label":"Cargo (rótulo)","type":"text"},"tipo":{"label":"Tipo de atuação","type":"text"},"abrangencia":{"label":"Abrangência","type":"text"},"inicio":{"label":"Início","type":"date"},"fim":{"label":"Fim","type":"date"}}},
  "frequencia": {"label":"Frequência (chamadas registradas)","grain":"uma chamada vigente por aula (correção substitui a anterior); visível só a quem registra/consulta frequência da turma",
   "sql":"SELECT a.logical_attendance_id AS chamada_id, a.class_id, a.component_id AS componente, (a.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date AS registrada_em, cardinality(a.eligible_student_ids) AS estudantes_elegiveis FROM public.attendance_record_versions a WHERE NOT EXISTS (SELECT 1 FROM public.attendance_record_versions n WHERE n.supersedes_version_id = a.id)",
   "fields":{"chamada_id":{"label":"ID da chamada","type":"id"},"class_id":{"label":"ID da turma","type":"id"},"componente":{"label":"Componente","type":"text"},"registrada_em":{"label":"Registrada em","type":"date"},"estudantes_elegiveis":{"label":"Estudantes na chamada","type":"number"}}},
  "avaliacoes": {"label":"Resultados de avaliação (Pauta)","grain":"um resultado vigente por estudante × instrumento; visível só a quem registra/consulta resultados da turma",
   "sql":"SELECT r.logical_entry_id AS resultado_id, r.student_id, r.class_id, r.period_id AS periodo, r.instrument_id AS instrumento, r.value_label AS valor_rotulo, CASE WHEN jsonb_typeof(r.value) = 'number' THEN (r.value #>> '{}')::numeric END AS valor_numerico, (r.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date AS registrado_em FROM public.assessment_entry_versions r WHERE NOT EXISTS (SELECT 1 FROM public.assessment_entry_versions n WHERE n.supersedes_version_id = r.id)",
   "fields":{"resultado_id":{"label":"ID do resultado","type":"id"},"student_id":{"label":"ID do estudante","type":"id"},"class_id":{"label":"ID da turma","type":"id"},"periodo":{"label":"Período","type":"text"},"instrumento":{"label":"Instrumento","type":"text"},"valor_rotulo":{"label":"Resultado (como registrado)","type":"text"},"valor_numerico":{"label":"Resultado numérico","type":"number"},"registrado_em":{"label":"Registrado em","type":"date"}}}
 },
 "joins": [
  {"id":"turma_escola","from":"turmas","to":"escolas","on":["school_id","school_id"],"card":"N:1"},
  {"id":"vinculo_turma","from":"vinculos","to":"turmas","on":["class_id","class_id"],"card":"N:1"},
  {"id":"vinculo_escola","from":"vinculos","to":"escolas","on":["school_id","school_id"],"card":"N:1"},
  {"id":"vinculo_estudante","from":"vinculos","to":"estudantes","on":["student_id","student_id"],"card":"N:1"},
  {"id":"vinculo_matricula","from":"vinculos","to":"matriculas","on":["enrollment_id","enrollment_id"],"card":"N:1"},
  {"id":"matricula_escola","from":"matriculas","to":"escolas","on":["school_id","school_id"],"card":"N:1"},
  {"id":"matricula_estudante","from":"matriculas","to":"estudantes","on":["student_id","student_id"],"card":"N:1"},
  {"id":"servidor_escola","from":"servidores","to":"escolas","on":["school_id","school_id"],"card":"N:1"},
  {"id":"jornada_escola","from":"jornadas","to":"escolas","on":["school_id","school_id"],"card":"N:1"},
  {"id":"jornada_turma","from":"jornadas","to":"turmas","on":["class_id","class_id"],"card":"N:1"},
  {"id":"jornada_estudante","from":"jornadas","to":"estudantes","on":["student_id","student_id"],"card":"N:1"},
  {"id":"atuacao_escola","from":"atuacoes","to":"escolas","on":["school_id","school_id"],"card":"N:1"},
  {"id":"atuacao_turma","from":"atuacoes","to":"turmas","on":["class_id","class_id"],"card":"N:1"},
  {"id":"frequencia_turma","from":"frequencia","to":"turmas","on":["class_id","class_id"],"card":"N:1"},
  {"id":"avaliacao_turma","from":"avaliacoes","to":"turmas","on":["class_id","class_id"],"card":"N:1"},
  {"id":"avaliacao_estudante","from":"avaliacoes","to":"estudantes","on":["student_id","student_id"],"card":"N:1"}
 ],
 "gaps": [
  {"from":"servidores","to":"jornadas","reason":"Não há fonte de jornada/horário de servidor: a jornada 2026 registrada é do estudante. Jornada por servidor depende de grade com atuação vinculada."},
  {"from":"servidores","to":"atuacoes","reason":"Registros das planilhas de pessoal não têm chave de pessoa; nome sem chave não identifica pessoa, então não há ligação a atuações do SIGEM."},
  {"from":"servidores","to":"turmas","reason":"Planilha de pessoal não informa turma; a ligação servidor × turma só existe por atuação, que não está ligada à planilha."}
,
  {"from":"alimentacao","to":"escolas","reason":"Pedidos, estoque e execução da Alimentação só são lidos pelas leituras próprias do setor, que aplicam as permissões da Alimentação; abrir essas tabelas à consulta livre ampliaria o acesso. Use os relatórios da Alimentação."},
  {"from":"aee","to":"estudantes","reason":"Atendimento educacional especializado é dado sensível de inclusão lido só pelas leituras do setor com autorização própria; não entra no cruzamento livre."},
  {"from":"frequencia","to":"estudantes","reason":"A chamada guarda as marcações por aula; a presença individual por estudante só é apurada no fechamento de frequência homologado, então não há cruzamento por estudante aqui."}
 ]
}$j$::jsonb
$c$;
