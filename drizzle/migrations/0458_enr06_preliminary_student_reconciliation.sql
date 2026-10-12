-- Matrículas L06: identificação preliminar do estudante + reconciliação supervisionada com o estudante oficial.
-- Nunca funde, nunca cria estudante; nome sozinho nunca é candidato; decisão por pessoa ≠ quem registrou.
CREATE TABLE public.enr_preliminary_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_registration_id uuid NOT NULL REFERENCES public.protocol_registrations(id),
  civil_name text NOT NULL CHECK (length(btrim(civil_name)) BETWEEN 5 AND 200),
  birth_date date NOT NULL,
  official_identifier text CHECK (official_identifier IS NULL OR btrim(official_identifier) ~ '^[0-9A-Za-z.-]{4,40}$'),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (birth_date > date '1900-01-01')
);
CREATE TABLE public.enr_student_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preliminary_id uuid NOT NULL REFERENCES public.enr_preliminary_students(id),
  seq int NOT NULL CHECK (seq >= 1),
  decision text NOT NULL CHECK (decision IN ('mesmo-estudante','sem-correspondencia','indeterminado')),
  student_id text REFERENCES public.institutional_students(id),
  match_strength text NOT NULL CHECK (match_strength IN ('forte','fraca','nenhuma')),
  evidence_ref text,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  decider_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (preliminary_id, seq),
  CHECK ((decision = 'mesmo-estudante') = (student_id IS NOT NULL)),
  CHECK (match_strength <> 'fraca' OR decision <> 'mesmo-estudante' OR (length(btrim(reason)) >= 20 AND coalesce(btrim(evidence_ref),'') <> ''))
);
COMMENT ON TABLE public.enr_student_reconciliations IS 'Decisão humana append-only; sem-correspondencia não cria estudante (só a Secretaria cria pelo writer canônico).';
GRANT SELECT ON public.enr_preliminary_students, public.enr_student_reconciliations TO authenticated;
GRANT ALL ON public.enr_preliminary_students, public.enr_student_reconciliations TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_preliminary_students, public.enr_student_reconciliations FROM authenticated, anon;
ALTER TABLE public.enr_preliminary_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_student_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr prelim read" ON public.enr_preliminary_students FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-identificacao-de-ingresso') OR public.has_network_capability('reconciliar-estudante-de-ingresso'));
CREATE POLICY "enr reconciliation read" ON public.enr_student_reconciliations FOR SELECT TO authenticated
  USING (public.has_network_capability('registrar-identificacao-de-ingresso') OR public.has_network_capability('reconciliar-estudante-de-ingresso'));
CREATE TRIGGER enr_prelim_append_only BEFORE UPDATE OR DELETE ON public.enr_preliminary_students FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_reconciliation_append_only BEFORE UPDATE OR DELETE ON public.enr_student_reconciliations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_norm_name(_t text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT regexp_replace(lower(extensions.unaccent(btrim(coalesce(_t,'')))), '\s+', ' ', 'g')
$$;

CREATE OR REPLACE FUNCTION public.record_enr_preliminary_student(_protocol uuid, _name text, _birth date, _official text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  SELECT id INTO _id FROM public.enr_preliminary_students WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('registrar-identificacao-de-ingresso') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  IF _birth > current_date THEN RAISE EXCEPTION 'enr:invalid'; END IF;
  INSERT INTO public.enr_preliminary_students(protocol_registration_id, civil_name, birth_date, official_identifier, author_person, idempotency_key)
  VALUES (_protocol, regexp_replace(btrim(_name), '\s+', ' ', 'g'), _birth, nullif(btrim(coalesce(_official,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR unique_violation OR foreign_key_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

-- Candidatos: forte = identificador oficial exato; fraca = nome civil normalizado + nascimento exatos (versão vigente).
-- Nome sozinho nunca. Devolve só id e força; nenhum dado do terceiro sai daqui.
CREATE OR REPLACE FUNCTION public.enr_student_candidates(_prelim uuid)
RETURNS TABLE(student_id text, strength text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _r public.enr_preliminary_students;
BEGIN
  IF NOT public.has_network_capability('reconciliar-estudante-de-ingresso') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  SELECT * INTO _r FROM public.enr_preliminary_students WHERE id = _prelim;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  RETURN QUERY
  WITH cur AS (
    SELECT DISTINCT ON (v.student_id) v.student_id::text AS sid, v.civil_name, v.birth_date FROM public.student_identity_versions v ORDER BY v.student_id, v.version DESC),
  strong AS (SELECT s.id::text AS sid FROM public.institutional_students s WHERE _r.official_identifier IS NOT NULL AND s.institutional_identifier = _r.official_identifier),
  weak AS (SELECT c.sid FROM cur c WHERE c.birth_date = _r.birth_date AND public.enr_norm_name(c.civil_name) = public.enr_norm_name(_r.civil_name))
  SELECT st.sid, 'forte'::text FROM strong st
  UNION ALL SELECT w.sid, 'fraca'::text FROM weak w WHERE w.sid NOT IN (SELECT sid FROM strong);
END $$;

CREATE OR REPLACE FUNCTION public.record_enr_student_reconciliation(_prelim uuid, _expected_seq int, _decision text, _student text, _evidence text, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.enr_preliminary_students; _seq int; _done int; _strength text; _n int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  SELECT seq INTO _done FROM public.enr_student_reconciliations WHERE idempotency_key = _key AND decider_person = _p;
  IF _done IS NOT NULL THEN RETURN _done; END IF;
  IF NOT public.has_network_capability('reconciliar-estudante-de-ingresso') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  SELECT * INTO _r FROM public.enr_preliminary_students WHERE id = _prelim FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  IF _r.author_person = _p THEN RAISE EXCEPTION 'enr:self-reconciliation'; END IF;
  SELECT coalesce(max(seq),0) INTO _seq FROM public.enr_student_reconciliations WHERE preliminary_id = _prelim;
  IF _seq <> coalesce(_expected_seq,0) THEN RAISE EXCEPTION 'enr:stale-seq'; END IF;
  SELECT count(*) INTO _n FROM public.enr_student_candidates(_prelim);
  IF _decision = 'mesmo-estudante' THEN
    SELECT c.strength INTO _strength FROM public.enr_student_candidates(_prelim) c WHERE c.student_id = _student;
    IF _strength IS NULL THEN RAISE EXCEPTION 'enr:not-a-candidate'; END IF;
  ELSIF _decision = 'sem-correspondencia' THEN
    IF _n > 0 THEN RAISE EXCEPTION 'enr:candidates-pending'; END IF;
    _strength := 'nenhuma';
  ELSE
    _strength := CASE WHEN _n > 0 THEN 'fraca' ELSE 'nenhuma' END;
  END IF;
  INSERT INTO public.enr_student_reconciliations(preliminary_id, seq, decision, student_id, match_strength, evidence_ref, reason, decider_person, idempotency_key)
  VALUES (_prelim, _seq+1, _decision, CASE WHEN _decision='mesmo-estudante' THEN _student END, _strength, nullif(btrim(coalesce(_evidence,'')),''), btrim(_reason), _p, _key);
  RETURN _seq+1;
EXCEPTION WHEN check_violation OR unique_violation OR foreign_key_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

REVOKE EXECUTE ON FUNCTION public.enr_norm_name(text) FROM PUBLIC, anon, authenticated;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_enr_preliminary_student(uuid,text,date,text,text)','enr_student_candidates(uuid)',
    'record_enr_student_reconciliation(uuid,int,text,text,text,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;