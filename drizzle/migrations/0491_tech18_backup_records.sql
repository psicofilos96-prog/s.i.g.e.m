-- Tecnologia L18: backup de serviço do catálogo L15. Plano = versão append-only com periodicidade e FONTE (norma/fabricante/decisão),
-- aprovado por pessoa ≠ autor; execução e teste de restauração são registros append-only com evidência juntada (coluna oculta);
-- teste por pessoa ≠ quem executou o backup, com integridade conferida declarada. Status final é projeção (backupClaim).
CREATE TABLE public.tech_backup_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  scope text NOT NULL CHECK (length(btrim(scope)) BETWEEN 5 AND 500),
  every_hours int NOT NULL CHECK (every_hours BETWEEN 1 AND 8760),
  restore_test_every_days int CHECK (restore_test_every_days BETWEEN 1 AND 730),
  retention_days int CHECK (retention_days >= 1),
  source_kind text NOT NULL CHECK (source_kind IN ('norma','fabricante','contrato','decisao-tecnica')),
  source_ref text NOT NULL CHECK (length(btrim(source_ref)) >= 3),
  person_id uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_key, version)
);
CREATE TABLE public.tech_backup_plan_approvals (
  plan_version_id uuid PRIMARY KEY REFERENCES public.tech_backup_plan_versions(id),
  person_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.tech_backup_plan_versions(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('sucesso','parcial','falha')),
  checksum text CHECK (checksum IS NULL OR checksum ~ '^[0-9a-f]{64}$'),
  evidence_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at >= started_at),
  CHECK (outcome <> 'sucesso' OR checksum IS NOT NULL)
);
CREATE TABLE public.tech_restore_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.tech_backup_runs(id),
  tested_at timestamptz NOT NULL,
  restored_checksum text CHECK (restored_checksum IS NULL OR restored_checksum ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('restaurado','falha')),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  evidence_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tech_backup_plan_versions, public.tech_backup_plan_approvals, public.tech_backup_runs, public.tech_restore_tests TO service_role;
