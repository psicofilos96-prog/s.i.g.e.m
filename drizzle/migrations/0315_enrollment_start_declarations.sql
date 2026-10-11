-- Secretaria: data de início efetivo da matrícula declarada pela secretaria (append-only, por versão, com motivo e autoria).
-- A carga 2026 não trouxe data de início; nada é inferido da data técnica de importação. Sem declaração ⇒ declaração escolar não elegível.
CREATE TABLE public.school_enrollment_start_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  school_id text NOT NULL,
  start_on date NOT NULL,
  supersedes_id uuid REFERENCES public.school_enrollment_start_declarations(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  source_ref text,
  author_user_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supersedes_id)
);
CREATE INDEX sesd_enrollment_idx ON public.school_enrollment_start_declarations(enrollment_id, recorded_at DESC);
GRANT SELECT ON public.school_enrollment_start_declarations TO authenticated;
GRANT ALL ON public.school_enrollment_start_declarations TO service_role;
ALTER TABLE public.school_enrollment_start_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Secretaria da escola lê declarações de início" ON public.school_enrollment_start_declarations FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-matricula-e-movimentacao', school_id) OR public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER sesd_append_only BEFORE UPDATE OR DELETE ON public.school_enrollment_start_declarations
  FOR EACH ROW EXECUTE FUNCTION public.school_document_append_only();

CREATE OR REPLACE FUNCTION public.enrollment_declared_start(_enrollment text)
 RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT d.start_on FROM public.school_enrollment_start_declarations d WHERE d.enrollment_id = _enrollment
  AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_start_declarations n WHERE n.supersedes_id = d.id) ORDER BY d.recorded_at DESC LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.enrollment_declared_start(text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.secretariat_declare_enrollment_start(_enrollment text, _start_on date, _expected_head uuid, _reason text, _source_ref text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE se record; g uuid; head uuid; new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO se FROM public.school_enrollments e WHERE e.id = _enrollment;
  IF se.id IS NULL THEN RAISE EXCEPTION 'enrollment:not-found'; END IF;
  SELECT c.engagement_id INTO g FROM public.school_capability_grant('manter-matricula-e-enturmacao', se.school_id) c;
  IF g IS NULL THEN
    SELECT a.engagement_id INTO g FROM public.bo_fixture_accounts a JOIN public.school_capability_grant('manter-matricula-e-enturmacao', se.school_id) c ON true
     WHERE a.user_id = auth.uid() AND public.technical_automation_enabled() LIMIT 1;
  END IF;
  IF g IS NULL THEN RAISE EXCEPTION 'enrollment:not-found'; END IF; -- recusa sem revelar existência
  IF NOT public.af_enrollment_current(se.id) THEN RAISE EXCEPTION 'base-superseded'; END IF;
  IF se.opened_on IS NOT NULL THEN RAISE EXCEPTION 'enrollment:start-already-recorded'; END IF;
  IF _start_on IS NULL OR _start_on > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'enrollment:start-invalid'; END IF;
  IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sesd:' || se.id));
  SELECT d.id INTO head FROM public.school_enrollment_start_declarations d WHERE d.enrollment_id = se.id
    AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_start_declarations n WHERE n.supersedes_id = d.id) LIMIT 1;
  IF head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'base-superseded'; END IF;
  INSERT INTO public.school_enrollment_start_declarations(enrollment_id, school_id, start_on, supersedes_id, reason, source_ref, author_user_id, author_engagement)
    VALUES (se.id, se.school_id, _start_on, head, btrim(_reason), nullif(btrim(_source_ref), ''), auth.uid(), g) RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id, 'start_on', _start_on, 'supersedes_id', head);
END $function$;
REVOKE ALL ON FUNCTION public.secretariat_declare_enrollment_start(text, date, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_declare_enrollment_start(text, date, uuid, text, text) TO authenticated;

-- Leitura da secretaria: matrículas da escola com início efetivo (registrado ou declarado) e turma vigente.
CREATE OR REPLACE FUNCTION public.secretariat_enrollment_lookup(_school text, _query text, _on date)
 RETURNS TABLE(enrollment_id text, student_id text, student_name text, institutional_identifier text, start_on date, start_source text,
   declaration_head uuid, class_label text, ended_on date)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'document:scope-required'; END IF;
  IF NOT (public.has_school_capability('consultar-matricula-e-movimentacao', _school) OR public.has_school_capability('manter-matricula-e-enturmacao', _school)
          OR public.has_school_capability('emitir-documento-escolar', _school)) THEN RAISE EXCEPTION 'capability:consultar-matricula-e-movimentacao'; END IF;
  IF coalesce(length(btrim(_query)), 0) < 3 THEN RAISE EXCEPTION 'search:query-too-short'; END IF;
  RETURN QUERY
  SELECT se.id, s.id, s.display_name, s.institutional_identifier,
    coalesce(se.opened_on, public.enrollment_declared_start(se.id)),
    CASE WHEN se.opened_on IS NOT NULL THEN 'registro' WHEN public.enrollment_declared_start(se.id) IS NOT NULL THEN 'declaracao-da-secretaria' ELSE NULL END,
    (SELECT d.id FROM public.school_enrollment_start_declarations d WHERE d.enrollment_id = se.id
      AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_start_declarations n WHERE n.supersedes_id = d.id) LIMIT 1),
    (SELECT p.class_label_snapshot FROM public.class_enrollment_episodes p WHERE p.enrollment_id = se.id AND public.af_episode_current(p.id) AND p.valid_from <= _on
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on < _on) ORDER BY p.valid_from DESC LIMIT 1),
    (SELECT min(x.ended_on) FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id)
  FROM public.school_enrollments se JOIN public.institutional_students s ON s.id = se.student_id
  WHERE se.school_id = _school AND public.af_enrollment_current(se.id)
    AND (s.display_name ILIKE '%' || btrim(_query) || '%' OR s.institutional_identifier = btrim(_query) OR s.id = btrim(_query))
  ORDER BY s.display_name LIMIT 50;
