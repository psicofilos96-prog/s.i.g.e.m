-- Tecnologia L21. (a) Projeto de inovação: proposta + eventos append-only; aprovação por pessoa ≠ proponente; relato de USO
-- é distinto de EVIDÊNCIA DE APRENDIZAGEM (esta só com documento juntado e fonte declarada). (b) Laboratório = ambiente
-- canônico ops_spaces designado por ato aprovado por pessoa ≠ autor. (c) Empréstimo = bem ops_assets de categoria de
-- tecnologia, uma saída aberta por bem, devolução recebida por pessoa ≠ tomador. (d) Acessibilidade de serviço do
-- catálogo: recursos declarados de lista fechada, conferidos por pessoa ≠ declarante.
CREATE OR REPLACE FUNCTION public.tech_doc_ok(_d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _d IS NOT NULL AND EXISTS (SELECT 1 FROM public.admin_case_events WHERE id = _d AND event_type = 'documento_juntado') $$;
REVOKE ALL ON FUNCTION public.tech_doc_ok(uuid) FROM PUBLIC, anon, authenticated;

-- (a) Projetos
CREATE TABLE public.tech_innovation_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 200),
  objective text NOT NULL CHECK (length(btrim(objective)) BETWEEN 20 AND 2000),
  evidence_plan text NOT NULL CHECK (length(btrim(evidence_plan)) BETWEEN 20 AND 2000),
  service_keys text[] NOT NULL DEFAULT '{}',
  proposer_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_innovation_events (
  project_id uuid NOT NULL REFERENCES public.tech_innovation_projects(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('aprovacao','indeferimento','inicio','relato-de-uso','relato-de-percepcao','evidencia-de-aprendizagem','encerramento')),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  evidence_source text CHECK (evidence_source IN ('avaliacao-oficial','avaliacao-diagnostica','estudo-com-metodo-declarado')),
  doc_ref uuid REFERENCES public.admin_case_events(id),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, seq),
  CHECK (kind <> 'evidencia-de-aprendizagem' OR (evidence_source IS NOT NULL AND doc_ref IS NOT NULL)),
  CHECK (kind = 'evidencia-de-aprendizagem' OR evidence_source IS NULL),
  CHECK (kind <> 'encerramento' OR doc_ref IS NOT NULL)
);
-- (b) Laboratórios
CREATE TABLE public.tech_lab_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.ops_spaces(id),
  action text NOT NULL CHECK (action IN ('designar','retirar')),
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 10 AND 500),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_lab_designation_approvals (
  designation_id uuid PRIMARY KEY REFERENCES public.tech_lab_designations(id),
  person_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- (c) Empréstimos
CREATE TABLE public.tech_equipment_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id),
  school_id text NOT NULL,
  borrower_engagement uuid NOT NULL REFERENCES public.institutional_engagements(id),
  purpose text NOT NULL CHECK (length(btrim(purpose)) BETWEEN 10 AND 500),
  lent_on date NOT NULL,
  due_on date NOT NULL,
  term_doc_ref uuid REFERENCES public.admin_case_events(id),
  lender_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_on >= lent_on)
);
CREATE TABLE public.tech_equipment_loan_returns (
  loan_id uuid PRIMARY KEY REFERENCES public.tech_equipment_loans(id),
  returned_on date NOT NULL,
  condition_note text NOT NULL CHECK (length(btrim(condition_note)) >= 5),
  receiver_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- (d) Acessibilidade
CREATE TABLE public.tech_service_accessibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_version_id uuid NOT NULL REFERENCES public.tech_digital_service_versions(id),
  features text[] NOT NULL CHECK (features <@ ARRAY['leitor-de-tela','legendas','libras','audiodescricao','alto-contraste','ampliacao','navegacao-por-teclado','linguagem-simples','comunicacao-alternativa']),
  standard_ref text CHECK (standard_ref IS NULL OR length(btrim(standard_ref)) >= 3),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_service_accessibility_checks (
  declaration_id uuid PRIMARY KEY REFERENCES public.tech_service_accessibility(id),
  confirmed text[] NOT NULL,
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  person_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tech_innovation_projects, public.tech_innovation_events, public.tech_lab_designations, public.tech_lab_designation_approvals,
  public.tech_equipment_loans, public.tech_equipment_loan_returns, public.tech_service_accessibility, public.tech_service_accessibility_checks TO service_role;
REVOKE ALL ON public.tech_innovation_projects, public.tech_innovation_events, public.tech_lab_designations, public.tech_lab_designation_approvals,
  public.tech_equipment_loans, public.tech_equipment_loan_returns, public.tech_service_accessibility, public.tech_service_accessibility_checks FROM anon, authenticated;
GRANT SELECT ON public.tech_innovation_projects, public.tech_lab_designations, public.tech_lab_designation_approvals,
  public.tech_equipment_loan_returns, public.tech_service_accessibility, public.tech_service_accessibility_checks TO authenticated;
GRANT SELECT (project_id, seq, kind, note, evidence_source, person_id, created_at) ON public.tech_innovation_events TO authenticated;
GRANT SELECT (id, asset_id, school_id, borrower_engagement, purpose, lent_on, due_on, lender_person, created_at) ON public.tech_equipment_loans TO authenticated;
ALTER TABLE public.tech_innovation_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_innovation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_lab_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_lab_designation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_equipment_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_equipment_loan_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_service_accessibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_service_accessibility_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inov read" ON public.tech_innovation_projects FOR SELECT TO authenticated USING (proposer_person = public.current_person_id() OR public.tech_can_read(school_id));
CREATE POLICY "inov ev read" ON public.tech_innovation_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_innovation_projects p WHERE p.id = project_id AND (p.proposer_person = public.current_person_id() OR public.tech_can_read(p.school_id))));
CREATE POLICY "lab read" ON public.tech_lab_designations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = space_id AND public.tech_can_read(s.school_id)));
CREATE POLICY "lab appr read" ON public.tech_lab_designation_approvals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_lab_designations d JOIN public.ops_spaces s ON s.id = d.space_id WHERE d.id = designation_id AND public.tech_can_read(s.school_id)));
CREATE POLICY "loan read" ON public.tech_equipment_loans FOR SELECT TO authenticated USING (public.tech_can_read(school_id) OR EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = borrower_engagement AND e.person_id = public.current_person_id()));
CREATE POLICY "loan ret read" ON public.tech_equipment_loan_returns FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_equipment_loans l WHERE l.id = loan_id AND (public.tech_can_read(l.school_id) OR EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = l.borrower_engagement AND e.person_id = public.current_person_id()))));
CREATE POLICY "a11y read" ON public.tech_service_accessibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "a11y chk read" ON public.tech_service_accessibility_checks FOR SELECT TO authenticated USING (true);
CREATE TRIGGER inov_imm BEFORE UPDATE OR DELETE ON public.tech_innovation_projects FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER inov_ev_imm BEFORE UPDATE OR DELETE ON public.tech_innovation_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER lab_imm BEFORE UPDATE OR DELETE ON public.tech_lab_designations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER lab_appr_imm BEFORE UPDATE OR DELETE ON public.tech_lab_designation_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER loan_imm BEFORE UPDATE OR DELETE ON public.tech_equipment_loans FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER loan_ret_imm BEFORE UPDATE OR DELETE ON public.tech_equipment_loan_returns FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER a11y_imm BEFORE UPDATE OR DELETE ON public.tech_service_accessibility FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER a11y_chk_imm BEFORE UPDATE OR DELETE ON public.tech_service_accessibility_checks FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Writers (a)
CREATE OR REPLACE FUNCTION public.propose_tech_innovation_project(_school text, _title text, _objective text, _plan text, _services text[], _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  SELECT id INTO _id FROM public.tech_innovation_projects WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT (public.has_network_capability('propor-projetos-de-inovacao') OR (_school IS NOT NULL AND public.has_school_capability('propor-projetos-de-inovacao', _school))) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_services,'{}')) s WHERE NOT EXISTS (SELECT 1 FROM public.tech_digital_service_versions v WHERE v.service_key = s)) THEN RAISE EXCEPTION 'servico-fora-do-catalogo'; END IF;
  INSERT INTO public.tech_innovation_projects(school_id, title, objective, evidence_plan, service_keys, proposer_person, idempotency_key)
  VALUES (_school, btrim(_title), btrim(_objective), btrim(_plan), coalesce(_services,'{}'), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_innovation_event(_proj uuid, _expected int, _kind text, _note text, _source text, _doc uuid, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _pr public.tech_innovation_projects; _last int; _prev int; _state text;
BEGIN
  SELECT seq INTO _prev FROM public.tech_innovation_events WHERE idempotency_key = _key; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _pr FROM public.tech_innovation_projects WHERE id = _proj FOR UPDATE;
  IF _pr.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.tech_innovation_events WHERE project_id = _proj;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.tech_innovation_events WHERE project_id = _proj AND kind IN ('indeferimento','encerramento')) THEN 'fechado'
    WHEN EXISTS (SELECT 1 FROM public.tech_innovation_events WHERE project_id = _proj AND kind = 'inicio') THEN 'em-execucao'
    WHEN EXISTS (SELECT 1 FROM public.tech_innovation_events WHERE project_id = _proj AND kind = 'aprovacao') THEN 'aprovado' ELSE 'proposto' END INTO _state;
  IF NOT ((_state = 'proposto' AND _kind IN ('aprovacao','indeferimento')) OR (_state = 'aprovado' AND _kind = 'inicio')
       OR (_state = 'em-execucao' AND _kind IN ('relato-de-uso','relato-de-percepcao','evidencia-de-aprendizagem','encerramento'))) THEN RAISE EXCEPTION 'transicao-invalida'; END IF;
  IF _kind IN ('aprovacao','indeferimento') THEN
    IF NOT public.has_network_capability('aprovar-projetos-de-inovacao') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
    IF _p = _pr.proposer_person THEN RAISE EXCEPTION 'autoaprovacao'; END IF;
  ELSIF NOT (_p = _pr.proposer_person OR public.tech_can_manage(_pr.school_id)) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF _doc IS NOT NULL AND NOT public.tech_doc_ok(_doc) THEN RAISE EXCEPTION 'documento-nao-juntado'; END IF;
  INSERT INTO public.tech_innovation_events(project_id, seq, kind, note, evidence_source, doc_ref, person_id, idempotency_key)
  VALUES (_proj, _last + 1, _kind, btrim(_note), _source, _doc, _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

-- Writers (b)
CREATE OR REPLACE FUNCTION public.record_tech_lab_designation(_space uuid, _action text, _purpose text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _s public.ops_spaces;
BEGIN
  SELECT id INTO _id FROM public.tech_lab_designations WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _s FROM public.ops_spaces WHERE id = _space;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'espaco-inexistente'; END IF;
  IF NOT (public.has_network_capability('designar-laboratorios') OR public.has_school_capability('designar-laboratorios', _s.school_id)) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  INSERT INTO public.tech_lab_designations(space_id, action, purpose, person_id, idempotency_key) VALUES (_space, _action, btrim(_purpose), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
CREATE OR REPLACE FUNCTION public.approve_tech_lab_designation(_d uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _x public.tech_lab_designations;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-laboratorios') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _x FROM public.tech_lab_designations WHERE id = _d;
  IF _x.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _x.person_id = _p THEN RAISE EXCEPTION 'autoaprovacao'; END IF;
  INSERT INTO public.tech_lab_designation_approvals(designation_id, person_id) VALUES (_d, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-aprovada';
END $$;

-- Writers (c): bem de categoria de tecnologia (marca L11 vigente e aprovada), escola = última localização na cadeia, não baixado.
CREATE OR REPLACE FUNCTION public.lend_tech_equipment(_asset uuid, _engagement uuid, _purpose text, _due date, _term uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _a public.ops_assets; _cat text; _school text; _e public.institutional_engagements; _mk text;
BEGIN
  SELECT id INTO _id FROM public.tech_equipment_loans WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _a FROM public.ops_assets WHERE id = _asset FOR UPDATE;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'bem-inexistente'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _asset AND kind = 'baixa') THEN RAISE EXCEPTION 'bem-baixado'; END IF;
  SELECT category_key INTO _cat FROM public.ops_asset_category_versions WHERE id = _a.category_version_id;
  SELECT m.action INTO _mk FROM public.tech_equipment_category_marks m WHERE m.category_key = _cat
    AND EXISTS (SELECT 1 FROM public.tech_equipment_category_mark_approvals x WHERE x.mark_id = m.id) ORDER BY m.seq DESC LIMIT 1;
  IF _mk IS DISTINCT FROM 'incluir' THEN RAISE EXCEPTION 'nao-e-equipamento-de-tecnologia'; END IF;
  SELECT school_id INTO _school FROM public.ops_asset_events WHERE asset_id = _asset AND kind = 'localizacao' ORDER BY seq DESC LIMIT 1;
  IF _school IS NULL THEN RAISE EXCEPTION 'sem-localizacao'; END IF;
  IF NOT public.has_school_capability('emprestar-equipamentos', _school) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _e FROM public.institutional_engagements WHERE id = _engagement;
  IF _e.id IS NULL OR _e.school_id IS DISTINCT FROM _school OR _e.valid_from > current_date OR (_e.valid_until IS NOT NULL AND _e.valid_until < current_date) THEN RAISE EXCEPTION 'tomador-nao-vigente-na-escola'; END IF;
  IF _e.person_id = _p THEN RAISE EXCEPTION 'autoemprestimo'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_equipment_loans l WHERE l.asset_id = _asset AND NOT EXISTS (SELECT 1 FROM public.tech_equipment_loan_returns r WHERE r.loan_id = l.id)) THEN RAISE EXCEPTION 'emprestimo-aberto'; END IF;
  IF _term IS NOT NULL AND NOT public.tech_doc_ok(_term) THEN RAISE EXCEPTION 'termo-nao-juntado'; END IF;
  INSERT INTO public.tech_equipment_loans(asset_id, school_id, borrower_engagement, purpose, lent_on, due_on, term_doc_ref, lender_person, idempotency_key)
  VALUES (_asset, _school, _engagement, btrim(_purpose), current_date, _due, _term, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
CREATE OR REPLACE FUNCTION public.return_tech_equipment(_loan uuid, _condition text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _l public.tech_equipment_loans; _bp uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _l FROM public.tech_equipment_loans WHERE id = _loan FOR UPDATE;
  IF _l.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF NOT public.has_school_capability('emprestar-equipamentos', _l.school_id) THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT person_id INTO _bp FROM public.institutional_engagements WHERE id = _l.borrower_engagement;
  IF _bp = _p THEN RAISE EXCEPTION 'tomador-nao-recebe'; END IF;
  INSERT INTO public.tech_equipment_loan_returns(loan_id, returned_on, condition_note, receiver_person) VALUES (_loan, current_date, btrim(_condition), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-devolvido'; WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

-- Writers (d)
CREATE OR REPLACE FUNCTION public.declare_tech_service_accessibility(_service text, _features text[], _standard text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _v uuid;
BEGIN
  SELECT id INTO _id FROM public.tech_service_accessibility WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('configurar-catalogo-digital') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT id INTO _v FROM public.tech_digital_service_versions WHERE service_key = _service ORDER BY version DESC LIMIT 1;
  IF _v IS NULL THEN RAISE EXCEPTION 'servico-fora-do-catalogo'; END IF;
  INSERT INTO public.tech_service_accessibility(service_version_id, features, standard_ref, person_id, idempotency_key) VALUES (_v, _features, _standard, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
CREATE OR REPLACE FUNCTION public.check_tech_service_accessibility(_decl uuid, _confirmed text[], _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _d public.tech_service_accessibility;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('conferir-acessibilidade-digital') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _d FROM public.tech_service_accessibility WHERE id = _decl;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _d.person_id = _p THEN RAISE EXCEPTION 'autoconferencia'; END IF;
  IF NOT (coalesce(_confirmed,'{}') <@ _d.features) THEN RAISE EXCEPTION 'recurso-nao-declarado'; END IF;
  INSERT INTO public.tech_service_accessibility_checks(declaration_id, confirmed, note, person_id) VALUES (_decl, coalesce(_confirmed,'{}'), btrim(_note), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-conferida'; WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

REVOKE ALL ON FUNCTION public.propose_tech_innovation_project(text, text, text, text, text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_innovation_event(uuid, int, text, text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_lab_designation(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_tech_lab_designation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lend_tech_equipment(uuid, uuid, text, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_tech_equipment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.declare_tech_service_accessibility(text, text[], text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_tech_service_accessibility(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_tech_innovation_project(text, text, text, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_innovation_event(uuid, int, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_lab_designation(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_tech_lab_designation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lend_tech_equipment(uuid, uuid, text, date, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_tech_equipment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.declare_tech_service_accessibility(text, text[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_tech_service_accessibility(uuid, text[], text) TO authenticated;