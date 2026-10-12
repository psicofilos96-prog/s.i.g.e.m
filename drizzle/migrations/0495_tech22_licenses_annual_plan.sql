-- Tecnologia L22. Licença = direito de uso de serviço do catálogo L15 com contrato JUNTADO (coluna oculta), versão append-only
-- (quantidade, vigência); uso = acessos ativos do L16 (projeção). Plano anual de tecnologia = versão append-only por ano com
-- ações que só REFERENCIAM fatos canônicos; aprovado por pessoa ≠ autor; sem valor orçamentário (custo só de fonte contábil real).
CREATE TABLE public.tech_license_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  license_kind text NOT NULL CHECK (license_kind IN ('por-usuario','por-dispositivo','por-escola','rede','livre')),
  seats int CHECK (seats >= 1),
  valid_from date NOT NULL,
  valid_until date,
  contract_ref uuid REFERENCES public.admin_case_events(id),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_key, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (license_kind = 'livre' OR contract_ref IS NOT NULL),
  CHECK (license_kind IN ('rede','livre') OR seats IS NOT NULL)
);
CREATE TABLE public.tech_annual_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL CHECK (year BETWEEN 2026 AND 2100),
  version int NOT NULL CHECK (version >= 1),
  actions jsonb NOT NULL CHECK (jsonb_typeof(actions) = 'array' AND jsonb_array_length(actions) BETWEEN 1 AND 200),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.tech_annual_plan_approvals (
  plan_version_id uuid PRIMARY KEY REFERENCES public.tech_annual_plan_versions(id),
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  person_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tech_license_versions, public.tech_annual_plan_versions, public.tech_annual_plan_approvals TO service_role;
REVOKE ALL ON public.tech_license_versions, public.tech_annual_plan_versions, public.tech_annual_plan_approvals FROM anon, authenticated;
GRANT SELECT (id, service_key, version, license_kind, seats, valid_from, valid_until, person_id, created_at) ON public.tech_license_versions TO authenticated;
GRANT SELECT ON public.tech_annual_plan_versions, public.tech_annual_plan_approvals TO authenticated;
ALTER TABLE public.tech_license_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_annual_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_annual_plan_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lic read" ON public.tech_license_versions FOR SELECT TO authenticated USING (public.tech_can_read(NULL) OR public.has_network_capability('gerir-licencas'));
CREATE POLICY "plan read" ON public.tech_annual_plan_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan appr read" ON public.tech_annual_plan_approvals FOR SELECT TO authenticated USING (true);
CREATE TRIGGER lic_imm BEFORE UPDATE OR DELETE ON public.tech_license_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER plan_imm BEFORE UPDATE OR DELETE ON public.tech_annual_plan_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER plan_appr_imm BEFORE UPDATE OR DELETE ON public.tech_annual_plan_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_license(_service text, _expected int, _kind text, _seats int, _from date, _until date, _contract uuid, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _prev int;
BEGIN
  SELECT version INTO _prev FROM public.tech_license_versions WHERE idempotency_key = _key; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('gerir-licencas') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tech_digital_service_versions WHERE service_key = _service) THEN RAISE EXCEPTION 'servico-fora-do-catalogo'; END IF;
  IF _contract IS NOT NULL AND NOT public.tech_doc_ok(_contract) THEN RAISE EXCEPTION 'contrato-nao-juntado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tech-lic:' || _service));
  SELECT coalesce(max(version),0) INTO _last FROM public.tech_license_versions WHERE service_key = _service;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_license_versions(service_key, version, license_kind, seats, valid_from, valid_until, contract_ref, person_id, idempotency_key)
  VALUES (_service, _last + 1, _kind, _seats, _from, _until, _contract, _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

-- Ação do plano: {title, kind in (lista), refs:[{source, id}]} — source só da lista de fontes canônicas.
CREATE OR REPLACE FUNCTION public.record_tech_annual_plan(_year int, _expected int, _actions jsonb, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _prev int;
BEGIN
  SELECT version INTO _prev FROM public.tech_annual_plan_versions WHERE idempotency_key = _key; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('planejar-tecnologia-da-rede') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF jsonb_typeof(_actions) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(_actions) a WHERE jsonb_typeof(a) <> 'object'
     OR length(coalesce(a->>'title','')) < 5
     OR coalesce(a->>'kind','') NOT IN ('aquisicao','manutencao','formacao','conectividade','seguranca','inovacao','licenciamento','infraestrutura')
     OR (a ? 'cost') OR (a ? 'budget') OR (a ? 'valor')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(a->'refs','[]'::jsonb)) r WHERE coalesce(r->>'source','') NOT IN
        ('ops_assets','ops_spaces','ops_requests','tech_changes','tech_digital_service_versions','tech_innovation_projects','dev_classes','admin_case_files','tech_connectivity_links')
        OR length(coalesce(r->>'id','')) < 3))
  THEN RAISE EXCEPTION 'acoes-invalidas'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tech-plan:' || _year));
  SELECT coalesce(max(version),0) INTO _last FROM public.tech_annual_plan_versions WHERE year = _year;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_annual_plan_versions(year, version, actions, reason, person_id, idempotency_key) VALUES (_year, _last + 1, _actions, _reason, _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_annual_plan(_plan uuid, _decision text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.tech_annual_plan_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-plano-de-tecnologia') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _v FROM public.tech_annual_plan_versions WHERE id = _plan;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _v.person_id = _p THEN RAISE EXCEPTION 'autoaprovacao'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_annual_plan_versions WHERE year = _v.year AND version > _v.version) THEN RAISE EXCEPTION 'versao-superada'; END IF;
  INSERT INTO public.tech_annual_plan_approvals(plan_version_id, decision_ref, person_id) VALUES (_plan, btrim(_decision), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-aprovado'; WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
REVOKE ALL ON FUNCTION public.record_tech_license(text, int, text, int, date, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_annual_plan(int, int, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_tech_annual_plan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_license(text, int, text, int, date, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_annual_plan(int, int, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_tech_annual_plan(uuid, text) TO authenticated;