-- B2.5.2. A identidade e o contexto estrutural permanecem imutáveis.
-- Uma versão cadastral responde a duas perguntas independentes:
-- class_at(classId, D, T) = o fato válido em D entre os fatos registrados até T.
-- Primeiro escolhem-se as cabeças conhecidas em T de CADA segmento (somente
-- substituições já registradas em T); depois filtra-se a vigência inclusiva em D.
-- Nenhuma/mais de uma cabeça aplicável significa ausência/inconsistência.
-- Uma versão futura de outro segmento jamais oculta uma versão anterior em D.

ALTER TABLE public.institutional_classes
  ADD CONSTRAINT institutional_classes_academic_year_fk
  FOREIGN KEY (academic_year_id) REFERENCES public.institutional_academic_years(id);
CREATE INDEX institutional_classes_school_year_idx
  ON public.institutional_classes(school_id, academic_year_id);
-- A identidade não admite escrita direta nem TRUNCATE pelos papéis da API.
REVOKE ALL ON public.institutional_classes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.institutional_classes TO authenticated, service_role;
-- O executor auxiliar da Cloud não é um escritor institucional.
DO $class_acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE ALL ON public.institutional_classes FROM sandbox_exec';
  END IF;
END $class_acl$;

CREATE TABLE public.institutional_class_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  segment_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid,
  code text,
  name text NOT NULL CHECK (btrim(name) <> ''),
  administrative_status text NOT NULL CHECK (administrative_status IN ('ativa', 'inativa')),
  valid_from date NOT NULL,
  valid_until date,
  change_reason text,
  originating_act_ref text NOT NULL CHECK (btrim(originating_act_ref) <> ''),
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  recorded_via_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  authorizing_policy_id uuid NOT NULL REFERENCES public.capability_policies(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (class_id, version),
  UNIQUE (id, class_id, segment_id),
  UNIQUE (supersedes_id),
  FOREIGN KEY (supersedes_id, class_id, segment_id)
    REFERENCES public.institutional_class_record_versions(id, class_id, segment_id),
  CHECK (supersedes_id IS DISTINCT FROM id),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (version = 1 OR coalesce(btrim(change_reason), '') <> '')
);
CREATE INDEX institutional_class_record_segment_idx
  ON public.institutional_class_record_versions(class_id, segment_id, version DESC);
CREATE UNIQUE INDEX institutional_class_record_segment_root_idx
  ON public.institutional_class_record_versions(class_id, segment_id)
  WHERE supersedes_id IS NULL;
CREATE INDEX institutional_class_record_known_idx
  ON public.institutional_class_record_versions(class_id, created_at);
ALTER TABLE public.institutional_class_record_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institutional_class_record_versions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.institutional_class_record_versions TO authenticated;
GRANT SELECT ON public.institutional_class_record_versions TO service_role;
-- A Cloud também concede INSERT por default ACL ao executor auxiliar.
DO $version_acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'REVOKE ALL ON public.institutional_class_record_versions FROM sandbox_exec';
  END IF;
END $version_acl$;
CREATE POLICY "class registry versions by own engagement"
  ON public.institutional_class_record_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.institutional_classes c
    WHERE c.id = class_id AND public.can_read_institutional_class(c.id, c.school_id)
  ));
CREATE TRIGGER institutional_class_record_versions_immutable
  BEFORE UPDATE OR DELETE ON public.institutional_class_record_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- A versão cresce estritamente ao longo de cada encadeamento. Junto da FK
-- composta, isso impede ciclos mesmo em INSERT de múltiplas linhas.
CREATE FUNCTION public.guard_class_record_chain()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $chain$
DECLARE _parent_version integer;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT parent.version INTO _parent_version
    FROM public.institutional_class_record_versions parent WHERE parent.id = NEW.supersedes_id;
    IF _parent_version IS NULL OR _parent_version >= NEW.version
    THEN RAISE EXCEPTION 'class:invalid-version-chain'; END IF;
  END IF;
  RETURN NEW;
END $chain$;
CREATE CONSTRAINT TRIGGER institutional_class_record_chain_guard
  AFTER INSERT ON public.institutional_class_record_versions
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW
  EXECUTE FUNCTION public.guard_class_record_chain();

