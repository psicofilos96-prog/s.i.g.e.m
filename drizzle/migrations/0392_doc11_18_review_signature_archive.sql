-- L11 revisão/aprovação de versão de ato (separada de assinatura)
CREATE TABLE public.admin_act_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  act_version_id uuid NOT NULL REFERENCES public.admin_case_act_versions(id),
  verdict text NOT NULL CHECK (verdict IN ('aprovado','devolvido')),
  justification text,
  reviewer_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verdict <> 'devolvido' OR length(btrim(coalesce(justification,''))) >= 10)
);
CREATE UNIQUE INDEX admin_act_reviews_one_per_reviewer ON public.admin_act_reviews(act_version_id, reviewer_person);
-- L12 assinatura eletrônica simples (nunca qualificada sem evidência)
CREATE TABLE public.admin_act_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  act_version_id uuid NOT NULL REFERENCES public.admin_case_act_versions(id),
  signer_person uuid NOT NULL,
  signature_level text NOT NULL DEFAULT 'simples' CHECK (signature_level IN ('simples','avancada','qualificada')),
  qualified_evidence_ref text,
  signed_content_sha256 text NOT NULL,
  evidence jsonb NOT NULL,
  verification_code text NOT NULL UNIQUE,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (act_version_id, signer_person),
  CHECK (signature_level = 'simples' OR qualified_evidence_ref IS NOT NULL)
);
-- L17 classificação e temporalidade (sem descarte automático)
CREATE TABLE public.admin_case_archival_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.admin_case_files(id),
  event_type text NOT NULL CHECK (event_type IN ('classificado','arquivado_corrente','transferido_intermediario','recolhido_permanente','eliminacao_proposta','eliminacao_autorizada')),
  classification_code text,
  retention_rule_ref text,
  decision_ref text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type NOT IN ('eliminacao_autorizada','recolhido_permanente') OR decision_ref IS NOT NULL)
);
-- L18 digitalização com proveniência e conferência
CREATE TABLE public.admin_case_digitizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_event_id uuid NOT NULL UNIQUE REFERENCES public.admin_case_events(id),
  original_description text NOT NULL,
  original_custody text NOT NULL,
  device_ref text,
  digitized_by_person uuid NOT NULL,
  digitized_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_case_digitization_conferences (
  digitization_id uuid PRIMARY KEY REFERENCES public.admin_case_digitizations(id),
  result text NOT NULL CHECK (result IN ('conforme','divergente')),
  note text,
  conferred_by_person uuid NOT NULL,
  conferred_at timestamptz NOT NULL DEFAULT now()
);
-- L19 acesso granular (concessão com finalidade e vigência)
CREATE TABLE public.admin_case_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.admin_case_files(id),
  grantee_person uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('leitura','leitura_anexos_sensiveis')),
  purpose text NOT NULL CHECK (length(btrim(purpose)) >= 5),
  valid_until date NOT NULL,
  granted_by_person uuid NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_case_access_revocations (
  grant_id uuid PRIMARY KEY REFERENCES public.admin_case_access_grants(id),
  reason text NOT NULL,
  revoked_by_person uuid NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
-- L14 regras de prazo configuráveis (sem semente)
CREATE TABLE public.admin_case_deadline_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL,
  version int NOT NULL,
  classification_code text NOT NULL,
  days int NOT NULL CHECK (days BETWEEN 1 AND 3650),
  day_kind text NOT NULL CHECK (day_kind IN ('corridos','uteis')),
  status text NOT NULL CHECK (status IN ('rascunho','aprovada','revogada')),
  decision_ref text,
  created_by_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, version),
  CHECK (status <> 'aprovada' OR decision_ref IS NOT NULL)
);

GRANT SELECT ON public.admin_act_reviews, public.admin_act_signatures, public.admin_case_archival_events, public.admin_case_digitizations,
  public.admin_case_digitization_conferences, public.admin_case_access_grants, public.admin_case_access_revocations, public.admin_case_deadline_rules TO authenticated;
GRANT ALL ON public.admin_act_reviews, public.admin_act_signatures, public.admin_case_archival_events, public.admin_case_digitizations,
  public.admin_case_digitization_conferences, public.admin_case_access_grants, public.admin_case_access_revocations, public.admin_case_deadline_rules TO service_role;
