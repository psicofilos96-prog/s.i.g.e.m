-- AG — Censo Escolar: ciclo anual governado, snapshot imutável com impressão digital,
-- consistência estrutural versionada, staging genérico de fonte externa e comparação.
-- Nenhuma regra/layout oficial do Educacenso é criada: exportação oficial bloqueada por fonte.
-- Capacidades (fail-closed até política homologada): preparar-censo-escolar, conferir-censo-escolar,
-- consultar-censo-escolar (rede) e consultar-pendencias-do-censo (escola).

CREATE TABLE public.census_cycles (
  id text PRIMARY KEY,
  academic_year_id text NOT NULL UNIQUE REFERENCES public.institutional_academic_years(id),
  nature text NOT NULL CHECK (nature IN ('observado-importado', 'nativo')),
  reference_date date NOT NULL,
  opened_by_person uuid NOT NULL,
  opened_by_user uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.census_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id text NOT NULL REFERENCES public.census_cycles(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.census_snapshots(id),
  reference_date date NOT NULL,
  rule_set text NOT NULL,
  content jsonb NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  author_person uuid NOT NULL,
  author_user uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, version),
  UNIQUE (supersedes_id)
);
CREATE TABLE public.census_snapshot_conferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.census_snapshots(id),
  fingerprint text NOT NULL,
  person uuid NOT NULL,
  user_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.census_cycle_events (
  cycle_id text NOT NULL REFERENCES public.census_cycles(id),
  seq integer NOT NULL CHECK (seq >= 1),
  stage text NOT NULL CHECK (stage IN ('preparacao', 'validacao', 'pendencias', 'conferencia', 'snapshot')),
  snapshot_id uuid REFERENCES public.census_snapshots(id),
  fingerprint text,
  person uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cycle_id, seq)
);
CREATE TABLE public.census_source_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id text NOT NULL REFERENCES public.census_cycles(id),
  origin text NOT NULL CHECK (length(btrim(origin)) > 0),
  edition_layout text NOT NULL CHECK (length(btrim(edition_layout)) > 0),
  parser_id text NOT NULL,
  parser_version integer NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  staged_sha256 text NOT NULL,
  accepted jsonb NOT NULL,
  rejections jsonb NOT NULL,
  operator_person uuid NOT NULL,
  operator_user uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, parser_id, parser_version, source_sha256)
);

-- Somente leitura pelos readers DEFINER; nenhum DML direto para ninguém (inclusive automação).
REVOKE ALL ON public.census_cycles, public.census_snapshots, public.census_snapshot_conferences,
  public.census_cycle_events, public.census_source_imports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.census_cycles, public.census_snapshots, public.census_snapshot_conferences,
  public.census_cycle_events, public.census_source_imports TO service_role;
ALTER TABLE public.census_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.census_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.census_snapshot_conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.census_cycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.census_source_imports ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.census_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $fn$
BEGIN RAISE EXCEPTION 'census:append-only'; END $fn$;
CREATE TRIGGER census_cycles_immutable BEFORE UPDATE OR DELETE ON public.census_cycles FOR EACH ROW EXECUTE FUNCTION public.census_immutable();
CREATE TRIGGER census_snapshots_immutable BEFORE UPDATE OR DELETE ON public.census_snapshots FOR EACH ROW EXECUTE FUNCTION public.census_immutable();
CREATE TRIGGER census_conferences_immutable BEFORE UPDATE OR DELETE ON public.census_snapshot_conferences FOR EACH ROW EXECUTE FUNCTION public.census_immutable();
CREATE TRIGGER census_events_immutable BEFORE UPDATE OR DELETE ON public.census_cycle_events FOR EACH ROW EXECUTE FUNCTION public.census_immutable();
CREATE TRIGGER census_imports_immutable BEFORE UPDATE OR DELETE ON public.census_source_imports FOR EACH ROW EXECUTE FUNCTION public.census_immutable();

