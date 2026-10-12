-- Centro de Operações L05: ordem de manutenção sobre a solicitação do L02 (setor infraestrutura).
-- Etapas com transições impostas no banco; categoria/urgência só do catálogo aprovado; executor = atuação;
-- conferência por pessoa ≠ executor; evidências só juntadas do SIGEM Documentos (coluna oculta).

CREATE TABLE public.ops_maintenance_catalog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key text NOT NULL CHECK (catalog_key ~ '^[a-z0-9-]{2,60}$'),
  version int NOT NULL CHECK (version >= 1),
  categories text[] NOT NULL CHECK (cardinality(categories) >= 1),
  urgencies text[] NOT NULL CHECK (cardinality(urgencies) >= 1),
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_key, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.ops_maintenance_catalog_approvals (
  catalog_version_id uuid PRIMARY KEY REFERENCES public.ops_maintenance_catalog_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ops_maintenance_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.ops_requests(id),
  catalog_version_id uuid NOT NULL REFERENCES public.ops_maintenance_catalog_versions(id),
  space_id uuid REFERENCES public.ops_spaces(id),
  protocol_ref uuid REFERENCES public.protocol_registrations(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ops_maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.ops_maintenance_orders(id),
  seq int NOT NULL CHECK (seq >= 1),
  stage text NOT NULL CHECK (stage IN ('triagem','devolucao','classificacao','avaliacao-tecnica','programacao','execucao','conferencia','conclusao','cancelamento')),
  category text,
  urgency text,
  urgency_reason text CHECK (urgency_reason IS NULL OR length(btrim(urgency_reason)) >= 10),
  technical_assessment text CHECK (technical_assessment IS NULL OR length(btrim(technical_assessment)) >= 10),
  requires_technical_report boolean,
  scheduled_for date,
  executor_engagement uuid REFERENCES public.institutional_engagements(id),
  executed_on date,
  conference_result text CHECK (conference_result IS NULL OR conference_result IN ('aprovada','reprovada')),
  evidence_refs uuid[] NOT NULL DEFAULT '{}',
  note text CHECK (note IS NULL OR length(btrim(note)) >= 10),
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, seq),
  CHECK (stage <> 'classificacao' OR (category IS NOT NULL AND urgency IS NOT NULL AND urgency_reason IS NOT NULL)),
  CHECK (stage <> 'avaliacao-tecnica' OR (technical_assessment IS NOT NULL AND requires_technical_report IS NOT NULL)),
  CHECK (stage <> 'programacao' OR (scheduled_for IS NOT NULL AND executor_engagement IS NOT NULL)),
  CHECK (stage <> 'execucao' OR executed_on IS NOT NULL),
  CHECK (stage <> 'conferencia' OR conference_result IS NOT NULL),
  CHECK (stage NOT IN ('devolucao','cancelamento') OR note IS NOT NULL),
  CHECK (conference_result IS DISTINCT FROM 'reprovada' OR note IS NOT NULL)
);

GRANT SELECT ON public.ops_maintenance_catalog_versions, public.ops_maintenance_catalog_approvals, public.ops_maintenance_orders TO authenticated;
GRANT ALL ON public.ops_maintenance_catalog_versions, public.ops_maintenance_catalog_approvals, public.ops_maintenance_orders, public.ops_maintenance_events TO service_role;
REVOKE SELECT ON public.ops_maintenance_events FROM authenticated;
GRANT SELECT (id, order_id, seq, stage, category, urgency, urgency_reason, technical_assessment, requires_technical_report, scheduled_for,
  executor_engagement, executed_on, conference_result, note, actor_person, idempotency_key, created_at) ON public.ops_maintenance_events TO authenticated;
ALTER TABLE public.ops_maintenance_catalog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_maintenance_catalog_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_maintenance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_maintenance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mcat readable by persons" ON public.ops_maintenance_catalog_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "mcat approvals readable by persons" ON public.ops_maintenance_catalog_approvals FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "morders follow request" ON public.ops_maintenance_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = request_id AND (r.requester_person = public.current_person_id() OR public.ops_can_read(r.sector, r.school_id))));
CREATE POLICY "mevents follow order" ON public.ops_maintenance_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_maintenance_orders o JOIN public.ops_requests r ON r.id = o.request_id WHERE o.id = order_id
    AND (r.requester_person = public.current_person_id() OR public.ops_can_read(r.sector, r.school_id))));

