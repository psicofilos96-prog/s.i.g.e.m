-- TSEMED.REC — Conciliação CIECE das Tabelas SEMED: verificações derivadas na leitura (nunca gravadas), comparando só
-- fontes com a MESMA data de referência e o mesmo escopo (escola+ano); pendências são ledger append-only presas à
-- impressão digital dos valores comparados, então divergência nunca é apagada e valor alterado reabre a pendência.
CREATE OR REPLACE FUNCTION public.semed_typed_sum(_school text, _year int, _code text, _suffix text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH ev AS (
    SELECT e.seq, e.field_values FROM public.semed_table_submissions s JOIN public.semed_table_submission_events e ON e.submission_id = s.id
    WHERE s.school_id = _school AND s.year = _year AND s.table_code = _code AND e.act = 'salvar' ORDER BY e.seq DESC LIMIT 1)
  SELECT CASE WHEN ev.seq IS NULL THEN NULL ELSE jsonb_build_object('seq', ev.seq, 'sum',
    (SELECT sum((value #>> '{}')::numeric) FROM jsonb_each(ev.field_values) WHERE key LIKE 'm.%' AND (_suffix IS NULL OR key LIKE '%.' || _suffix) AND jsonb_typeof(value) = 'number')) END
  FROM (SELECT 1) x LEFT JOIN ev ON true $$;
REVOKE EXECUTE ON FUNCTION public.semed_typed_sum(text,int,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.semed_reconciliation_compute(_school text, _year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r4 public.semed_t04_rule_versions; r6 public.semed_t06_rule_versions; r11 public.semed_t11_rule_versions;
  t4 jsonb; t6 jsonb; t11m jsonb; t11f jsonb; t11 numeric; ap11 jsonb; mp record; ros jsonb; nstaff int; nform int; ndiv int;
  out jsonb := '[]'::jsonb; t11seq int;
  FUNCTION_DUMMY int;
BEGIN
  SELECT * INTO r4 FROM public.semed_t04_rule_versions WHERE year = _year ORDER BY version DESC LIMIT 1;
  SELECT * INTO r6 FROM public.semed_t06_rule_versions WHERE year = _year ORDER BY version DESC LIMIT 1;
  SELECT * INTO r11 FROM public.semed_t11_rule_versions WHERE year = _year ORDER BY version DESC LIMIT 1;
  t4 := public.semed_typed_sum(_school, _year, '04', NULL);
  t6 := public.semed_typed_sum(_school, _year, '06', 'inicial');
  t11m := public.semed_typed_sum(_school, _year, '11', 'masc'); t11f := public.semed_typed_sum(_school, _year, '11', 'fem');
  t11 := CASE WHEN t11m IS NULL THEN NULL ELSE coalesce((t11m->>'sum')::numeric, 0) + coalesce((t11f->>'sum')::numeric, 0) END;
  t11seq := (t11m->>'seq')::int;
  ap11 := public.semed_t11_compute(_school, _year);

  -- C1: Tabela 04 (total da grade) × Tabela 11 (masc+fem) — só com a mesma data de referência.
  out := out || jsonb_build_object('key', 't04-x-t11', 'label', 'Tabela 04 (total por idade) × Tabela 11 (total por gênero)',
    'date_a', r4.reference_date, 'date_b', r11.cutoff_date, 'a', t4->'sum', 'b', t11,
    'sources', jsonb_build_array(jsonb_build_object('fonte', 'Tabela 04', 'evento', t4->'seq', 'regra', r4.version), jsonb_build_object('fonte', 'Tabela 11', 'evento', t11seq, 'regra', r11.version)),
    'status', CASE WHEN r4.id IS NULL OR r11.id IS NULL THEN 'nao-comparavel:regra-ausente' WHEN r4.reference_date <> r11.cutoff_date THEN 'nao-comparavel:datas-diferentes'
      WHEN t4 IS NULL OR t11 IS NULL THEN 'sem-dado' WHEN (t4->>'sum')::numeric = t11 THEN 'confere' ELSE 'divergente' END);
  -- C2: Tabela 06 (matrícula inicial) × Tabela 11.
  out := out || jsonb_build_object('key', 't06-x-t11', 'label', 'Tabela 06 (matrícula inicial) × Tabela 11 (total por gênero)',
    'date_a', r6.initial_date, 'date_b', r11.cutoff_date, 'a', t6->'sum', 'b', t11,
    'sources', jsonb_build_array(jsonb_build_object('fonte', 'Tabela 06', 'evento', t6->'seq', 'regra', r6.version), jsonb_build_object('fonte', 'Tabela 11', 'evento', t11seq, 'regra', r11.version)),
    'status', CASE WHEN r6.id IS NULL OR r11.id IS NULL THEN 'nao-comparavel:regra-ausente' WHEN r6.initial_date <> r11.cutoff_date THEN 'nao-comparavel:datas-diferentes'
      WHEN t6 IS NULL OR t11 IS NULL THEN 'sem-dado' WHEN (t6->>'sum')::numeric = t11 THEN 'confere' ELSE 'divergente' END);
  -- C3: Tabela 11 × matrícula/enturmação do cadastro na data de corte.
  out := out || jsonb_build_object('key', 't11-x-matricula', 'label', 'Tabela 11 × matrículas válidas do cadastro na data de corte',
    'date_a', r11.cutoff_date, 'date_b', r11.cutoff_date, 'a', t11, 'b', ap11->'totals'->'total',
    'sources', jsonb_build_array(jsonb_build_object('fonte', 'Tabela 11', 'evento', t11seq, 'regra', r11.version), jsonb_build_object('fonte', 'Matrículas (cadastro central)', 'sem_data', ap11->'totals'->'sem_data')),
    'status', CASE WHEN r11.id IS NULL THEN 'nao-comparavel:regra-ausente' WHEN coalesce((ap11->'totals'->>'sem_data')::int, 0) > 0 THEN 'nao-comparavel:matriculas-sem-data'
      WHEN t11 IS NULL THEN 'sem-dado' WHEN t11 = (ap11->'totals'->>'total')::numeric THEN 'confere' ELSE 'divergente' END);
  -- C4: Tabela 11 × Mapa mensal declarado — só se a data de corte é o último dia do mês do mapa.
  SELECT m.id, m.month, m.total_ii, m.source_file INTO mp FROM public.school_declared_monthly_maps m
    WHERE m.school_id = _school AND m.year = extract(year FROM r11.cutoff_date) AND m.month = extract(month FROM r11.cutoff_date)
    ORDER BY m.created_at DESC LIMIT 1;
  out := out || jsonb_build_object('key', 't11-x-mapa', 'label', 'Tabela 11 × Mapa Estatístico mensal declarado (total II)',
    'date_a', r11.cutoff_date, 'date_b', CASE WHEN mp.id IS NULL THEN NULL ELSE (make_date(extract(year FROM r11.cutoff_date)::int, mp.month, 1) + interval '1 month' - interval '1 day')::date END,
    'a', t11, 'b', mp.total_ii,
    'sources', jsonb_build_array(jsonb_build_object('fonte', 'Tabela 11', 'evento', t11seq), jsonb_build_object('fonte', 'Mapa mensal declarado', 'arquivo', mp.source_file, 'mes', mp.month)),
    'status', CASE WHEN r11.id IS NULL THEN 'nao-comparavel:regra-ausente' WHEN mp.id IS NULL THEN 'nao-comparavel:sem-mapa-do-mes'
      WHEN r11.cutoff_date <> (date_trunc('month', r11.cutoff_date) + interval '1 month' - interval '1 day')::date THEN 'nao-comparavel:datas-diferentes'
      WHEN t11 IS NULL OR mp.total_ii IS NULL THEN 'sem-dado' WHEN t11 = mp.total_ii THEN 'confere' ELSE 'divergente' END);
  -- C5/C6: Tabela 10 × cadastro de servidores.
  SELECT count(*) INTO nstaff FROM (SELECT DISTINCT public.semed_t10_staff_key(CASE WHEN c.outcome = 'candidato-unico' THEN c.candidate_person_id END, s.full_name, s.registration)
    FROM public.staff_administrative_records s LEFT JOIN LATERAL (SELECT x.outcome, x.candidate_person_id FROM public.staff_reconciliation_candidates x WHERE x.staff_record_id = s.id ORDER BY x.derived_at DESC LIMIT 1) c ON true
    WHERE s.school_id = _school) k;
  SELECT count(DISTINCT v.staff_key) INTO nform FROM public.semed_t10_formation_versions v
    WHERE v.school_id = _school AND v.year = _year AND NOT v.withdrawn AND NOT EXISTS (SELECT 1 FROM public.semed_t10_formation_versions n WHERE n.supersedes_id = v.id);
  out := out || jsonb_build_object('key', 't10-x-servidores', 'label', 'Tabela 10: servidores do cadastro × servidores com formação informada',
    'date_a', NULL, 'date_b', NULL, 'a', nstaff, 'b', nform,
    'sources', jsonb_build_array(jsonb_build_object('fonte', 'Cadastro de pessoal'), jsonb_build_object('fonte', 'Tabela 10 (formações)')),
    'status', CASE WHEN nstaff = 0 THEN 'sem-dado' WHEN nform = nstaff THEN 'confere' ELSE 'divergente' END);
  -- C7: Tabela 09 matrícula por etapa — sem fonte central, sempre lacuna declarada.
  out := out || jsonb_build_object('key', 't09-etapa', 'label', 'Tabela 09: matrícula por etapa × enturmação por etapa',
    'date_a', NULL, 'date_b', NULL, 'a', NULL, 'b', NULL, 'sources', jsonb_build_array(jsonb_build_object('fonte', 'Turmas (ano/etapa)')),
    'status', 'nao-comparavel:turmas-sem-ano-etapa');
  RETURN (SELECT jsonb_agg(c || jsonb_build_object('fingerprint', md5(concat_ws('|', c->>'key', c->>'a', c->>'b', c->>'date_a', c->>'date_b', c->>'status')))) FROM jsonb_array_elements(out) c);
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_reconciliation_compute(text,int) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.semed_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id), year int NOT NULL,
  check_key text NOT NULL, fingerprint text NOT NULL, seq int NOT NULL,
  act text NOT NULL CHECK (act IN ('abrir','retornar','aprovar','comentar')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 1000),
  snapshot jsonb NOT NULL, actor_scope text NOT NULL CHECK (actor_scope IN ('escola','rede')),
  recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, year, check_key, seq)
);
GRANT SELECT ON public.semed_reconciliation_events TO authenticated;
GRANT ALL ON public.semed_reconciliation_events TO service_role;
ALTER TABLE public.semed_reconciliation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pendências da conciliação no escopo" ON public.semed_reconciliation_events FOR SELECT TO authenticated USING (public.semed_can_read(school_id));
CREATE TRIGGER semed_reconciliation_immutable BEFORE UPDATE OR DELETE ON public.semed_reconciliation_events FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();

CREATE OR REPLACE FUNCTION public.semed_reconciliation_at(_school text, _year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'semed:sem-sessao'; END IF;
  IF NOT public.semed_can_read(_school) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  RETURN public.semed_reconciliation_compute(_school, _year);
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_reconciliation_at(text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_reconciliation_at(text,int) TO authenticated;

-- Rede: todas as escolas com zona e dependência do cadastro (consolidação por escola/zona/tipo).
CREATE OR REPLACE FUNCTION public.semed_reconciliation_network(_year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_is_network() THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('school_id', s.id, 'name', v.official_name, 'zona', v.location_kind,
      'tipo', v.administrative_dependency, 'checks', public.semed_reconciliation_compute(s.id, _year)) ORDER BY v.official_name), '[]'::jsonb)
    FROM public.institutional_schools s
    LEFT JOIN LATERAL (SELECT x.official_name, x.location_kind, x.administrative_dependency FROM public.institutional_school_record_versions x
      WHERE x.school_id = s.id ORDER BY x.version_number DESC LIMIT 1) v ON true);
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_reconciliation_network(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_reconciliation_network(int) TO authenticated;

-- Atos humanos: abrir (escola revisora ou rede), retornar/aprovar (só rede, com justificativa), comentar (escola ou rede).
-- O ato fica preso à impressão digital atual; nada apaga a divergência, que continua sendo recalculada.
CREATE OR REPLACE FUNCTION public.semed_reconciliation_act(_school text, _year int, _check text, _fingerprint text, _act text, _reason text, _expected_seq int)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c jsonb; last int; scope text; net boolean := public.semed_is_network();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'semed:sem-sessao'; END IF;
  IF _act IN ('retornar','aprovar') AND NOT net THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF _act IN ('abrir','comentar') AND NOT (net OR public.semed_can_review(_school) OR public.semed_can_fill(_school)) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF _act NOT IN ('abrir','retornar','aprovar','comentar') THEN RAISE EXCEPTION 'semed:acao-desconhecida'; END IF;
  IF coalesce(length(trim(_reason)), 0) < 5 THEN RAISE EXCEPTION 'semed:motivo-obrigatorio'; END IF;
  SELECT x INTO c FROM jsonb_array_elements(public.semed_reconciliation_compute(_school, _year)) x WHERE x->>'key' = _check;
  IF c IS NULL THEN RAISE EXCEPTION 'semed:rec-verificacao-desconhecida'; END IF;
  IF c->>'fingerprint' <> _fingerprint THEN RAISE EXCEPTION 'semed:base-desatualizada'; END IF;
  IF _act IN ('abrir','retornar','aprovar') AND c->>'status' <> 'divergente' THEN RAISE EXCEPTION 'semed:rec-sem-divergencia'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('semed-rec:' || _school || ':' || _year || ':' || _check));
  SELECT max(seq) INTO last FROM public.semed_reconciliation_events WHERE school_id = _school AND year = _year AND check_key = _check;
  IF coalesce(last, 0) <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'semed:base-desatualizada'; END IF;
  scope := CASE WHEN net THEN 'rede' ELSE 'escola' END;
  INSERT INTO public.semed_reconciliation_events (school_id, year, check_key, fingerprint, seq, act, reason, snapshot, actor_scope, recorded_by)
    VALUES (_school, _year, _check, _fingerprint, coalesce(last, 0) + 1, _act, trim(_reason), c, scope, auth.uid());
  RETURN coalesce(last, 0) + 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_reconciliation_act(text,int,text,text,text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_reconciliation_act(text,int,text,text,text,text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_semed(_operation_id text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.semed_reconciliation_events a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_submission_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_submissions s WHERE public.semed_fixture_row(to_jsonb(s))
    AND NOT EXISTS (SELECT 1 FROM public.semed_table_submission_events e WHERE e.submission_id = s.id); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t04_adjustments a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t04_rule_versions a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t06_rule_versions a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t11_rule_versions a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_attachments a WHERE a.withdrawn_of IS NOT NULL AND public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_attachments a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  LOOP
    DELETE FROM public.semed_t10_formation_versions a WHERE public.semed_fixture_row(to_jsonb(a))
      AND NOT EXISTS (SELECT 1 FROM public.semed_t10_formation_versions b WHERE b.supersedes_id = a.id);
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c; EXIT WHEN c = 0;
  END LOOP;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;