END $function$;
REVOKE ALL ON FUNCTION public.secretariat_enrollment_lookup(text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_enrollment_lookup(text, text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.af_document_facts(_school text, _student text, _on date)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE f jsonb := '{}'::jsonb; src jsonb := '[]'::jsonb; s record; sv record; e record; n int; c record; yv record; eligible text := 'ok'; st date; dec uuid;
BEGIN
  f := jsonb_build_object('escola.id', _school, 'aluno.id', _student, 'documento.data_de_referencia', _on::text);
  SELECT * INTO s FROM public.institutional_students WHERE id = _student;
  IF s.id IS NOT NULL THEN
    f := f || jsonb_build_object('aluno.nome', s.display_name);
    IF s.institutional_identifier IS NOT NULL THEN f := f || jsonb_build_object('aluno.identificador', s.institutional_identifier); END IF;
    src := src || jsonb_build_object('fact', 'aluno', 'reader', 'institutional_students', 'ref', s.id);
  END IF;
  SELECT v.* INTO sv FROM public.institutional_school_record_versions v WHERE v.school_id = _school AND v.valid_from <= _on
   ORDER BY v.valid_from DESC, v.version_number DESC LIMIT 1;
  IF sv.id IS NOT NULL THEN f := f || jsonb_build_object('escola.nome', sv.official_name);
    src := src || jsonb_build_object('fact', 'escola.nome', 'reader', 'institutional_school_record_versions', 'ref', sv.id); END IF;
  SELECT count(*) INTO n FROM public.school_enrollments se WHERE se.student_id = _student AND se.school_id = _school AND public.af_enrollment_current(se.id)
     AND coalesce(se.opened_on, public.enrollment_declared_start(se.id)) <= _on
     AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id AND x.ended_on < _on);
  IF n = 1 THEN
    SELECT se.* INTO e FROM public.school_enrollments se WHERE se.student_id = _student AND se.school_id = _school AND public.af_enrollment_current(se.id)
       AND coalesce(se.opened_on, public.enrollment_declared_start(se.id)) <= _on
       AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = se.id AND x.ended_on < _on);
    st := coalesce(e.opened_on, public.enrollment_declared_start(e.id));
    f := f || jsonb_build_object('matricula.abertura', st::text, 'ano_letivo.id', e.academic_year_id);
    IF e.institutional_number IS NOT NULL THEN f := f || jsonb_build_object('matricula.numero', e.institutional_number); END IF;
    src := src || jsonb_build_object('fact', 'matricula', 'reader', 'school_enrollments', 'ref', e.id);
    IF e.opened_on IS NULL THEN
      SELECT d.id INTO dec FROM public.school_enrollment_start_declarations d WHERE d.enrollment_id = e.id
        AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_start_declarations x WHERE x.supersedes_id = d.id) LIMIT 1;
      src := src || jsonb_build_object('fact', 'matricula.abertura', 'reader', 'school_enrollment_start_declarations', 'ref', dec);
    END IF;
    SELECT v.official_name INTO yv FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = e.academic_year_id ORDER BY v.version DESC LIMIT 1;
    IF yv.official_name IS NOT NULL THEN f := f || jsonb_build_object('ano_letivo.nome', yv.official_name); END IF;
    SELECT count(*) INTO n FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id) AND p.valid_from <= _on
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on < _on);
    IF n = 1 THEN
      SELECT p.* INTO c FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id) AND p.valid_from <= _on
         AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on < _on);
      f := f || jsonb_build_object('turma.rotulo', c.class_label_snapshot, 'turma.desde', c.valid_from::text);
      src := src || jsonb_build_object('fact', 'turma', 'reader', 'class_enrollment_episodes', 'ref', c.id);
    END IF;
  ELSIF n = 0 THEN eligible := 'sem-vinculo-ativo-com-inicio-efetivo';
  ELSE eligible := 'vinculo-ambiguo'; END IF;
  RETURN jsonb_build_object('fields', f, 'sources', src, 'eligibility', eligible);
END $function$;

-- Limpeza BO também remove declarações de início feitas por contas técnicas da operação.
CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_school_extras(_operation_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _users uuid[];
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  SELECT coalesce(array_agg(a.user_id), '{}') INTO _users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  LOOP
    DELETE FROM public.school_enrollment_start_declarations d WHERE d.author_user_id = ANY(_users)
      AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_start_declarations n WHERE n.supersedes_id = d.id);
    EXIT WHEN NOT FOUND;
  END LOOP;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
END $function$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_school_extras(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_school_extras(text) TO service_role;