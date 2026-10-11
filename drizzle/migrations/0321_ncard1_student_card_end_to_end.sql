-- NCARD.1 — carteirinha ponta a ponta: dados do cadastro oficial (nunca digitados), nome social, foto 3x4, layout
-- versionado por escola, verificação pública sem nome/foto/dado de menor, leitura da família com foto, limpeza de fixtures.

ALTER TABLE public.student_card_issuances ADD COLUMN IF NOT EXISTS name_kind text CHECK (name_kind IN ('civil','social'));
ALTER TABLE public.student_card_issuances ADD COLUMN IF NOT EXISTS internal_id text;
ALTER TABLE public.student_card_issuances ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.student_card_issuances ADD COLUMN IF NOT EXISTS layout_version integer;
ALTER TABLE public.student_card_issuances ADD COLUMN IF NOT EXISTS shift_label text;

CREATE TABLE public.student_card_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL,
  object_path text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  origin text NOT NULL CHECK (origin IN ('camera','arquivo')),
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.student_card_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_card_photos TO service_role;
ALTER TABLE public.student_card_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_card_layout_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  config jsonb NOT NULL,
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, version)
);
REVOKE ALL ON public.student_card_layout_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.student_card_layout_versions TO service_role;
ALTER TABLE public.student_card_layout_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.student_card_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE op text := current_setting('sigem.card_cleanup_op', true);
BEGIN
  IF TG_OP = 'DELETE' AND op ~ '^bo-[0-9a-f]{12}$' AND EXISTS (SELECT 1 FROM public.bo_fixture_accounts a WHERE a.operation_id = op AND a.user_id = OLD.actor_user_id) THEN
    RETURN OLD; END IF;
  RAISE EXCEPTION 'card:append-only';
END $$;
CREATE TRIGGER student_card_photos_immutable BEFORE UPDATE OR DELETE ON public.student_card_photos FOR EACH ROW EXECUTE FUNCTION public.student_card_immutable();
CREATE TRIGGER student_card_layout_immutable BEFORE UPDATE OR DELETE ON public.student_card_layout_versions FOR EACH ROW EXECUTE FUNCTION public.student_card_immutable();

