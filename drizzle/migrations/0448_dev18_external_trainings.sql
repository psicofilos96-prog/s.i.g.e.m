-- SIGEM Desenvolvimento L18: formações externas. Submissão (versões) → conferência → análise → validação/indeferimento fundamentado.
-- Validar registra que a formação externa foi conferida; NUNCA equivale a reconhecimento para progressão (ato próprio do DP, fora daqui).
CREATE TABLE public.dev_external_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_external_training_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.dev_external_trainings(id),
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  provider text NOT NULL CHECK (length(btrim(provider)) BETWEEN 3 AND 200),
  modality text NOT NULL CHECK (modality IN ('presencial','remota','hibrida')),
  hours_minutes int NOT NULL CHECK (hours_minutes > 0),
  period_start date NOT NULL,
  period_end date NOT NULL,
  certificate_document_version uuid NOT NULL REFERENCES public.docserv_document_versions(id),
  certificate_sha256 text NOT NULL CHECK (certificate_sha256 ~ '^[0-9a-f]{64}$'),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_id, version),
  CHECK (period_end >= period_start),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.dev_external_training_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.dev_external_training_versions(id),
  seq int NOT NULL CHECK (seq >= 1),
  stage text NOT NULL CHECK (stage IN ('conferencia','analise','decisao')),
  outcome text NOT NULL CHECK (outcome IN ('conforme','divergente','favoravel','desfavoravel','devolvido','validado','indeferido')),
  grounds text NOT NULL CHECK (length(btrim(grounds)) >= 20),
  reviewer_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, seq),
  CHECK ((stage = 'conferencia' AND outcome IN ('conforme','divergente','devolvido'))
      OR (stage = 'analise' AND outcome IN ('favoravel','desfavoravel','devolvido'))
      OR (stage = 'decisao' AND outcome IN ('validado','indeferido','devolvido')))
);
GRANT SELECT ON public.dev_external_trainings, public.dev_external_training_reviews TO authenticated;
GRANT ALL ON public.dev_external_trainings, public.dev_external_training_versions, public.dev_external_training_reviews TO service_role;
GRANT SELECT (id, training_id, version, title, provider, modality, hours_minutes, period_start, period_end, certificate_sha256, reason, author_person, created_at)
  ON public.dev_external_training_versions TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_external_trainings, public.dev_external_training_versions, public.dev_external_training_reviews FROM authenticated, anon;
ALTER TABLE public.dev_external_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_external_training_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_external_training_reviews ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.dev_ext_readable(_training uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_external_trainings t WHERE t.id = _training
    AND (t.person_id = public.current_person_id() OR public.has_network_capability('analisar-formacoes-externas')))
$$;
REVOKE EXECUTE ON FUNCTION public.dev_ext_readable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_ext_readable(uuid) TO authenticated;
CREATE POLICY "dev ext read" ON public.dev_external_trainings FOR SELECT TO authenticated USING (public.dev_ext_readable(id));
CREATE POLICY "dev ext versions read" ON public.dev_external_training_versions FOR SELECT TO authenticated USING (public.dev_ext_readable(training_id));
CREATE POLICY "dev ext reviews read" ON public.dev_external_training_reviews FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.dev_external_training_versions v WHERE v.id = version_id AND public.dev_ext_readable(v.training_id)));
CREATE TRIGGER devext_immutable BEFORE UPDATE OR DELETE ON public.dev_external_trainings FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devextv_immutable BEFORE UPDATE OR DELETE ON public.dev_external_training_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devextr_immutable BEFORE UPDATE OR DELETE ON public.dev_external_training_reviews FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Estado da versão = projeção do ledger (nunca campo gravado).
CREATE OR REPLACE FUNCTION public.dev_ext_version_state(_version uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE WHEN r.outcome IN ('validado','indeferido','devolvido') THEN r.outcome
                     WHEN r.stage = 'conferencia' THEN 'conferida' ELSE 'analisada' END
                   FROM public.dev_external_training_reviews r WHERE r.version_id = _version ORDER BY r.seq DESC LIMIT 1), 'submetida')
$$;
REVOKE EXECUTE ON FUNCTION public.dev_ext_version_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_ext_version_state(uuid) TO authenticated;

