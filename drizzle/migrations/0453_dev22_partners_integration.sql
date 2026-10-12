-- SIGEM Desenvolvimento L22: parceiros formativos (versionados, aprovados por pessoa ≠ autor) e vínculo parceiro × versão de curso.
-- Integrações com DP/OP/Supervisão/A&A/Documentos são só leitura das fontes canônicas; nenhum efeito funcional (progressão, promoção, remuneração).
CREATE TABLE public.dev_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9.-]{1,30}$'),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_partner_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.dev_partners(id),
  version int NOT NULL CHECK (version >= 1),
  legal_name text NOT NULL CHECK (length(btrim(legal_name)) >= 3),
  nature text NOT NULL CHECK (nature IN ('instituicao-de-ensino','orgao-publico','organizacao-social','outro')),
  agreement_document_ref uuid REFERENCES public.docserv_document_versions(id),
  valid_from date NOT NULL,
  valid_until date,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, version),
  CHECK (version = 1 OR reason IS NOT NULL),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.dev_partner_approvals (
  partner_version_id uuid PRIMARY KEY REFERENCES public.dev_partner_versions(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_partner_course_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_version_id uuid NOT NULL REFERENCES public.dev_partner_approvals(partner_version_id),
  course_version_id uuid NOT NULL REFERENCES public.dev_course_versions(id),
  role text NOT NULL CHECK (role IN ('coexecucao','certificacao-conjunta','apoio')),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_version_id, course_version_id, role)
);
GRANT SELECT ON public.dev_partners, public.dev_partner_versions, public.dev_partner_approvals, public.dev_partner_course_links TO authenticated;
GRANT ALL ON public.dev_partners, public.dev_partner_versions, public.dev_partner_approvals, public.dev_partner_course_links TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_partners, public.dev_partner_versions, public.dev_partner_approvals, public.dev_partner_course_links FROM authenticated, anon;
ALTER TABLE public.dev_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_partner_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_partner_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_partner_course_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev partners read" ON public.dev_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev partner versions read" ON public.dev_partner_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dev_partner_approvals a WHERE a.partner_version_id = id) OR public.has_network_capability('manter-parceiros-formativos'));
CREATE POLICY "dev partner approvals read" ON public.dev_partner_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev partner course read" ON public.dev_partner_course_links FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_dev_partner_version(_code text, _expected_version int, _name text, _nature text, _agreement uuid, _from date, _until date, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _c uuid; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_partner_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('manter-parceiros-formativos') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT id INTO _c FROM public.dev_partners WHERE code = upper(btrim(_code)) FOR UPDATE;
  IF _c IS NULL THEN
    IF coalesce(_expected_version, 0) <> 0 THEN RAISE EXCEPTION 'dev:stale'; END IF;
    INSERT INTO public.dev_partners(code, author_person) VALUES (upper(btrim(_code)), _p) RETURNING id INTO _c;
  END IF;
  SELECT coalesce(max(version), 0) INTO _last FROM public.dev_partner_versions WHERE partner_id = _c;
  IF _last <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_partner_versions(partner_id, version, legal_name, nature, agreement_document_ref, valid_from, valid_until, reason, author_person, idempotency_key)
  VALUES (_c, _last + 1, btrim(_name), _nature, _agreement, _from, _until, nullif(btrim(coalesce(_reason,'')),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_dev_partner(_version uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _a uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-parceiros-formativos') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT author_person INTO _a FROM public.dev_partner_versions WHERE id = _version FOR UPDATE;
  IF _a IS NULL THEN RAISE EXCEPTION 'dev:not-found'; END IF;
  IF _a = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_partner_approvals(partner_version_id, approver_person, reason) VALUES (_version, _p, btrim(_reason));
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.link_dev_partner_course(_partner_version uuid, _course_version uuid, _role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT public.has_network_capability('manter-parceiros-formativos') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT id INTO _id FROM public.dev_partner_course_links WHERE partner_version_id = _partner_version AND course_version_id = _course_version AND role = _role;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.dev_partner_course_links(partner_version_id, course_version_id, role, author_person) VALUES (_partner_version, _course_version, _role, _p) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_partner_version(text,int,text,text,uuid,date,date,text,text)','approve_dev_partner(uuid,text)','link_dev_partner_course(uuid,uuid,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;