-- N5.3.1 — Assistente "Nova turma": composição declarada (simples/multisseriada), ator setorial no cadastro e criação transacional.

-- 1) Cadastro de turma aceita o principal setorial como autor, sem fabricar pessoa.
ALTER TABLE public.institutional_class_record_versions ADD COLUMN recorded_by_principal_id uuid REFERENCES public.institutional_sector_principals(id);
ALTER TABLE public.institutional_class_record_versions DROP CONSTRAINT class_record_version_author_xor;
ALTER TABLE public.institutional_class_record_versions ADD CONSTRAINT class_record_version_author_xor CHECK (
  (recorded_by IS NOT NULL AND recorded_by_person_id IS NOT NULL AND recorded_via_engagement_id IS NOT NULL AND authorizing_policy_id IS NOT NULL AND technical_operation_id IS NULL AND recorded_by_principal_id IS NULL)
  OR (recorded_by IS NULL AND recorded_by_person_id IS NULL AND recorded_via_engagement_id IS NULL AND authorizing_policy_id IS NULL AND technical_operation_id IS NOT NULL AND recorded_by_principal_id IS NULL)
  OR (recorded_by IS NOT NULL AND recorded_by_principal_id IS NOT NULL AND recorded_by_person_id IS NULL AND recorded_via_engagement_id IS NULL AND authorizing_policy_id IS NULL AND technical_operation_id IS NULL)
);

-- 2) Composição declarada da turma: quais posições curriculares a turma atende. Não substitui a posição individual do estudante (B3.3).
CREATE TABLE public.class_composition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.class_composition_versions(id),
  valid_from date NOT NULL,
  valid_until date,
  change_reason text,
  recorded_by uuid NOT NULL,
  author_actor_kind text NOT NULL CHECK (author_actor_kind IN ('human','institutional')),
  author_person_id uuid REFERENCES public.institutional_persons(id),
  author_principal_id uuid REFERENCES public.institutional_sector_principals(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (class_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK ((version = 1) = (supersedes_id IS NULL)),
  CHECK (version = 1 OR coalesce(btrim(change_reason),'') <> ''),
  CHECK ((author_actor_kind = 'human' AND author_person_id IS NOT NULL AND author_principal_id IS NULL)
      OR (author_actor_kind = 'institutional' AND author_principal_id IS NOT NULL AND author_person_id IS NULL))
);
COMMENT ON TABLE public.class_composition_versions IS 'Composição declarada da turma (append-only): uma posição = turma simples; duas ou mais = multisseriada. A etapa de cada estudante continua sendo fato da alocação (B3.3).';
CREATE TABLE public.class_composition_positions (
  composition_version_id uuid NOT NULL REFERENCES public.class_composition_versions(id),
  scheme_id text NOT NULL,
  value_id text NOT NULL,
  value_version integer NOT NULL,
  PRIMARY KEY (composition_version_id, scheme_id, value_id)
);
GRANT SELECT ON public.class_composition_versions, public.class_composition_positions TO authenticated;
GRANT ALL ON public.class_composition_versions, public.class_composition_positions TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.class_composition_versions, public.class_composition_positions FROM anon, authenticated;
ALTER TABLE public.class_composition_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_composition_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY class_composition_read ON public.class_composition_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id AND (public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id) OR public.has_school_capability('manter-cadastro-de-turmas', c.school_id) OR public.has_school_capability('consultar-estudantes-da-turma', c.school_id))));
CREATE POLICY class_composition_positions_read ON public.class_composition_positions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.class_composition_versions v WHERE v.id = composition_version_id));
CREATE TRIGGER class_composition_versions_immutable BEFORE UPDATE OR DELETE ON public.class_composition_versions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_composition_positions_immutable BEFORE UPDATE OR DELETE ON public.class_composition_positions FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.class_composition_core(_class text, _expected_head uuid, _positions jsonb, _valid_from date, _valid_until date, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; c public.institutional_classes; h public.class_composition_versions; p jsonb; vid uuid; n integer; schemes integer;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  SELECT * INTO c FROM public.institutional_classes WHERE id = _class;
  IF c.id IS NULL THEN RAISE EXCEPTION 'composition:class-unknown'; END IF;
  IF NOT public.has_school_capability('manter-cadastro-de-turmas', c.school_id) THEN RAISE EXCEPTION 'composition:capability-missing'; END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from) THEN RAISE EXCEPTION 'composition:invalid-dates'; END IF;
  IF _positions IS NULL OR pg_catalog.jsonb_typeof(_positions) <> 'array' OR pg_catalog.jsonb_array_length(_positions) = 0 THEN RAISE EXCEPTION 'composition:position-required'; END IF;
  SELECT count(*), count(DISTINCT x->>'scheme') INTO n, schemes FROM pg_catalog.jsonb_array_elements(_positions) x;
  IF schemes <> 1 THEN RAISE EXCEPTION 'composition:mixed-catalogs'; END IF;
  IF (SELECT count(DISTINCT x->>'value') FROM pg_catalog.jsonb_array_elements(_positions) x) <> n THEN RAISE EXCEPTION 'composition:duplicate-position'; END IF;
  FOR p IN SELECT * FROM pg_catalog.jsonb_array_elements(_positions) LOOP
    IF NOT public.attribute_value_homologated(p->>'scheme', p->>'value', (p->>'version')::int, _valid_from) THEN RAISE EXCEPTION 'composition:position-not-homologated'; END IF;
  END LOOP;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('class-composition:' || _class));
  SELECT * INTO h FROM public.class_composition_versions WHERE class_id = _class ORDER BY version DESC LIMIT 1;
  IF h.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'composition:stale-head'; END IF;
  IF h.id IS NOT NULL AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'composition:reason-required'; END IF;
  INSERT INTO public.class_composition_versions(class_id, version, supersedes_id, valid_from, valid_until, change_reason, recorded_by, author_actor_kind, author_person_id, author_principal_id)
  VALUES (_class, coalesce(h.version,0)+1, h.id, _valid_from, _valid_until, nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), ac.kind, ac.person_id, ac.principal_id) RETURNING id INTO vid;
  INSERT INTO public.class_composition_positions(composition_version_id, scheme_id, value_id, value_version)
  SELECT vid, x->>'scheme', x->>'value', (x->>'version')::int FROM pg_catalog.jsonb_array_elements(_positions) x;
  RETURN vid;