-- Submissão: só a própria pessoa; certificado = versão DocServ da própria pessoa (PDF). Nova versão só após devolução ou indeferimento, com motivo.
CREATE OR REPLACE FUNCTION public.submit_dev_external_training(_training uuid, _expected_version int, _title text, _provider text, _modality text,
  _hours int, _start date, _end date, _certificate uuid, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _t uuid := _training; _last int; _sha text; _lastv uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_external_training_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT sha256 INTO _sha FROM public.docserv_document_versions WHERE id = _certificate AND person_id = _p AND mime_type = 'application/pdf';
  IF _sha IS NULL OR _sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'dev:invalid-document'; END IF;
  IF _end > current_date THEN RAISE EXCEPTION 'dev:future-period'; END IF;
  IF _t IS NULL THEN
    IF coalesce(_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'dev:stale'; END IF;
    INSERT INTO public.dev_external_trainings(person_id) VALUES (_p) RETURNING id INTO _t; _last := 0;
  ELSE
    PERFORM 1 FROM public.dev_external_trainings WHERE id = _t AND person_id = _p FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
    SELECT id, version INTO _lastv, _last FROM public.dev_external_training_versions WHERE training_id = _t ORDER BY version DESC LIMIT 1;
    IF _last <> _expected_version THEN RAISE EXCEPTION 'dev:stale'; END IF;
    IF public.dev_ext_version_state(_lastv) NOT IN ('devolvido','indeferido') THEN RAISE EXCEPTION 'dev:in-review'; END IF;
  END IF;
  INSERT INTO public.dev_external_training_versions(training_id, version, title, provider, modality, hours_minutes, period_start, period_end,
    certificate_document_version, certificate_sha256, reason, author_person, idempotency_key)
  VALUES (_t, _last + 1, btrim(_title), btrim(_provider), _modality, _hours, _start, _end, _certificate, _sha, nullif(btrim(coalesce(_reason,'')),''), _p, _key)
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Revisão: conferência → análise → decisão, cada etapa por pessoa distinta do titular e das etapas anteriores; capacidades por etapa.
CREATE OR REPLACE FUNCTION public.review_dev_external_training(_version uuid, _expected_seq int, _stage text, _outcome text, _grounds text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_external_training_versions; _owner uuid; _last int; _prev text; _state text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_external_training_reviews WHERE version_id = _version AND seq = _expected_seq + 1
             AND reviewer_person = _p AND stage = _stage AND outcome = _outcome) THEN RETURN _expected_seq + 1; END IF;
  IF NOT public.has_network_capability(CASE _stage WHEN 'decisao' THEN 'validar-formacoes-externas' ELSE 'analisar-formacoes-externas' END) THEN
    RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _v FROM public.dev_external_training_versions WHERE id = _version;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  SELECT person_id INTO _owner FROM public.dev_external_trainings WHERE id = _v.training_id FOR UPDATE;
  IF _p = _owner THEN RAISE EXCEPTION 'dev:self-review'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_external_training_reviews WHERE version_id = _version AND reviewer_person = _p) THEN RAISE EXCEPTION 'dev:segregation'; END IF;
  IF _v.version <> (SELECT max(version) FROM public.dev_external_training_versions WHERE training_id = _v.training_id) THEN RAISE EXCEPTION 'dev:not-latest'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_external_training_reviews WHERE version_id = _version;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  _state := public.dev_ext_version_state(_version);
  IF _state IN ('validado','indeferido','devolvido') THEN RAISE EXCEPTION 'dev:closed'; END IF;
  SELECT stage INTO _prev FROM public.dev_external_training_reviews WHERE version_id = _version ORDER BY seq DESC LIMIT 1;
  IF NOT ((_prev IS NULL AND _stage = 'conferencia') OR (_prev = 'conferencia' AND _stage = 'analise') OR (_prev = 'analise' AND _stage = 'decisao')) THEN
    RAISE EXCEPTION 'dev:stage-order'; END IF;
  -- Certificado ainda íntegro no momento de conferir.
  IF _stage = 'conferencia' AND (SELECT sha256 FROM public.docserv_document_versions WHERE id = _v.certificate_document_version) IS DISTINCT FROM _v.certificate_sha256 THEN
    RAISE EXCEPTION 'dev:document-changed'; END IF;
  -- Conferência divergente não pode virar validação.
  IF _stage = 'decisao' AND _outcome = 'validado' AND EXISTS (SELECT 1 FROM public.dev_external_training_reviews
     WHERE version_id = _version AND outcome IN ('divergente','desfavoravel')) THEN RAISE EXCEPTION 'dev:grounds-contradict'; END IF;
  INSERT INTO public.dev_external_training_reviews(version_id, seq, stage, outcome, grounds, reviewer_person)
  VALUES (_version, _last + 1, _stage, _outcome, btrim(_grounds), _p);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['submit_dev_external_training(uuid,int,text,text,text,int,date,date,uuid,text,text)','review_dev_external_training(uuid,int,text,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
COMMENT ON TABLE public.dev_external_training_reviews IS 'Validado = formação externa conferida; não equivale a reconhecimento para progressão funcional.';