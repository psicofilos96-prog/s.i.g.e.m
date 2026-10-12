-- Centro de Operações L19: motoristas/monitores = atuação institucional vigente (pessoa real) + designação com ato juntado
-- no SIGEM Documentos (nunca gerado aqui); habilitações por chave com validade e documento (sem número guardado); requisitos
-- por função são versão aprovada por pessoa ≠ autor; escala só com designação/atuação/rota vigentes e requisitos válidos.
CREATE TABLE public.ops_crew_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  role text NOT NULL CHECK (role IN ('motorista','monitor')),
  act_doc_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  valid_from date NOT NULL,
  valid_until date,
  designated_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE public.ops_crew_designation_revocations (
  designation_id uuid PRIMARY KEY REFERENCES public.ops_crew_designations(id),
  effective_on date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  act_doc_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  revoked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_crew_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designation_id uuid NOT NULL REFERENCES public.ops_crew_designations(id),
  cred_key text NOT NULL CHECK (cred_key ~ '^[a-z0-9-]{2,40}$'),
  valid_until date NOT NULL,
  doc_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  recorded_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_crew_requirement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('motorista','monitor')),
  version int NOT NULL CHECK (version >= 1),
  required_keys text[] NOT NULL CHECK (cardinality(required_keys) >= 1),
  basis_ref text NOT NULL CHECK (length(btrim(basis_ref)) >= 3),
  author_person uuid NOT NULL,
  approver_person uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, version)
);
CREATE TABLE public.ops_crew_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_version_id uuid NOT NULL REFERENCES public.ops_route_versions(id),
  vehicle_id uuid REFERENCES public.ops_vehicles(id),
  designation_id uuid NOT NULL REFERENCES public.ops_crew_designations(id),
  on_date date NOT NULL,
  requirement_version_id uuid NOT NULL REFERENCES public.ops_crew_requirement_versions(id),
  scheduled_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designation_id, on_date, route_version_id)
);
REVOKE ALL ON public.ops_crew_designations, public.ops_crew_designation_revocations, public.ops_crew_credentials, public.ops_crew_requirement_versions, public.ops_crew_shifts FROM anon, authenticated;
GRANT SELECT (id, engagement_id, role, valid_from, valid_until, designated_by, idempotency_key, created_at) ON public.ops_crew_designations TO authenticated;
GRANT SELECT (designation_id, effective_on, reason, revoked_by, created_at) ON public.ops_crew_designation_revocations TO authenticated;
GRANT SELECT (id, designation_id, cred_key, valid_until, recorded_by, idempotency_key, created_at) ON public.ops_crew_credentials TO authenticated;
GRANT SELECT ON public.ops_crew_requirement_versions, public.ops_crew_shifts TO authenticated;
GRANT ALL ON public.ops_crew_designations, public.ops_crew_designation_revocations, public.ops_crew_credentials, public.ops_crew_requirement_versions, public.ops_crew_shifts TO service_role;
ALTER TABLE public.ops_crew_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_crew_designation_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_crew_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_crew_requirement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_crew_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew designations" ON public.ops_crew_designations FOR SELECT TO authenticated
  USING (public.has_network_capability('designar-equipe-de-transporte') OR public.has_network_capability('escalar-transporte')
    OR EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = engagement_id AND e.person_id = public.current_person_id()));
CREATE POLICY "crew revocations" ON public.ops_crew_designation_revocations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_crew_designations d WHERE d.id = designation_id));
CREATE POLICY "crew credentials" ON public.ops_crew_credentials FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_crew_designations d WHERE d.id = designation_id));
CREATE POLICY "crew requirements" ON public.ops_crew_requirement_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "crew shifts" ON public.ops_crew_shifts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_crew_designations d WHERE d.id = designation_id));
CREATE TRIGGER opscd_immutable BEFORE UPDATE OR DELETE ON public.ops_crew_designations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opscdr_immutable BEFORE UPDATE OR DELETE ON public.ops_crew_designation_revocations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opscc_immutable BEFORE UPDATE OR DELETE ON public.ops_crew_credentials FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opscs_immutable BEFORE UPDATE OR DELETE ON public.ops_crew_shifts FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
-- Requisitos: só a aprovação (uma vez, pessoa ≠ autor) pode alterar a linha.
CREATE OR REPLACE FUNCTION public.ops_crew_req_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.approver_person IS NOT NULL OR NEW.approver_person IS NULL
     OR (NEW.role, NEW.version, NEW.required_keys, NEW.basis_ref, NEW.author_person) IS DISTINCT FROM (OLD.role, OLD.version, OLD.required_keys, OLD.basis_ref, OLD.author_person)
  THEN RAISE EXCEPTION 'opscrew:immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opscrv_guard BEFORE UPDATE OR DELETE ON public.ops_crew_requirement_versions FOR EACH ROW EXECUTE FUNCTION public.ops_crew_req_guard();

