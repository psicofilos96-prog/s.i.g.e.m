-- 0108: neutralização append-only dos stand-ins temporais da carga C (EducaCenso 2026).
-- Limites 01/01–31/12 do ano 2026 e valid_from 31/08 das turmas não são sustentados pela fonte.
-- Nada é apagado: registra-se que o valor gravado não é fato institucional e os readers deixam de devolvê-lo.
-- known_at das turmas = emissão real de cada bloco da fonte; início efetivo da turma permanece desconhecido.

CREATE TABLE public.temporal_stand_in_neutralizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table text NOT NULL CHECK (target_table IN ('institutional_academic_year_versions','institutional_class_record_versions','institutional_classes','class_census_declarations')),
  target_id text NOT NULL,
  field text NOT NULL CHECK (field IN ('starts_on','ends_on','valid_from')),
  status text NOT NULL CHECK (status = 'nao-sustentado-pela-fonte'),
  reason text NOT NULL CHECK (pg_catalog.btrim(reason) <> ''),
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_table, target_id, field)
);
COMMENT ON TABLE public.temporal_stand_in_neutralizations IS 'Marca, sem apagar, valores temporais gravados como stand-in (não sustentados pela fonte). Readers tratam o campo como desconhecido.';

CREATE TABLE public.class_source_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  known_at timestamptz NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  source_ref text NOT NULL,
  source_locator text,
  technical_operation_id uuid NOT NULL REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_hash, class_id)
);
COMMENT ON TABLE public.class_source_observations IS 'Quando a fonte observou a turma (emissão do bloco). known_at/snapshot; nunca início de vigência.';

REVOKE ALL ON public.temporal_stand_in_neutralizations, public.class_source_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.temporal_stand_in_neutralizations, public.class_source_observations TO authenticated;
ALTER TABLE public.temporal_stand_in_neutralizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_source_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura autenticada" ON public.temporal_stand_in_neutralizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "leitura conforme turma" ON public.class_source_observations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id));
CREATE TRIGGER temporal_stand_in_neutralizations_immutable BEFORE UPDATE OR DELETE ON public.temporal_stand_in_neutralizations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER class_source_observations_immutable BEFORE UPDATE OR DELETE ON public.class_source_observations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.temporal_field_unknown(_table text, _id text, _field text)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $f$
  SELECT EXISTS (SELECT 1 FROM public.temporal_stand_in_neutralizations n WHERE n.target_table = _table AND n.target_id = _id AND n.field = _field)
$f$;
REVOKE ALL ON FUNCTION public.temporal_field_unknown(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.temporal_field_unknown(text, text, text) TO authenticated;

-- Ano letivo: limites neutralizados ⇒ estado na data não pode ser afirmado.
CREATE OR REPLACE FUNCTION public.calendar_year_state_at(_year text, _on date, _known_at timestamp with time zone)
 RETURNS text LANGUAGE sql STABLE SET search_path TO '' AS $function$
  WITH v AS (SELECT x.* FROM public.institutional_academic_year_versions x
             WHERE x.academic_year_id = _year AND x.created_at <= _known_at ORDER BY x.version DESC LIMIT 1)
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM v WHERE public.temporal_field_unknown('institutional_academic_year_versions', v.id::text, 'starts_on')
                                    OR public.temporal_field_unknown('institutional_academic_year_versions', v.id::text, 'ends_on'))
      THEN 'ano-letivo-limites-oficiais-nao-informados'
    WHEN (SELECT x.is_active AND x.starts_on <= _on AND x.ends_on >= _on
          FROM public.institutional_academic_year_versions x
          WHERE x.academic_year_id = _year AND x.valid_from <= _on AND x.created_at <= _known_at
          ORDER BY x.version DESC LIMIT 1) IS TRUE THEN NULL
    ELSE 'ano-letivo-inativo-ou-desconhecido-na-data' END
$function$;

CREATE OR REPLACE FUNCTION public.b41_year_active_throughout(_year text, _from date, _until date)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO '' AS $function$
  SELECT NOT EXISTS (SELECT 1 FROM public.institutional_academic_year_versions v
                     WHERE v.academic_year_id = _year AND public.temporal_field_unknown('institutional_academic_year_versions', v.id::text, 'valid_from'))
     AND NOT EXISTS (
    SELECT 1 FROM public.b41_segment_points(_from, _until,
      ARRAY(SELECT v.valid_from FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = _year)) s
    WHERE (SELECT v.is_active FROM public.institutional_academic_year_versions v
           WHERE v.academic_year_id = _year AND v.valid_from <= s.at_date
           ORDER BY v.version DESC LIMIT 1) IS DISTINCT FROM true)
$function$;

