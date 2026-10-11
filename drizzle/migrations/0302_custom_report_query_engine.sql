-- Gerador personalizado: catálogo semântico fechado + execução parametrizada SECURITY INVOKER (RLS de quem consulta).
CREATE TABLE public.report_custom_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  base_source text NOT NULL,
  joins text[] NOT NULL DEFAULT '{}',
  spec_sha256 text NOT NULL,
  row_total integer,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.report_custom_runs TO authenticated;
GRANT ALL ON public.report_custom_runs TO service_role;
ALTER TABLE public.report_custom_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own runs read" ON public.report_custom_runs FOR SELECT TO authenticated USING (actor_id = auth.uid());
CREATE POLICY "own runs insert" ON public.report_custom_runs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

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
   "fields":{"engagement_id":{"label":"ID da atuação","type":"id"},"person_id":{"label":"ID da pessoa","type":"id"},"school_id":{"label":"ID da escola","type":"id"},"class_id":{"label":"ID da turma","type":"id"},"cargo":{"label":"Cargo (rótulo)","type":"text"},"tipo":{"label":"Tipo de atuação","type":"text"},"abrangencia":{"label":"Abrangência","type":"text"},"inicio":{"label":"Início","type":"date"},"fim":{"label":"Fim","type":"date"}}}
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
  {"id":"atuacao_turma","from":"atuacoes","to":"turmas","on":["class_id","class_id"],"card":"N:1"}
 ],
 "gaps": [
  {"from":"servidores","to":"jornadas","reason":"Não há fonte de jornada/horário de servidor: a jornada 2026 registrada é do estudante. Jornada por servidor depende de grade com atuação vinculada."},
  {"from":"servidores","to":"atuacoes","reason":"Registros das planilhas de pessoal não têm chave de pessoa; nome sem chave não identifica pessoa, então não há ligação a atuações do SIGEM."},
  {"from":"servidores","to":"turmas","reason":"Planilha de pessoal não informa turma; a ligação servidor × turma só existe por atuação, que não está ligada à planilha."}
 ]
}$j$::jsonb
$c$;

-- Catálogo público para a tela: sem o texto SQL.
CREATE OR REPLACE FUNCTION public.report_custom_catalog()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $f$
DECLARE c jsonb := public.rcq_catalog_internal(); s text; out jsonb := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'rcq:auth-required'; END IF;
  FOR s IN SELECT jsonb_object_keys(c->'sources') LOOP
    out := out || jsonb_build_object(s, (c->'sources'->s) - 'sql');
  END LOOP;
  RETURN jsonb_build_object('sources', out, 'joins', c->'joins', 'gaps', c->'gaps');
END $f$;