-- Pessoa natural autora (conta de órgão não é autora de ato censitário).
CREATE FUNCTION public.census_natural_person() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  me := public.s_current_person();
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = me AND p.actor_nature = 'pessoa-natural') THEN
    RAISE EXCEPTION 'census:natural-person-required'; END IF;
  RETURN me;
END $fn$;
REVOKE ALL ON FUNCTION public.census_natural_person() FROM PUBLIC, anon, authenticated, service_role;

-- Composição determinística dos fatos canônicos na data de referência (helper interno, sem EXECUTE externo).
-- Medida = {value:int|null, reason:text|null}; ausência/indeterminação nunca vira zero.
CREATE FUNCTION public.census_compose(_year text, _on date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE r jsonb;
BEGIN
  WITH sch AS (
    SELECT DISTINCT ON (v.school_id) v.school_id, v.active
      FROM public.institutional_school_record_versions v
     WHERE v.valid_from <= _on
     ORDER BY v.school_id, v.version_number DESC
  ), enr AS (
    SELECT se.id, se.school_id, se.student_id, se.opened_on,
      (SELECT min(x.ended_on) FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id) AS ended_on
      FROM public.school_enrollments se
     WHERE se.academic_year_id = _year AND public.af_enrollment_current(se.id)
  ), enr_open AS (
    SELECT * FROM enr WHERE (ended_on IS NULL OR ended_on >= _on) AND (opened_on IS NULL OR opened_on <= _on)
  ), ep AS (
    SELECT c.id, c.enrollment_id, c.school_id, c.class_id, c.valid_from
      FROM public.class_enrollment_episodes c
     WHERE public.af_episode_current(c.id) AND c.valid_from <= _on
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = c.id AND x.ended_on < _on)
       AND EXISTS (SELECT 1 FROM enr WHERE enr.id = c.enrollment_id)
  ), pos AS (
    SELECT p.school_id FROM public.allocation_curricular_positions p
     WHERE NOT p.annulled AND p.valid_from <= _on AND (p.valid_until IS NULL OR p.valid_until >= _on)
       AND NOT EXISTS (SELECT 1 FROM public.allocation_curricular_positions n WHERE n.supersedes_id = p.id)
  ), pst AS (
    SELECT p.school_id FROM public.professional_postings p
     WHERE p.valid_from <= _on AND (p.valid_until IS NULL OR p.valid_until >= _on)
       AND NOT EXISTS (SELECT 1 FROM public.professional_postings n WHERE n.supersedes_id = p.id)
  ), cls AS (
    SELECT c.school_id, count(*) n FROM public.institutional_classes c WHERE c.academic_year_id = _year GROUP BY 1
  ), per_school AS (
    SELECT s.school_id, s.active,
      (SELECT count(*) FROM enr_open e WHERE e.school_id = s.school_id AND e.opened_on IS NOT NULL) AS enr_known,
      (SELECT count(*) FROM enr_open e WHERE e.school_id = s.school_id AND e.opened_on IS NULL) AS enr_unknown,
      (SELECT count(*) FROM ep WHERE ep.school_id = s.school_id) AS ep_n,
      (SELECT count(*) FROM pos WHERE pos.school_id = s.school_id) AS pos_n,
      (SELECT count(*) FROM pst WHERE pst.school_id = s.school_id) AS pst_n,
      coalesce((SELECT cls.n FROM cls WHERE cls.school_id = s.school_id), 0) AS cls_n
    FROM sch s
  ), findings AS (
    SELECT 'vinculo-sem-inicio-efetivo' AS rule, school_id, count(*) AS n FROM enr_open WHERE opened_on IS NULL GROUP BY 2
    UNION ALL
    SELECT 'vinculo-ambiguo-no-ano', school_id, count(*) FROM (
      SELECT e.school_id, e.student_id FROM enr_open e GROUP BY 1, 2 HAVING count(*) > 1) z GROUP BY 2
    UNION ALL
    SELECT 'enturmacao-antes-do-vinculo', ep.school_id, count(*) FROM ep JOIN enr e ON e.id = ep.enrollment_id
      WHERE e.opened_on IS NOT NULL AND ep.valid_from < e.opened_on GROUP BY 2
    UNION ALL
    SELECT 'enturmacao-com-vinculo-encerrado', ep.school_id, count(*) FROM ep JOIN enr e ON e.id = ep.enrollment_id
      WHERE e.ended_on IS NOT NULL AND e.ended_on < _on GROUP BY 2
    UNION ALL
    SELECT 'enturmacao-em-turma-de-outra-escola-ou-ano', ep.school_id, count(*) FROM ep
      LEFT JOIN public.institutional_classes c ON c.id = ep.class_id
      WHERE c.id IS NULL OR c.school_id <> ep.school_id OR c.academic_year_id <> _year GROUP BY 2
    UNION ALL
    SELECT 'enturmacao-simultanea', school_id, count(*) FROM (
      SELECT ep.school_id, ep.enrollment_id FROM ep GROUP BY 1, 2 HAVING count(*) > 1) z GROUP BY 2
    UNION ALL
    SELECT 'vinculo-em-escola-sem-cadastro-vigente', e.school_id, count(*) FROM enr_open e
      WHERE NOT EXISTS (SELECT 1 FROM sch WHERE sch.school_id = e.school_id AND sch.active) GROUP BY 2
  )
  SELECT jsonb_build_object(
    'schema', 'sigem.census-snapshot.v1', 'academic_year_id', _year, 'reference_date', _on, 'rule_set', 'estrutural-v1',
    'schools', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'school_id', ps.school_id, 'active', ps.active,
        'measures', jsonb_build_object(
          'vinculos_ativos', CASE WHEN ps.enr_unknown > 0 THEN jsonb_build_object('value', NULL, 'reason', 'inicio-efetivo-nao-declarado', 'proven', ps.enr_known, 'unknown', ps.enr_unknown)
                                  ELSE jsonb_build_object('value', ps.enr_known, 'reason', NULL) END,
          'turmas', jsonb_build_object('value', ps.cls_n, 'reason', NULL),
          'enturmacoes_vigentes', CASE WHEN ps.enr_unknown > 0 AND ps.ep_n = 0 THEN jsonb_build_object('value', NULL, 'reason', 'vinculos-sem-inicio-efetivo')
                                       ELSE jsonb_build_object('value', ps.ep_n, 'reason', NULL) END,
          'posicoes_curriculares', CASE WHEN ps.ep_n = 0 THEN jsonb_build_object('value', NULL, 'reason', 'sem-enturmacao-vigente')
                                        ELSE jsonb_build_object('value', ps.pos_n, 'reason', NULL) END,
          'lotacoes_profissionais', jsonb_build_object('value', ps.pst_n, 'reason', NULL)
        )) ORDER BY ps.school_id) FROM per_school ps), '[]'::jsonb),
    'findings', coalesce((SELECT jsonb_agg(jsonb_build_object('rule', f.rule, 'rule_version', 1, 'school_id', f.school_id, 'count', f.n)
        ORDER BY f.rule, f.school_id) FROM findings f), '[]'::jsonb),
    'domains_unavailable', jsonb_build_array(
      jsonb_build_object('domain', 'atribuicoes-docentes', 'reason', 'fora-da-composicao-estrutural-v1'),
      jsonb_build_object('domain', 'regras-oficiais-educacenso', 'reason', 'EDUCACENSO_LAYOUT-BLOCKED_BY_OFFICIAL_SOURCE'))
  ) INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.census_compose(text, date) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.census_fingerprint(_content jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $fn$
  SELECT encode(sha256(convert_to(_content::text, 'UTF8')), 'hex') $fn$;
REVOKE ALL ON FUNCTION public.census_fingerprint(jsonb) FROM PUBLIC, anon;

CREATE FUNCTION public.census_head_seq(_cycle text) RETURNS integer LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT coalesce(max(e.seq), 0) FROM public.census_cycle_events e WHERE e.cycle_id = _cycle $fn$;
REVOKE ALL ON FUNCTION public.census_head_seq(text) FROM PUBLIC, anon, authenticated, service_role;

-- Writers humanos
CREATE FUNCTION public.census_open_cycle(_year text, _reference_date date, _reason text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; st text; yv record; cid text;
BEGIN
  me := public.census_natural_person();
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  IF _year IS NULL OR _reference_date IS NULL OR coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'census:arguments-required'; END IF;
  SELECT v.starts_on, v.ends_on INTO yv FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = _year ORDER BY v.version DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'census:year-not-found'; END IF;
  IF (yv.starts_on IS NOT NULL AND _reference_date < yv.starts_on) OR (yv.ends_on IS NOT NULL AND _reference_date > yv.ends_on) THEN
    RAISE EXCEPTION 'census:reference-outside-year'; END IF;
  SELECT s.state INTO st FROM public.academic_year_operational_state_at(_year) s LIMIT 1;
  cid := 'censo-' || _year;
  PERFORM pg_advisory_xact_lock(hashtext(cid));
  IF EXISTS (SELECT 1 FROM public.census_cycles c WHERE c.id = cid) THEN RAISE EXCEPTION 'census:cycle-exists'; END IF;
  INSERT INTO public.census_cycles(id, academic_year_id, nature, reference_date, opened_by_person, opened_by_user, reason)
    VALUES (cid, _year, CASE WHEN st = 'historico-importado' THEN 'observado-importado' ELSE 'nativo' END, _reference_date, me, auth.uid(), _reason);
  INSERT INTO public.census_cycle_events(cycle_id, seq, stage, person, user_id, reason) VALUES (cid, 1, 'preparacao', me, auth.uid(), _reason);
  RETURN cid;
END $fn$;

CREATE FUNCTION public.census_take_snapshot(_cycle text, _expected_head uuid, _reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; c record; head record; content jsonb; fp text; nid uuid; stage text;
BEGIN
  me := public.census_natural_person();
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(_cycle, '')));
  SELECT * INTO c FROM public.census_cycles x WHERE x.id = _cycle;
  IF NOT FOUND THEN RAISE EXCEPTION 'census:not-found'; END IF;
  SELECT e.stage INTO stage FROM public.census_cycle_events e WHERE e.cycle_id = _cycle ORDER BY e.seq DESC LIMIT 1;
  IF stage = 'snapshot' THEN RAISE EXCEPTION 'census:cycle-closed'; END IF;
  SELECT * INTO head FROM public.census_snapshots s WHERE s.cycle_id = _cycle
    AND NOT EXISTS (SELECT 1 FROM public.census_snapshots n WHERE n.supersedes_id = s.id) LIMIT 1;
  IF (head.id IS NULL) <> (_expected_head IS NULL) OR head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'census:stale'; END IF;
  IF head.id IS NOT NULL AND coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'census:reason-required'; END IF;
  content := public.census_compose(c.academic_year_id, c.reference_date);
  fp := public.census_fingerprint(content);
  IF head.id IS NOT NULL AND head.fingerprint = fp THEN RAISE EXCEPTION 'census:snapshot-unchanged'; END IF;
  INSERT INTO public.census_snapshots(cycle_id, version, supersedes_id, reference_date, rule_set, content, fingerprint, author_person, author_user, reason)
    VALUES (_cycle, coalesce(head.version, 0) + 1, head.id, c.reference_date, 'estrutural-v1', content, fp, me, auth.uid(), nullif(btrim(_reason), ''))
    RETURNING id INTO nid;
  RETURN jsonb_build_object('id', nid, 'version', coalesce(head.version, 0) + 1, 'fingerprint', fp);
END $fn$;

-- Conferência: a pessoa confere a impressão digital do snapshot; se os fatos mudaram desde então, exige novo snapshot.
CREATE FUNCTION public.census_confer_snapshot(_snapshot uuid, _fingerprint text, _note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; s record; c record; nid uuid;
BEGIN
  me := public.census_natural_person();
  IF NOT public.has_network_capability('conferir-censo-escolar') THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  SELECT * INTO s FROM public.census_snapshots x WHERE x.id = _snapshot;
  IF NOT FOUND THEN RAISE EXCEPTION 'census:not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(s.cycle_id));
  IF EXISTS (SELECT 1 FROM public.census_snapshots n WHERE n.supersedes_id = s.id) THEN RAISE EXCEPTION 'census:stale'; END IF;
  IF _fingerprint IS DISTINCT FROM s.fingerprint THEN RAISE EXCEPTION 'census:fingerprint-mismatch'; END IF;
  IF s.author_person = me THEN RAISE EXCEPTION 'census:segregation-required'; END IF;
  SELECT * INTO c FROM public.census_cycles x WHERE x.id = s.cycle_id;
  IF public.census_fingerprint(public.census_compose(c.academic_year_id, c.reference_date)) <> s.fingerprint THEN
    RAISE EXCEPTION 'census:snapshot-outdated'; END IF;
  INSERT INTO public.census_snapshot_conferences(snapshot_id, fingerprint, person, user_id, note)
    VALUES (s.id, s.fingerprint, me, auth.uid(), nullif(btrim(_note), '')) RETURNING id INTO nid;
  RETURN nid;
END $fn$;

-- Etapas do ciclo; 'homologacao' não existe enquanto não houver regra/competência homologada.
CREATE FUNCTION public.census_advance_stage(_cycle text, _expected_seq integer, _stage text, _reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; cur text; head record; conf record; nseq int; order_ text[] := ARRAY['preparacao','validacao','pendencias','conferencia','snapshot'];
BEGIN
  me := public.census_natural_person();
  IF _stage = 'homologacao' THEN RAISE EXCEPTION 'census:homologation-rule-missing'; END IF;
  IF _stage IN ('conferencia', 'snapshot') THEN
    IF NOT public.has_network_capability('conferir-censo-escolar') THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  ELSIF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'census:reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(_cycle, '')));
  IF NOT EXISTS (SELECT 1 FROM public.census_cycles c WHERE c.id = _cycle) THEN RAISE EXCEPTION 'census:not-found'; END IF;
  nseq := public.census_head_seq(_cycle);
  IF _expected_seq IS DISTINCT FROM nseq THEN RAISE EXCEPTION 'census:stale'; END IF;
  SELECT e.stage INTO cur FROM public.census_cycle_events e WHERE e.cycle_id = _cycle AND e.seq = nseq;
  IF array_position(order_, _stage) IS NULL OR array_position(order_, _stage) <> array_position(order_, cur) + 1 THEN
    RAISE EXCEPTION 'census:transition-invalid'; END IF;
  SELECT * INTO head FROM public.census_snapshots s WHERE s.cycle_id = _cycle
    AND NOT EXISTS (SELECT 1 FROM public.census_snapshots n WHERE n.supersedes_id = s.id) LIMIT 1;
  IF _stage IN ('pendencias', 'conferencia', 'snapshot') AND head.id IS NULL THEN RAISE EXCEPTION 'census:snapshot-required'; END IF;
  IF _stage = 'snapshot' THEN
    SELECT * INTO conf FROM public.census_snapshot_conferences k WHERE k.snapshot_id = head.id AND k.fingerprint = head.fingerprint
      ORDER BY k.created_at DESC LIMIT 1;
    IF conf.id IS NULL THEN RAISE EXCEPTION 'census:conference-required'; END IF;
    IF conf.person = me OR head.author_person = me THEN RAISE EXCEPTION 'census:segregation-required'; END IF;
  END IF;
  INSERT INTO public.census_cycle_events(cycle_id, seq, stage, snapshot_id, fingerprint, person, user_id, reason)
    VALUES (_cycle, nseq + 1, _stage, head.id, head.fingerprint, me, auth.uid(), _reason);
  RETURN nseq + 1;
END $fn$;

-- Staging genérico: parser registrado no banco. Sem layout oficial homologado, nenhum parser Educacenso existe.
CREATE FUNCTION public.census_source_parsers() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO '' AS $fn$
  SELECT jsonb_build_array(jsonb_build_object('id', 'sigem-agregado-por-escola', 'version', 1,
    'description', 'Linhas {school_id, measure, value|null} já agregadas, sem dado pessoal',
    'measures', jsonb_build_array('vinculos_ativos', 'turmas', 'enturmacoes_vigentes', 'posicoes_curriculares', 'lotacoes_profissionais'))) $fn$;
REVOKE ALL ON FUNCTION public.census_source_parsers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.census_source_parsers() TO authenticated;

CREATE FUNCTION public.census_stage_source(_cycle text, _origin text, _edition_layout text, _parser_id text, _parser_version integer,
  _source_sha256 text, _rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; p jsonb; acc jsonb := '[]'::jsonb; rej jsonb := '[]'::jsonb; r jsonb; i int := 0; seen text[] := '{}'; k text; nid uuid; v jsonb;
BEGIN
  me := public.census_natural_person();
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.census_cycles c WHERE c.id = _cycle) THEN RAISE EXCEPTION 'census:not-found'; END IF;
  IF _edition_layout ~* 'educacenso|inep' THEN RAISE EXCEPTION 'census:official-layout-not-homologated'; END IF;
  SELECT x INTO p FROM jsonb_array_elements(public.census_source_parsers()) x WHERE x->>'id' = _parser_id AND (x->>'version')::int = _parser_version;
  IF p IS NULL THEN RAISE EXCEPTION 'census:parser-not-registered'; END IF;
  IF _source_sha256 IS NULL OR _source_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'census:hash-invalid'; END IF;
  IF jsonb_typeof(_rows) <> 'array' THEN RAISE EXCEPTION 'census:rows-invalid'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    i := i + 1; v := r->'value';
    IF jsonb_typeof(r) <> 'object' OR coalesce(r->>'school_id', '') = '' OR coalesce(r->>'measure', '') = '' THEN
      rej := rej || jsonb_build_object('row', i, 'reason', 'campos-obrigatorios');
    ELSIF NOT (p->'measures') ? (r->>'measure') THEN
      rej := rej || jsonb_build_object('row', i, 'reason', 'medida-desconhecida');
    ELSIF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = r->>'school_id') THEN
      rej := rej || jsonb_build_object('row', i, 'reason', 'escola-desconhecida');
    ELSIF v IS NOT NULL AND jsonb_typeof(v) <> 'null' AND NOT (jsonb_typeof(v) = 'number' AND (v::text) ~ '^[0-9]+$') THEN
      rej := rej || jsonb_build_object('row', i, 'reason', 'valor-invalido');
    ELSE
      k := (r->>'school_id') || '|' || (r->>'measure');
      IF k = ANY (seen) THEN rej := rej || jsonb_build_object('row', i, 'reason', 'duplicada');
      ELSE seen := seen || k;
        acc := acc || jsonb_build_object('school_id', r->>'school_id', 'measure', r->>'measure',
          'value', CASE WHEN v IS NULL OR jsonb_typeof(v) = 'null' THEN NULL ELSE (v::text)::int END);
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.census_source_imports x WHERE x.cycle_id = _cycle AND x.parser_id = _parser_id
               AND x.parser_version = _parser_version AND x.source_sha256 = _source_sha256) THEN
    SELECT x.id INTO nid FROM public.census_source_imports x WHERE x.cycle_id = _cycle AND x.parser_id = _parser_id
      AND x.parser_version = _parser_version AND x.source_sha256 = _source_sha256;
    RETURN jsonb_build_object('id', nid, 'idempotent', true);
  END IF;
  INSERT INTO public.census_source_imports(cycle_id, origin, edition_layout, parser_id, parser_version, source_sha256, staged_sha256, accepted, rejections, operator_person, operator_user)
    VALUES (_cycle, _origin, _edition_layout, _parser_id, _parser_version, _source_sha256, public.census_fingerprint(acc), acc, rej, me, auth.uid())
    RETURNING id INTO nid;
  RETURN jsonb_build_object('id', nid, 'idempotent', false, 'accepted', jsonb_array_length(acc), 'rejected', jsonb_array_length(rej));
END $fn$;

-- Readers
CREATE FUNCTION public.census_can_read_network() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT public.has_network_capability('consultar-censo-escolar') OR public.has_network_capability('preparar-censo-escolar')
      OR public.has_network_capability('conferir-censo-escolar') $fn$;
REVOKE ALL ON FUNCTION public.census_can_read_network() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.census_cycles_overview() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.census_can_read_network() THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', c.id, 'academic_year_id', c.academic_year_id, 'nature', c.nature, 'reference_date', c.reference_date, 'created_at', c.created_at,
    'events', (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'stage', e.stage, 'snapshot_id', e.snapshot_id, 'fingerprint', e.fingerprint,
                 'reason', e.reason, 'created_at', e.created_at) ORDER BY e.seq) FROM public.census_cycle_events e WHERE e.cycle_id = c.id),
    'snapshots', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'version', s.version, 'supersedes_id', s.supersedes_id,
                 'fingerprint', s.fingerprint, 'reason', s.reason, 'created_at', s.created_at,
                 'current', NOT EXISTS (SELECT 1 FROM public.census_snapshots n WHERE n.supersedes_id = s.id),
                 'conferences', (SELECT count(*) FROM public.census_snapshot_conferences k WHERE k.snapshot_id = s.id AND k.fingerprint = s.fingerprint))
                 ORDER BY s.version) FROM public.census_snapshots s WHERE s.cycle_id = c.id), '[]'::jsonb),
    'imports', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'origin', i.origin, 'edition_layout', i.edition_layout,
                 'parser', i.parser_id || '@' || i.parser_version, 'source_sha256', i.source_sha256, 'accepted', jsonb_array_length(i.accepted),
                 'rejections', i.rejections, 'created_at', i.created_at) ORDER BY i.created_at) FROM public.census_source_imports i WHERE i.cycle_id = c.id), '[]'::jsonb)
  ) ORDER BY c.academic_year_id) FROM public.census_cycles c), '[]'::jsonb);