-- Turma: valid_from neutralizado ⇒ devolvido NULL; a turma só é afirmada a partir da primeira observação da fonte.
CREATE OR REPLACE FUNCTION public.class_at(_class_id text, _valid_on date, _known_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS SETOF public.institutional_class_record_versions LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
DECLARE _found public.institutional_class_record_versions%ROWTYPE; _h public.institutional_class_record_versions%ROWTYPE;
  _count integer := 0; _observed date; _unknown boolean; _found_unknown boolean := false;
BEGIN
  IF _class_id IS NULL OR _valid_on IS NULL THEN RAISE EXCEPTION 'class:query-arguments-required'; END IF;
  SELECT min(o.known_at)::date INTO _observed FROM public.class_source_observations o
   WHERE o.class_id = _class_id AND (_known_at IS NULL OR o.recorded_at <= _known_at);
  FOR _h IN
    WITH known AS (
      SELECT v.* FROM public.institutional_class_record_versions v
      WHERE v.class_id = _class_id AND (_known_at IS NULL OR v.created_at <= _known_at))
    SELECT v.* FROM known v WHERE NOT EXISTS (SELECT 1 FROM known successor WHERE successor.supersedes_id = v.id)
  LOOP
    _unknown := public.temporal_field_unknown('institutional_class_record_versions', _h.id::text, 'valid_from');
    IF (CASE WHEN _unknown THEN _observed IS NOT NULL AND _observed <= _valid_on ELSE _h.valid_from <= _valid_on END)
       AND (_h.valid_until IS NULL OR _h.valid_until >= _valid_on) THEN
      _count := _count + 1; _found := _h; _found_unknown := _unknown;
    END IF;
  END LOOP;
  IF _count > 1 THEN RAISE EXCEPTION 'class:ambiguous-temporal-state'; END IF;
  IF _count = 0 THEN RETURN; END IF;
  IF _found_unknown THEN _found.valid_from := NULL; END IF;
  RETURN NEXT _found;
END $function$;

CREATE OR REPLACE FUNCTION public.technical_correct_educacenso_2026_temporal(_operation_kind text, _source_hash text, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
DECLARE op uuid; fp text; existing record; c_op uuid; r jsonb; cid text; n int := 0; reason_y text; reason_c text;
  m jsonb := _payload->'manifest'; cls jsonb := _payload->'classes';
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _operation_kind IS DISTINCT FROM 'technical_correct_educacenso_2026_temporal' THEN RAISE EXCEPTION 'technical:operation-kind-mismatch'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(cls) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:manifest-hash-mismatch'; END IF;
  SELECT o.id INTO c_op FROM public.technical_execution_operations o WHERE o.operation_kind = 'technical_import_educacenso_2026_classes' AND o.source_hash = _source_hash;
  IF c_op IS NULL THEN RAISE EXCEPTION 'technical:class-operation-not-found'; END IF;
  IF (m->>'class_count')::int IS DISTINCT FROM pg_catalog.jsonb_array_length(cls)
     OR pg_catalog.jsonb_array_length(cls) <> (SELECT count(*) FROM public.technical_execution_targets t WHERE t.operation_id = c_op AND t.target_table = 'institutional_classes')
    THEN RAISE EXCEPTION 'technical:count-classes'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(cls) e WHERE (e->>'known_at') IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.institutional_class_identifiers ci JOIN public.technical_execution_targets t ON t.operation_id = c_op AND t.target_table='institutional_classes' AND t.target_id = ci.class_id
       WHERE ci.identifier_kind = 'educacenso-turma' AND ci.value = e->>'code')) THEN RAISE EXCEPTION 'technical:class-not-found'; END IF;
  fp := pg_catalog.encode(extensions.digest(_payload::text, 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || _operation_kind));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = _operation_kind AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN existing.id;
  END IF;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, _operation_kind, 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida', m, pg_catalog.clock_timestamp());
  reason_y := 'Limites 01/01–31/12 gravados como stand-in na carga C; a fonte censitária declara só o ano 2026. Limites oficiais desconhecidos até carga do Calendário Escolar 2026.';
  reason_c := 'valid_from 31/08 veio da Data de Referência de relatório agregado (snapshot), não do início da turma. Início efetivo desconhecido; known_at = emissão do bloco da fonte.';
  INSERT INTO public.temporal_stand_in_neutralizations(target_table, target_id, field, status, reason, technical_operation_id)
  SELECT 'institutional_academic_year_versions', v.id::text, f, 'nao-sustentado-pela-fonte', reason_y, op
  FROM public.institutional_academic_year_versions v, unnest(ARRAY['starts_on','ends_on','valid_from']) f WHERE v.technical_operation_id = c_op;
  FOR r IN SELECT * FROM pg_catalog.jsonb_array_elements(cls) LOOP
    SELECT ci.class_id INTO cid FROM public.institutional_class_identifiers ci WHERE ci.identifier_kind='educacenso-turma' AND ci.value = r->>'code';
    INSERT INTO public.class_source_observations(class_id, known_at, source_hash, source_ref, source_locator, technical_operation_id)
    VALUES (cid, (r->>'known_at')::timestamptz, _source_hash, m->>'source_ref', r->>'locator', op);
    INSERT INTO public.temporal_stand_in_neutralizations(target_table, target_id, field, status, reason, technical_operation_id)
    VALUES ('institutional_classes', cid, 'valid_from', 'nao-sustentado-pela-fonte', reason_c, op);
    INSERT INTO public.temporal_stand_in_neutralizations(target_table, target_id, field, status, reason, technical_operation_id)
    SELECT 'institutional_class_record_versions', v.id::text, 'valid_from', 'nao-sustentado-pela-fonte', reason_c, op
    FROM public.institutional_class_record_versions v WHERE v.class_id = cid AND v.technical_operation_id = c_op;
    INSERT INTO public.temporal_stand_in_neutralizations(target_table, target_id, field, status, reason, technical_operation_id)
    SELECT 'class_census_declarations', d.id::text, 'valid_from', 'nao-sustentado-pela-fonte', 'Declaração censitária: data gravada é snapshot da fonte, não vigência.', op
    FROM public.class_census_declarations d WHERE d.class_id = cid AND d.technical_operation_id = c_op;
    n := n + 1;
  END LOOP;
  IF n <> pg_catalog.jsonb_array_length(cls) THEN RAISE EXCEPTION 'technical:written-count'; END IF;
  RETURN op;
END $f$;
REVOKE ALL ON FUNCTION public.technical_correct_educacenso_2026_temporal(text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