CREATE OR REPLACE FUNCTION public.designate_ops_crew(_engagement uuid, _role text, _act_doc uuid, _from date, _until date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _person uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscrew:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_crew_designations WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('designar-equipe-de-transporte') THEN RAISE EXCEPTION 'opscrew:forbidden'; END IF;
  SELECT person_id INTO _person FROM public.institutional_engagements e WHERE e.id = _engagement AND e.valid_from <= _from AND (e.valid_until IS NULL OR e.valid_until >= _from);
  IF _person IS NULL THEN RAISE EXCEPTION 'opscrew:engagement-not-active'; END IF;
  IF _person = _p THEN RAISE EXCEPTION 'opscrew:self-designation'; END IF;
  IF NOT public.ops_doc_is_attachment(_act_doc) THEN RAISE EXCEPTION 'opscrew:act-required'; END IF;
  INSERT INTO public.ops_crew_designations(engagement_id, role, act_doc_ref, valid_from, valid_until, designated_by, idempotency_key)
  VALUES (_engagement, _role, _act_doc, _from, _until, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opscrew:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.revoke_ops_crew_designation(_d uuid, _on date, _reason text, _act_doc uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscrew:no-person'; END IF;
  IF NOT public.has_network_capability('designar-equipe-de-transporte') THEN RAISE EXCEPTION 'opscrew:forbidden'; END IF;
  IF NOT public.ops_doc_is_attachment(_act_doc) THEN RAISE EXCEPTION 'opscrew:act-required'; END IF;
  INSERT INTO public.ops_crew_designation_revocations(designation_id, effective_on, reason, act_doc_ref, revoked_by) VALUES (_d, _on, btrim(_reason), _act_doc, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opscrew:already-revoked';
  WHEN check_violation THEN RAISE EXCEPTION 'opscrew:invalid';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'opscrew:not-found';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_crew_credential(_d uuid, _cred text, _until date, _doc uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscrew:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_crew_credentials WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('designar-equipe-de-transporte') THEN RAISE EXCEPTION 'opscrew:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_crew_designations WHERE id = _d) THEN RAISE EXCEPTION 'opscrew:not-found'; END IF;
  IF NOT public.ops_doc_is_attachment(_doc) THEN RAISE EXCEPTION 'opscrew:credential-doc-required'; END IF;
  INSERT INTO public.ops_crew_credentials(designation_id, cred_key, valid_until, doc_ref, recorded_by, idempotency_key)
  VALUES (_d, _cred, _until, _doc, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opscrew:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.register_ops_crew_requirement(_role text, _expected_version int, _keys text[], _basis text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscrew:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-requisitos-de-transporte') THEN RAISE EXCEPTION 'opscrew:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_keys) k WHERE k !~ '^[a-z0-9-]{2,40}$') THEN RAISE EXCEPTION 'opscrew:invalid-key'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_crew_requirement_versions WHERE role = _role;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opscrew:conflict'; END IF;
  INSERT INTO public.ops_crew_requirement_versions(role, version, required_keys, basis_ref, author_person) VALUES (_role, _last + 1, _keys, btrim(_basis), _p) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opscrew:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_crew_requirement(_rv uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.ops_crew_requirement_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscrew:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-requisitos-de-transporte') THEN RAISE EXCEPTION 'opscrew:approve-forbidden'; END IF;
  SELECT * INTO _v FROM public.ops_crew_requirement_versions WHERE id = _rv FOR UPDATE;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'opscrew:not-found'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'opscrew:self-approval'; END IF;
  IF _v.approver_person IS NOT NULL THEN RAISE EXCEPTION 'opscrew:already-approved'; END IF;
  UPDATE public.ops_crew_requirement_versions SET approver_person = _p, approved_at = now() WHERE id = _rv;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_ops_crew(_route_version uuid, _vehicle uuid, _d uuid, _on date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _des public.ops_crew_designations; _req public.ops_crew_requirement_versions; _rv public.ops_route_versions; _person uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsshift:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_crew_shifts WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('escalar-transporte') THEN RAISE EXCEPTION 'opsshift:forbidden'; END IF;
  SELECT * INTO _des FROM public.ops_crew_designations WHERE id = _d FOR UPDATE;
  IF _des.id IS NULL OR _des.valid_from > _on OR (_des.valid_until IS NOT NULL AND _des.valid_until < _on)
     OR EXISTS (SELECT 1 FROM public.ops_crew_designation_revocations r WHERE r.designation_id = _d AND r.effective_on <= _on) THEN RAISE EXCEPTION 'opsshift:designation-not-active'; END IF;
  SELECT person_id INTO _person FROM public.institutional_engagements e WHERE e.id = _des.engagement_id AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on);
  IF _person IS NULL THEN RAISE EXCEPTION 'opsshift:engagement-not-active'; END IF;
  SELECT v.* INTO _rv FROM public.ops_route_versions v JOIN public.ops_route_approvals a ON a.route_version_id = v.id
    WHERE v.id = _route_version AND v.valid_from <= _on AND (v.valid_until IS NULL OR v.valid_until >= _on);
  IF _rv.id IS NULL THEN RAISE EXCEPTION 'opsshift:route-not-approved'; END IF;
  IF _vehicle IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_vehicles WHERE id = _vehicle) THEN RAISE EXCEPTION 'opsshift:unknown-vehicle'; END IF;
  SELECT * INTO _req FROM public.ops_crew_requirement_versions WHERE role = _des.role AND approver_person IS NOT NULL ORDER BY version DESC LIMIT 1;
  IF _req.id IS NULL OR _req.version <> (SELECT max(version) FROM public.ops_crew_requirement_versions WHERE role = _des.role) THEN RAISE EXCEPTION 'opsshift:requirements-not-approved'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_req.required_keys) k WHERE NOT EXISTS (SELECT 1 FROM public.ops_crew_credentials c WHERE c.designation_id = _d AND c.cred_key = k AND c.valid_until >= _on))
    THEN RAISE EXCEPTION 'opsshift:credential-missing-or-expired'; END IF;
  -- Mesma pessoa em duas rotas do mesmo turno no mesmo dia é recusada.
  IF EXISTS (SELECT 1 FROM public.ops_crew_shifts s JOIN public.ops_crew_designations d2 ON d2.id = s.designation_id
      JOIN public.institutional_engagements e2 ON e2.id = d2.engagement_id JOIN public.ops_route_versions v2 ON v2.id = s.route_version_id
      WHERE e2.person_id = _person AND s.on_date = _on AND v2.shift_label = _rv.shift_label) THEN RAISE EXCEPTION 'opsshift:person-double-booked'; END IF;
  INSERT INTO public.ops_crew_shifts(route_version_id, vehicle_id, designation_id, on_date, requirement_version_id, scheduled_by, idempotency_key)
  VALUES (_route_version, _vehicle, _d, _on, _req.id, _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.ops_crew_req_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.designate_ops_crew(uuid,text,uuid,date,date,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_ops_crew_designation(uuid,date,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_crew_credential(uuid,text,date,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_ops_crew_requirement(text,int,text[],text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_crew_requirement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_ops_crew(uuid,uuid,uuid,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.designate_ops_crew(uuid,text,uuid,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_ops_crew_designation(uuid,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_crew_credential(uuid,text,date,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_ops_crew_requirement(text,int,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_crew_requirement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_ops_crew(uuid,uuid,uuid,date,text) TO authenticated;