-- A verificação é diferida: uma retificação pode acrescentar, atomicamente,
-- esquerda + alvo + direita. Apenas as cabeças finais podem ser comparadas.
-- O lock compartilhado com o escritor serializa commits da mesma turma.
-- READ COMMITTED é exigido: um snapshot antigo de REPEATABLE READ não veria
-- uma inserção concorrente após esperar pelo lock.
CREATE FUNCTION public.guard_class_record_current_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $overlap$
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'class:read-committed-required';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('class-registry:' || NEW.class_id, 0));
  IF EXISTS (
    SELECT 1 FROM public.institutional_class_record_versions a
    JOIN public.institutional_class_record_versions b
      ON b.class_id = a.class_id AND b.id > a.id
     AND pg_catalog.daterange(a.valid_from, a.valid_until, '[]') &&
         pg_catalog.daterange(b.valid_from, b.valid_until, '[]')
    WHERE a.class_id = NEW.class_id
      AND NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions x
                      WHERE x.supersedes_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions y
                      WHERE y.supersedes_id = b.id)
  ) THEN
    RAISE EXCEPTION 'class:overlapping-current-segments';
  END IF;
  RETURN NEW;
END $overlap$;
REVOKE ALL ON FUNCTION public.guard_class_record_current_overlap() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER institutional_class_record_no_overlap
  AFTER INSERT ON public.institutional_class_record_versions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION public.guard_class_record_current_overlap();

CREATE FUNCTION public.class_at(_class_id text, _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS SETOF public.institutional_class_record_versions
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $class_at$
DECLARE _found public.institutional_class_record_versions%ROWTYPE; _count integer;
BEGIN
  IF _class_id IS NULL OR _valid_on IS NULL THEN RAISE EXCEPTION 'class:query-arguments-required'; END IF;
  WITH known AS (
    SELECT v.* FROM public.institutional_class_record_versions v
    WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)
  ), heads AS (
    SELECT v.* FROM known v
    WHERE NOT EXISTS (SELECT 1 FROM known successor WHERE successor.supersedes_id = v.id)
  )
  SELECT count(*)::integer INTO _count FROM heads h
  WHERE h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on);
  IF _count > 1 THEN RAISE EXCEPTION 'class:ambiguous-temporal-state'; END IF;
  IF _count = 0 THEN RETURN; END IF;
  WITH known AS (
    SELECT v.* FROM public.institutional_class_record_versions v
    WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at)
  ), heads AS (
    SELECT v.* FROM known v
    WHERE NOT EXISTS (SELECT 1 FROM known successor WHERE successor.supersedes_id = v.id)
  )
  SELECT h.* INTO _found FROM heads h
  WHERE h.valid_from <= _valid_on AND (h.valid_until IS NULL OR h.valid_until >= _valid_on);
  RETURN NEXT _found;
