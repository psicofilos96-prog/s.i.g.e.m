-- TSEMED.4 — Tabela 04: regra da distorção (data de referência + idade mínima de distorção por linha) é dado
-- versionado registrado pela rede; apuração lê só o cadastro central (um estudante por enturmação vigente na data);
-- ajustes da escola sobre a apuração são ledger append-only com motivo.
CREATE TABLE public.semed_t04_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL, version int NOT NULL CHECK (version >= 1),
  reference_date date NOT NULL,
  thresholds jsonb NOT NULL,
  basis text NOT NULL CHECK (length(trim(basis)) >= 5),
  recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, version)
);
CREATE TABLE public.semed_t04_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id), year int NOT NULL,
  cell_key text NOT NULL, computed_value int, value int CHECK (value IS NULL OR value >= 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 5),
  recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX semed_t04_adj_idx ON public.semed_t04_adjustments (school_id, year, cell_key, created_at DESC);
GRANT SELECT ON public.semed_t04_rule_versions, public.semed_t04_adjustments TO authenticated;
GRANT ALL ON public.semed_t04_rule_versions, public.semed_t04_adjustments TO service_role;
ALTER TABLE public.semed_t04_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semed_t04_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regra da Tabela 04 legível por contas" ON public.semed_t04_rule_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ajustes da Tabela 04 no escopo" ON public.semed_t04_adjustments FOR SELECT TO authenticated USING (public.semed_can_read(school_id));
CREATE TRIGGER semed_t04_rule_immutable BEFORE UPDATE OR DELETE ON public.semed_t04_rule_versions FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();
CREATE TRIGGER semed_t04_adj_immutable BEFORE UPDATE OR DELETE ON public.semed_t04_adjustments FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();

CREATE OR REPLACE FUNCTION public.semed_fixture_row(_old jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE op text := current_setting('sigem.bo_cleanup_op', true);
BEGIN
  IF op IS NULL OR op !~ '^bo-[0-9a-f]{12}$' OR NOT public.technical_automation_enabled() THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = op
    AND a.user_id::text IN (_old->>'actor_user_id', _old->>'created_by', _old->>'recorded_by'));
END $$;

CREATE OR REPLACE FUNCTION public.semed_t04_record_rule(_year int, _expected_version int, _reference_date date, _thresholds jsonb, _basis text)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cur int; k text; v jsonb; def jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_is_network() THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF _reference_date IS NULL OR extract(year FROM _reference_date) NOT BETWEEN _year - 1 AND _year THEN RAISE EXCEPTION 'semed:data-referencia-invalida'; END IF;
  IF coalesce(length(trim(_basis)), 0) < 5 THEN RAISE EXCEPTION 'semed:fundamento-obrigatorio'; END IF;
  SELECT definition INTO def FROM public.semed_table_catalog WHERE year = _year AND table_code = '04' ORDER BY version DESC LIMIT 1;
  IF def IS NULL THEN RAISE EXCEPTION 'semed:catalogo-ausente'; END IF;
  IF jsonb_typeof(_thresholds) <> 'object' THEN RAISE EXCEPTION 'semed:limiares-invalidos'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(_thresholds) LOOP
    IF public.semed_key_spec(def, 'm.' || k || '.a6') IS NULL THEN RAISE EXCEPTION 'semed:linha-desconhecida:%', k; END IF;
    IF jsonb_typeof(v) <> 'number' OR (v::text)::numeric <> trunc((v::text)::numeric) OR (v::text)::int NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'semed:idade-invalida:%', k; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('semed-t04-rule:' || _year));
  SELECT max(version) INTO cur FROM public.semed_t04_rule_versions WHERE year = _year;
  IF coalesce(cur, 0) <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'semed:base-desatualizada'; END IF;
  INSERT INTO public.semed_t04_rule_versions (year, version, reference_date, thresholds, basis, recorded_by)
    VALUES (_year, coalesce(cur, 0) + 1, _reference_date, _thresholds, trim(_basis), auth.uid());
  RETURN coalesce(cur, 0) + 1;
END $$;

CREATE OR REPLACE FUNCTION public.semed_t04_record_adjustments(_school text, _year int, _items jsonb, _reason text)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE it jsonb; def jsonb; n int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_can_fill(_school) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF coalesce(length(trim(_reason)), 0) < 5 THEN RAISE EXCEPTION 'semed:motivo-obrigatorio'; END IF;
  SELECT c.definition INTO def FROM public.semed_table_catalog c WHERE c.year = _year AND c.table_code = '04' ORDER BY c.version DESC LIMIT 1;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 600 THEN RAISE EXCEPTION 'semed:ajustes-invalidos'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF public.semed_key_spec(def, it->>'cell') IS NULL OR (it->>'cell') NOT LIKE 'm.%' THEN RAISE EXCEPTION 'semed:campo-desconhecido:%', it->>'cell'; END IF;
    INSERT INTO public.semed_t04_adjustments (school_id, year, cell_key, computed_value, value, reason, recorded_by)
      VALUES (_school, _year, it->>'cell', nullif(it->>'computed', '')::int, nullif(it->>'value', '')::int, trim(_reason), auth.uid());
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Apuração: um estudante conta uma vez (enturmação vigente na data de referência, sem sucessora, sem término até a data).
-- Idade e ano/etapa exigem fontes ausentes no cadastro (data de nascimento; oferta da turma): cada estudante sem elas
-- é contado como lacuna, nunca alocado numa célula.
CREATE OR REPLACE FUNCTION public.semed_t04_apuracao(_school text, _year int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.semed_t04_rule_versions; ref date; students bigint; dup bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_can_read(_school) THEN RETURN NULL; END IF;
  SELECT * INTO r FROM public.semed_t04_rule_versions WHERE year = _year ORDER BY version DESC LIMIT 1;
  ref := r.reference_date;
  IF ref IS NULL THEN
    RETURN jsonb_build_object('rule_version', NULL, 'reference_date', NULL, 'students', NULL, 'cells', '{}'::jsonb,
      'gaps', jsonb_build_array('regra-ausente'));
  END IF;
  WITH heads AS (
    SELECT e.id, e.student_id FROM public.class_enrollment_episodes e
    WHERE e.school_id = _school AND e.valid_from <= ref
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on <= ref))
  SELECT count(DISTINCT student_id), count(*) - count(DISTINCT student_id) INTO students, dup FROM heads;
  RETURN jsonb_build_object('rule_version', r.version, 'reference_date', ref, 'students', students, 'duplicate_allocations', dup,
    'without_birth_date', students, 'without_stage', students, 'cells', '{}'::jsonb,
    'gaps', jsonb_build_array('data-de-nascimento-sem-fonte', 'ano-etapa-da-turma-sem-oferta-registrada'));
END $$;

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
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.semed_t04_record_rule(int,int,date,jsonb,text), public.semed_t04_record_adjustments(text,int,jsonb,text), public.semed_t04_apuracao(text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_t04_record_rule(int,int,date,jsonb,text), public.semed_t04_record_adjustments(text,int,jsonb,text), public.semed_t04_apuracao(text,int) TO authenticated;
