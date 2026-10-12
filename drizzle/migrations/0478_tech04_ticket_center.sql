-- Tecnologia L04: categoria de chamado = versão append-only com formulário declarado; utilizável só na última versão
-- aprovada por pessoa ≠ autor; classificação do chamado com respostas validadas no banco; protocolo único por chamado.
CREATE TABLE public.tech_ticket_category_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL CHECK (category_key ~ '^[a-z0-9-]{2,80}$'),
  version int NOT NULL CHECK (version >= 1),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 3 AND 120),
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'array' AND jsonb_array_length(fields) <= 30),
  requires_attachment boolean NOT NULL DEFAULT false,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_key, version), CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.tech_ticket_category_approvals (
  category_version_id uuid PRIMARY KEY REFERENCES public.tech_ticket_category_versions(id),
  decision text NOT NULL CHECK (length(btrim(decision)) >= 10),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_ticket_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ops_requests(id),
  seq int NOT NULL CHECK (seq >= 1),
  category_version_id uuid NOT NULL REFERENCES public.tech_ticket_category_versions(id),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq), CHECK (seq = 1 OR reason IS NOT NULL)
);
GRANT SELECT ON public.tech_ticket_category_versions, public.tech_ticket_category_approvals, public.tech_ticket_classifications TO authenticated;
GRANT ALL ON public.tech_ticket_category_versions, public.tech_ticket_category_approvals, public.tech_ticket_classifications TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_ticket_category_versions, public.tech_ticket_category_approvals, public.tech_ticket_classifications FROM anon, authenticated, service_role;
ALTER TABLE public.tech_ticket_category_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_ticket_category_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_ticket_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech cat read" ON public.tech_ticket_category_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech cat appr read" ON public.tech_ticket_category_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech class read" ON public.tech_ticket_classifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id
  AND (r.requester_person = public.current_person_id() OR public.tech_can_read(r.school_id))));
CREATE TRIGGER tech_cat_immutable BEFORE UPDATE OR DELETE ON public.tech_ticket_category_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_cat_appr_immutable BEFORE UPDATE OR DELETE ON public.tech_ticket_category_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_class_immutable BEFORE UPDATE OR DELETE ON public.tech_ticket_classifications FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Campo: {key, label, type: texto|escolha|sim-nao|data, required, options?}
CREATE OR REPLACE FUNCTION public.tech_fields_valid(_f jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_f) e WHERE NOT (
      jsonb_typeof(e) = 'object' AND (e->>'key') ~ '^[a-z0-9-]{2,40}$' AND length(btrim(coalesce(e->>'label',''))) >= 2
      AND (e->>'type') IN ('texto','escolha','sim-nao','data') AND jsonb_typeof(e->'required') = 'boolean'
      AND ((e->>'type') <> 'escolha' OR (jsonb_typeof(e->'options') = 'array' AND jsonb_array_length(e->'options') >= 2))))
  AND (SELECT count(*) = count(DISTINCT e->>'key') FROM jsonb_array_elements(_f) e)
$$;
CREATE OR REPLACE FUNCTION public.tech_answers_problem(_f jsonb, _a jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT 'campo-desconhecido:' || k FROM jsonb_object_keys(_a) k WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_f) e WHERE e->>'key' = k) LIMIT 1),
    (SELECT 'campo-obrigatorio:' || (e->>'key') FROM jsonb_array_elements(_f) e WHERE (e->>'required')::boolean AND NOT (_a ? (e->>'key')) LIMIT 1),
    (SELECT 'valor-invalido:' || (e->>'key') FROM jsonb_array_elements(_f) e WHERE _a ? (e->>'key') AND NOT CASE e->>'type'
        WHEN 'texto' THEN jsonb_typeof(_a->(e->>'key')) = 'string' AND length(btrim(_a->>(e->>'key'))) BETWEEN 1 AND 500
        WHEN 'sim-nao' THEN jsonb_typeof(_a->(e->>'key')) = 'boolean'
        WHEN 'data' THEN jsonb_typeof(_a->(e->>'key')) = 'string' AND (_a->>(e->>'key')) ~ '^\d{4}-\d{2}-\d{2}$'
        WHEN 'escolha' THEN (e->'options') @> jsonb_build_array(_a->(e->>'key'))
        ELSE false END LIMIT 1))
