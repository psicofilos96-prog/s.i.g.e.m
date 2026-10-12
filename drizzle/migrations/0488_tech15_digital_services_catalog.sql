-- Tecnologia L15: catálogo de sistemas e serviços digitais da rede. Entrada = versão append-only
-- (configurar-catalogo-digital); utilizável só na última versão aprovada por pessoa ≠ autor (aprovar-catalogo-digital).
-- Contrato/termo só como juntada do SIGEM Documentos (coluna oculta). SIGEM e integrações não são copiados.
CREATE TABLE public.tech_digital_service_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL CHECK (service_key ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  version int NOT NULL CHECK (version >= 1),
  name text NOT NULL CHECK (length(btrim(name)) >= 3),
  kind text NOT NULL CHECK (kind IN ('sistema','servico','plataforma','aplicativo')),
  audience text[] NOT NULL CHECK (cardinality(audience) >= 1 AND audience <@ ARRAY['estudantes','familias','professores','escolas','gestao','publico']),
  operator text NOT NULL CHECK (operator IN ('rede','municipio','terceiro')),
  status text NOT NULL CHECK (status IN ('em-uso','em-implantacao','descontinuado')),
  data_classes text[] NOT NULL CHECK (data_classes <@ ARRAY['nenhum','pessoais','sensiveis','criancas']),
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 10 AND 1000),
  access_url text CHECK (access_url IS NULL OR access_url ~ '^https://'),
  contract_ref uuid REFERENCES public.admin_case_events(id),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_key, version),
  CHECK (operator = 'rede' OR contract_ref IS NOT NULL OR status = 'descontinuado'),
  CHECK (NOT ('nenhum' = ANY(data_classes)) OR cardinality(data_classes) = 1)
);
GRANT ALL ON public.tech_digital_service_versions TO service_role;
REVOKE ALL ON public.tech_digital_service_versions FROM anon, authenticated;
GRANT SELECT (id, service_key, version, name, kind, audience, operator, status, data_classes, purpose, access_url, person_id, created_at) ON public.tech_digital_service_versions TO authenticated;
ALTER TABLE public.tech_digital_service_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech dsv read" ON public.tech_digital_service_versions FOR SELECT TO authenticated USING (true);
CREATE TRIGGER tech_dsv_immutable BEFORE UPDATE OR DELETE ON public.tech_digital_service_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE TABLE public.tech_digital_service_approvals (
  version_id uuid PRIMARY KEY REFERENCES public.tech_digital_service_versions(id),
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tech_digital_service_approvals TO service_role;
REVOKE ALL ON public.tech_digital_service_approvals FROM anon, authenticated;
GRANT SELECT ON public.tech_digital_service_approvals TO authenticated;
ALTER TABLE public.tech_digital_service_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech dsa read" ON public.tech_digital_service_approvals FOR SELECT TO authenticated USING (true);
CREATE TRIGGER tech_dsa_immutable BEFORE UPDATE OR DELETE ON public.tech_digital_service_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_digital_service(_key text, _expected int, _name text, _kind text, _aud text[], _op text, _status text,
  _data text[], _purpose text, _url text, _contract uuid, _idem text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _prev int;
BEGIN
  SELECT version INTO _prev FROM public.tech_digital_service_versions WHERE idempotency_key = _idem; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('configurar-catalogo-digital') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF _contract IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin_case_events WHERE id = _contract AND event_type = 'documento_juntado') THEN RAISE EXCEPTION 'contrato-nao-juntado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tech-dsv:' || _key));
  SELECT coalesce(max(version), 0) INTO _last FROM public.tech_digital_service_versions WHERE service_key = _key;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_digital_service_versions(service_key, version, name, kind, audience, operator, status, data_classes, purpose, access_url, contract_ref, person_id, idempotency_key)
  VALUES (_key, _last + 1, btrim(_name), _kind, _aud, _op, _status, _data, btrim(_purpose), _url, _contract, _p, _idem);
  RETURN _last + 1;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_digital_service(_version uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.tech_digital_service_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-catalogo-digital') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _v FROM public.tech_digital_service_versions WHERE id = _version FOR UPDATE;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _v.person_id = _p THEN RAISE EXCEPTION 'autoaprovacao'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_digital_service_versions WHERE service_key = _v.service_key AND version > _v.version) THEN RAISE EXCEPTION 'versao-superada'; END IF;
  INSERT INTO public.tech_digital_service_approvals(version_id, decision_ref, person_id) VALUES (_version, btrim(_decision), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-aprovada'; WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

REVOKE ALL ON FUNCTION public.record_tech_digital_service(text, int, text, text, text[], text, text, text[], text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_tech_digital_service(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_digital_service(text, int, text, text, text[], text, text, text[], text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_tech_digital_service(uuid, text) TO authenticated;