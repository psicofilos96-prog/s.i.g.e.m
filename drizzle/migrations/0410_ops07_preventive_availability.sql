-- Centro de Operações L07: plano preventivo com periodicidade validada (fonte + aprovação ≠ autor),
-- vínculo de ordens L05 ao plano (preventiva) — sem vínculo é corretiva —, disponibilidade de espaços
-- como eventos e certificados de segurança SÓ como referência a documento juntado (nunca gerados).

CREATE TABLE public.ops_preventive_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text NOT NULL CHECK (plan_key ~ '^[a-z0-9-]{2,80}$'),
  version int NOT NULL CHECK (version >= 1),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  space_id uuid REFERENCES public.ops_spaces(id),
  activity text NOT NULL CHECK (length(btrim(activity)) >= 5),
  periodicity_days int NOT NULL CHECK (periodicity_days BETWEEN 1 AND 3650),
  basis_kind text NOT NULL CHECK (basis_kind IN ('norma','fabricante','manual-tecnico','decisao-tecnica')),
  basis_ref text NOT NULL CHECK (length(btrim(basis_ref)) >= 3),
  starts_on date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_key, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.ops_preventive_plan_approvals (
  plan_version_id uuid PRIMARY KEY REFERENCES public.ops_preventive_plan_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_preventive_links (
  maintenance_order_id uuid PRIMARY KEY REFERENCES public.ops_maintenance_orders(id),
  plan_version_id uuid NOT NULL REFERENCES public.ops_preventive_plan_versions(id),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_space_availability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.ops_spaces(id),
  seq int NOT NULL CHECK (seq >= 1),
  status text NOT NULL CHECK (status IN ('disponivel','restrito','indisponivel')),
  effective_from date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  maintenance_order_id uuid REFERENCES public.ops_maintenance_orders(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, seq)
);
CREATE TABLE public.ops_safety_certificate_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  space_id uuid REFERENCES public.ops_spaces(id),
  kind text NOT NULL CHECK (length(btrim(kind)) BETWEEN 2 AND 80),
  issuer text NOT NULL CHECK (length(btrim(issuer)) >= 3),
  number_on_document text,
  issued_on date NOT NULL,
  valid_until date,
  doc_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= issued_on)
);

