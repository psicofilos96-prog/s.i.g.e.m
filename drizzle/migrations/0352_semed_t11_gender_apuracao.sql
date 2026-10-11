-- TSEMED.11 — Tabela 11: matrícula inicial por gênero apurada das matrículas válidas na data de corte e do sexo
-- registrado na identidade do estudante. Data de corte e mapa (esquema/valor do cadastro → coluna) são regra da rede,
-- versionada e sem semente; sem regra, sem data de início ou sem sexo registrado ⇒ "não informado"/não apurado, nunca suposição.
CREATE TABLE public.semed_t11_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL, version int NOT NULL CHECK (version >= 1),
  cutoff_date date NOT NULL, sex_map jsonb NOT NULL, basis text NOT NULL CHECK (length(basis) BETWEEN 5 AND 500),
  recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, version)
);
GRANT SELECT ON public.semed_t11_rule_versions TO authenticated;
GRANT ALL ON public.semed_t11_rule_versions TO service_role;
ALTER TABLE public.semed_t11_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regra T11 legível por autenticados" ON public.semed_t11_rule_versions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER semed_t11_rule_immutable BEFORE UPDATE OR DELETE ON public.semed_t11_rule_versions FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();

CREATE OR REPLACE FUNCTION public.semed_t11_record_rule(_year int, _expected_version int, _cutoff date, _sex_map jsonb, _basis text)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cur int; k text; v text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_is_network() THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF _cutoff IS NULL OR extract(year FROM _cutoff) NOT BETWEEN _year - 1 AND _year THEN RAISE EXCEPTION 'semed:t11-data-invalida'; END IF;
  IF _sex_map IS NULL OR jsonb_typeof(_sex_map) <> 'object' OR _sex_map = '{}'::jsonb THEN RAISE EXCEPTION 'semed:t11-mapa-invalido'; END IF;
  FOR k, v IN SELECT key, value #>> '{}' FROM jsonb_each(_sex_map) LOOP
    IF v NOT IN ('masc','fem') OR k !~ '^[^/]+/[^/]+$' THEN RAISE EXCEPTION 'semed:t11-mapa-invalido'; END IF;
  END LOOP;
  IF coalesce(length(trim(_basis)), 0) < 5 THEN RAISE EXCEPTION 'semed:motivo-obrigatorio'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('semed-t11-rule:' || _year));
  SELECT max(version) INTO cur FROM public.semed_t11_rule_versions WHERE year = _year;
  IF coalesce(cur, 0) <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'semed:base-desatualizada'; END IF;
  INSERT INTO public.semed_t11_rule_versions (year, version, cutoff_date, sex_map, basis, recorded_by)
    VALUES (_year, coalesce(cur, 0) + 1, _cutoff, _sex_map, trim(_basis), auth.uid());
  RETURN coalesce(cur, 0) + 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_t11_record_rule(int,int,date,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_t11_record_rule(int,int,date,jsonb,text) TO authenticated;

-- Contagem por estudante distinto (matrícula válida na data de corte); sexo = última versão da identidade.
CREATE OR REPLACE FUNCTION public.semed_t11_compute(_school text, _year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.semed_t11_rule_versions; ids text[]; undated bigint; gaps jsonb := '[]'::jsonb; m int; f int; ni int; um int; tot int;
BEGIN
  SELECT * INTO r FROM public.semed_t11_rule_versions WHERE year = _year ORDER BY version DESC LIMIT 1;
  IF r.id IS NULL THEN RETURN jsonb_build_object('rule_version', NULL, 'cutoff', NULL, 'totals', '{}'::jsonb, 'gaps', jsonb_build_array('regra-ausente')); END IF;
  SELECT active_ids, undated_count INTO ids, undated FROM public.active_enrollments_at(_school, r.cutoff_date, now());
  WITH st AS (
    SELECT DISTINCT e.student_id FROM public.school_enrollments e WHERE e.id::text = ANY (ids)
  ), sx AS (
    SELECT st.student_id, iv.sex_scheme_id, iv.sex_value_id FROM st
    LEFT JOIN LATERAL (SELECT v.sex_scheme_id, v.sex_value_id FROM public.student_identity_versions v
      WHERE v.student_id = st.student_id ORDER BY v.version DESC LIMIT 1) iv ON true)
  SELECT count(*) FILTER (WHERE r.sex_map ->> (sex_scheme_id || '/' || sex_value_id) = 'masc'),
         count(*) FILTER (WHERE r.sex_map ->> (sex_scheme_id || '/' || sex_value_id) = 'fem'),
         count(*) FILTER (WHERE sex_value_id IS NULL),
         count(*) FILTER (WHERE sex_value_id IS NOT NULL AND r.sex_map ->> (sex_scheme_id || '/' || sex_value_id) IS NULL),
         count(*)
    INTO m, f, ni, um, tot FROM sx;
  IF undated > 0 THEN gaps := gaps || '"matriculas-sem-data-de-inicio"'; END IF;
  IF ni > 0 THEN gaps := gaps || '"sexo-nao-informado"'; END IF;
  IF um > 0 THEN gaps := gaps || '"sexo-fora-do-mapa"'; END IF;
  gaps := gaps || '"turmas-sem-ano-etapa"';
  RETURN jsonb_build_object('rule_version', r.version, 'cutoff', r.cutoff_date, 'gaps', gaps,
    'totals', jsonb_build_object('masc', m, 'fem', f, 'nao_informado', ni, 'fora_do_mapa', um, 'total', tot, 'sem_data', undated));
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_t11_compute(text,int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.semed_t11_apuracao(_school text, _year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'semed:sem-sessao'; END IF;
  IF NOT public.semed_can_read(_school) THEN RETURN NULL; END IF;
  RETURN public.semed_t11_compute(_school, _year);
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_t11_apuracao(text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_t11_apuracao(text,int) TO authenticated;

-- Avanço da tabela só quando o total digitado por gênero confere com a apuração, e só se a apuração é completa
-- (sem matrícula sem data, sem sexo não informado ou fora do mapa); incompleta ⇒ não há base para recusar.
CREATE OR REPLACE FUNCTION public.semed_t11_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sub public.semed_table_submissions; vals jsonb; ap jsonb; col text; typed numeric;
BEGIN
  IF NEW.act NOT IN ('enviar-conferencia','conferir','enviar','fechar') THEN RETURN NEW; END IF;
  SELECT * INTO sub FROM public.semed_table_submissions WHERE id = NEW.submission_id;
  IF sub.table_code <> '11' THEN RETURN NEW; END IF;
  ap := public.semed_t11_compute(sub.school_id, sub.year);
  IF ap ->> 'rule_version' IS NULL OR (ap -> 'totals' ->> 'sem_data')::int > 0 OR (ap -> 'totals' ->> 'nao_informado')::int > 0
     OR (ap -> 'totals' ->> 'fora_do_mapa')::int > 0 THEN RETURN NEW; END IF;
  SELECT field_values INTO vals FROM public.semed_table_submission_events WHERE submission_id = sub.id AND act = 'salvar' ORDER BY seq DESC LIMIT 1;
  FOREACH col IN ARRAY ARRAY['masc','fem'] LOOP
    SELECT sum((value #>> '{}')::numeric) INTO typed FROM jsonb_each(coalesce(vals, '{}')) WHERE key LIKE 'm.%.' || col;
    IF coalesce(typed, 0) <> (ap -> 'totals' ->> col)::numeric THEN RAISE EXCEPTION 'semed:t11-divergente:%', col; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER semed_t11_guard BEFORE INSERT ON public.semed_table_submission_events FOR EACH ROW EXECUTE FUNCTION public.semed_t11_guard();

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_semed(_operation_id text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
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