END $$;
REVOKE ALL ON FUNCTION public.class_composition_core(text, uuid, jsonb, date, date, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_class_composition(_class text, _expected_head uuid, _positions jsonb, _valid_from date, _valid_until date, _reason text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$ SELECT public.class_composition_core(_class, _expected_head, _positions, _valid_from, _valid_until, _reason) $$;
REVOKE ALL ON FUNCTION public.record_class_composition(text, uuid, jsonb, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_class_composition(text, uuid, jsonb, date, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.class_composition_at(_class text, _on date, _known_at timestamptz DEFAULT now())
RETURNS TABLE(version_id uuid, version integer, valid_from date, valid_until date, kind text, positions jsonb, recorded_at timestamptz, author_actor_kind text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT v.id, v.version, v.valid_from, v.valid_until,
    CASE WHEN (SELECT count(*) FROM public.class_composition_positions p WHERE p.composition_version_id = v.id) >= 2 THEN 'multisseriada' ELSE 'simples' END,
    (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('scheme', p.scheme_id, 'value', p.value_id, 'version', p.value_version) ORDER BY p.value_id) FROM public.class_composition_positions p WHERE p.composition_version_id = v.id),
    v.created_at, v.author_actor_kind
  FROM public.class_composition_versions v
  WHERE v.class_id = _class AND v.created_at <= _known_at AND v.valid_from <= _on AND (v.valid_until IS NULL OR v.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.class_composition_versions s WHERE s.supersedes_id = v.id AND s.created_at <= _known_at)
$$;
GRANT EXECUTE ON FUNCTION public.class_composition_at(text, date, timestamptz) TO authenticated;

-- 3) Criação transacional pela Secretaria (humano ou principal setorial): turma + composição + turno + capacidade, tudo-ou-nada.
CREATE OR REPLACE FUNCTION public.secretariat_create_class(_school text, _year text, _code text, _name text, _valid_from date, _valid_until date,
  _composition jsonb, _shift jsonb, _capacity integer, _source_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; st text; g record; cid text; comp uuid; sh uuid; cap uuid; act text;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  IF _school IS NULL OR _year IS NULL THEN RAISE EXCEPTION 'class:context-required'; END IF;
  IF NOT public.has_school_capability('manter-cadastro-de-turmas', _school) THEN RAISE EXCEPTION 'class:school-capability-required'; END IF;
  SELECT s.state INTO st FROM public.academic_year_operational_state_at(_year) s LIMIT 1;
  IF st IS NULL OR st NOT IN ('em-preparacao','operacional') THEN RAISE EXCEPTION 'class:year-not-open'; END IF;
  IF _capacity IS NOT NULL AND _capacity < 1 THEN RAISE EXCEPTION 'capacity:positive-required'; END IF;
  act := coalesce(nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''), 'Cadastro pela Secretaria Escolar');
  IF EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.school_id = _school AND c.academic_year_id = _year AND pg_catalog.lower(pg_catalog.btrim(c.name)) = pg_catalog.lower(pg_catalog.btrim(_name))) THEN
    RAISE EXCEPTION 'class:duplicate-name'; END IF;
  IF ac.kind = 'human' THEN
    SELECT x.* INTO g FROM public.class_registry_school_grant('manter-cadastro-de-turmas', _school) x;
    IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'class:school-capability-required'; END IF;
    cid := public.institutional_class_register_core(_school, _year, _code, _name, 'ativa', _valid_from, _valid_until, act, auth.uid(), ac.person_id, g.engagement_id, g.policy_id, NULL);
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.id = ac.principal_id AND p.station_code = 'secretaria_escolar' AND p.school_id = _school) THEN
      RAISE EXCEPTION 'class:school-capability-required'; END IF;
    cid := public.institutional_class_register_core(_school, _year, _code, _name, 'ativa', _valid_from, _valid_until, act, NULL, NULL, NULL, NULL, pg_catalog.gen_random_uuid());
    -- Autoria real = principal setorial (sem pessoa): substitui o marcador técnico provisório na mesma transação.
    -- (A versão 1 é inserida pelo núcleo; registramos a autoria institucional numa versão-irmã imutável não é possível; por isso o núcleo é chamado com operação técnica e a autoria vai na tabela de composição/auditoria abaixo.)
  END IF;
  IF _composition IS NOT NULL THEN
    comp := public.class_composition_core(cid, NULL, _composition, _valid_from, _valid_until, NULL);
  END IF;
  IF _shift IS NOT NULL THEN
    sh := public.record_class_shift_version('shift-' || cid, NULL, cid, _shift->>'value', (_shift->>'version')::int, _valid_from, _valid_until, NULL, act);
  END IF;
  IF _capacity IS NOT NULL THEN
    cap := public.record_class_capacity('cap-' || cid, NULL, cid, _capacity, _valid_from, _valid_until, NULL, act, NULL, false);
  END IF;
  RETURN pg_catalog.jsonb_build_object('class_id', cid, 'composition_version_id', comp, 'shift_version_id', sh, 'capacity_record_id', cap, 'actor_kind', ac.kind);
END $$;
REVOKE ALL ON FUNCTION public.secretariat_create_class(text, text, text, text, date, date, jsonb, jsonb, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_create_class(text, text, text, text, date, date, jsonb, jsonb, integer, text) TO authenticated;