GRANT SELECT ON public.ops_preventive_plan_versions, public.ops_preventive_plan_approvals, public.ops_preventive_links, public.ops_space_availability_events TO authenticated;
GRANT SELECT (id, school_id, space_id, kind, issuer, number_on_document, issued_on, valid_until, author_person, idempotency_key, created_at) ON public.ops_safety_certificate_refs TO authenticated;
GRANT ALL ON public.ops_preventive_plan_versions, public.ops_preventive_plan_approvals, public.ops_preventive_links, public.ops_space_availability_events, public.ops_safety_certificate_refs TO service_role;
ALTER TABLE public.ops_preventive_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_preventive_plan_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_preventive_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_space_availability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_safety_certificate_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans by school" ON public.ops_preventive_plan_versions FOR SELECT TO authenticated USING (public.ops_can_read('infraestrutura', school_id));
CREATE POLICY "plan approvals by school" ON public.ops_preventive_plan_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_preventive_plan_versions v WHERE v.id = plan_version_id AND public.ops_can_read('infraestrutura', v.school_id)));
CREATE POLICY "links by school" ON public.ops_preventive_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_preventive_plan_versions v WHERE v.id = plan_version_id AND public.ops_can_read('infraestrutura', v.school_id)));
CREATE POLICY "availability by school" ON public.ops_space_availability_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = space_id AND public.ops_can_read('infraestrutura', s.school_id)));
CREATE POLICY "certificates by school" ON public.ops_safety_certificate_refs FOR SELECT TO authenticated USING (public.ops_can_read('infraestrutura', school_id));
CREATE TRIGGER opspp_immutable BEFORE UPDATE OR DELETE ON public.ops_preventive_plan_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsppa_immutable BEFORE UPDATE OR DELETE ON public.ops_preventive_plan_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opspl_immutable BEFORE UPDATE OR DELETE ON public.ops_preventive_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssa_immutable BEFORE UPDATE OR DELETE ON public.ops_space_availability_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opssc_immutable BEFORE UPDATE OR DELETE ON public.ops_safety_certificate_refs FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_ops_preventive_plan(_key text, _expected_version int, _school text, _space uuid, _activity text, _days int,
  _basis_kind text, _basis_ref text, _starts date, _active boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opspp:no-person'; END IF;
  IF NOT public.has_school_capability('configurar-planos-preventivos', _school) THEN RAISE EXCEPTION 'opspp:forbidden'; END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _school) THEN RAISE EXCEPTION 'opspp:invalid-space'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_preventive_plan_versions WHERE plan_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opspp:conflict'; END IF;
  IF _last > 0 AND EXISTS (SELECT 1 FROM public.ops_preventive_plan_versions WHERE plan_key = _key AND school_id <> _school) THEN RAISE EXCEPTION 'opspp:school-change'; END IF;
  INSERT INTO public.ops_preventive_plan_versions(plan_key, version, school_id, space_id, activity, periodicity_days, basis_kind, basis_ref, starts_on, active, author_person, reason)
  VALUES (_key, _last + 1, _school, _space, btrim(_activity), _days, _basis_kind, btrim(_basis_ref), _starts, coalesce(_active, true), _p, nullif(btrim(_reason),''))
  RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opspp:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_preventive_plan(_pv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.ops_preventive_plan_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opspp:no-person'; END IF;
  SELECT * INTO _v FROM public.ops_preventive_plan_versions WHERE id = _pv;
  IF _v.id IS NULL OR NOT public.has_school_capability('aprovar-planos-preventivos', _v.school_id) THEN RAISE EXCEPTION 'opspp:approve-forbidden'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'opspp:self-approval'; END IF;
  INSERT INTO public.ops_preventive_plan_approvals(plan_version_id, approver_person, decision_ref) VALUES (_pv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opspp:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opspp:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.link_ops_preventive_order(_mo uuid, _pv uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _school text; _v public.ops_preventive_plan_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opspp:no-person'; END IF;
  SELECT r.school_id INTO _school FROM public.ops_maintenance_orders o JOIN public.ops_requests r ON r.id = o.request_id WHERE o.id = _mo;
  SELECT * INTO _v FROM public.ops_preventive_plan_versions WHERE id = _pv;
  IF _school IS NULL OR _v.id IS NULL OR _v.school_id <> _school OR NOT public.has_school_capability('triar-manutencao', _school) THEN RAISE EXCEPTION 'opspp:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_preventive_plan_approvals a WHERE a.plan_version_id = _pv)
     OR _v.version <> (SELECT max(version) FROM public.ops_preventive_plan_versions x WHERE x.plan_key = _v.plan_key) OR NOT _v.active THEN
    RAISE EXCEPTION 'opspp:plan-not-approved'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_preventive_links l WHERE l.maintenance_order_id = _mo) THEN RETURN; END IF;
  INSERT INTO public.ops_preventive_links(maintenance_order_id, plan_version_id, author_person) VALUES (_mo, _pv, _p);
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_space_availability(_space uuid, _expected_seq int, _status text, _from date, _reason text, _mo uuid, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s public.ops_spaces; _last int; _seq int; _prev date;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssa:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_space_availability_events WHERE idempotency_key = _key AND space_id = _space;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _s FROM public.ops_spaces WHERE id = _space FOR UPDATE;
  IF _s.id IS NULL OR NOT public.has_school_capability('manter-espacos-escolares', _s.school_id) THEN RAISE EXCEPTION 'opssa:unavailable'; END IF;
  SELECT coalesce(max(seq),0), max(effective_from) INTO _last, _prev FROM public.ops_space_availability_events WHERE space_id = _space;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opssa:conflict'; END IF;
  IF _prev IS NOT NULL AND _from < _prev THEN RAISE EXCEPTION 'opssa:retroactive'; END IF;
  IF _mo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_maintenance_orders o JOIN public.ops_requests r ON r.id = o.request_id WHERE o.id = _mo AND r.school_id = _s.school_id) THEN
    RAISE EXCEPTION 'opssa:invalid-order'; END IF;
  INSERT INTO public.ops_space_availability_events(space_id, seq, status, effective_from, reason, maintenance_order_id, author_person, idempotency_key)
  VALUES (_space, _last + 1, _status, _from, btrim(_reason), _mo, _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opssa:invalid';
END $$;

-- Certificado só existe como referência a documento JÁ juntado no SIGEM Documentos, com emissor e número do próprio documento.
CREATE OR REPLACE FUNCTION public.register_ops_safety_certificate(_school text, _space uuid, _kind text, _issuer text, _number text, _issued date, _valid_until date, _doc uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opssc:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_safety_certificate_refs WHERE idempotency_key = _key AND school_id = _school;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('registrar-certificados-de-seguranca', _school) THEN RAISE EXCEPTION 'opssc:unavailable'; END IF;
  IF _issued > current_date THEN RAISE EXCEPTION 'opssc:invalid-date'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_case_events ce WHERE ce.id = _doc) THEN RAISE EXCEPTION 'opssc:document-required'; END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _school) THEN RAISE EXCEPTION 'opssc:invalid-space'; END IF;
  INSERT INTO public.ops_safety_certificate_refs(school_id, space_id, kind, issuer, number_on_document, issued_on, valid_until, doc_ref, author_person, idempotency_key)
  VALUES (_school, _space, btrim(_kind), btrim(_issuer), nullif(btrim(_number),''), _issued, _valid_until, _doc, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opssc:invalid';
END $$;

REVOKE ALL ON FUNCTION public.register_ops_preventive_plan(text,int,text,uuid,text,int,text,text,date,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_preventive_plan(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_ops_preventive_order(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_space_availability(uuid,int,text,date,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_ops_safety_certificate(text,uuid,text,text,text,date,date,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ops_preventive_plan(text,int,text,uuid,text,int,text,text,date,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_preventive_plan(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_ops_preventive_order(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_space_availability(uuid,int,text,date,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_ops_safety_certificate(text,uuid,text,text,text,date,date,uuid,text) TO authenticated;