CREATE OR REPLACE FUNCTION public.report_custom_query(_spec jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $f$
DECLARE
  cat jsonb := public.rcq_catalog_internal();
  base text := _spec->>'source';
  aliases jsonb := '{}'::jsonb;   -- alias -> source
  jn jsonb; jdef jsonb; jid text; from_sql text; used_joins text[] := '{}';
  sens boolean := COALESCE((_spec->>'includeSensitive')::boolean, false);
  sel text[] := '{}'; grp text[] := '{}'; outcols jsonb := '[]'; i int := 0;
  item jsonb; expr text; where_sql text; order_sql text := ''; q text;
  lim int := LEAST(GREATEST(COALESCE((_spec->>'limit')::int, 100), 1), 1000);
  off int := GREATEST(COALESCE((_spec->>'offset')::int, 0), 0);
  has_measures boolean := jsonb_array_length(COALESCE(_spec->'measures','[]')) > 0;
  has_group boolean := jsonb_array_length(COALESCE(_spec->'groupBy','[]')) > 0;
  rollup boolean := COALESCE((_spec->>'subtotals')::boolean, false);
  res jsonb; tot bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'rcq:auth-required'; END IF;
  IF base IS NULL OR NOT (cat->'sources' ? base) THEN RAISE EXCEPTION 'rcq:unknown-source'; END IF;
  aliases := jsonb_build_object(base, base);
  from_sql := format('(%s) %I', cat->'sources'->base->>'sql', base);
  FOR jn IN SELECT * FROM jsonb_array_elements_text(COALESCE(_spec->'joins','[]')) LOOP NULL; END LOOP;
  FOR jid IN SELECT jsonb_array_elements_text(COALESCE(_spec->'joins','[]')) LOOP
    SELECT j INTO jdef FROM jsonb_array_elements(cat->'joins') j WHERE j->>'id' = jid;
    IF jdef IS NULL THEN RAISE EXCEPTION 'rcq:unknown-join %', jid; END IF;
    IF NOT aliases ? (jdef->>'from') THEN RAISE EXCEPTION 'rcq:join-not-connected %', jid; END IF;
    IF aliases ? (jdef->>'to') THEN RAISE EXCEPTION 'rcq:source-twice %', jdef->>'to'; END IF;
    aliases := aliases || jsonb_build_object(jdef->>'to', jdef->>'to');
    used_joins := used_joins || jid;
    from_sql := from_sql || format(' LEFT JOIN (%s) %I ON %I.%I = %I.%I', cat->'sources'->(jdef->>'to')->>'sql', jdef->>'to',
      jdef->>'from', jdef->'on'->>0, jdef->>'to', jdef->'on'->>1);
  END LOOP;
  IF array_length(used_joins,1) > 4 THEN RAISE EXCEPTION 'rcq:too-many-joins'; END IF;

  -- Seleção
  IF has_group OR has_measures THEN
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'groupBy','[]')) LOOP
      expr := public.rcq_field(cat, aliases, item #>> '{}', sens);
      i := i + 1; sel := sel || format('%s AS c%s', expr, i); grp := grp || expr;
      outcols := outcols || jsonb_build_object('id', 'c'||i, 'field', item #>> '{}', 'kind', 'group');
    END LOOP;
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'measures','[]')) LOOP
      i := i + 1;
      CASE item->>'agg'
        WHEN 'count' THEN expr := 'count(*)';
        WHEN 'percent' THEN expr := 'round(count(*) * 100.0 / NULLIF(sum(count(*)) OVER (PARTITION BY ' || CASE WHEN rollup AND has_group THEN 'GROUPING(' || array_to_string(grp, ',') || ')' ELSE '1' END || '),0), 2)';
        WHEN 'count_distinct' THEN expr := format('count(DISTINCT %s)', public.rcq_field(cat, aliases, item->>'field', sens));
        WHEN 'sum' THEN expr := format('sum(%s)', public.rcq_num(cat, aliases, item->>'field'));
        WHEN 'avg' THEN expr := format('round(avg(%s), 2)', public.rcq_num(cat, aliases, item->>'field'));
        WHEN 'min' THEN expr := format('min(%s)', public.rcq_field(cat, aliases, item->>'field', sens));
        WHEN 'max' THEN expr := format('max(%s)', public.rcq_field(cat, aliases, item->>'field', sens));
        ELSE RAISE EXCEPTION 'rcq:unknown-aggregate';
      END CASE;
      sel := sel || format('%s AS c%s', expr, i);
      outcols := outcols || jsonb_build_object('id', 'c'||i, 'field', item->>'field', 'agg', item->>'agg', 'kind', 'measure');
    END LOOP;
    IF rollup AND has_group THEN sel := sel || format('GROUPING(%s) AS _nivel', array_to_string(grp, ',')); END IF;
  ELSE
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'columns','[]')) LOOP
      expr := public.rcq_field(cat, aliases, item #>> '{}', sens);
      i := i + 1; sel := sel || format('%s AS c%s', expr, i);
      outcols := outcols || jsonb_build_object('id', 'c'||i, 'field', item #>> '{}', 'kind', 'column');
    END LOOP;
  END IF;
  IF i = 0 THEN RAISE EXCEPTION 'rcq:no-columns'; END IF;
  IF i > 40 THEN RAISE EXCEPTION 'rcq:too-many-columns'; END IF;

  where_sql := public.rcq_filter(cat, aliases, _spec->'filter', sens, 0);
  q := format('SELECT %s FROM %s%s', array_to_string(sel, ', '), from_sql, CASE WHEN where_sql IS NULL THEN '' ELSE ' WHERE ' || where_sql END);
  IF has_group OR has_measures THEN
    IF has_group THEN q := q || CASE WHEN rollup THEN ' GROUP BY ROLLUP(' ELSE ' GROUP BY (' END || array_to_string(grp, ',') || ')'; END IF;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'sort','[]')) LOOP
    IF (item->>'col') !~ '^c[0-9]{1,2}$' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(outcols) o WHERE o->>'id' = item->>'col') THEN RAISE EXCEPTION 'rcq:bad-sort'; END IF;
    order_sql := order_sql || CASE WHEN order_sql = '' THEN '' ELSE ', ' END || format('%I %s NULLS LAST', item->>'col', CASE WHEN item->>'dir' = 'desc' THEN 'DESC' ELSE 'ASC' END);
  END LOOP;
  IF rollup AND has_group THEN order_sql := CASE WHEN order_sql = '' THEN '' ELSE order_sql || ', ' END || '_nivel'; END IF;
  IF order_sql = '' THEN order_sql := '1'; END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(z) - ''_rn'' - ''_total'' ORDER BY z._rn), ''[]''::jsonb), max(z._total) FROM (SELECT t.*, row_number() OVER (ORDER BY %s) AS _rn, count(*) OVER () AS _total FROM (%s) t ORDER BY %s LIMIT %s OFFSET %s) z',
    order_sql, q, order_sql, lim, off) INTO res, tot;

  INSERT INTO public.report_custom_runs(base_source, joins, spec_sha256, row_total)
  VALUES (base, used_joins, encode(extensions.digest(_spec::text, 'sha256'), 'hex'), COALESCE(tot, 0));

  RETURN jsonb_build_object('columns', outcols, 'rows', res, 'total', COALESCE(tot, 0), 'limit', lim, 'offset', off);