ALTER TABLE public.admin_act_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_act_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_archival_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_digitizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_digitization_conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_access_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_deadline_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews follow version" ON public.admin_act_reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_case_act_versions v WHERE v.id = act_version_id));
CREATE POLICY "signatures follow version" ON public.admin_act_signatures FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_case_act_versions v WHERE v.id = act_version_id));
CREATE POLICY "archival follows case" ON public.admin_case_archival_events FOR SELECT TO authenticated USING (public.admin_case_readable(case_id));
CREATE POLICY "digitization follows event" ON public.admin_case_digitizations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_case_events e WHERE e.id = case_event_id));
CREATE POLICY "conference follows digitization" ON public.admin_case_digitization_conferences FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_case_digitizations d WHERE d.id = digitization_id));
CREATE POLICY "grants visible to grantee or case readers" ON public.admin_case_access_grants FOR SELECT TO authenticated
  USING (grantee_person = public.current_person_id() OR public.case_can_act((SELECT c.unit_id FROM public.admin_case_files c WHERE c.id = case_id), 'instruir-processos'));
CREATE POLICY "revocations follow grant" ON public.admin_case_access_revocations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_case_access_grants g WHERE g.id = grant_id));
CREATE POLICY "deadline rules readable" ON public.admin_case_deadline_rules FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['admin_act_reviews','admin_act_signatures','admin_case_archival_events','admin_case_digitizations','admin_case_digitization_conferences','admin_case_access_revocations','admin_case_deadline_rules'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only()', t || '_immutable', t);
  END LOOP;
  EXECUTE 'CREATE TRIGGER admin_case_access_grants_immutable BEFORE UPDATE OR DELETE ON public.admin_case_access_grants FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only()';
END $$;

-- L19: leitura por concessão vigente e não revogada
CREATE OR REPLACE FUNCTION public.admin_case_granted(_case_id uuid, _scope text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_case_access_grants g WHERE g.case_id = _case_id AND g.grantee_person = public.current_person_id()
    AND g.valid_until >= current_date AND (g.scope = _scope OR g.scope = 'leitura_anexos_sensiveis')
    AND NOT EXISTS (SELECT 1 FROM public.admin_case_access_revocations r WHERE r.grant_id = g.id)) $$;
CREATE POLICY "case readable by grant" ON public.admin_case_files FOR SELECT TO authenticated USING (public.admin_case_granted(id, 'leitura'));
CREATE OR REPLACE FUNCTION public.admin_case_readable(_case_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.admin_case_granted(_case_id, 'leitura') OR EXISTS (SELECT 1 FROM public.admin_case_files c WHERE c.id = _case_id AND (
    public.case_can_act(c.unit_id, 'instruir-processos') OR c.opened_by_person = public.current_person_id()
    OR EXISTS (SELECT 1 FROM public.admin_case_dispatches d WHERE d.case_id = c.id AND public.case_can_act(d.to_unit_id, 'instruir-processos')))) $$;

CREATE OR REPLACE FUNCTION public.grant_admin_case_access(_case_id uuid, _grantee uuid, _scope text, _purpose text, _valid_until date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'grant:no-person'; END IF;
  IF NOT public.case_can_act(public.admin_case_current_unit(_case_id), 'conceder-acesso-processos') THEN RAISE EXCEPTION 'grant:forbidden'; END IF;
  IF _valid_until < current_date OR _valid_until > current_date + 366 THEN RAISE EXCEPTION 'grant:invalid-validity'; END IF;
  IF _grantee = _p THEN RAISE EXCEPTION 'grant:self-grant'; END IF;
  INSERT INTO public.admin_case_access_grants(case_id, grantee_person, scope, purpose, valid_until, granted_by_person)
  VALUES (_case_id, _grantee, _scope, btrim(_purpose), _valid_until, _p) RETURNING id INTO _id;
  RETURN _id;
END $$;
CREATE OR REPLACE FUNCTION public.revoke_admin_case_access(_grant_id uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c uuid;
BEGIN
  SELECT case_id INTO _c FROM public.admin_case_access_grants WHERE id = _grant_id;
  IF _p IS NULL OR _c IS NULL OR NOT public.case_can_act(public.admin_case_current_unit(_c), 'conceder-acesso-processos') THEN RAISE EXCEPTION 'grant:forbidden'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'grant:reason-required'; END IF;
  INSERT INTO public.admin_case_access_revocations(grant_id, reason, revoked_by_person) VALUES (_grant_id, btrim(_reason), _p);
END $$;

-- L11
CREATE OR REPLACE FUNCTION public.review_admin_act_version(_act_version_id uuid, _verdict text, _justification text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.admin_case_act_versions; _case uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'review:no-person'; END IF;
  SELECT * INTO _v FROM public.admin_case_act_versions WHERE id = _act_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'review:not-found'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'review:self-review'; END IF;
  SELECT case_id INTO _case FROM public.admin_case_acts WHERE id = _v.act_id;
  IF NOT public.case_can_act(public.admin_case_current_unit(_case), 'revisar-atos-processuais') THEN RAISE EXCEPTION 'review:forbidden'; END IF;
  INSERT INTO public.admin_act_reviews(act_version_id, verdict, justification, reviewer_person) VALUES (_act_version_id, _verdict, nullif(btrim(_justification),''), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'review:already-reviewed'; WHEN check_violation THEN RAISE EXCEPTION 'review:justification-required';
END $$;

-- L12: só a versão vigente, aprovada e não devolvida; assinante = autor ou competente pela espécie
CREATE OR REPLACE FUNCTION public.sign_admin_act_version(_act_version_id uuid, _user_agent text)
RETURNS TABLE(verification_code text, signed_content_sha256 text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.admin_case_act_versions; _a public.admin_case_acts; _max int; _code text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sign:no-person'; END IF;
  SELECT * INTO _v FROM public.admin_case_act_versions WHERE id = _act_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sign:not-found'; END IF;
  SELECT * INTO _a FROM public.admin_case_acts WHERE id = _v.act_id;
  SELECT max(version) INTO _max FROM public.admin_case_act_versions WHERE act_id = _v.act_id;
  IF _v.version <> _max THEN RAISE EXCEPTION 'sign:not-current-version'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_act_reviews r WHERE r.act_version_id = _v.id AND r.verdict = 'aprovado')
     OR EXISTS (SELECT 1 FROM public.admin_act_reviews r WHERE r.act_version_id = _v.id AND r.verdict = 'devolvido') THEN
    RAISE EXCEPTION 'sign:not-approved'; END IF;
  IF NOT public.case_can_act(_a.unit_id, _v.competence_capability) THEN RAISE EXCEPTION 'sign:forbidden'; END IF;
  _code := encode(extensions.gen_random_bytes(12), 'hex');
  INSERT INTO public.admin_act_signatures(act_version_id, signer_person, signed_content_sha256, evidence, verification_code)
  VALUES (_v.id, _p, _v.content_sha256,
    jsonb_build_object('auth_uid', auth.uid(), 'session_aal', coalesce(auth.jwt()->>'aal',''), 'user_agent', left(coalesce(_user_agent,''),200), 'competence', _v.competence_capability), _code);
  RETURN QUERY SELECT _code, _v.content_sha256;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'sign:already-signed';
END $$;

-- L13: verificação pública mínima por código opaco (resposta igual para inválido e inexistente)
CREATE OR REPLACE FUNCTION public.verify_admin_act_signature(_code text)
RETURNS TABLE(status text, act_kind text, case_number text, version int, signed_content_sha256 text, signature_level text, signed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'valido'::text, a.act_kind, c.case_number, v.version, s.signed_content_sha256, s.signature_level, s.signed_at
  FROM public.admin_act_signatures s JOIN public.admin_case_act_versions v ON v.id = s.act_version_id
  JOIN public.admin_case_acts a ON a.id = v.act_id JOIN public.admin_case_files c ON c.id = a.case_id
  WHERE _code ~ '^[0-9a-f]{24}$' AND s.verification_code = _code
  UNION ALL SELECT 'indisponivel', NULL, NULL, NULL, NULL, NULL, NULL
  WHERE NOT EXISTS (SELECT 1 FROM public.admin_act_signatures s WHERE _code ~ '^[0-9a-f]{24}$' AND s.verification_code = _code) $$;

-- L17
CREATE OR REPLACE FUNCTION public.record_admin_case_archival(_case_id uuid, _event_type text, _classification_code text, _retention_rule_ref text, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _proposer uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'archive:no-person'; END IF;
  IF NOT public.case_can_act(public.admin_case_current_unit(_case_id), 'gerir-arquivo-documental') THEN RAISE EXCEPTION 'archive:forbidden'; END IF;
  IF _event_type = 'eliminacao_autorizada' THEN
    SELECT author_person INTO _proposer FROM public.admin_case_archival_events WHERE case_id = _case_id AND event_type = 'eliminacao_proposta' ORDER BY created_at DESC LIMIT 1;
    IF _proposer IS NULL THEN RAISE EXCEPTION 'archive:no-proposal'; END IF;
    IF _proposer = _p THEN RAISE EXCEPTION 'archive:same-person'; END IF;
  END IF;
  IF _event_type = 'eliminacao_proposta' AND coalesce(btrim(_retention_rule_ref),'') = '' THEN RAISE EXCEPTION 'archive:no-retention-rule'; END IF;
  INSERT INTO public.admin_case_archival_events(case_id, event_type, classification_code, retention_rule_ref, decision_ref, author_person)
  VALUES (_case_id, _event_type, nullif(btrim(_classification_code),''), nullif(btrim(_retention_rule_ref),''), nullif(btrim(_decision_ref),''), _p);
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'archive:decision-required';
END $$;

-- L18
CREATE OR REPLACE FUNCTION public.record_admin_digitization(_case_event_id uuid, _original_description text, _original_custody text, _device_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _case uuid; _id uuid;
BEGIN
  SELECT case_id INTO _case FROM public.admin_case_events WHERE id = _case_event_id AND event_type = 'documento_juntado';
  IF _p IS NULL OR _case IS NULL OR NOT public.case_can_act(public.admin_case_current_unit(_case), 'instruir-processos') THEN RAISE EXCEPTION 'digitize:forbidden'; END IF;
  IF length(btrim(coalesce(_original_description,''))) < 5 OR length(btrim(coalesce(_original_custody,''))) < 3 THEN RAISE EXCEPTION 'digitize:provenance-required'; END IF;
  INSERT INTO public.admin_case_digitizations(case_event_id, original_description, original_custody, device_ref, digitized_by_person)
  VALUES (_case_event_id, btrim(_original_description), btrim(_original_custody), nullif(btrim(_device_ref),''), _p) RETURNING id INTO _id;
  RETURN _id;
END $$;
CREATE OR REPLACE FUNCTION public.confer_admin_digitization(_digitization_id uuid, _result text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _d public.admin_case_digitizations; _case uuid;
BEGIN
  SELECT * INTO _d FROM public.admin_case_digitizations WHERE id = _digitization_id;
  IF _p IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'digitize:forbidden'; END IF;
  IF _d.digitized_by_person = _p THEN RAISE EXCEPTION 'digitize:same-person'; END IF;
  SELECT case_id INTO _case FROM public.admin_case_events WHERE id = _d.case_event_id;
  IF NOT public.case_can_act(public.admin_case_current_unit(_case), 'instruir-processos') THEN RAISE EXCEPTION 'digitize:forbidden'; END IF;
  IF _result = 'divergente' AND length(btrim(coalesce(_note,''))) < 10 THEN RAISE EXCEPTION 'digitize:note-required'; END IF;
  INSERT INTO public.admin_case_digitization_conferences(digitization_id, result, note, conferred_by_person) VALUES (_digitization_id, _result, nullif(btrim(_note),''), _p);
END $$;

-- L14
CREATE OR REPLACE FUNCTION public.register_admin_deadline_rule(_rule_key text, _expected_version int, _classification_code text, _days int, _day_kind text, _status text, _decision_ref text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int;
BEGIN
  IF _p IS NULL OR NOT public.has_network_capability('configurar-prazos-documentais') THEN RAISE EXCEPTION 'deadline:forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('deadline|' || _rule_key, 0));
  SELECT coalesce(max(version),0) INTO _last FROM public.admin_case_deadline_rules WHERE rule_key = _rule_key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'deadline:stale-base'; END IF;
  INSERT INTO public.admin_case_deadline_rules(rule_key, version, classification_code, days, day_kind, status, decision_ref, created_by_person)
  VALUES (_rule_key, _last+1, _classification_code, _days, _day_kind, _status, nullif(btrim(_decision_ref),''), _p);
  RETURN _last+1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'deadline:decision-required';
END $$;

-- L16: pesquisa documental só sobre processos legíveis; metadados sensíveis nunca retornam
CREATE OR REPLACE FUNCTION public.search_admin_cases(_term text, _classification text, _year int)
RETURNS TABLE(case_id uuid, case_number text, subject text, classification_code text, unit_id text, opened_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.id, c.case_number, c.subject, c.classification_code, c.unit_id, c.opened_at FROM public.admin_case_files c
  WHERE (coalesce(_term,'') = '' OR c.case_number ILIKE '%' || _term || '%' OR c.subject ILIKE '%' || _term || '%')
    AND (coalesce(_classification,'') = '' OR c.classification_code = _classification)
    AND (_year IS NULL OR c.year = _year)
  ORDER BY c.opened_at DESC, c.id LIMIT 200 $$;

REVOKE ALL ON FUNCTION public.admin_case_granted(uuid,text), public.grant_admin_case_access(uuid,uuid,text,text,date), public.revoke_admin_case_access(uuid,text),
  public.review_admin_act_version(uuid,text,text), public.sign_admin_act_version(uuid,text), public.verify_admin_act_signature(text),
  public.record_admin_case_archival(uuid,text,text,text,text), public.record_admin_digitization(uuid,text,text,text), public.confer_admin_digitization(uuid,text,text),
  public.register_admin_deadline_rule(text,int,text,int,text,text,text), public.search_admin_cases(text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_case_granted(uuid,text), public.grant_admin_case_access(uuid,uuid,text,text,date), public.revoke_admin_case_access(uuid,text),
  public.review_admin_act_version(uuid,text,text), public.sign_admin_act_version(uuid,text), public.verify_admin_act_signature(text),
  public.record_admin_case_archival(uuid,text,text,text,text), public.record_admin_digitization(uuid,text,text,text), public.confer_admin_digitization(uuid,text,text),
  public.register_admin_deadline_rule(text,int,text,int,text,text,text), public.search_admin_cases(text,text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_act_signature(text) TO anon;