END $fn$;

CREATE FUNCTION public.census_snapshot_content(_snapshot uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.census_can_read_network() THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  SELECT s.content INTO r FROM public.census_snapshots s WHERE s.id = _snapshot;
  IF r IS NULL THEN RAISE EXCEPTION 'census:not-found'; END IF;
  RETURN r;
END $fn$;

-- Prévia ao vivo (não grava): o que o próximo snapshot conteria.
CREATE FUNCTION public.census_live_preview(_cycle text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE c record; content jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.census_can_read_network() THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  SELECT * INTO c FROM public.census_cycles x WHERE x.id = _cycle;
  IF NOT FOUND THEN RAISE EXCEPTION 'census:not-found'; END IF;
  content := public.census_compose(c.academic_year_id, c.reference_date);
  RETURN jsonb_build_object('content', content, 'fingerprint', public.census_fingerprint(content));
END $fn$;

-- Escola: só as próprias medidas/pendências do snapshot vigente e, ao vivo, os itens pendentes (ids, sem PII).
CREATE FUNCTION public.census_school_pending(_cycle text, _school text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE c record; head record; items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR NOT (public.has_school_capability('consultar-pendencias-do-censo', _school) OR public.census_can_read_network()) THEN
    RAISE EXCEPTION 'census:not-authorized'; END IF;
  SELECT * INTO c FROM public.census_cycles x WHERE x.id = _cycle;
  IF NOT FOUND THEN RAISE EXCEPTION 'census:not-found'; END IF;
  SELECT * INTO head FROM public.census_snapshots s WHERE s.cycle_id = _cycle
    AND NOT EXISTS (SELECT 1 FROM public.census_snapshots n WHERE n.supersedes_id = s.id) LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object('rule', 'vinculo-sem-inicio-efetivo', 'enrollment_id', se.id, 'institutional_number', se.institutional_number) ORDER BY se.id), '[]'::jsonb)
    INTO items FROM public.school_enrollments se
   WHERE se.school_id = _school AND se.academic_year_id = c.academic_year_id AND se.opened_on IS NULL AND public.af_enrollment_current(se.id)
     AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id AND x.ended_on < c.reference_date);
  RETURN jsonb_build_object('cycle_id', _cycle, 'school_id', _school,
    'snapshot', CASE WHEN head.id IS NULL THEN NULL ELSE jsonb_build_object('id', head.id, 'version', head.version, 'fingerprint', head.fingerprint,
      'school', (SELECT x FROM jsonb_array_elements(head.content->'schools') x WHERE x->>'school_id' = _school),
      'findings', coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(head.content->'findings') x WHERE x->>'school_id' = _school), '[]'::jsonb)) END,
    'live_items', items);
