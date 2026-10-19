-- Alimentação especial: Secretaria da escola pede com laudo → nutricionista (estação Alimentação) defere/indefere → cozinha recebe lista nominal.
CREATE TABLE public.meal_special_diet_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  student_id text NOT NULL,
  need text NOT NULL CHECK (length(btrim(need)) >= 3 AND length(need) <= 200),
  report_path text NOT NULL,
  report_sha256 text NOT NULL CHECK (report_sha256 ~ '^[0-9a-f]{64}$'),
  report_until date NULL,
  requested_by uuid NOT NULL,
  requested_by_principal_id uuid NOT NULL REFERENCES public.institutional_sector_principals(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE
);
CREATE TABLE public.meal_special_diet_decisions (
  request_id uuid PRIMARY KEY REFERENCES public.meal_special_diet_requests(id),
  outcome text NOT NULL CHECK (outcome IN ('deferido','indeferido')),
  menu_condition text NULL CHECK (menu_condition IS NULL OR length(menu_condition) <= 120),
  handling_note text NULL CHECK (handling_note IS NULL OR length(handling_note) <= 1000),
  valid_until date NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  decided_by uuid NOT NULL,
  decided_by_principal_id uuid NOT NULL REFERENCES public.institutional_sector_principals(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome = 'indeferido' OR menu_condition IS NOT NULL)
);
REVOKE ALL ON public.meal_special_diet_requests, public.meal_special_diet_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_special_diet_requests, public.meal_special_diet_decisions TO service_role;
ALTER TABLE public.meal_special_diet_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_special_diet_decisions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER msdr_append_only BEFORE UPDATE OR DELETE ON public.meal_special_diet_requests FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER msdd_append_only BEFORE UPDATE OR DELETE ON public.meal_special_diet_decisions FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE OR REPLACE FUNCTION public.msd_principal(_station text, _school text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT p.id FROM public.institutional_sector_principals p
   WHERE p.auth_user_id = auth.uid() AND p.station_code = _station AND (_school IS NULL OR p.school_id = _school) LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.msd_principal(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msd_principal(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.msd_can_read(_school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT auth.uid() IS NOT NULL AND (
    public.msd_principal('alimentacao', NULL) IS NOT NULL
    OR public.msd_principal('secretaria_escolar', _school) IS NOT NULL
    OR public.msd_principal('direcao_escolar', _school) IS NOT NULL)
$fn$;
REVOKE ALL ON FUNCTION public.msd_can_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.msd_can_read(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_meal_special_diet(_school text, _student text, _need text, _path text, _sha256 text, _until date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE pr uuid; nid uuid;
BEGIN
  pr := public.msd_principal('secretaria_escolar', _school);
  IF pr IS NULL THEN RAISE EXCEPTION 'diet:secretaria-only'; END IF;
  SELECT id INTO nid FROM public.meal_special_diet_requests WHERE idempotency_key = _key;
  IF nid IS NOT NULL THEN RETURN nid; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.school_id = _school AND e.student_id = _student) THEN RAISE EXCEPTION 'diet:estudante-fora-da-escola'; END IF;
  IF _path IS NULL OR _path NOT LIKE _school || '/%' THEN RAISE EXCEPTION 'diet:laudo-obrigatorio'; END IF;
  INSERT INTO public.meal_special_diet_requests(school_id, student_id, need, report_path, report_sha256, report_until, requested_by, requested_by_principal_id, idempotency_key)
  VALUES (_school, _student, btrim(_need), _path, lower(_sha256), _until, auth.uid(), pr, _key) RETURNING id INTO nid;
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.request_meal_special_diet(text, text, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_meal_special_diet(text, text, text, text, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_meal_special_diet(_request uuid, _outcome text, _condition text, _note text, _until date, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE pr uuid; rq public.meal_special_diet_requests;
BEGIN
  pr := public.msd_principal('alimentacao', NULL);
  IF pr IS NULL THEN RAISE EXCEPTION 'diet:nutricionista-only'; END IF;
  SELECT * INTO rq FROM public.meal_special_diet_requests WHERE id = _request FOR UPDATE;
  IF rq.id IS NULL THEN RAISE EXCEPTION 'diet:pedido-desconhecido'; END IF;
  IF rq.requested_by = auth.uid() THEN RAISE EXCEPTION 'diet:autor-nao-decide'; END IF;
  IF EXISTS (SELECT 1 FROM public.meal_special_diet_decisions d WHERE d.request_id = _request) THEN RAISE EXCEPTION 'diet:ja-decidido'; END IF;
  INSERT INTO public.meal_special_diet_decisions(request_id, outcome, menu_condition, handling_note, valid_until, reason, decided_by, decided_by_principal_id)
  VALUES (_request, _outcome, CASE WHEN _outcome = 'deferido' THEN nullif(btrim(_condition),'') END, nullif(btrim(_note),''), coalesce(_until, rq.report_until), btrim(_reason), auth.uid(), pr);
END $fn$;
REVOKE ALL ON FUNCTION public.decide_meal_special_diet(uuid, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_meal_special_diet(uuid, text, text, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.meal_special_diets_at(_school text)
RETURNS TABLE(request_id uuid, school_id text, student_name text, need text, report_path text, report_until date, requested_at timestamptz,
  outcome text, menu_condition text, handling_note text, valid_until date, decided_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NOT public.msd_can_read(_school) AND NOT (_school IS NULL AND public.msd_principal('alimentacao', NULL) IS NOT NULL) THEN RAISE EXCEPTION 'diet:not-authorized'; END IF;
  RETURN QUERY SELECT r.id, r.school_id,
    coalesce((SELECT v.civil_name FROM public.student_identity_versions v WHERE v.student_id = r.student_id ORDER BY v.version DESC LIMIT 1), r.student_id),
    r.need, r.report_path, r.report_until, r.requested_at, d.outcome, d.menu_condition, d.handling_note, d.valid_until, d.decided_at
  FROM public.meal_special_diet_requests r LEFT JOIN public.meal_special_diet_decisions d ON d.request_id = r.id
  WHERE _school IS NULL OR r.school_id = _school ORDER BY r.requested_at DESC LIMIT 1000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_special_diets_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_special_diets_at(text) TO authenticated;

-- Lista nominal da cozinha: só deferidos vigentes; cada leitura fica registrada (LGPD).
CREATE OR REPLACE FUNCTION public.meal_special_diet_kitchen_list(_school text, _on date)
RETURNS TABLE(student_name text, class_label text, menu_condition text, handling_note text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE n int;
BEGIN
  PERFORM public.meal_grant_on('registrar-execucao-alimentacao', _school, _on);
  SELECT count(*) INTO n FROM public.meal_special_diet_requests r JOIN public.meal_special_diet_decisions d ON d.request_id = r.id
   WHERE r.school_id = _school AND d.outcome = 'deferido' AND (d.valid_until IS NULL OR d.valid_until >= _on);
  INSERT INTO public.meal_sensitive_access_events(school_id, consulted_on, purpose, rows_returned, author_user_id)
  VALUES (_school, _on, 'lista diária de alimentação especial da cozinha', n, auth.uid());
  RETURN QUERY SELECT
    coalesce((SELECT v.civil_name FROM public.student_identity_versions v WHERE v.student_id = r.student_id ORDER BY v.version DESC LIMIT 1), r.student_id),
    (SELECT e.class_label_snapshot FROM public.class_enrollment_episodes e WHERE e.student_id = r.student_id AND e.school_id = _school AND e.valid_from <= _on ORDER BY e.valid_from DESC LIMIT 1),
    d.menu_condition, d.handling_note
  FROM public.meal_special_diet_requests r JOIN public.meal_special_diet_decisions d ON d.request_id = r.id
  WHERE r.school_id = _school AND d.outcome = 'deferido' AND (d.valid_until IS NULL OR d.valid_until >= _on)
  ORDER BY 2 NULLS LAST, 1;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_special_diet_kitchen_list(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meal_special_diet_kitchen_list(text, date) TO authenticated;

CREATE POLICY "laudos: secretaria envia" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'alimentacao-laudos' AND public.msd_principal('secretaria_escolar', split_part(name, '/', 1)) IS NOT NULL);
CREATE POLICY "laudos: leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'alimentacao-laudos' AND public.msd_can_read(split_part(name, '/', 1)));