CREATE OR REPLACE FUNCTION public.student_card_layout_problem(_c jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE k text; l text;
BEGIN
  IF _c IS NULL OR jsonb_typeof(_c) <> 'object' THEN RETURN 'layout:not-object'; END IF;
  FOR k IN SELECT jsonb_object_keys(_c) LOOP
    IF k NOT IN ('format','accent','title','backText','logos','showClass','showShift','showInternalId') THEN RETURN 'layout:key:' || k; END IF;
  END LOOP;
  IF _c->>'format' IS DISTINCT FROM 'card-v1' THEN RETURN 'layout:format'; END IF;
  IF jsonb_typeof(_c->'accent') IS DISTINCT FROM 'number' OR (_c->>'accent')::numeric NOT IN (0,1,2,3,4) THEN RETURN 'layout:accent'; END IF;
  IF jsonb_typeof(_c->'title') IS DISTINCT FROM 'string' OR length(_c->>'title') NOT BETWEEN 1 AND 60 THEN RETURN 'layout:title'; END IF;
  IF jsonb_typeof(_c->'backText') IS DISTINCT FROM 'string' OR length(_c->>'backText') > 200 THEN RETURN 'layout:backText'; END IF;
  IF jsonb_typeof(_c->'logos') IS DISTINCT FROM 'array' OR jsonb_array_length(_c->'logos') > 3 THEN RETURN 'layout:logos'; END IF;
  FOR l IN SELECT jsonb_array_elements_text(_c->'logos') LOOP
    IF l NOT IN ('brasao','sigem','educacao') THEN RETURN 'layout:logo:' || l; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['showClass','showShift','showInternalId'] LOOP
    IF jsonb_typeof(_c->k) IS DISTINCT FROM 'boolean' THEN RETURN 'layout:' || k; END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.record_student_card_layout(_school text, _expected integer, _config jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cur integer; p text;
BEGIN
  PERFORM public.student_card_grant(_school);
  p := public.student_card_layout_problem(_config); IF p IS NOT NULL THEN RAISE EXCEPTION '%', p; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('card-layout:' || _school));
  SELECT max(v.version) INTO cur FROM public.student_card_layout_versions v WHERE v.school_id = _school;
  IF cur IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'card:head-changed'; END IF;
  INSERT INTO public.student_card_layout_versions(school_id, version, config, actor_user_id) VALUES (_school, coalesce(cur, 0) + 1, _config, auth.uid());
  RETURN coalesce(cur, 0) + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_student_card_layout(text, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_card_layout(text, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_card_layouts(_school text)
RETURNS TABLE(version integer, config jsonb, recorded_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.student_card_grant(_school);
  RETURN QUERY SELECT v.version, v.config, v.recorded_at FROM public.student_card_layout_versions v WHERE v.school_id = _school ORDER BY v.version;
END $$;
REVOKE ALL ON FUNCTION public.student_card_layouts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_card_layouts(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_card_identity(_student text)
RETURNS TABLE(name text, name_kind text, internal_id text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH iv AS (SELECT v.civil_name, v.social_name FROM public.student_identity_versions v WHERE v.student_id = _student ORDER BY v.version DESC LIMIT 1)
  SELECT CASE WHEN nullif(btrim(iv.social_name), '') IS NOT NULL THEN btrim(iv.social_name) ELSE coalesce(nullif(btrim(iv.civil_name), ''), s.display_name) END,
         CASE WHEN nullif(btrim(iv.social_name), '') IS NOT NULL THEN 'social' ELSE 'civil' END,
         s.institutional_identifier
    FROM public.institutional_students s LEFT JOIN iv ON true WHERE s.id = _student
$$;
REVOKE ALL ON FUNCTION public.student_card_identity(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.student_card_school_name(_school text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.official_name FROM public.institutional_school_record_versions v WHERE v.school_id = _school AND v.valid_from <= CURRENT_DATE
   ORDER BY v.valid_from DESC, v.version_number DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.student_card_school_name(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.student_card_enrollment(_school text, _student text)
RETURNS TABLE(enrollment_id text, class_label text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT se.id,
    (SELECT p.class_label_snapshot FROM public.class_enrollment_episodes p WHERE p.enrollment_id = se.id AND public.af_episode_current(p.id) AND p.valid_from <= CURRENT_DATE
       AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on < CURRENT_DATE) ORDER BY p.valid_from DESC LIMIT 1)
  FROM public.school_enrollments se WHERE se.school_id = _school AND se.student_id = _student AND public.af_enrollment_current(se.id)
  ORDER BY se.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.student_card_enrollment(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.student_card_candidates(_school text, _query text)
RETURNS TABLE(student_id text, name text, name_kind text, internal_id text, class_label text, has_photo boolean, open_card text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.student_card_grant(_school);
  IF coalesce(length(btrim(_query)), 0) < 3 THEN RAISE EXCEPTION 'search:query-too-short'; END IF;
  RETURN QUERY
  SELECT s.id, i.name, i.name_kind, i.internal_id, e.class_label,
    EXISTS (SELECT 1 FROM public.student_card_photos ph WHERE ph.student_id = s.id AND ph.school_id = _school),
    (SELECT h.public_id FROM (SELECT DISTINCT ON (c.public_id) c.* FROM public.student_card_issuances c WHERE c.student_id = s.id AND c.school_id = _school
       ORDER BY c.public_id, c.version DESC) h WHERE h.kind <> 'cancelamento' LIMIT 1)
  FROM public.institutional_students s
  CROSS JOIN LATERAL public.student_card_identity(s.id) i
  CROSS JOIN LATERAL public.student_card_enrollment(_school, s.id) e
  WHERE (s.display_name ILIKE '%' || btrim(_query) || '%' OR i.name ILIKE '%' || btrim(_query) || '%' OR s.institutional_identifier = btrim(_query) OR s.id = btrim(_query))
  ORDER BY i.name LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.student_card_candidates(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_card_candidates(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_student_card_photo(_school text, _student text, _path text, _sha256 text, _origin text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nid uuid;
BEGIN
  PERFORM public.student_card_grant(_school);
  IF NOT EXISTS (SELECT 1 FROM public.student_card_enrollment(_school, _student) e WHERE e.enrollment_id IS NOT NULL) THEN RAISE EXCEPTION 'card:no-enrollment-at-school'; END IF;
  IF _path IS NULL OR _path NOT LIKE (_school || '/carteirinha/' || _student || '/%') OR _path ~ '\.\.' THEN RAISE EXCEPTION 'card:photo-path-invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'fotos-estudantes' AND o.name = _path) THEN RAISE EXCEPTION 'card:photo-missing'; END IF;
  INSERT INTO public.student_card_photos(student_id, school_id, object_path, sha256, origin, actor_user_id) VALUES (_student, _school, _path, _sha256, _origin, auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_student_card_photo(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_card_photo(text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_card_photo_current(_school text, _student text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.student_card_grant(_school);
  RETURN (SELECT p.object_path FROM public.student_card_photos p WHERE p.school_id = _school AND p.student_id = _student ORDER BY p.recorded_at DESC LIMIT 1);
END $$;
REVOKE ALL ON FUNCTION public.student_card_photo_current(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_card_photo_current(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_card_storage_ok(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((storage.foldername(_name))[2] = 'carteirinha' AND public.has_school_capability('emitir-carteirinha-estudantil', (storage.foldername(_name))[1]), false)
$$;
CREATE OR REPLACE FUNCTION public.student_card_family_photo_ok(_name text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE h public.student_card_issuances; a public.guardian_authorizations;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  FOR h IN SELECT DISTINCT ON (c.public_id) c.* FROM public.student_card_issuances c
            WHERE c.public_id IN (SELECT x.public_id FROM public.student_card_issuances x WHERE x.photo_path = _name) ORDER BY c.public_id, c.version DESC LOOP
    CONTINUE WHEN h.kind = 'cancelamento' OR h.photo_path IS DISTINCT FROM _name;
    BEGIN a := public.family_authorization(h.student_id); EXCEPTION WHEN others THEN a := NULL; END;
    IF a.id IS NOT NULL AND 'matricula' = ANY (a.sections) THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.student_card_storage_ok(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_card_family_photo_ok(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_card_storage_ok(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_card_family_photo_ok(text) TO authenticated;

CREATE POLICY fotos_carteirinha_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-estudantes' AND public.student_card_storage_ok(name) AND pg_catalog.lower(storage.extension(name)) IN ('jpg','jpeg'));
CREATE POLICY fotos_carteirinha_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-estudantes' AND (public.student_card_storage_ok(name) OR public.student_card_family_photo_ok(name)));

CREATE OR REPLACE FUNCTION public.record_student_card_v2(_public_id text, _expected_version integer, _kind text, _student text, _school text, _year text, _valid_until date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g uuid; head public.student_card_issuances; pid text; idn record; enr record; sn text; ph text; lv integer; sid text; sch text;
BEGIN
  IF _kind NOT IN ('emissao','reemissao','cancelamento') THEN RAISE EXCEPTION 'card:kind-invalid'; END IF;
  IF _kind <> 'emissao' THEN
    PERFORM pg_advisory_xact_lock(hashtext('card:' || coalesce(_public_id, '')));
    SELECT * INTO head FROM public.student_card_issuances c WHERE c.public_id = _public_id ORDER BY c.version DESC LIMIT 1;
    IF head.id IS NULL THEN RAISE EXCEPTION 'card:unknown'; END IF;
    g := public.student_card_grant(head.school_id);
    IF head.version <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'card:head-changed'; END IF;
    IF head.kind = 'cancelamento' THEN RAISE EXCEPTION 'card:already-cancelled'; END IF;
    IF length(btrim(coalesce(_reason, ''))) = 0 THEN RAISE EXCEPTION 'card:reason-required'; END IF;
    IF _kind = 'cancelamento' THEN
      INSERT INTO public.student_card_issuances(public_id, version, kind, student_id, school_id, academic_year, valid_until, student_name, school_name, class_label, reason, actor_user_id, actor_engagement,
        name_kind, internal_id, photo_path, layout_version, shift_label)
      VALUES (head.public_id, head.version + 1, 'cancelamento', head.student_id, head.school_id, head.academic_year, head.valid_until, head.student_name, head.school_name, head.class_label,
        btrim(_reason), auth.uid(), g, head.name_kind, head.internal_id, head.photo_path, head.layout_version, head.shift_label);
      RETURN head.public_id;
    END IF;
    sid := head.student_id; sch := head.school_id; pid := head.public_id;
  ELSE
    IF _public_id IS NOT NULL THEN RAISE EXCEPTION 'card:base-not-allowed'; END IF;
    g := public.student_card_grant(_school);
    sid := _student; sch := _school;
    IF _year IS NULL OR _year !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'card:year-invalid'; END IF;
    IF EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (c.public_id) c.* FROM public.student_card_issuances c WHERE c.student_id = sid AND c.school_id = sch AND c.academic_year = _year
                ORDER BY c.public_id, c.version DESC) h WHERE h.kind <> 'cancelamento') THEN RAISE EXCEPTION 'card:already-open'; END IF;
  END IF;
  SELECT * INTO enr FROM public.student_card_enrollment(sch, sid);
  IF enr.enrollment_id IS NULL THEN RAISE EXCEPTION 'card:no-enrollment-at-school'; END IF;
  SELECT * INTO idn FROM public.student_card_identity(sid);
  IF idn.name IS NULL THEN RAISE EXCEPTION 'card:identity-missing'; END IF;
  sn := public.student_card_school_name(sch);
  IF sn IS NULL THEN RAISE EXCEPTION 'card:school-name-missing'; END IF;
  SELECT p.object_path INTO ph FROM public.student_card_photos p WHERE p.school_id = sch AND p.student_id = sid ORDER BY p.recorded_at DESC LIMIT 1;
  SELECT max(v.version) INTO lv FROM public.student_card_layout_versions v WHERE v.school_id = sch;
  IF _kind = 'emissao' THEN
    IF _valid_until IS NULL OR _valid_until < make_date(_year::int, 1, 1) OR _valid_until > make_date(_year::int + 1, 12, 31) THEN RAISE EXCEPTION 'card:validity-invalid'; END IF;
    pid := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    INSERT INTO public.student_card_issuances(public_id, version, kind, student_id, school_id, academic_year, valid_until, student_name, school_name, class_label, reason, actor_user_id, actor_engagement,
      name_kind, internal_id, photo_path, layout_version)
    VALUES (pid, 1, 'emissao', sid, sch, _year, _valid_until, idn.name, sn, enr.class_label, nullif(btrim(_reason), ''), auth.uid(), g, idn.name_kind, idn.internal_id, ph, lv);
    RETURN pid;
  END IF;
  IF _valid_until IS NOT NULL AND (_valid_until < make_date(head.academic_year::int, 1, 1) OR _valid_until > make_date(head.academic_year::int + 1, 12, 31)) THEN RAISE EXCEPTION 'card:validity-invalid'; END IF;
  INSERT INTO public.student_card_issuances(public_id, version, kind, student_id, school_id, academic_year, valid_until, student_name, school_name, class_label, reason, actor_user_id, actor_engagement,
    name_kind, internal_id, photo_path, layout_version)
  VALUES (pid, head.version + 1, 'reemissao', sid, sch, head.academic_year, coalesce(_valid_until, head.valid_until), idn.name, sn, enr.class_label, btrim(_reason), auth.uid(), g,
    idn.name_kind, idn.internal_id, ph, lv);
  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.record_student_card_v2(text, integer, text, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_card_v2(text, integer, text, text, text, text, date, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_student_card(text, integer, text, text, text, text, date, text, text, text, text) FROM authenticated;
COMMENT ON FUNCTION public.record_student_card(text, integer, text, text, text, text, date, text, text, text, text) IS 'DEPRECATED: replaced by record_student_card_v2 (dados do cadastro oficial)';

CREATE OR REPLACE FUNCTION public.student_card_chain_v2(_school text)
RETURNS TABLE(public_id text, version integer, kind text, student_id text, academic_year text, valid_until date, student_name text, name_kind text, internal_id text,
  school_name text, class_label text, photo_path text, layout_version integer, reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.student_card_grant(_school);
  RETURN QUERY SELECT c.public_id, c.version, c.kind, c.student_id, c.academic_year, c.valid_until, c.student_name, c.name_kind, c.internal_id, c.school_name, c.class_label,
    c.photo_path, c.layout_version, c.reason, c.recorded_at FROM public.student_card_issuances c WHERE c.school_id = _school ORDER BY c.public_id, c.version;
END $$;
REVOKE ALL ON FUNCTION public.student_card_chain_v2(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_card_chain_v2(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_student_card_v2(_public_id text, _version integer)
RETURNS TABLE(status text, public_id text, version integer, school_name text, academic_year text, valid_until date, issued_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE head public.student_card_issuances; asked public.student_card_issuances;
BEGIN
  IF _public_id IS NULL OR _public_id !~ '^[A-Z0-9]{10}$' OR _version IS NULL OR _version < 1 THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::integer, NULL::text, NULL::text, NULL::date, NULL::date; RETURN; END IF;
  SELECT * INTO head FROM public.student_card_issuances c WHERE c.public_id = _public_id ORDER BY c.version DESC LIMIT 1;
  SELECT * INTO asked FROM public.student_card_issuances c WHERE c.public_id = _public_id AND c.version = _version;
  IF head.id IS NULL OR asked.id IS NULL OR asked.kind = 'cancelamento' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::integer, NULL::text, NULL::text, NULL::date, NULL::date; RETURN; END IF;
  RETURN QUERY SELECT
    CASE WHEN head.kind = 'cancelamento' THEN 'cancelada' WHEN head.version <> asked.version THEN 'substituida'
         WHEN asked.valid_until < CURRENT_DATE THEN 'expirada' ELSE 'valida' END,
    asked.public_id, asked.version, asked.school_name, asked.academic_year, asked.valid_until, (asked.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date;
END $$;
REVOKE ALL ON FUNCTION public.verify_student_card_v2(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_student_card_v2(text, integer) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_student_card(text, integer) FROM anon, authenticated;
COMMENT ON FUNCTION public.verify_student_card(text, integer) IS 'DEPRECATED: replaced by verify_student_card_v2 (sem dado pessoal)';

CREATE OR REPLACE FUNCTION public.family_student_cards_v2(_student text)
RETURNS TABLE(public_id text, version integer, status text, academic_year text, valid_until date, student_name text, name_kind text, school_name text, class_label text,
  internal_id text, photo_path text, layout jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.guardian_authorizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  a := public.family_authorization(_student);
  IF a.id IS NULL OR NOT ('matricula' = ANY (a.sections)) THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  RETURN QUERY
  SELECT h.public_id, h.version, CASE WHEN h.valid_until < CURRENT_DATE THEN 'expirada' ELSE 'valida' END,
         h.academic_year, h.valid_until, h.student_name, h.name_kind, h.school_name, h.class_label, h.internal_id, h.photo_path,
         (SELECT l.config FROM public.student_card_layout_versions l WHERE l.school_id = h.school_id AND l.version = h.layout_version)
    FROM (SELECT DISTINCT ON (c.public_id) c.* FROM public.student_card_issuances c WHERE c.student_id = _student ORDER BY c.public_id, c.version DESC) h
   WHERE h.kind <> 'cancelamento'
   ORDER BY h.academic_year DESC, h.recorded_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.family_student_cards_v2(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.family_student_cards_v2(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_cards(_operation_id text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer := 0; m integer; users uuid[];
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  SELECT coalesce(array_agg(a.user_id), '{}') INTO users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  IF EXISTS (SELECT 1 FROM public.student_card_issuances c WHERE c.public_id IN (SELECT x.public_id FROM public.student_card_issuances x WHERE x.actor_user_id = ANY(users))
             AND NOT (c.actor_user_id = ANY(users))) THEN RAISE EXCEPTION 'bo:card-mixed-chain'; END IF;
  PERFORM set_config('sigem.card_cleanup_op', _operation_id, true);
  DELETE FROM public.student_card_issuances c WHERE c.actor_user_id = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.student_card_photos p WHERE p.actor_user_id = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.student_card_layout_versions l WHERE l.actor_user_id = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  PERFORM set_config('sigem.card_cleanup_op', '', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_cards(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_cards(text) TO service_role;
