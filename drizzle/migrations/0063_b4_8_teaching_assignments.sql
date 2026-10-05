-- B4.8 — Atribuição docente: elo turma ↔ elemento da matriz aplicável ↔ atuação (pessoa). Aditivo.
-- Writer preparado e FECHADO: nenhuma política concede 'manter-atribuicao-docente' (decisão do proprietário).
-- Papel é eixo aberto opcional por catálogo (scheme/value/version), sem taxonomia; D8 (substituição) não modelada.
-- Co-responsabilidade = várias atuações distintas no mesmo elemento, sem semântica atribuída.

CREATE TABLE public.teaching_assignments (
  id text PRIMARY KEY CHECK (id ~ '^ta-[0-9a-f-]{36}$'),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.teaching_assignment_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id text NOT NULL REFERENCES public.teaching_assignments(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.teaching_assignment_versions(id),
  change_kind text NOT NULL CHECK (change_kind IN ('constituicao','sucessao','retificacao')),
  valid_from date NOT NULL,
  valid_until date,
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  matrix_id text NOT NULL,
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_versions(id),
  item_key text NOT NULL,
  role_scheme_id text, role_value_id text, role_value_version integer,
  source_ref text,
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_person_id uuid,
  recorded_via_engagement_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK ((role_scheme_id IS NULL) = (role_value_id IS NULL) AND (role_value_id IS NULL) = (role_value_version IS NULL)),
  CHECK (change_kind = 'constituicao' OR (supersedes_id IS NOT NULL AND change_reason IS NOT NULL))
);
GRANT SELECT ON public.teaching_assignments, public.teaching_assignment_versions TO authenticated;
GRANT ALL ON public.teaching_assignments, public.teaching_assignment_versions TO service_role;
REVOKE TRUNCATE, UPDATE, DELETE ON public.teaching_assignments, public.teaching_assignment_versions FROM service_role;
ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_assignment_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read assignments of readable class" ON public.teaching_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = class_id AND public.can_read_institutional_class(c.id, c.school_id)));
CREATE POLICY "read assignment versions of readable class or own" ON public.teaching_assignment_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teaching_assignments a JOIN public.institutional_classes c ON c.id = a.class_id
           WHERE a.id = assignment_id AND public.can_read_institutional_class(c.id, c.school_id))
      OR EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = engagement_id AND e.person_id = public.current_person_id()));
CREATE TRIGGER teaching_assignments_immutable BEFORE UPDATE OR DELETE ON public.teaching_assignments
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER teaching_assignment_versions_immutable BEFORE UPDATE OR DELETE ON public.teaching_assignment_versions
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE INDEX teaching_assignment_versions_engagement_idx ON public.teaching_assignment_versions(engagement_id);

-- Janela efetiva conhecida: retificada some; sucessão encerra a predecessora na véspera.
CREATE FUNCTION public.teaching_assignment_effective_versions(_known_at timestamptz)
RETURNS TABLE(version_id uuid, assignment_id text, effective_from date, effective_until date)
LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT v.id, v.assignment_id, v.valid_from,
    CASE WHEN s.change_kind = 'sucessao' THEN least(coalesce(v.valid_until, s.valid_from - 1), s.valid_from - 1) ELSE v.valid_until END
  FROM public.teaching_assignment_versions v
  LEFT JOIN public.teaching_assignment_versions s ON s.supersedes_id = v.id AND s.created_at <= _known_at
  WHERE v.created_at <= _known_at AND (s.id IS NULL OR s.change_kind = 'sucessao')