END $fn$;

-- Comparação snapshot × fonte importada. Nunca corrige dado operacional.
CREATE FUNCTION public.census_compare(_snapshot uuid, _import uuid)
RETURNS TABLE(school_id text, measure text, sigem_value integer, sigem_reason text, source_value integer, category text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE s record; i record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.census_can_read_network() THEN RAISE EXCEPTION 'census:not-authorized'; END IF;
  SELECT * INTO s FROM public.census_snapshots x WHERE x.id = _snapshot;
  SELECT * INTO i FROM public.census_source_imports x WHERE x.id = _import;
  IF s.id IS NULL OR i.id IS NULL OR s.cycle_id <> i.cycle_id THEN RAISE EXCEPTION 'census:not-found'; END IF;
  RETURN QUERY
  WITH sg AS (
    SELECT sc->>'school_id' AS sid, m.key AS meas, m.value AS mv
      FROM jsonb_array_elements(s.content->'schools') sc, jsonb_each(sc->'measures') m
  ), src AS (
    SELECT a->>'school_id' AS sid, a->>'measure' AS meas, a->'value' AS v FROM jsonb_array_elements(i.accepted) a
  )
  SELECT coalesce(sg.sid, src.sid), coalesce(sg.meas, src.meas),
    CASE WHEN jsonb_typeof(sg.mv->'value') = 'number' THEN (sg.mv->>'value')::int END, sg.mv->>'reason',
    CASE WHEN jsonb_typeof(src.v) = 'number' THEN (src.v::text)::int END,
    CASE
      WHEN sg.sid IS NULL THEN 'ausente-no-sigem'
      WHEN src.sid IS NULL THEN 'ausente-na-fonte'
      WHEN jsonb_typeof(sg.mv->'value') <> 'number' OR jsonb_typeof(src.v) <> 'number' THEN 'nao-comparavel'
      WHEN (sg.mv->>'value')::int = (src.v::text)::int THEN 'igual'
      ELSE 'divergente' END
  FROM sg FULL JOIN src ON src.sid = sg.sid AND src.meas = sg.meas
  ORDER BY 1, 2;
END $fn$;

-- ACL de funções: só usuários com login; nada para anon/automação.
DO $g$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'census_open_cycle(text, date, text)', 'census_take_snapshot(text, uuid, text)', 'census_confer_snapshot(uuid, text, text)',
    'census_advance_stage(text, integer, text, text)',
    'census_stage_source(text, text, text, text, integer, text, jsonb)', 'census_cycles_overview()', 'census_snapshot_content(uuid)',
    'census_live_preview(text)', 'census_school_pending(text, text)', 'census_compare(uuid, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $g$;
REVOKE ALL ON FUNCTION public.census_immutable() FROM PUBLIC, anon, authenticated, service_role;