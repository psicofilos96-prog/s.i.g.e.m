CREATE TABLE public.student_card_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL CHECK (public_id ~ '^[A-Z0-9]{10}$'),
  version integer NOT NULL CHECK (version >= 1),
  kind text NOT NULL CHECK (kind IN ('emissao','reemissao','cancelamento')),
  student_id text NOT NULL,
  school_id text NOT NULL,
  academic_year text NOT NULL CHECK (academic_year ~ '^[0-9]{4}$'),
  valid_until date NOT NULL,
  student_name text NOT NULL,
  school_name text NOT NULL,
  class_label text,
  reason text,
  actor_user_id uuid NOT NULL,
  actor_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (public_id, version),
  CHECK (version = 1 OR length(btrim(coalesce(reason, ''))) > 0)
);
GRANT ALL ON public.student_card_issuances TO service_role;
ALTER TABLE public.student_card_issuances ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.student_card_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'card:append-only'; END $$;
CREATE TRIGGER student_card_issuances_immutable BEFORE UPDATE OR DELETE ON public.student_card_issuances
  FOR EACH ROW EXECUTE FUNCTION public.student_card_immutable();

CREATE OR REPLACE FUNCTION public.student_card_grant(_school text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'emitir-carteirinha-estudantil' AND c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school
   ORDER BY c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'card:capability-missing'; END IF;
  RETURN g;
END $$;
REVOKE ALL ON FUNCTION public.student_card_grant(text) FROM PUBLIC, anon, authenticated;

-- Emite (sem base), reemite ou cancela (com base esperada = versão vigente).
CREATE OR REPLACE FUNCTION public.record_student_card(_public_id text, _expected_version integer, _kind text, _student text, _school text, _year text, _valid_until date, _student_name text, _school_name text, _class_label text, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE g uuid; head public.student_card_issuances; pid text;
BEGIN
  IF _kind NOT IN ('emissao','reemissao','cancelamento') THEN RAISE EXCEPTION 'card:kind-invalid'; END IF;
  IF _kind = 'emissao' THEN
    IF _public_id IS NOT NULL THEN RAISE EXCEPTION 'card:base-not-allowed'; END IF;
    g := public.student_card_grant(_school);
    IF NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e WHERE e.student_id = _student AND e.school_id = _school) THEN RAISE EXCEPTION 'card:no-enrollment-at-school'; END IF;
    IF _valid_until IS NULL OR _valid_until < make_date(_year::int, 1, 1) THEN RAISE EXCEPTION 'card:validity-invalid'; END IF;
    pid := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    INSERT INTO public.student_card_issuances(public_id, version, kind, student_id, school_id, academic_year, valid_until, student_name, school_name, class_label, reason, actor_user_id, actor_engagement)
    VALUES (pid, 1, 'emissao', _student, _school, _year, _valid_until, btrim(_student_name), btrim(_school_name), nullif(btrim(_class_label), ''), nullif(btrim(_reason), ''), auth.uid(), g);
    RETURN pid;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('card:' || coalesce(_public_id, '')));
  SELECT * INTO head FROM public.student_card_issuances WHERE public_id = _public_id ORDER BY version DESC LIMIT 1;
  IF head.id IS NULL THEN RAISE EXCEPTION 'card:unknown'; END IF;
  g := public.student_card_grant(head.school_id);
  IF head.version <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'card:head-changed'; END IF;
  IF head.kind = 'cancelamento' THEN RAISE EXCEPTION 'card:already-cancelled'; END IF;
  INSERT INTO public.student_card_issuances(public_id, version, kind, student_id, school_id, academic_year, valid_until, student_name, school_name, class_label, reason, actor_user_id, actor_engagement)
  VALUES (head.public_id, head.version + 1, _kind, head.student_id, head.school_id, head.academic_year,
    CASE WHEN _kind = 'reemissao' THEN coalesce(_valid_until, head.valid_until) ELSE head.valid_until END,
    CASE WHEN _kind = 'reemissao' THEN coalesce(nullif(btrim(_student_name), ''), head.student_name) ELSE head.student_name END,
    CASE WHEN _kind = 'reemissao' THEN coalesce(nullif(btrim(_school_name), ''), head.school_name) ELSE head.school_name END,
    CASE WHEN _kind = 'reemissao' THEN coalesce(nullif(btrim(_class_label), ''), head.class_label) ELSE head.class_label END,
    btrim(_reason), auth.uid(), g);
  RETURN head.public_id;
END $$;
REVOKE ALL ON FUNCTION public.record_student_card(text, integer, text, text, text, text, date, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_student_card(text, integer, text, text, text, text, date, text, text, text, text) TO authenticated;

-- Verificação pública: só allowlist; inexistente e versão cancelada respondem igual.
CREATE OR REPLACE FUNCTION public.verify_student_card(_public_id text, _version integer)
RETURNS TABLE(status text, public_id text, student_name text, school_name text, class_label text, academic_year text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE head public.student_card_issuances; asked public.student_card_issuances;
BEGIN
  SELECT * INTO head FROM public.student_card_issuances c WHERE c.public_id = _public_id ORDER BY c.version DESC LIMIT 1;
  SELECT * INTO asked FROM public.student_card_issuances c WHERE c.public_id = _public_id AND c.version = _version;
  IF head.id IS NULL OR asked.id IS NULL OR asked.kind = 'cancelamento' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text; RETURN;
  END IF;
  RETURN QUERY SELECT
    CASE WHEN head.kind = 'cancelamento' THEN 'cancelada'
         WHEN head.version <> asked.version THEN 'substituida'
         WHEN asked.valid_until < CURRENT_DATE THEN 'expirada' ELSE 'valida' END,
    asked.public_id, asked.student_name, asked.school_name, asked.class_label, asked.academic_year;
END $$;
REVOKE ALL ON FUNCTION public.verify_student_card(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_student_card(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.student_card_chain(_school text)
RETURNS TABLE(public_id text, version integer, kind text, student_id text, academic_year text, valid_until date, student_name text, class_label text, reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.student_card_grant(_school);
  RETURN QUERY SELECT c.public_id, c.version, c.kind, c.student_id, c.academic_year, c.valid_until, c.student_name, c.class_label, c.reason, c.recorded_at
    FROM public.student_card_issuances c WHERE c.school_id = _school ORDER BY c.public_id, c.version;
END $$;
REVOKE ALL ON FUNCTION public.student_card_chain(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_card_chain(text) TO authenticated;