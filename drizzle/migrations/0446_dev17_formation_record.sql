-- SIGEM Desenvolvimento L17: histórico formativo permanente por pessoa = projeção das fontes canônicas (nada copiado).
-- Consulta própria ou administrativa (capacidade + finalidade, com trilha append-only).
CREATE TABLE public.dev_history_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_person uuid NOT NULL REFERENCES public.institutional_persons(id),
  reader_person uuid NOT NULL,
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 10 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dev_history_access_log TO authenticated;
GRANT ALL ON public.dev_history_access_log TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_history_access_log FROM authenticated, anon;
ALTER TABLE public.dev_history_access_log ENABLE ROW LEVEL SECURITY;
-- Titular vê quem consultou seu histórico; auditoria da formação vê tudo.
CREATE POLICY "dev history log read" ON public.dev_history_access_log FOR SELECT TO authenticated
  USING (subject_person = public.current_person_id() OR public.has_network_capability('auditar-historico-formativo'));
CREATE TRIGGER devhal_immutable BEFORE UPDATE OR DELETE ON public.dev_history_access_log FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.dev_formation_record(_person uuid, _purpose text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _own boolean; _items jsonb; _tracks jsonb; _hours bigint;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  _own := (_person = _p);
  IF NOT _own THEN
    IF NOT public.has_network_capability('consultar-historico-formativo') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
    IF _purpose IS NULL OR length(btrim(_purpose)) < 10 THEN RAISE EXCEPTION 'dev:purpose-required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_persons WHERE id = _person) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
    INSERT INTO public.dev_history_access_log(subject_person, reader_person, purpose) VALUES (_person, _p, btrim(_purpose));
  END IF;
  WITH it AS (
    SELECT e.id AS enrollment_id, k.label AS class_label, k.starts_on, k.ends_on, v.course_id, v.title AS course_title, v.version AS course_version, v.hours_minutes,
      -- vínculo de época: fotografia do pedido, nunca a lotação atual
      jsonb_build_object('id', l.id, 'registration', l.functional_registration, 'position_id', l.position_id, 'valid_from', l.valid_from, 'valid_until', l.valid_until) AS link,
      (SELECT x.kind FROM public.dev_participation_events x WHERE x.enrollment_id = e.id ORDER BY x.seq DESC LIMIT 1) AS last_event,
      cf.decision AS completion, cf.created_at AS completed_at,
      (SELECT jsonb_build_object('code', i.verification_code, 'version', cv.version, 'issued_on', i.created_at::date,
          'status', CASE WHEN EXISTS (SELECT 1 FROM public.dev_certificate_revocations r WHERE r.issuance_id = i.id) THEN 'revogado' ELSE 'valido' END)
        FROM public.dev_certificate_issuances i JOIN public.dev_certificate_versions cv ON cv.id = i.version_id
        WHERE i.enrollment_id = e.id AND NOT EXISTS (SELECT 1 FROM public.dev_certificate_issuances n WHERE n.supersedes = i.id)) AS certificate
    FROM public.dev_enrollments e JOIN public.dev_classes k ON k.id = e.class_id JOIN public.dev_course_versions v ON v.id = k.course_version_id
    LEFT JOIN public.professional_functional_links l ON l.id = e.functional_link_id
    LEFT JOIN public.dev_completion_confirmations cf ON cf.enrollment_id = e.id
    WHERE e.person_id = _person)
  SELECT coalesce(jsonb_agg(jsonb_build_object('enrollment_id', enrollment_id, 'class_label', class_label, 'starts_on', starts_on, 'ends_on', ends_on,
      'course_id', course_id, 'course_title', course_title, 'course_version', course_version,
      'hours_minutes', CASE WHEN completion = 'conclusao' THEN hours_minutes END, 'nominal_hours_minutes', hours_minutes,
      'link_at_time', link, 'last_event', last_event, 'completion', completion, 'completed_at', completed_at, 'certificate', certificate) ORDER BY starts_on, enrollment_id), '[]'),
    -- carga cumprida só de conclusões confirmadas (L15); inscrição/participação não somam
    coalesce(sum(hours_minutes) FILTER (WHERE completion = 'conclusao'), 0)
  INTO _items, _hours FROM it;
  -- Trilhas: última versão aprovada; etapa cumprida só por conclusão confirmada do curso.
  SELECT coalesce(jsonb_agg(t ORDER BY t->>'title'), '[]') INTO _tracks FROM (
    SELECT jsonb_build_object('track_version_id', tv.id, 'title', tv.title, 'version', tv.version,
      'steps_total', (SELECT count(*) FROM public.dev_track_steps s WHERE s.track_version_id = tv.id AND NOT s.elective),
      'steps_done', (SELECT count(*) FROM public.dev_track_steps s WHERE s.track_version_id = tv.id AND NOT s.elective AND EXISTS (
         SELECT 1 FROM public.dev_completion_confirmations c JOIN public.dev_enrollments e2 ON e2.id = c.enrollment_id
           JOIN public.dev_classes k2 ON k2.id = e2.class_id JOIN public.dev_course_versions v2 ON v2.id = k2.course_version_id
         WHERE e2.person_id = _person AND c.decision = 'conclusao' AND v2.course_id = s.course_id))) AS t
    FROM public.dev_track_versions tv
    WHERE tv.version = (SELECT max(version) FROM public.dev_track_versions o WHERE o.track_id = tv.track_id)
      AND EXISTS (SELECT 1 FROM public.dev_track_approvals a WHERE a.track_version_id = tv.id AND a.decision = 'aprovada')
      AND EXISTS (SELECT 1 FROM public.dev_track_steps s JOIN public.dev_course_versions v3 ON v3.course_id = s.course_id
         JOIN public.dev_classes k3 ON k3.course_version_id = v3.id JOIN public.dev_enrollments e3 ON e3.class_id = k3.id
         WHERE s.track_version_id = tv.id AND e3.person_id = _person)) q;
  RETURN jsonb_build_object('person_id', _person, 'own', _own, 'completed_hours_minutes', _hours, 'items', _items, 'tracks', _tracks);
END $$;
REVOKE EXECUTE ON FUNCTION public.dev_formation_record(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_formation_record(uuid, text) TO authenticated;