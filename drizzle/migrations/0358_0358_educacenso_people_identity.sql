CREATE TABLE public.educacenso_identity_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collision_key text NOT NULL,
  collision_kind text NOT NULL,
  person_ids text[] NOT NULL,
  seq integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('manter-separados','encaminhar-correcao-na-origem','reabrir')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collision_key, seq)
);
COMMENT ON TABLE public.educacenso_identity_review_events IS 'Fila de revisão de possíveis duplicidades de pessoa para o Educacenso. Append-only; nunca unifica pessoas nem guarda o valor do identificador (só chave derivada).';
GRANT SELECT ON public.educacenso_identity_review_events TO authenticated;
GRANT ALL ON public.educacenso_identity_review_events TO service_role;
ALTER TABLE public.educacenso_identity_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review read by census network" ON public.educacenso_identity_review_events FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('preparar-censo-escolar')));

CREATE OR REPLACE FUNCTION public.educacenso_identity_review_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'educacenso:append-only'; END $$;
CREATE TRIGGER educacenso_identity_review_no_change BEFORE UPDATE OR DELETE ON public.educacenso_identity_review_events
  FOR EACH ROW EXECUTE FUNCTION public.educacenso_identity_review_immutable();

-- Máscara: primeiro nome + iniciais. Nome completo nunca sai do leitor.
CREATE OR REPLACE FUNCTION public.educacenso_mask_name(_n text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _n IS NULL OR btrim(_n) = '' THEN NULL ELSE
    (SELECT string_agg(CASE WHEN i = 1 THEN w ELSE left(w, 1) || '.' END, ' ' ORDER BY i)
       FROM unnest(regexp_split_to_array(btrim(_n), '\s+')) WITH ORDINALITY AS t(w, i)) END
$$;

CREATE OR REPLACE FUNCTION public.educacenso_people_at(_school text, _limit integer DEFAULT 200, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _net boolean := public.has_network_capability('preparar-censo-escolar');
  _out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:unauthenticated'; END IF;
  IF NOT (_net OR public.has_school_capability('preparar-censo-escolar', _school)) THEN RAISE EXCEPTION 'educacenso:forbidden'; END IF;
  _limit := least(greatest(coalesce(_limit, 200), 1), 500); _offset := greatest(coalesce(_offset, 0), 0);

  WITH students AS (
    SELECT DISTINCT e.student_id FROM public.class_enrollment_episodes e WHERE e.school_id = _school
  ), stu AS (
    SELECT 'aluno'::text AS role, s.student_id AS local_ref, sp.person_id::text AS person_id, p.display_name,
      (SELECT jsonb_build_object('birth', v.birth_date IS NOT NULL, 'sex', v.sex_value_id IS NOT NULL, 'name', v.civil_name)
         FROM public.student_identity_versions v WHERE v.student_id = s.student_id ORDER BY v.version DESC LIMIT 1) AS idv,
      (SELECT count(*) FROM public.institutional_student_persons x WHERE x.student_id = s.student_id) AS person_links
    FROM students s
    LEFT JOIN public.institutional_student_persons sp ON sp.student_id = s.student_id
    LEFT JOIN public.institutional_persons p ON p.id::text = sp.person_id::text
  ), prof AS (
    SELECT DISTINCT ON (g.person_id) 'profissional'::text AS role, g.person_id::text AS local_ref, g.person_id::text AS person_id, p.display_name,
      NULL::jsonb AS idv, 1::bigint AS person_links
    FROM public.institutional_engagements g JOIN public.institutional_persons p ON p.id::text = g.person_id::text
    WHERE g.school_id = _school AND (g.valid_until IS NULL OR g.valid_until >= current_date) AND p.actor_nature = 'pessoa-natural'
  ), people AS (
    SELECT u.*,
      (SELECT i.value FROM public.institutional_person_identifiers i WHERE i.person_id::text = u.person_id AND i.identifier_kind = 'inep-pessoa' LIMIT 1) AS inep,
      EXISTS (SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id::text = u.person_id AND i.identifier_kind = 'cpf-hmac') AS has_cpf
    FROM (SELECT * FROM stu UNION ALL SELECT * FROM prof) u
  ), coll AS (
    -- Colisão determinística: mesmo identificador em pessoas diferentes; chave nunca revela o valor.
    SELECT md5(i.identifier_kind || ':' || i.value) AS k, i.identifier_kind AS kind, array_agg(DISTINCT i.person_id::text ORDER BY i.person_id::text) AS persons
    FROM public.institutional_person_identifiers i
    WHERE i.identifier_kind IN ('inep-pessoa','cpf-hmac')
      AND i.value IN (SELECT j.value FROM public.institutional_person_identifiers j JOIN people pp ON pp.person_id = j.person_id::text WHERE j.identifier_kind = i.identifier_kind)
    GROUP BY 1, 2 HAVING count(DISTINCT i.person_id) > 1
    UNION ALL
    SELECT md5('aluno-multiplas-pessoas:' || s.local_ref), 'aluno-multiplas-pessoas', array_agg(DISTINCT s.person_id ORDER BY s.person_id)
    FROM stu s WHERE s.person_links > 1 GROUP BY s.local_ref
  )
  SELECT jsonb_build_object(
    'school_id', _school, 'network', _net,
    'summary', jsonb_build_object(
      'students', (SELECT count(DISTINCT local_ref) FROM people WHERE role = 'aluno'),
      'professionals', (SELECT count(*) FROM people WHERE role = 'profissional'),
      'without_person', (SELECT count(DISTINCT local_ref) FROM people WHERE person_id IS NULL),
      'inep_valid', (SELECT count(*) FROM people WHERE inep ~ '^\d{12}$'),
      'inep_invalid', (SELECT count(*) FROM people WHERE inep IS NOT NULL AND inep !~ '^\d{12}$'),
      'inep_missing', (SELECT count(*) FROM people WHERE inep IS NULL),
      'cpf_present', (SELECT count(*) FROM people WHERE has_cpf),
      'birth_present', (SELECT count(*) FROM people WHERE (idv->>'birth')::boolean),
      'sex_present', (SELECT count(*) FROM people WHERE (idv->>'sex')::boolean),
      'staff_records_without_person', (SELECT count(*) FROM public.staff_administrative_records r WHERE r.school_id = _school),
      'collisions', (SELECT count(*) FROM coll)),
    'people', coalesce((SELECT jsonb_agg(x ORDER BY x->>'masked_name' NULLS LAST, x->>'local_ref') FROM (
      SELECT jsonb_build_object('role', role, 'local_ref', local_ref, 'person_id', person_id,
        'masked_name', public.educacenso_mask_name(coalesce(idv->>'name', display_name)),
        'inep', CASE WHEN inep IS NULL THEN 'ausente' WHEN inep ~ '^\d{12}$' THEN 'valido' ELSE 'invalido' END,
        'inep_masked', CASE WHEN inep IS NULL THEN NULL ELSE repeat('•', greatest(length(inep) - 4, 0)) || right(inep, 4) END,
        'cpf', CASE WHEN has_cpf THEN 'registrado' ELSE 'ausente' END,
        'birth', CASE WHEN role = 'profissional' THEN 'sem-fonte' WHEN (idv->>'birth')::boolean THEN 'registrado' ELSE 'ausente' END,
        'sex', CASE WHEN role = 'profissional' THEN 'sem-fonte' WHEN (idv->>'sex')::boolean THEN 'registrado' ELSE 'ausente' END) AS x
      FROM people ORDER BY role, local_ref LIMIT _limit OFFSET _offset) q), '[]'::jsonb),
    'collisions', coalesce((SELECT jsonb_agg(jsonb_build_object('key', c.k, 'kind', c.kind, 'person_ids', c.persons,
        'masked_names', (SELECT jsonb_agg(public.educacenso_mask_name(p.display_name)) FROM public.institutional_persons p WHERE p.id::text = ANY (c.persons)),
        'review', (SELECT jsonb_build_object('seq', r.seq, 'decision', r.decision, 'reason', r.reason, 'recorded_at', r.recorded_at)
                     FROM public.educacenso_identity_review_events r WHERE r.collision_key = c.k ORDER BY r.seq DESC LIMIT 1)))
      FROM coll c), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.educacenso_identity_review(_key text, _kind text, _persons text[], _decision text, _reason text, _expected_seq integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:unauthenticated'; END IF;
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'educacenso:forbidden'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'educacenso:reason-required'; END IF;
  IF coalesce(array_length(_persons, 1), 0) < 2 THEN RAISE EXCEPTION 'educacenso:invalid-collision'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('educacenso-review:' || _key));
  SELECT coalesce(max(seq), 0) INTO _head FROM public.educacenso_identity_review_events WHERE collision_key = _key;
  IF _head <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'educacenso:stale-base'; END IF;
  IF _decision = 'reabrir' AND _head = 0 THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
  INSERT INTO public.educacenso_identity_review_events (collision_key, collision_kind, person_ids, seq, decision, reason, recorded_by)
  VALUES (_key, _kind, (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(_persons) x), _head + 1, _decision, btrim(_reason), auth.uid());
  RETURN _head + 1;
END $$;

REVOKE ALL ON FUNCTION public.educacenso_people_at(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.educacenso_identity_review(text, text, text[], text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.educacenso_people_at(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.educacenso_identity_review(text, text, text[], text, text, integer) TO authenticated;