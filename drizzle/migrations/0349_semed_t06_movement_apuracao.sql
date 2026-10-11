-- TSEMED.6 — Tabela 06: movimento e rendimento derivados SÓ de eventos reais.
CREATE TABLE public.semed_t06_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL, version int NOT NULL CHECK (version >= 1),
  initial_date date NOT NULL, final_date date NOT NULL CHECK (final_date > initial_date),
  movement_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  standing_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  basis text NOT NULL CHECK (length(trim(basis)) >= 5),
  recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, version)
);
GRANT SELECT ON public.semed_t06_rule_versions TO authenticated;
GRANT ALL ON public.semed_t06_rule_versions TO service_role;
ALTER TABLE public.semed_t06_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regra da Tabela 06 legível por contas" ON public.semed_t06_rule_versions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER semed_t06_rule_immutable BEFORE UPDATE OR DELETE ON public.semed_t06_rule_versions FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();

CREATE OR REPLACE FUNCTION public.semed_t06_record_rule(_year int, _expected_version int, _initial date, _final date, _movement_map jsonb, _standing_map jsonb, _basis text)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cur int; k text; v jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_is_network() THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF _initial IS NULL OR _final IS NULL OR _final <= _initial OR extract(year FROM _final) NOT BETWEEN _year AND _year + 1 THEN RAISE EXCEPTION 'semed:datas-invalidas'; END IF;
  IF coalesce(length(trim(_basis)), 0) < 5 THEN RAISE EXCEPTION 'semed:fundamento-obrigatorio'; END IF;
  IF jsonb_typeof(coalesce(_movement_map, '{}')) <> 'object' OR jsonb_typeof(coalesce(_standing_map, '{}')) <> 'object' THEN RAISE EXCEPTION 'semed:mapa-invalido'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(coalesce(_movement_map, '{}')) LOOP
    IF v #>> '{}' NOT IN ('transferencia','cancelamento','evasao') THEN RAISE EXCEPTION 'semed:coluna-invalida:%', k; END IF;
  END LOOP;
  FOR k, v IN SELECT * FROM jsonb_each(coalesce(_standing_map, '{}')) LOOP
    IF v #>> '{}' NOT IN ('aprovados','reprovados') THEN RAISE EXCEPTION 'semed:coluna-invalida:%', k; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('semed-t06-rule:' || _year));
  SELECT max(version) INTO cur FROM public.semed_t06_rule_versions WHERE year = _year;
  IF coalesce(cur, 0) <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'semed:base-desatualizada'; END IF;
  INSERT INTO public.semed_t06_rule_versions (year, version, initial_date, final_date, movement_map, standing_map, basis, recorded_by)
    VALUES (_year, coalesce(cur, 0) + 1, _initial, _final, coalesce(_movement_map, '{}'), coalesce(_standing_map, '{}'), trim(_basis), auth.uid());
  RETURN coalesce(cur, 0) + 1;
END $$;

CREATE OR REPLACE FUNCTION public.semed_t06_compute(_school text, _year int)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.semed_t06_rule_versions; gaps jsonb := '[]'::jsonb; t jsonb;
  undated int; inicial int; entradas int; unmapped int; untyped_exits int; tr int; ca int; ev int;
  closed int; open_st int; unmapped_st int; ap int; rp int; fin int;
