-- Direção L12 — Histórico de Ocorrências ("Caderno Negro").
-- Registro imutável (meio de prova): sem UPDATE/DELETE para ninguém; retificação = adendo encadeado.
-- Escrita só pela conta da Direção da própria escola; leitura pela Direção e OP da escola e pelas contas de rede.
CREATE TABLE public.school_disciplinary_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  number_year int NOT NULL,
  number_seq int NOT NULL,
  addendum_of uuid REFERENCES public.school_disciplinary_occurrences(id),
  occurred_at timestamptz NOT NULL,
  severity text NOT NULL CHECK (length(btrim(severity)) > 0),
  kind text NOT NULL CHECK (length(btrim(kind)) > 0),
  narrative text NOT NULL CHECK (length(btrim(narrative)) >= 10),
  measures text[] NOT NULL DEFAULT '{}',
  witnesses text,
  recorded_by_user uuid NOT NULL,
  recorded_by_principal_id uuid NOT NULL REFERENCES public.institutional_sector_principals(id),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, number_year, number_seq)
);
CREATE INDEX sdo_school_idx ON public.school_disciplinary_occurrences(school_id, created_at DESC);
CREATE INDEX sdo_addendum_idx ON public.school_disciplinary_occurrences(addendum_of);

CREATE TABLE public.school_disciplinary_occurrence_parties (
  occurrence_id uuid NOT NULL REFERENCES public.school_disciplinary_occurrences(id),
  party_kind text NOT NULL CHECK (party_kind IN ('estudante','servidor','outro')),
  party_ref text,
  label_snapshot text NOT NULL CHECK (length(btrim(label_snapshot)) > 0),
  role text NOT NULL CHECK (role IN ('envolvido','testemunha')),
  PRIMARY KEY (occurrence_id, party_kind, label_snapshot, role)
);

REVOKE ALL ON public.school_disciplinary_occurrences, public.school_disciplinary_occurrence_parties FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.school_disciplinary_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_disciplinary_occurrence_parties ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sdo_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'occurrence:immutable'; END $$;
CREATE TRIGGER sdo_no_change BEFORE UPDATE OR DELETE ON public.school_disciplinary_occurrences FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();
CREATE TRIGGER sdop_no_change BEFORE UPDATE OR DELETE ON public.school_disciplinary_occurrence_parties FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();

CREATE OR REPLACE FUNCTION public.sdo_can_read(_school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = auth.uid()
    AND ((p.station_code IN ('direcao_escolar','orientacao_pedagogica') AND p.school_id = _school) OR p.school_id IS NULL))