END $f$;

CREATE OR REPLACE FUNCTION public.rcq_field(cat jsonb, aliases jsonb, ref text, sens boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $f$
DECLARE a text := split_part(ref, '.', 1); f text := split_part(ref, '.', 2); d jsonb;
BEGIN
  IF ref IS NULL OR NOT aliases ? a THEN RAISE EXCEPTION 'rcq:field-source-not-in-query %', ref; END IF;
  d := cat->'sources'->(aliases->>a)->'fields'->f;
  IF d IS NULL THEN RAISE EXCEPTION 'rcq:unknown-field %', ref; END IF;
  IF COALESCE((d->>'sensitive')::boolean, false) AND NOT sens THEN RAISE EXCEPTION 'rcq:sensitive-not-allowed %', ref; END IF;
  RETURN format('%I.%I', a, f);
END $f$;

CREATE OR REPLACE FUNCTION public.rcq_num(cat jsonb, aliases jsonb, ref text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $f$
DECLARE e text := public.rcq_field(cat, aliases, ref, false);
BEGIN
  IF cat->'sources'->(aliases->>split_part(ref,'.',1))->'fields'->split_part(ref,'.',2)->>'type' <> 'number' THEN RAISE EXCEPTION 'rcq:not-numeric %', ref; END IF;
  RETURN e;
END $f$;

CREATE OR REPLACE FUNCTION public.rcq_filter(cat jsonb, aliases jsonb, node jsonb, sens boolean, depth int)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $f$
DECLARE parts text[] := '{}'; ch jsonb; p text; e text; t text; op text; val jsonb; cast_t text; lit text;
BEGIN
  IF node IS NULL OR node = 'null'::jsonb THEN RETURN NULL; END IF;
  IF depth > 4 THEN RAISE EXCEPTION 'rcq:filter-too-deep'; END IF;
  IF node ? 'items' THEN
    FOR ch IN SELECT * FROM jsonb_array_elements(node->'items') LOOP
      p := public.rcq_filter(cat, aliases, ch, sens, depth + 1);
      IF p IS NOT NULL THEN parts := parts || ('(' || p || ')'); END IF;
    END LOOP;
    IF array_length(parts, 1) IS NULL THEN RETURN NULL; END IF;
    IF array_length(parts, 1) > 30 THEN RAISE EXCEPTION 'rcq:too-many-filters'; END IF;
    RETURN array_to_string(parts, CASE WHEN node->>'op' = 'or' THEN ' OR ' ELSE ' AND ' END);
  END IF;
  e := public.rcq_field(cat, aliases, node->>'field', sens);
  t := cat->'sources'->(aliases->>split_part(node->>'field','.',1))->'fields'->split_part(node->>'field','.',2)->>'type';
  cast_t := CASE t WHEN 'number' THEN 'numeric' WHEN 'date' THEN 'date' WHEN 'boolean' THEN 'boolean' ELSE 'text' END;
  op := node->>'operator'; val := node->'value';
  lit := CASE WHEN val IS NULL OR jsonb_typeof(val) = 'array' THEN NULL ELSE format('%L::%s', val #>> '{}', cast_t) END;
  IF op IN ('contains','starts','not_contains') AND t NOT IN ('text','id') THEN RAISE EXCEPTION 'rcq:operator-type %', op; END IF;
  IF op IN ('gt','gte','lt','lte','between') AND t NOT IN ('number','date') THEN RAISE EXCEPTION 'rcq:operator-type %', op; END IF;
  RETURN CASE op
    WHEN 'eq' THEN format('%s = %s', e, lit)
    WHEN 'neq' THEN format('%s IS DISTINCT FROM %s', e, lit)
    WHEN 'contains' THEN format('%s::text ILIKE %L', e, '%' || replace(replace(val #>> '{}', '%', '\%'), '_', '\_') || '%')
    WHEN 'not_contains' THEN format('COALESCE(%s::text,'''') NOT ILIKE %L', e, '%' || replace(replace(val #>> '{}', '%', '\%'), '_', '\_') || '%')
    WHEN 'starts' THEN format('%s::text ILIKE %L', e, replace(replace(val #>> '{}', '%', '\%'), '_', '\_') || '%')
    WHEN 'gt' THEN format('%s > %s', e, lit) WHEN 'gte' THEN format('%s >= %s', e, lit)
    WHEN 'lt' THEN format('%s < %s', e, lit) WHEN 'lte' THEN format('%s <= %s', e, lit)
    WHEN 'between' THEN format('%s BETWEEN %L::%s AND %L::%s', e, val->>0, cast_t, val->>1, cast_t)
    WHEN 'in' THEN format('%s IN (%s)', e, (SELECT string_agg(format('%L::%s', x, cast_t), ',') FROM jsonb_array_elements_text(val) x))
    WHEN 'is_null' THEN format('%s IS NULL', e)
    WHEN 'not_null' THEN format('%s IS NOT NULL', e)
    ELSE public.rcq_raise('rcq:unknown-operator')
  END;
END $f$;

CREATE OR REPLACE FUNCTION public.rcq_raise(msg text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $f$ BEGIN RAISE EXCEPTION '%', msg; END $f$;

REVOKE ALL ON FUNCTION public.report_custom_query(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_custom_catalog() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rcq_catalog_internal() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rcq_field(jsonb, jsonb, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rcq_num(jsonb, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rcq_filter(jsonb, jsonb, jsonb, boolean, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rcq_raise(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_custom_query(jsonb), public.report_custom_catalog(), public.rcq_catalog_internal(),
  public.rcq_field(jsonb, jsonb, text, boolean), public.rcq_num(jsonb, jsonb, text), public.rcq_filter(jsonb, jsonb, jsonb, boolean, int), public.rcq_raise(text) TO authenticated;