BEGIN
  SELECT * INTO r FROM public.semed_t06_rule_versions WHERE year = _year ORDER BY version DESC LIMIT 1;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('rule_version', NULL, 'totals', '{}'::jsonb, 'gaps', jsonb_build_array('regra-ausente'), 'counts', '{}'::jsonb);
  END IF;
  WITH enr AS (
    SELECT e.id, e.opened_on FROM public.school_enrollments e
    WHERE e.school_id = _school AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id)
      AND (e.opened_on IS NULL OR e.opened_on <= r.final_date))
  SELECT count(*) FILTER (WHERE opened_on IS NULL),
         count(*) FILTER (WHERE opened_on <= r.initial_date AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = enr.id AND x.ended_on < r.initial_date)),
         count(*) FILTER (WHERE opened_on > r.initial_date)
    INTO undated, inicial, entradas FROM enr;
  IF undated > 0 THEN inicial := NULL; entradas := NULL; gaps := gaps || '"matriculas-sem-data-de-inicio"'; END IF;

  WITH mv AS (
    SELECT m.movement_type_id FROM public.student_movement_events m
    JOIN public.school_enrollments e ON e.id = m.enrollment_id AND e.school_id = _school
    WHERE m.effective_on > r.initial_date AND m.effective_on <= r.final_date
      AND NOT EXISTS (SELECT 1 FROM public.student_movement_events s WHERE s.supersedes_id = m.id))
  SELECT count(*) FILTER (WHERE r.movement_map ->> movement_type_id = 'transferencia'),
         count(*) FILTER (WHERE r.movement_map ->> movement_type_id = 'cancelamento'),
         count(*) FILTER (WHERE r.movement_map ->> movement_type_id = 'evasao'),
         count(*) FILTER (WHERE r.movement_map ->> movement_type_id IS NULL)
    INTO tr, ca, ev, unmapped FROM mv;
  SELECT count(*) INTO untyped_exits FROM public.school_enrollment_endings x
    JOIN public.school_enrollments e ON e.id = x.enrollment_id AND e.school_id = _school
    WHERE x.ended_on > r.initial_date AND x.ended_on <= r.final_date
      AND NOT EXISTS (SELECT 1 FROM public.student_movement_events m WHERE m.enrollment_id = e.id AND m.effective_on = x.ended_on);
  IF unmapped > 0 THEN gaps := gaps || '"movimentacao-sem-coluna-na-regra"'; END IF;
  IF untyped_exits > 0 THEN gaps := gaps || '"saida-sem-tipo-de-movimentacao"'; END IF;
  IF unmapped > 0 OR untyped_exits > 0 THEN tr := NULL; ca := NULL; ev := NULL; END IF;

  WITH st AS (
    SELECT DISTINCT ON (a.student_id, a.cycle_id) a.cycle_id, a.class_id, a.standing_id
    FROM public.academic_standing_versions a
    JOIN public.school_enrollments e ON e.student_id = a.student_id AND e.cycle_id = a.cycle_id AND e.school_id = _school
    WHERE NOT EXISTS (SELECT 1 FROM public.academic_standing_versions s WHERE s.supersedes_version_id = a.id)
    ORDER BY a.student_id, a.cycle_id, a.version_number DESC)
  SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.cycle_closing_versions c WHERE c.class_id = st.class_id AND c.cycle_id = st.cycle_id)),
         count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.cycle_closing_versions c WHERE c.class_id = st.class_id AND c.cycle_id = st.cycle_id)),
         count(*) FILTER (WHERE r.standing_map ->> standing_id IS NULL),
         count(*) FILTER (WHERE r.standing_map ->> standing_id = 'aprovados'),
         count(*) FILTER (WHERE r.standing_map ->> standing_id = 'reprovados')
    INTO closed, open_st, unmapped_st, ap, rp FROM st;
  IF closed = 0 THEN gaps := gaps || '"resultado-sem-fechamento"'; ap := NULL; rp := NULL;
  ELSIF open_st > 0 OR unmapped_st > 0 THEN gaps := gaps || '"resultado-parcial"'; ap := NULL; rp := NULL; END IF;

  fin := CASE WHEN inicial IS NULL OR entradas IS NULL OR tr IS NULL THEN NULL ELSE inicial + entradas - tr - ca - ev END;
  gaps := gaps || '"ano-etapa-sem-oferta-registrada"';
  IF fin IS NOT NULL AND ap IS NOT NULL AND ap + rp <> fin THEN gaps := gaps || '"resultado-diverge-da-matricula-final"'; END IF;
  t := jsonb_strip_nulls(jsonb_build_object('inicial', inicial, 'recebidos', entradas, 'transferencia', tr, 'cancelamento', ca, 'evasao', ev, 'final', fin, 'aprovados', ap, 'reprovados', rp));
  RETURN jsonb_build_object('rule_version', r.version, 'initial_date', r.initial_date, 'final_date', r.final_date, 'totals', t, 'gaps', gaps,
    'counts', jsonb_build_object('sem_data_de_inicio', undated, 'movimentacoes_sem_coluna', unmapped, 'saidas_sem_tipo', untyped_exits,
      'situacoes_sem_fechamento', open_st, 'situacoes_sem_coluna', unmapped_st));
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_t06_compute(text,int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.semed_t06_apuracao(_school text, _year int)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'semed:sem-sessao'; END IF;
  IF NOT public.semed_can_read(_school) THEN RETURN NULL; END IF;
  RETURN public.semed_t06_compute(_school, _year);
END $$;

CREATE OR REPLACE FUNCTION public.semed_t06_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sub public.semed_table_submissions; vals jsonb; ap jsonb; col text; typed numeric;
BEGIN
  IF NEW.act NOT IN ('enviar-conferencia','conferir','enviar','fechar') THEN RETURN NEW; END IF;
  SELECT * INTO sub FROM public.semed_table_submissions WHERE id = NEW.submission_id;
  IF sub.table_code <> '06' THEN RETURN NEW; END IF;
  SELECT field_values INTO vals FROM public.semed_table_submission_events WHERE submission_id = sub.id AND act = 'salvar' ORDER BY seq DESC LIMIT 1;
  ap := public.semed_t06_compute(sub.school_id, sub.year) -> 'totals';
  FOR col IN SELECT jsonb_object_keys(ap) LOOP
    CONTINUE WHEN col = 'final';
    SELECT sum((value #>> '{}')::numeric) INTO typed FROM jsonb_each(coalesce(vals, '{}')) WHERE key LIKE 'm.%.' || col;
    IF coalesce(typed, 0) <> (ap ->> col)::numeric THEN RAISE EXCEPTION 'semed:t06-divergente:%', col; END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_t06_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER semed_t06_guard BEFORE INSERT ON public.semed_table_submission_events FOR EACH ROW EXECUTE FUNCTION public.semed_t06_guard();

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
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;

REVOKE EXECUTE ON FUNCTION public.semed_t06_record_rule(int,int,date,date,jsonb,jsonb,text), public.semed_t06_apuracao(text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_t06_record_rule(int,int,date,date,jsonb,jsonb,text), public.semed_t06_apuracao(text,int) TO authenticated;