CREATE TRIGGER opsmc_immutable BEFORE UPDATE OR DELETE ON public.ops_maintenance_catalog_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsmca_immutable BEFORE UPDATE OR DELETE ON public.ops_maintenance_catalog_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsmo_immutable BEFORE UPDATE OR DELETE ON public.ops_maintenance_orders FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsme_immutable BEFORE UPDATE OR DELETE ON public.ops_maintenance_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_ops_maintenance_catalog(_key text, _expected_version int, _categories text[], _urgencies text[], _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmc:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-catalogo-de-manutencao') THEN RAISE EXCEPTION 'opsmc:forbidden'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_maintenance_catalog_versions WHERE catalog_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opsmc:conflict'; END IF;
  INSERT INTO public.ops_maintenance_catalog_versions(catalog_key, version, categories, urgencies, author_person, reason)
  VALUES (_key, _last + 1, _categories, _urgencies, _p, nullif(btrim(_reason),'')) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsmc:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_maintenance_catalog(_cv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmc:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-catalogo-de-manutencao') THEN RAISE EXCEPTION 'opsmc:approve-forbidden'; END IF;
  SELECT author_person INTO _author FROM public.ops_maintenance_catalog_versions WHERE id = _cv;
  IF _author IS NULL THEN RAISE EXCEPTION 'opsmc:unavailable'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'opsmc:self-approval'; END IF;
  INSERT INTO public.ops_maintenance_catalog_approvals(catalog_version_id, approver_person, decision_ref) VALUES (_cv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsmc:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opsmc:invalid';
END $$;

-- Abertura pela Direção: quem abre a ordem é o próprio solicitante do L02 com `solicitar-manutencao` na escola.
CREATE OR REPLACE FUNCTION public.open_ops_maintenance_order(_request uuid, _catalog uuid, _space uuid, _protocol uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.ops_requests; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmo:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_maintenance_orders WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _request;
  IF _r.id IS NULL OR _r.sector <> 'infraestrutura' OR _r.requester_person <> _p OR NOT public.has_school_capability('solicitar-manutencao', _r.school_id) THEN
    RAISE EXCEPTION 'opsmo:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_maintenance_catalog_versions c JOIN public.ops_maintenance_catalog_approvals a ON a.catalog_version_id = c.id
    WHERE c.id = _catalog AND c.version = (SELECT max(version) FROM public.ops_maintenance_catalog_versions x WHERE x.catalog_key = c.catalog_key)) THEN
    RAISE EXCEPTION 'opsmo:catalog-not-approved'; END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _r.school_id) THEN RAISE EXCEPTION 'opsmo:invalid-space'; END IF;
  INSERT INTO public.ops_maintenance_orders(request_id, catalog_version_id, space_id, protocol_ref, author_person, idempotency_key)
  VALUES (_request, _catalog, _space, _protocol, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsmo:already-open';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'opsmo:invalid';
END $$;

-- Transições permitidas (estrutura do fluxo; quem pode é capacidade, nunca cargo).
CREATE OR REPLACE FUNCTION public.ops_maintenance_next_ok(_last text, _stage text, _last_result text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN _stage = 'cancelamento' THEN coalesce(_last,'') NOT IN ('conclusao','cancelamento','devolucao')
    WHEN _last IS NULL THEN _stage = 'triagem'
    WHEN _last = 'triagem' THEN _stage IN ('classificacao','devolucao')
    WHEN _last = 'classificacao' THEN _stage IN ('avaliacao-tecnica','classificacao')
    WHEN _last = 'avaliacao-tecnica' THEN _stage IN ('programacao','classificacao')
    WHEN _last = 'programacao' THEN _stage IN ('execucao','programacao')
    WHEN _last = 'execucao' THEN _stage = 'conferencia'
    WHEN _last = 'conferencia' AND _last_result = 'aprovada' THEN _stage = 'conclusao'
    WHEN _last = 'conferencia' AND _last_result = 'reprovada' THEN _stage IN ('execucao','programacao')
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.record_ops_maintenance_event(_order uuid, _expected_seq int, _stage text, _category text, _urgency text, _urgency_reason text,
  _assessment text, _requires_report boolean, _scheduled_for date, _executor uuid, _executed_on date, _result text, _evidence uuid[], _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _o public.ops_maintenance_orders; _r public.ops_requests; _c public.ops_maintenance_catalog_versions;
  _last int; _seq int; _lstage text; _lresult text; _cap text; _exec uuid; _exec_person uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsmo:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_maintenance_events WHERE idempotency_key = _key AND order_id = _order;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _o FROM public.ops_maintenance_orders WHERE id = _order FOR UPDATE;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'opsmo:unavailable'; END IF;
  SELECT * INTO _r FROM public.ops_requests WHERE id = _o.request_id;
  _cap := CASE _stage WHEN 'triagem' THEN 'triar-manutencao' WHEN 'devolucao' THEN 'triar-manutencao' WHEN 'classificacao' THEN 'triar-manutencao'
    WHEN 'avaliacao-tecnica' THEN 'avaliar-manutencao' WHEN 'programacao' THEN 'programar-manutencao' WHEN 'execucao' THEN 'executar-manutencao'
    WHEN 'conferencia' THEN 'conferir-manutencao' WHEN 'conclusao' THEN 'conferir-manutencao' WHEN 'cancelamento' THEN 'triar-manutencao' END;
  IF _cap IS NULL OR NOT public.has_school_capability(_cap, _r.school_id) THEN RAISE EXCEPTION 'opsmo:unavailable'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_maintenance_events WHERE order_id = _order;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsmo:conflict'; END IF;
  SELECT stage, conference_result INTO _lstage, _lresult FROM public.ops_maintenance_events WHERE order_id = _order AND seq = _last;
  IF NOT public.ops_maintenance_next_ok(_lstage, _stage, _lresult) THEN RAISE EXCEPTION 'opsmo:invalid-transition'; END IF;
  SELECT * INTO _c FROM public.ops_maintenance_catalog_versions WHERE id = _o.catalog_version_id;
  IF _stage = 'classificacao' AND (NOT (_category = ANY (_c.categories)) OR NOT (_urgency = ANY (_c.urgencies))) THEN RAISE EXCEPTION 'opsmo:not-in-catalog'; END IF;
  IF _stage = 'programacao' THEN
    IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _executor AND e.school_id = _r.school_id
      AND e.valid_from <= _scheduled_for AND (e.valid_until IS NULL OR e.valid_until >= _scheduled_for)) THEN RAISE EXCEPTION 'opsmo:executor-not-active'; END IF;
  END IF;
  -- execução: só a pessoa da atuação programada; conferência: pessoa diferente de quem executou.
  SELECT executor_engagement INTO _exec FROM public.ops_maintenance_events WHERE order_id = _order AND stage = 'programacao' ORDER BY seq DESC LIMIT 1;
  SELECT person_id INTO _exec_person FROM public.institutional_engagements WHERE id = _exec;
  IF _stage = 'execucao' AND _exec_person IS DISTINCT FROM _p THEN RAISE EXCEPTION 'opsmo:not-executor'; END IF;
  IF _stage = 'conferencia' AND EXISTS (SELECT 1 FROM public.ops_maintenance_events WHERE order_id = _order AND stage = 'execucao' AND actor_person = _p) THEN
    RAISE EXCEPTION 'opsmo:self-conference'; END IF;
  IF (_executed_on IS NOT NULL AND _executed_on > current_date) THEN RAISE EXCEPTION 'opsmo:invalid-date'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_evidence,'{}')) ev WHERE NOT EXISTS (SELECT 1 FROM public.admin_case_events ce WHERE ce.id = ev)) THEN
    RAISE EXCEPTION 'opsmo:evidence-not-in-documents'; END IF;
  INSERT INTO public.ops_maintenance_events(order_id, seq, stage, category, urgency, urgency_reason, technical_assessment, requires_technical_report,
    scheduled_for, executor_engagement, executed_on, conference_result, evidence_refs, note, actor_person, idempotency_key)
  VALUES (_order, _last + 1, _stage,
    CASE WHEN _stage = 'classificacao' THEN _category END, CASE WHEN _stage = 'classificacao' THEN _urgency END, CASE WHEN _stage = 'classificacao' THEN nullif(btrim(_urgency_reason),'') END,
    CASE WHEN _stage = 'avaliacao-tecnica' THEN nullif(btrim(_assessment),'') END, CASE WHEN _stage = 'avaliacao-tecnica' THEN _requires_report END,
    CASE WHEN _stage = 'programacao' THEN _scheduled_for END, CASE WHEN _stage = 'programacao' THEN _executor END,
    CASE WHEN _stage = 'execucao' THEN _executed_on END, CASE WHEN _stage = 'conferencia' THEN _result END,
    coalesce(_evidence,'{}'), nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsmo:invalid';
END $$;

REVOKE ALL ON FUNCTION public.register_ops_maintenance_catalog(text,int,text[],text[],text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_maintenance_catalog(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_ops_maintenance_order(uuid,uuid,uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_maintenance_event(uuid,int,text,text,text,text,text,boolean,date,uuid,date,text,uuid[],text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ops_maintenance_catalog(text,int,text[],text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_maintenance_catalog(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_ops_maintenance_order(uuid,uuid,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_maintenance_event(uuid,int,text,text,text,text,text,boolean,date,uuid,date,text,uuid[],text,text) TO authenticated;