$fn$;
REVOKE ALL ON FUNCTION public.teaching_assignment_effective_versions(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teaching_assignment_effective_versions(timestamptz) TO authenticated;

-- Reader INVOKER (RLS decide): atribuições efetivas da turma na data/knownAt, com aplicabilidade revalidada.
CREATE FUNCTION public.teaching_assignments_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(assignment_id text, version_id uuid, version integer, change_kind text, effective_from date, effective_until date,
  engagement_id uuid, person_id uuid, matrix_id text, matrix_version_id uuid, item_key text,
  component_id text, component_label_snapshot text, element_scheme_id text, element_value_id text, element_value_version integer,
  role_scheme_id text, role_value_id text, role_value_version integer, source_ref text, change_reason text, recorded_at timestamptz,
  assignment_state text, co_assigned_engagement_ids uuid[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  WITH eff AS (
    SELECT v.*, w.effective_from AS ef, w.effective_until AS eu
    FROM public.teaching_assignment_effective_versions(_known_at) w
    JOIN public.teaching_assignment_versions v ON v.id = w.version_id
    JOIN public.teaching_assignments a ON a.id = v.assignment_id AND a.class_id = _class_id
    WHERE w.effective_from <= _on AND (w.effective_until IS NULL OR w.effective_until >= _on)),
  app AS (SELECT m.matrix_version_id FROM public.class_curricular_matrices_at(NULL, _class_id, _on, _known_at) m
          WHERE m.result_kind IN ('matrix','specific-link') AND m.matrix_version_id IS NOT NULL)
  SELECT e.assignment_id, e.id, e.version, e.change_kind, e.ef, e.eu, e.engagement_id, ie.person_id,
    e.matrix_id, e.matrix_version_id, e.item_key, i.component_id, i.component_label_snapshot,
    i.element_scheme_id, i.element_value_id, i.element_value_version,
    e.role_scheme_id, e.role_value_id, e.role_value_version, e.source_ref, e.change_reason, e.created_at,
    CASE WHEN i.id IS NULL THEN 'elemento-inexistente'
         WHEN NOT EXISTS (SELECT 1 FROM app WHERE app.matrix_version_id = e.matrix_version_id) THEN 'matriz-nao-aplicavel-na-data'
         WHEN ie.id IS NULL OR ie.valid_from > _on OR (ie.valid_until IS NOT NULL AND ie.valid_until < _on)
           OR EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = ie.id AND x.created_at <= _known_at AND x.ended_on < _on)
           THEN 'atuacao-nao-vigente'
         ELSE 'vigente' END,
    ARRAY(SELECT o.engagement_id FROM eff o WHERE o.matrix_version_id = e.matrix_version_id AND o.item_key = e.item_key
          AND o.engagement_id <> e.engagement_id ORDER BY o.engagement_id)
  FROM eff e
  LEFT JOIN public.institutional_engagements ie ON ie.id = e.engagement_id
  LEFT JOIN public.curricular_matrix_items i ON i.matrix_version_id = e.matrix_version_id AND i.item_key = e.item_key
  ORDER BY e.matrix_id, e.item_key, e.engagement_id
$fn$;
REVOKE ALL ON FUNCTION public.teaching_assignments_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teaching_assignments_at(text, date, timestamptz) TO authenticated;

-- Próprias atribuições da pessoa da sessão (projeção do professor).
CREATE FUNCTION public.my_teaching_assignments_at(_on date, _known_at timestamptz)
RETURNS TABLE(assignment_id text, class_id text, version_id uuid, effective_from date, effective_until date,
  engagement_id uuid, matrix_id text, item_key text, component_id text, component_label_snapshot text,
  element_value_id text, role_value_id text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT v.assignment_id, a.class_id, v.id, w.effective_from, w.effective_until, v.engagement_id, v.matrix_id, v.item_key,
    i.component_id, i.component_label_snapshot, i.element_value_id, v.role_value_id
  FROM public.teaching_assignment_effective_versions(_known_at) w
  JOIN public.teaching_assignment_versions v ON v.id = w.version_id
  JOIN public.teaching_assignments a ON a.id = v.assignment_id
  JOIN public.institutional_engagements e ON e.id = v.engagement_id AND e.person_id = public.current_person_id()
  LEFT JOIN public.curricular_matrix_items i ON i.matrix_version_id = v.matrix_version_id AND i.item_key = v.item_key
  WHERE w.effective_from <= _on AND (w.effective_until IS NULL OR w.effective_until >= _on)
  ORDER BY a.class_id, v.matrix_id, v.item_key
$fn$;
REVOKE ALL ON FUNCTION public.my_teaching_assignments_at(date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_teaching_assignments_at(date, timestamptz) TO authenticated;

CREATE FUNCTION public.teaching_assignment_grant(_school text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'assignment:class-not-found'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'manter-atribuicao-docente' AND c.policy_id IS NOT NULL
     AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')
   ORDER BY (c.scope_level = 'escola') DESC, c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-atribuicao-docente'; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.teaching_assignment_grant(text) FROM PUBLIC, anon, authenticated, service_role;

-- Writer: _assignment_id NULL ⇒ constituição de nova atribuição; senão sucessão/retificação com cabeça esperada.
CREATE FUNCTION public.record_teaching_assignment_version(_class_id text, _assignment_id text, _expected_head_id uuid,
  _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _matrix_version_id uuid, _item_key text,
  _role_scheme_id text, _role_value_id text, _role_value_version integer, _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE _school text; g uuid; _aid text; _head uuid; _hver integer; _vid uuid; _mid text; _pt date; _e record;
BEGIN
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  g := public.teaching_assignment_grant(_school);
  IF _change_kind IS NULL OR _change_kind NOT IN ('constituicao','sucessao','retificacao') THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'assignment:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'assignment:invalid-window'; END IF;
  IF _change_kind <> 'constituicao' AND coalesce(pg_catalog.btrim(_reason),'') = '' THEN RAISE EXCEPTION 'assignment:reason-required'; END IF;
  IF _engagement_id IS NULL OR _matrix_version_id IS NULL OR coalesce(_item_key,'') = '' THEN RAISE EXCEPTION 'assignment:target-required'; END IF;
  IF _role_value_id IS NOT NULL AND NOT public.attribute_value_homologated(_role_scheme_id, _role_value_id, _role_value_version) THEN
    RAISE EXCEPTION 'assignment:role-not-homologated'; END IF;

  -- Atuação: mesma escola da turma, vigente em toda a janela, sem encerramento anterior ao fim.
  SELECT * INTO _e FROM public.institutional_engagements e WHERE e.id = _engagement_id;
  IF _e.id IS NULL OR _e.school_id IS DISTINCT FROM _school THEN RAISE EXCEPTION 'assignment:engagement-outside-school'; END IF;
  IF _e.valid_from > _valid_from OR (_e.valid_until IS NOT NULL AND (_valid_until IS NULL OR _e.valid_until < _valid_until))
     OR EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = _e.id AND (_valid_until IS NULL OR x.ended_on < _valid_until))
  THEN RAISE EXCEPTION 'assignment:engagement-not-valid-throughout'; END IF;

  -- Elemento pertence à versão de matriz; matriz aplicável à turma no início e no fim da janela.
  SELECT v.matrix_id INTO _mid FROM public.curricular_matrix_versions v WHERE v.id = _matrix_version_id;
  IF _mid IS NULL OR NOT EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _matrix_version_id AND i.item_key = _item_key)
  THEN RAISE EXCEPTION 'assignment:element-not-in-matrix'; END IF;
  FOR _pt IN SELECT _valid_from UNION SELECT _valid_until WHERE _valid_until IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.class_curricular_matrices_at(_school, _class_id, _pt, now()) m
                   WHERE m.result_kind IN ('matrix','specific-link') AND m.matrix_version_id = _matrix_version_id)
    THEN RAISE EXCEPTION 'assignment:matrix-not-applicable'; END IF;
  END LOOP;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('assignment:' || _class_id, 0));
  IF _assignment_id IS NULL THEN
    IF _change_kind <> 'constituicao' OR _expected_head_id IS NOT NULL THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.teaching_assignments a WHERE a.id = _assignment_id AND a.class_id = _class_id)
    THEN RAISE EXCEPTION 'assignment:not-found'; END IF;
    SELECT v.id, v.version INTO _head, _hver FROM public.teaching_assignment_versions v WHERE v.assignment_id = _assignment_id ORDER BY v.version DESC LIMIT 1;
    IF _expected_head_id IS DISTINCT FROM _head THEN RAISE EXCEPTION 'assignment:stale-head'; END IF;
    IF _change_kind = 'constituicao' THEN RAISE EXCEPTION 'assignment:invalid-change-kind'; END IF;
    IF _change_kind = 'sucessao' AND _valid_from <= (SELECT valid_from FROM public.teaching_assignment_versions WHERE id = _head)
    THEN RAISE EXCEPTION 'assignment:succession-must-start-later'; END IF;
  END IF;

  -- Sobreposição fail-closed: mesma atuação no mesmo elemento em OUTRA atribuição com janela cruzada.
  IF EXISTS (SELECT 1 FROM public.teaching_assignment_effective_versions(now()) w
             JOIN public.teaching_assignment_versions v ON v.id = w.version_id
             JOIN public.teaching_assignments a ON a.id = v.assignment_id AND a.class_id = _class_id
             WHERE v.assignment_id IS DISTINCT FROM _assignment_id AND v.engagement_id = _engagement_id
               AND v.matrix_version_id = _matrix_version_id AND v.item_key = _item_key
               AND w.effective_from <= coalesce(_valid_until, 'infinity'::date)
               AND coalesce(w.effective_until, 'infinity'::date) >= _valid_from)
  THEN RAISE EXCEPTION 'assignment:overlap'; END IF;

  IF _assignment_id IS NULL THEN
    _aid := 'ta-' || gen_random_uuid()::text;
    INSERT INTO public.teaching_assignments(id, class_id) VALUES (_aid, _class_id);
  ELSE _aid := _assignment_id; END IF;
  INSERT INTO public.teaching_assignment_versions(assignment_id, version, supersedes_id, change_kind, valid_from, valid_until,
      engagement_id, matrix_id, matrix_version_id, item_key, role_scheme_id, role_value_id, role_value_version,
      source_ref, change_reason, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_aid, coalesce(_hver,0)+1, _head, _change_kind, _valid_from, _valid_until, _engagement_id, _mid, _matrix_version_id,
      _item_key, _role_scheme_id, _role_value_id, _role_value_version, nullif(pg_catalog.btrim(coalesce(_source_ref,'')),''),
      nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), public.current_person_id(), g)
    RETURNING id INTO _vid;
  RETURN pg_catalog.jsonb_build_object('assignment_id', _aid, 'version_id', _vid, 'version', coalesce(_hver,0)+1);
END $fn$;
REVOKE ALL ON FUNCTION public.record_teaching_assignment_version(text, text, uuid, text, date, date, uuid, uuid, text, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_teaching_assignment_version(text, text, uuid, text, date, date, uuid, uuid, text, text, text, integer, text, text) TO authenticated;