REVOKE ALL ON public.tech_backup_plan_versions, public.tech_backup_plan_approvals, public.tech_backup_runs, public.tech_restore_tests FROM anon, authenticated;
GRANT SELECT (id, service_key, version, scope, every_hours, restore_test_every_days, retention_days, source_kind, source_ref, person_id, created_at) ON public.tech_backup_plan_versions TO authenticated;
GRANT SELECT ON public.tech_backup_plan_approvals TO authenticated;
GRANT SELECT (id, plan_version_id, started_at, ended_at, outcome, checksum, person_id, created_at) ON public.tech_backup_runs TO authenticated;
GRANT SELECT (id, run_id, tested_at, restored_checksum, outcome, note, person_id, created_at) ON public.tech_restore_tests TO authenticated;
ALTER TABLE public.tech_backup_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_backup_plan_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_backup_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_restore_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bk plan read" ON public.tech_backup_plan_versions FOR SELECT TO authenticated USING (public.has_network_capability('gerir-backups'));
CREATE POLICY "bk appr read" ON public.tech_backup_plan_approvals FOR SELECT TO authenticated USING (public.has_network_capability('gerir-backups'));
CREATE POLICY "bk run read" ON public.tech_backup_runs FOR SELECT TO authenticated USING (public.has_network_capability('gerir-backups'));
CREATE POLICY "bk test read" ON public.tech_restore_tests FOR SELECT TO authenticated USING (public.has_network_capability('gerir-backups'));
CREATE TRIGGER bk_plan_immutable BEFORE UPDATE OR DELETE ON public.tech_backup_plan_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER bk_appr_immutable BEFORE UPDATE OR DELETE ON public.tech_backup_plan_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER bk_run_immutable BEFORE UPDATE OR DELETE ON public.tech_backup_runs FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER bk_test_immutable BEFORE UPDATE OR DELETE ON public.tech_restore_tests FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.tech_backup_doc_ok(_d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_case_events WHERE id = _d AND event_type = 'documento_juntado') $$;
REVOKE ALL ON FUNCTION public.tech_backup_doc_ok(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_tech_backup_plan(_service text, _expected int, _scope text, _every int, _test_days int, _ret int, _src_kind text, _src text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _prev int;
BEGIN
  SELECT version INTO _prev FROM public.tech_backup_plan_versions WHERE idempotency_key = _key; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('gerir-backups') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tech_digital_service_versions WHERE service_key = _service) THEN RAISE EXCEPTION 'servico-fora-do-catalogo'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tech-bk:' || _service));
  SELECT coalesce(max(version), 0) INTO _last FROM public.tech_backup_plan_versions WHERE service_key = _service;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_backup_plan_versions(service_key, version, scope, every_hours, restore_test_every_days, retention_days, source_kind, source_ref, person_id, idempotency_key)
  VALUES (_service, _last + 1, btrim(_scope), _every, _test_days, _ret, _src_kind, btrim(_src), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_backup_plan(_plan uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.tech_backup_plan_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-planos-de-backup') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _v FROM public.tech_backup_plan_versions WHERE id = _plan;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _v.person_id = _p THEN RAISE EXCEPTION 'autoaprovacao'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_backup_plan_versions WHERE service_key = _v.service_key AND version > _v.version) THEN RAISE EXCEPTION 'versao-superada'; END IF;
  INSERT INTO public.tech_backup_plan_approvals(plan_version_id, person_id) VALUES (_plan, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-aprovado';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_backup_run(_plan uuid, _start timestamptz, _end timestamptz, _outcome text, _checksum text, _evidence uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _v public.tech_backup_plan_versions;
BEGIN
  SELECT id INTO _id FROM public.tech_backup_runs WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('gerir-backups') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _v FROM public.tech_backup_plan_versions WHERE id = _plan;
  IF _v.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tech_backup_plan_approvals WHERE plan_version_id = _plan) THEN RAISE EXCEPTION 'plano-nao-aprovado'; END IF;
  IF _end > now() + interval '5 minutes' THEN RAISE EXCEPTION 'periodo-futuro'; END IF;
  IF NOT public.tech_backup_doc_ok(_evidence) THEN RAISE EXCEPTION 'evidencia-nao-juntada'; END IF;
  INSERT INTO public.tech_backup_runs(plan_version_id, started_at, ended_at, outcome, checksum, evidence_ref, person_id, idempotency_key)
  VALUES (_plan, _start, _end, _outcome, lower(_checksum), _evidence, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_restore_test(_run uuid, _at timestamptz, _checksum text, _outcome text, _note text, _evidence uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _r public.tech_backup_runs;
BEGIN
  SELECT id INTO _id FROM public.tech_restore_tests WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('testar-restauracoes') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _r FROM public.tech_backup_runs WHERE id = _run;
  IF _r.id IS NULL OR _r.outcome = 'falha' THEN RAISE EXCEPTION 'backup-inexistente-ou-falho'; END IF;
  IF _r.person_id = _p THEN RAISE EXCEPTION 'executor-nao-testa'; END IF;
  IF _at < _r.ended_at OR _at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'data-invalida'; END IF;
  IF NOT public.tech_backup_doc_ok(_evidence) THEN RAISE EXCEPTION 'evidencia-nao-juntada'; END IF;
  INSERT INTO public.tech_restore_tests(run_id, tested_at, restored_checksum, outcome, note, evidence_ref, person_id, idempotency_key)
  VALUES (_run, _at, lower(_checksum), _outcome, btrim(_note), _evidence, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
REVOKE ALL ON FUNCTION public.record_tech_backup_plan(text, int, text, int, int, int, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_tech_backup_plan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_backup_run(uuid, timestamptz, timestamptz, text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_restore_test(uuid, timestamptz, text, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_backup_plan(text, int, text, int, int, int, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_tech_backup_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_backup_run(uuid, timestamptz, timestamptz, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_restore_test(uuid, timestamptz, text, text, text, uuid, text) TO authenticated;