$$;

CREATE OR REPLACE FUNCTION public.record_tech_ticket_category(_key_cat text, _label text, _fields jsonb, _requires_attachment boolean, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v int;
BEGIN
  SELECT version INTO _v FROM public.tech_ticket_category_versions WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('configurar-categorias-de-chamado') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF NOT public.tech_fields_valid(_fields) THEN RAISE EXCEPTION 'formulario-invalido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('techcat|' || _key_cat));
  SELECT coalesce(max(version), 0) + 1 INTO _v FROM public.tech_ticket_category_versions WHERE category_key = _key_cat;
  INSERT INTO public.tech_ticket_category_versions(category_key, version, label, fields, requires_attachment, reason, person_id, idempotency_key)
  VALUES (_key_cat, _v, btrim(_label), _fields, _requires_attachment, _reason, _p, _key);
  RETURN _v;
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_ticket_category(_version uuid, _decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.tech_ticket_category_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-categorias-de-chamado') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _c FROM public.tech_ticket_category_versions WHERE id = _version;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _c.person_id = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_ticket_category_approvals WHERE category_version_id = _version) THEN RETURN; END IF;
  INSERT INTO public.tech_ticket_category_approvals(category_version_id, decision, person_id) VALUES (_version, btrim(_decision), _p);
END $$;

CREATE OR REPLACE FUNCTION public.tech_classify_ticket(_request uuid, _expected_seq int, _category_version uuid, _answers jsonb, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_requests; _c public.tech_ticket_category_versions; _last int; _err text; _prev int;
BEGIN
  SELECT seq INTO _prev FROM public.tech_ticket_classifications WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _request AND sector = 'tecnologia' FOR UPDATE;
  IF _r.id IS NULL OR NOT (_r.requester_person = _p OR public.tech_can_manage(_r.school_id)) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_ticket_classifications WHERE request_id = _request;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  IF _last > 0 AND NOT public.tech_can_manage(_r.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _c FROM public.tech_ticket_category_versions WHERE id = _category_version;
  IF _c.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tech_ticket_category_approvals WHERE category_version_id = _c.id)
     OR EXISTS (SELECT 1 FROM public.tech_ticket_category_versions o WHERE o.category_key = _c.category_key AND o.version > _c.version)
  THEN RAISE EXCEPTION 'categoria-nao-utilizavel'; END IF;
  _err := public.tech_answers_problem(_c.fields, _answers);
  IF _err IS NOT NULL THEN RAISE EXCEPTION '%', _err; END IF;
  INSERT INTO public.tech_ticket_classifications(request_id, seq, category_version_id, answers, reason, person_id, idempotency_key)
  VALUES (_request, _last + 1, _c.id, _answers, _reason, _p, _key);
  RETURN _last + 1;
END $$;

-- Protocolo único: um chamado de tecnologia recebe no máximo um vínculo de protocolo.
CREATE OR REPLACE FUNCTION public.tech_protocol_once() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.kind = 'vinculo-protocolo' AND EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = NEW.request_id AND r.sector = 'tecnologia')
     AND EXISTS (SELECT 1 FROM public.ops_request_events e WHERE e.request_id = NEW.request_id AND e.kind = 'vinculo-protocolo')
  THEN RAISE EXCEPTION 'protocolo-ja-vinculado'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tech_protocol_once BEFORE INSERT ON public.ops_request_events FOR EACH ROW EXECUTE FUNCTION public.tech_protocol_once();

REVOKE ALL ON FUNCTION public.record_tech_ticket_category(text, text, jsonb, boolean, text, text), public.approve_tech_ticket_category(uuid, text),
  public.tech_classify_ticket(uuid, int, uuid, jsonb, text, text), public.tech_protocol_once() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_ticket_category(text, text, jsonb, boolean, text, text), public.approve_tech_ticket_category(uuid, text),
  public.tech_classify_ticket(uuid, int, uuid, jsonb, text, text) TO authenticated;