END $class_at$;
REVOKE ALL ON FUNCTION public.class_at(text, date, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.class_at(text, date, timestamptz) TO authenticated;

-- Validação única para cada linha cadastral que será gravada. NULL no fim
-- valida apenas o início: não presume o término do ano nem uma data infinita.
CREATE FUNCTION public.class_record_context(
  _school_id text, _academic_year_id text, _valid_from date, _valid_until date)
RETURNS TABLE(school_name text, year_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $class_context$
DECLARE _school_name text; _school_active boolean;
  _year public.institutional_academic_year_versions%ROWTYPE;
BEGIN
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from)
  THEN RAISE EXCEPTION 'class:invalid-dates'; END IF;
  SELECT s.official_name, s.active INTO _school_name, _school_active
  FROM public.institutional_school_record_versions s
  WHERE s.school_id = _school_id AND s.valid_from <= _valid_from
  ORDER BY s.version_number DESC LIMIT 1;
  IF _school_name IS NULL THEN RAISE EXCEPTION 'class:school-unavailable'; END IF;
  IF NOT _school_active THEN RAISE EXCEPTION 'class:school-inactive'; END IF;
  SELECT y.* INTO _year FROM public.institutional_academic_year_versions y
  WHERE y.academic_year_id = _academic_year_id AND y.valid_from <= _valid_from
  ORDER BY y.version DESC LIMIT 1;
  IF _year.id IS NULL THEN RAISE EXCEPTION 'class:academic-year-unavailable'; END IF;
  IF NOT _year.is_active THEN RAISE EXCEPTION 'class:academic-year-inactive'; END IF;
  IF _valid_from < _year.starts_on OR _valid_from > _year.ends_on
  THEN RAISE EXCEPTION 'class:academic-year-outside-bounds'; END IF;
  IF _valid_until IS NOT NULL AND EXISTS (
    WITH checkpoints AS (
      SELECT _valid_from AS at_date
      UNION
      SELECT v.valid_from FROM public.institutional_academic_year_versions v
      WHERE v.academic_year_id = _academic_year_id
        AND v.valid_from > _valid_from AND v.valid_from <= _valid_until
    ), segments AS (
      SELECT at_date,
        coalesce(lead(at_date) OVER (ORDER BY at_date) - 1, _valid_until) AS through_date
      FROM checkpoints
    )
    SELECT 1 FROM segments s
    LEFT JOIN LATERAL (
      SELECT v.is_active, v.starts_on, v.ends_on
      FROM public.institutional_academic_year_versions v
      WHERE v.academic_year_id = _academic_year_id AND v.valid_from <= s.at_date
      ORDER BY v.version DESC LIMIT 1
    ) applicable ON true
    WHERE applicable.is_active IS DISTINCT FROM true
       OR s.at_date < applicable.starts_on OR s.through_date > applicable.ends_on
  ) THEN RAISE EXCEPTION 'class:academic-year-incompatible-segment'; END IF;
  RETURN QUERY SELECT _school_name, _year.official_name;
END $class_context$;
REVOKE ALL ON FUNCTION public.class_record_context(text, text, date, date)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.register_institutional_class(
  _school_id text, _academic_year_id text, _code text, _name text,
  _administrative_status text, _valid_from date, _valid_until date, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $register_class$
DECLARE _grant record; _school_name text; _year_name text; _class_id text;
  _person_id uuid; _recorded_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'class:unauthenticated'; END IF;
  IF _school_id IS NULL OR _academic_year_id IS NULL THEN RAISE EXCEPTION 'class:context-required'; END IF;
  IF coalesce(btrim(_name), '') = '' THEN RAISE EXCEPTION 'class:name-required'; END IF;
  IF _administrative_status IS NULL OR _administrative_status NOT IN ('ativa', 'inativa')
  THEN RAISE EXCEPTION 'class:invalid-status'; END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from)
  THEN RAISE EXCEPTION 'class:invalid-dates'; END IF;
  IF coalesce(btrim(_act_ref), '') = '' THEN RAISE EXCEPTION 'class:act-required'; END IF;
  SELECT g.* INTO _grant FROM public.class_registry_school_grant('manter-cadastro-de-turmas', _school_id) g;
  IF _grant.engagement_id IS NULL THEN RAISE EXCEPTION 'class:school-capability-required'; END IF;
  _person_id := public.current_person_id();
  IF _person_id IS NULL THEN RAISE EXCEPTION 'class:person-required'; END IF;
  SELECT c.school_name, c.year_name INTO _school_name, _year_name
  FROM public.class_record_context(_school_id, _academic_year_id, _valid_from, _valid_until) c;
  _class_id := 'turma-' || gen_random_uuid();
  _recorded_at := clock_timestamp();
  INSERT INTO public.institutional_classes
    (id, school_id, school_label_snapshot, academic_year_id, academic_year_label,
     code, name, valid_from, valid_until, originating_act_ref, created_at)
  VALUES (_class_id, _school_id, _school_name, _academic_year_id, _year_name,
          nullif(btrim(_code), ''), btrim(_name), _valid_from, _valid_until, btrim(_act_ref), _recorded_at);
  INSERT INTO public.institutional_class_record_versions
    (class_id, segment_id, version, code, name, administrative_status,
     valid_from, valid_until, originating_act_ref, recorded_by,
     recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
  VALUES (_class_id, gen_random_uuid(), 1, nullif(btrim(_code), ''), btrim(_name),
          _administrative_status, _valid_from, _valid_until, btrim(_act_ref), auth.uid(),
          _person_id, _grant.engagement_id, _grant.policy_id, _recorded_at);
  RETURN _class_id;
END $register_class$;
REVOKE ALL ON FUNCTION public.register_institutional_class(text, text, text, text, text, date, date, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_institutional_class(text, text, text, text, text, date, date, text)
  TO authenticated;

CREATE FUNCTION public.record_institutional_class_version(
  _class_id text, _base_version_id uuid, _operation text, _code text, _name text,
  _administrative_status text, _valid_from date, _valid_until date,
  _reason text, _act_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $record_class$
DECLARE _identity public.institutional_classes%ROWTYPE;
  _base public.institutional_class_record_versions%ROWTYPE;
  _grant record; _person_id uuid; _recorded_at timestamptz;
  _target_from date; _target_until date; _target_code text; _target_name text;
  _target_status text; _next_version integer; _replacement_id uuid;
  _left_exists boolean; _right_exists boolean; _new_segment uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'class:unauthenticated'; END IF;
  IF _class_id IS NULL OR _base_version_id IS NULL THEN RAISE EXCEPTION 'class:base-required'; END IF;
  IF _operation NOT IN ('correct', 'inactivate', 'reactivate') OR _operation IS NULL
  THEN RAISE EXCEPTION 'class:invalid-operation'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'class:reason-required'; END IF;
  IF coalesce(btrim(_act_ref), '') = '' THEN RAISE EXCEPTION 'class:act-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'class:valid-from-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('class-registry:' || _class_id, 0));
  SELECT c.* INTO _identity FROM public.institutional_classes c WHERE c.id = _class_id FOR UPDATE;
  IF _identity.id IS NULL THEN RAISE EXCEPTION 'class:not-found'; END IF;
  SELECT g.* INTO _grant FROM public.class_registry_school_grant('manter-cadastro-de-turmas', _identity.school_id) g;
  IF _grant.engagement_id IS NULL THEN RAISE EXCEPTION 'class:school-capability-required'; END IF;
  _person_id := public.current_person_id();
  IF _person_id IS NULL THEN RAISE EXCEPTION 'class:person-required'; END IF;
  SELECT v.* INTO _base FROM public.institutional_class_record_versions v
  WHERE v.id = _base_version_id AND v.class_id = _class_id;
  IF _base.id IS NULL THEN RAISE EXCEPTION 'class:base-not-found'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_class_record_versions v WHERE v.supersedes_id = _base.id)
  THEN RAISE EXCEPTION 'class:base-superseded'; END IF;
  _target_from := _valid_from;
  IF _operation = 'correct' THEN
    IF coalesce(btrim(_name), '') = '' THEN RAISE EXCEPTION 'class:name-required'; END IF;
    IF _administrative_status IS NULL OR _administrative_status NOT IN ('ativa', 'inativa')
    THEN RAISE EXCEPTION 'class:invalid-status'; END IF;
    IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'class:invalid-dates'; END IF;
    _target_until := _valid_until;
    _target_code := nullif(btrim(_code), '');
    _target_name := btrim(_name);
    _target_status := _administrative_status;
    IF (_base.valid_until IS NOT NULL AND _target_from > _base.valid_until)
       OR (_target_until IS NOT NULL AND _target_until < _base.valid_from)
    THEN RAISE EXCEPTION 'class:correction-must-intersect-base'; END IF;
  ELSE
    IF _code IS NOT NULL OR _name IS NOT NULL OR _administrative_status IS NOT NULL OR _valid_until IS NOT NULL
    THEN RAISE EXCEPTION 'class:transition-has-extra-fields'; END IF;
    IF _target_from < _base.valid_from OR (_base.valid_until IS NOT NULL AND _target_from > _base.valid_until)
    THEN RAISE EXCEPTION 'class:transition-outside-base'; END IF;
    IF (_operation = 'inactivate' AND _base.administrative_status <> 'ativa') OR
       (_operation = 'reactivate' AND _base.administrative_status <> 'inativa')
    THEN RAISE EXCEPTION 'class:invalid-transition'; END IF;
    _target_until := _base.valid_until;
    _target_code := _base.code;
    _target_name := _base.name;
    _target_status := CASE WHEN _operation = 'inactivate' THEN 'inativa' ELSE 'ativa' END;
  END IF;

  _left_exists := _target_from > _base.valid_from;
  _right_exists := _target_until IS NOT NULL
    AND (_base.valid_until IS NULL OR _target_until < _base.valid_until);
  -- Toda peça nova tem sua própria data inicial e precisa passar pela mesma
  -- regra escolar e pelo ano segmentado, antes de qualquer INSERT.
  IF _left_exists THEN
    PERFORM 1 FROM public.class_record_context(
      _identity.school_id, _identity.academic_year_id,
      _base.valid_from, _target_from - 1);
  END IF;
  PERFORM 1 FROM public.class_record_context(
    _identity.school_id, _identity.academic_year_id,
    _target_from, _target_until);
  IF _right_exists THEN
    PERFORM 1 FROM public.class_record_context(
      _identity.school_id, _identity.academic_year_id,
      _target_until + 1, _base.valid_until);
  END IF;
  SELECT coalesce(max(v.version), 0) + 1 INTO _next_version
    FROM public.institutional_class_record_versions v WHERE v.class_id = _class_id;
  _recorded_at := clock_timestamp();
  -- A primeira peça substitui a base no MESMO segmento; peças adicionais
  -- iniciam segmentos novos. Todas nascem no mesmo ato/instante transacional.
  IF _left_exists THEN
    INSERT INTO public.institutional_class_record_versions
      (class_id, segment_id, version, supersedes_id, code, name, administrative_status,
       valid_from, valid_until, change_reason, originating_act_ref, recorded_by,
       recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (_class_id, _base.segment_id, _next_version, _base.id,
            _base.code, _base.name, _base.administrative_status,
            _base.valid_from, _target_from - 1, btrim(_reason), btrim(_act_ref), auth.uid(),
            _person_id, _grant.engagement_id, _grant.policy_id, _recorded_at);
    _next_version := _next_version + 1;
    _new_segment := gen_random_uuid();
  ELSE
    _new_segment := _base.segment_id;
  END IF;
  INSERT INTO public.institutional_class_record_versions
    (class_id, segment_id, version, supersedes_id, code, name, administrative_status,
     valid_from, valid_until, change_reason, originating_act_ref, recorded_by,
     recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
  VALUES (_class_id, _new_segment, _next_version,
          CASE WHEN _left_exists THEN NULL ELSE _base.id END,
          _target_code, _target_name, _target_status,
          _target_from, _target_until, btrim(_reason), btrim(_act_ref), auth.uid(),
          _person_id, _grant.engagement_id, _grant.policy_id, _recorded_at)
  RETURNING id INTO _replacement_id;
  _next_version := _next_version + 1;
  IF _right_exists THEN
    INSERT INTO public.institutional_class_record_versions
      (class_id, segment_id, version, code, name, administrative_status,
       valid_from, valid_until, change_reason, originating_act_ref, recorded_by,
       recorded_by_person_id, recorded_via_engagement_id, authorizing_policy_id, created_at)
    VALUES (_class_id, gen_random_uuid(), _next_version,
            _base.code, _base.name, _base.administrative_status,
            _target_until + 1, _base.valid_until, btrim(_reason), btrim(_act_ref), auth.uid(),
            _person_id, _grant.engagement_id, _grant.policy_id, _recorded_at);
  END IF;

  -- Só cabeças conhecidas AGORA definem o estado atual. Um EXCLUDE em todas as
  -- versões rejeitaria legitimamente as versões antigas que a correção preserva.
  IF EXISTS (
    SELECT 1 FROM public.institutional_class_record_versions a
    JOIN public.institutional_class_record_versions b
      ON b.class_id = a.class_id AND b.id > a.id
     AND daterange(a.valid_from, a.valid_until, '[]') &&
         daterange(b.valid_from, b.valid_until, '[]')
    WHERE a.class_id = _class_id
      AND NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions x WHERE x.supersedes_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM public.institutional_class_record_versions y WHERE y.supersedes_id = b.id)
  ) THEN RAISE EXCEPTION 'class:overlapping-current-segments'; END IF;
  RETURN _replacement_id;
END $record_class$;
REVOKE ALL ON FUNCTION public.record_institutional_class_version(text, uuid, text, text, text, text, date, date, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_institutional_class_version(text, uuid, text, text, text, text, date, date, text, text)
  TO authenticated;