$$;
REVOKE ALL ON FUNCTION public.sdo_can_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sdo_can_read(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.direcao_record_occurrence(
  _school text, _occurred_at timestamptz, _severity text, _kind text, _narrative text,
  _measures text[], _witnesses text, _parties jsonb, _addendum_of uuid, _idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr uuid; nid uuid; y int; s int; o record; p jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'occurrence:auth-required'; END IF;
  SELECT id INTO pr FROM public.institutional_sector_principals
   WHERE auth_user_id = auth.uid() AND station_code = 'direcao_escolar' AND school_id = _school;
  IF pr IS NULL THEN RAISE EXCEPTION 'occurrence:direcao-only'; END IF;
  SELECT id INTO nid FROM public.school_disciplinary_occurrences WHERE idempotency_key = _idempotency_key;
  IF nid IS NOT NULL THEN RETURN nid; END IF;
  IF _occurred_at IS NULL OR _occurred_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'occurrence:date-invalid'; END IF;
  IF _addendum_of IS NOT NULL THEN
    SELECT * INTO o FROM public.school_disciplinary_occurrences WHERE id = _addendum_of;
    IF o.id IS NULL OR o.school_id <> _school THEN RAISE EXCEPTION 'occurrence:original-not-found'; END IF;
    IF o.addendum_of IS NOT NULL THEN _addendum_of := o.addendum_of; END IF;
  ELSIF _parties IS NULL OR jsonb_array_length(_parties) = 0 THEN RAISE EXCEPTION 'occurrence:party-required'; END IF;
  y := extract(year FROM _occurred_at AT TIME ZONE 'America/Sao_Paulo')::int;
  PERFORM pg_advisory_xact_lock(hashtext('sdo:' || _school || ':' || y));
  SELECT coalesce(max(number_seq), 0) + 1 INTO s FROM public.school_disciplinary_occurrences WHERE school_id = _school AND number_year = y;
  INSERT INTO public.school_disciplinary_occurrences(school_id, number_year, number_seq, addendum_of, occurred_at, severity, kind, narrative,
    measures, witnesses, recorded_by_user, recorded_by_principal_id, idempotency_key)
  VALUES (_school, y, s, _addendum_of, _occurred_at, btrim(_severity), btrim(_kind), btrim(_narrative),
    coalesce(_measures, '{}'), nullif(btrim(coalesce(_witnesses, '')), ''), auth.uid(), pr, _idempotency_key)
  RETURNING id INTO nid;
  FOR p IN SELECT * FROM jsonb_array_elements(coalesce(_parties, '[]'::jsonb)) LOOP
    IF p->>'kind' = 'estudante' AND NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = p->>'ref' AND e.school_id = _school) THEN
      RAISE EXCEPTION 'occurrence:student-not-in-school'; END IF;
    INSERT INTO public.school_disciplinary_occurrence_parties(occurrence_id, party_kind, party_ref, label_snapshot, role)
    VALUES (nid, p->>'kind', nullif(p->>'ref', ''), btrim(p->>'label'), coalesce(p->>'role', 'envolvido'))
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.direcao_record_occurrence(text, timestamptz, text, text, text, text[], text, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_record_occurrence(text, timestamptz, text, text, text, text[], text, jsonb, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_occurrences_at(_school text)
RETURNS TABLE(id uuid, number_year int, number_seq int, addendum_of uuid, occurred_at timestamptz, severity text, kind text,
  narrative text, measures text[], witnesses text, created_at timestamptz, parties jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sdo_can_read(_school) THEN RAISE EXCEPTION 'occurrence:not-authorized'; END IF;
  RETURN QUERY SELECT o.id, o.number_year, o.number_seq, o.addendum_of, o.occurred_at, o.severity, o.kind, o.narrative, o.measures,
    o.witnesses, o.created_at,
    coalesce((SELECT jsonb_agg(jsonb_build_object('kind', p.party_kind, 'ref', p.party_ref, 'label', p.label_snapshot, 'role', p.role))
      FROM public.school_disciplinary_occurrence_parties p WHERE p.occurrence_id = o.id), '[]'::jsonb)
  FROM public.school_disciplinary_occurrences o WHERE o.school_id = _school ORDER BY o.created_at DESC LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.school_occurrences_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_occurrences_at(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.direcao_occurrence_students(_school text, _q text)
RETURNS TABLE(student_id text, name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = auth.uid()
    AND p.station_code = 'direcao_escolar' AND p.school_id = _school) THEN RAISE EXCEPTION 'occurrence:direcao-only'; END IF;
  IF length(btrim(coalesce(_q, ''))) < 3 THEN RETURN; END IF;
  RETURN QUERY SELECT x.student_id, x.name FROM (
    SELECT DISTINCT e.student_id, coalesce(
      (SELECT v.civil_name FROM public.student_identity_versions v WHERE v.student_id = e.student_id ORDER BY v.version DESC LIMIT 1),
      s.display_name) AS name
    FROM public.school_enrollments e JOIN public.institutional_students s ON s.id = e.student_id
    WHERE e.school_id = _school) x
  WHERE lower(unaccent(coalesce(x.name, ''))) LIKE '%' || lower(unaccent(btrim(_q))) || '%'
  ORDER BY x.name LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION public.direcao_occurrence_students(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_occurrence_students(text, text) TO authenticated;