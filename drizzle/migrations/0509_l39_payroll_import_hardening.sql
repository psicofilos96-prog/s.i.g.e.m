-- L39: hardening da carga L38 da folha. Incremental; não reimporta nem altera as 2.037 linhas.
-- (1) Matrícula elegível só no formato estrito <dígitos>-<DV>; qualquer outro formato é NÃO ELEGÍVEL (NULL), nunca reduzido a dígitos.
CREATE OR REPLACE FUNCTION public.normalize_functional_registration(_r text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN pg_catalog.btrim(coalesce(_r,'')) ~ '^[0-9]+-[0-9]$'
              THEN pg_catalog.replace(pg_catalog.btrim(_r), '-', '') END
$$;
CREATE OR REPLACE FUNCTION public.functional_registration_format(_r text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _r IS NULL OR pg_catalog.btrim(_r) = '' THEN 'ausente'
              WHEN pg_catalog.btrim(_r) ~ '^[0-9]+-[0-9]$' THEN 'numerica-com-dv'
              WHEN pg_catalog.btrim(_r) ~ '^[0-9]+$' THEN 'numerica-sem-dv-ambigua'
              ELSE 'nao-elegivel' END
$$;
COMMENT ON FUNCTION public.normalize_functional_registration(text) IS 'L39: chave determinística só para <dígitos>-<DV> (zeros à esquerda e DV preservados); demais formatos ⇒ NULL (não elegível), sem redução a dígitos.';

-- (3) Escopo: a matrícula identifica o VÍNCULO; por período de referência há no máximo uma linha por matrícula,
-- em qualquer arquivo. Períodos diferentes são fotografias sucessivas do mesmo vínculo (históricos preservados).
CREATE UNIQUE INDEX IF NOT EXISTS pfr_period_registration_uq ON public.payroll_functional_registrations (reference_period, registration_norm);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pfr_reference_period_format') THEN
    ALTER TABLE public.payroll_functional_registrations ADD CONSTRAINT pfr_reference_period_format CHECK (reference_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;

-- (1) Escrita direta proibida para todos os papéis de aplicação, inclusive service_role via PostgREST.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payroll_functional_registrations FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payroll_registration_person_links FROM PUBLIC, anon, authenticated, service_role;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payroll_functional_registrations, public.payroll_registration_person_links FROM sandbox_exec;
  END IF;
END $$;

-- (5) Exposição mínima: nome e nascimento só para quem mantém/consulta registro funcional.
DROP POLICY IF EXISTS "pfr leitura funcional da rede" ON public.payroll_functional_registrations;
DROP POLICY IF EXISTS "pfr leitura registro funcional" ON public.payroll_functional_registrations;
CREATE POLICY "pfr leitura registro funcional" ON public.payroll_functional_registrations FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('consultar-registro-funcional')));

CREATE OR REPLACE FUNCTION public.payroll_registrations_overview(_reference_period text)
RETURNS TABLE(registration_norm text, reference_period text, cargo_code text, cargo_label text, monthly_hours integer, weekly_workload_text text, admission_year integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sem-sessao'; END IF;
  IF NOT (public.has_network_capability('consultar-quadro-profissional-da-rede') OR public.has_network_capability('consultar-registro-funcional')) THEN
    RAISE EXCEPTION 'capability:consultar-quadro-profissional-da-rede'; END IF;
  RETURN QUERY SELECT p.registration_norm, p.reference_period, p.cargo_code, p.cargo_label, p.monthly_hours, p.weekly_workload_text,
    pg_catalog.date_part('year', p.admission_date)::integer
  FROM public.payroll_functional_registrations p WHERE p.reference_period = _reference_period ORDER BY p.registration_norm;
END $$;
REVOKE ALL ON FUNCTION public.payroll_registrations_overview(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.payroll_registrations_overview(text) TO authenticated;
COMMENT ON FUNCTION public.payroll_registrations_overview(text) IS 'L39: quadro funcional sem nome nem data de nascimento para a capability ampla.';

-- Fingerprint canônico do conteúdo (mesmo cálculo para adoção e para recarga ⇒ idempotência por conteúdo).
CREATE OR REPLACE FUNCTION public.payroll_rows_fingerprint(_sheet text, _period text, _rows jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT pg_catalog.encode(extensions.digest(
    coalesce(_sheet,'') || '|' || coalesce(_period,'') || E'\n' ||
    coalesce((SELECT pg_catalog.string_agg(e::text, E'\n' ORDER BY (e->>'row_no')::int) FROM pg_catalog.jsonb_array_elements(_rows) e), ''),
    'sha256'), 'hex')
$$;
REVOKE ALL ON FUNCTION public.payroll_rows_fingerprint(text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Switch dedicado no banco (append-only, ausência = desligado).
CREATE TABLE IF NOT EXISTS public.payroll_import_switch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL,
  decided_by text NOT NULL CHECK (decided_by = 'decisao-do-proprietario'),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.payroll_import_switch_events FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.payroll_import_switch_events ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS pise_immutable ON public.payroll_import_switch_events;
CREATE TRIGGER pise_immutable BEFORE UPDATE OR DELETE ON public.payroll_import_switch_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.payroll_import_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.technical_automation_enabled() AND coalesce((SELECT s.enabled FROM public.payroll_import_switch_events s ORDER BY s.recorded_at DESC, s.id DESC LIMIT 1), false)
$$;
REVOKE ALL ON FUNCTION public.payroll_import_enabled() FROM PUBLIC, anon, authenticated, service_role;

-- Executor técnico dedicado: payload delimitado, sem SQL, tudo-ou-nada.
CREATE OR REPLACE FUNCTION public.technical_import_payroll_functional_registrations(_source_hash text, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE k constant text := 'technical_import_payroll_functional_registrations';
  m jsonb := _payload->'manifest'; rs jsonb := _payload->'rows'; norm jsonb; rej jsonb; fp text; op uuid;
  existing record; _sheet text; _period text; _n int; _loaded int;
BEGIN
  IF NOT public.payroll_import_enabled() THEN RAISE EXCEPTION 'technical:payroll-import-disabled'; END IF;
  IF coalesce(_source_hash,'') !~ '^[0-9a-f]{64}$' OR m->>'source_hash' IS DISTINCT FROM _source_hash THEN RAISE EXCEPTION 'technical:source-hash-invalid'; END IF;
  IF pg_catalog.jsonb_typeof(m) IS DISTINCT FROM 'object' OR pg_catalog.jsonb_typeof(rs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'technical:payload-shape'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(_payload) x WHERE x NOT IN ('manifest','rows'))
     OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(m) x WHERE x NOT IN ('source_hash','source_ref','sheet','reference_period','row_count','layout')) THEN
    RAISE EXCEPTION 'technical:payload-key-not-allowed'; END IF;
  _sheet := m->>'sheet'; _period := m->>'reference_period'; _n := pg_catalog.jsonb_array_length(rs);
  IF coalesce(_sheet,'') = '' OR coalesce(_period,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR coalesce(m->>'source_ref','') !~ '^[^/\\]{1,200}$' THEN RAISE EXCEPTION 'technical:manifest-invalid'; END IF;
  IF (m->>'row_count')::int IS DISTINCT FROM _n OR _n < 1 OR _n > 20000 THEN RAISE EXCEPTION 'technical:count-rows'; END IF;
  IF m->'layout' IS DISTINCT FROM '["Matricula","Nome","Admissao","Horas mensais","Carga horária","CodCargo","Cargo","Nascimento"]'::jsonb THEN RAISE EXCEPTION 'technical:layout-mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(rs) e WHERE pg_catalog.jsonb_typeof(e) <> 'object'
             OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(e) x WHERE x NOT IN ('row_no','registration_raw','full_name','birth_date','admission_date','monthly_hours','weekly_workload_text','cargo_code','cargo_label'))) THEN
    RAISE EXCEPTION 'technical:row-key-not-allowed'; END IF;

  -- Rejeições individualizadas (só nº de linha + motivo; nunca conteúdo).
  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('row_no', e->>'row_no', 'motivo', motivo) ORDER BY (e->>'row_no')) INTO rej
  FROM (SELECT e, CASE
      WHEN coalesce(e->>'row_no','') !~ '^[0-9]{1,6}$' OR (e->>'row_no')::int < 2 THEN 'linha-invalida'
      WHEN public.normalize_functional_registration(e->>'registration_raw') IS NULL THEN 'matricula-' || public.functional_registration_format(e->>'registration_raw')
      WHEN coalesce(pg_catalog.btrim(e->>'full_name'),'') = '' THEN 'sem-nome'
      WHEN e->>'birth_date' IS NOT NULL AND NOT pg_catalog.pg_input_is_valid(e->>'birth_date','date') THEN 'nascimento-invalido'
      WHEN e->>'admission_date' IS NOT NULL AND NOT pg_catalog.pg_input_is_valid(e->>'admission_date','date') THEN 'admissao-invalida'
      WHEN e->>'monthly_hours' IS NOT NULL AND coalesce(e->>'monthly_hours','') !~ '^[0-9]{1,4}$' THEN 'horas-invalidas'
      END AS motivo FROM pg_catalog.jsonb_array_elements(rs) e) q WHERE motivo IS NOT NULL;
  IF rej IS NOT NULL THEN RAISE EXCEPTION 'technical:rows-rejected % %', pg_catalog.jsonb_array_length(rej), (SELECT pg_catalog.jsonb_agg(x) FROM (SELECT x FROM pg_catalog.jsonb_array_elements(rej) x LIMIT 50) s); END IF;

  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'row_no', (e->>'row_no')::int, 'registration_raw', pg_catalog.btrim(e->>'registration_raw'), 'full_name', pg_catalog.btrim(e->>'full_name'),
      'birth_date', (e->>'birth_date')::date::text, 'admission_date', (e->>'admission_date')::date::text,
      'monthly_hours', (e->>'monthly_hours')::int, 'weekly_workload_text', nullif(pg_catalog.btrim(e->>'weekly_workload_text'),''),
      'cargo_code', nullif(pg_catalog.btrim(e->>'cargo_code'),''), 'cargo_label', nullif(pg_catalog.btrim(e->>'cargo_label'),''))
    ORDER BY (e->>'row_no')::int) INTO norm FROM pg_catalog.jsonb_array_elements(rs) e;
  IF (SELECT count(DISTINCT x->>'row_no') FROM pg_catalog.jsonb_array_elements(norm) x) <> _n THEN RAISE EXCEPTION 'technical:row-no-repeated'; END IF;
  IF (SELECT count(DISTINCT public.normalize_functional_registration(x->>'registration_raw')) FROM pg_catalog.jsonb_array_elements(norm) x) <> _n THEN RAISE EXCEPTION 'technical:registration-repeated-in-source'; END IF;
  fp := public.payroll_rows_fingerprint(_sheet, _period, norm);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('technical:' || k));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind = k AND source_hash = _source_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint <> fp THEN RAISE EXCEPTION 'technical:payload-differs-from-recorded-operation'; END IF;
    RETURN pg_catalog.jsonb_build_object('status','ja-carregado','operation_id',existing.id,'linhas',_n);
  END IF;
  SELECT count(*) INTO _loaded FROM public.payroll_functional_registrations WHERE source_sha256 = _source_hash;
  IF _loaded > 0 THEN RAISE EXCEPTION 'technical:source-loaded-without-operation'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(norm) x JOIN public.payroll_functional_registrations p
             ON p.reference_period = _period AND p.registration_norm = public.normalize_functional_registration(x->>'registration_raw')) THEN
    RAISE EXCEPTION 'technical:registration-already-in-period (retificação exige decisão própria)'; END IF;

  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, k, 'automacao-tecnica', 'executor técnico da folha (L39)', 'desenvolvimento', m->>'source_ref', _source_hash, 'decisao-do-proprietario', fp, 'concluida',
          pg_catalog.jsonb_build_object('sheet',_sheet,'reference_period',_period,'linhas',_n), pg_catalog.clock_timestamp());
  WITH ins AS (
    INSERT INTO public.payroll_functional_registrations(source_file, source_sha256, sheet, row_no, reference_period, registration_raw, registration_norm, full_name, birth_date, admission_date, monthly_hours, weekly_workload_text, cargo_code, cargo_label, imported_by)
    SELECT m->>'source_ref', _source_hash, _sheet, (x->>'row_no')::int, _period, x->>'registration_raw', public.normalize_functional_registration(x->>'registration_raw'),
           x->>'full_name', (x->>'birth_date')::date, (x->>'admission_date')::date, (x->>'monthly_hours')::int, x->>'weekly_workload_text', x->>'cargo_code', x->>'cargo_label', 'executor-tecnico-folha-l39'
    FROM pg_catalog.jsonb_array_elements(norm) x RETURNING id)
  INSERT INTO public.technical_execution_targets SELECT op, 'payroll_functional_registrations', id::text FROM ins;
  RETURN pg_catalog.jsonb_build_object('status','carregado','operation_id',op,'linhas',_n);
END $f$;
REVOKE ALL ON FUNCTION public.technical_import_payroll_functional_registrations(text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.technical_import_payroll_functional_registrations(text,jsonb) IS 'L39: única via de escrita da folha; switch no banco, payload por allowlist, hash, ledger técnico, idempotência por conteúdo, tudo-ou-nada.';

-- Adoção da carga L38 já existente no ledger técnico (backfill: sem alterar nenhuma linha).
DO $$
DECLARE s record; op uuid; norm jsonb;
BEGIN
  FOR s IN SELECT source_sha256, sheet, reference_period, min(source_file) AS f, min(imported_at) AS t0, count(*) AS n
           FROM public.payroll_functional_registrations GROUP BY 1,2,3 LOOP
    IF EXISTS (SELECT 1 FROM public.technical_execution_operations WHERE operation_kind='technical_import_payroll_functional_registrations' AND source_hash=s.source_sha256) THEN CONTINUE; END IF;
    SELECT jsonb_agg(jsonb_build_object('row_no', row_no, 'registration_raw', registration_raw, 'full_name', full_name,
        'birth_date', birth_date::text, 'admission_date', admission_date::text, 'monthly_hours', monthly_hours,
        'weekly_workload_text', weekly_workload_text, 'cargo_code', cargo_code, 'cargo_label', cargo_label) ORDER BY row_no)
      INTO norm FROM public.payroll_functional_registrations WHERE source_sha256=s.source_sha256 AND sheet=s.sheet AND reference_period=s.reference_period;
    op := gen_random_uuid();
    INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
    VALUES (op, 'technical_import_payroll_functional_registrations', 'automacao-tecnica', 'adoção L39 da carga L38 (gravada antes do executor dedicado)', 'desenvolvimento', s.f, s.source_sha256, 'decisao-do-proprietario',
            public.payroll_rows_fingerprint(s.sheet, s.reference_period, norm), 'concluida',
            jsonb_build_object('sheet', s.sheet, 'reference_period', s.reference_period, 'linhas', s.n, 'adocao', true), s.t0);
    INSERT INTO public.technical_execution_targets
    SELECT op, 'payroll_functional_registrations', id::text FROM public.payroll_functional_registrations WHERE source_sha256=s.source_sha256 AND sheet=s.sheet AND reference_period=s.reference_period;
  END LOOP;
END $$;

-- (4) Ligação vínculo→pessoa endurecida.
CREATE OR REPLACE FUNCTION public.record_payroll_person_link(
  _registration_norm text, _expected_seq integer, _action text, _person_id uuid, _evidence text, _idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _actor uuid := public.current_person_id(); _last public.payroll_registration_person_links; _dup public.payroll_registration_person_links;
BEGIN
  IF auth.uid() IS NULL OR _actor IS NULL THEN RAISE EXCEPTION 'sem-sessao'; END IF;
  IF NOT public.has_network_capability('manter-registro-funcional') THEN RAISE EXCEPTION 'capability:manter-registro-funcional'; END IF;
  IF coalesce(_registration_norm,'') !~ '^[0-9]{2,}$' THEN RAISE EXCEPTION 'matricula-nao-elegivel'; END IF;
  IF coalesce(pg_catalog.length(_idempotency_key),0) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'idempotencia-chave-invalida'; END IF;
  IF coalesce(pg_catalog.length(pg_catalog.btrim(_evidence)),0) < 10 THEN RAISE EXCEPTION 'evidencia-insuficiente'; END IF;
  IF _action IS NULL OR _action NOT IN ('vincular','revogar') THEN RAISE EXCEPTION 'acao-invalida'; END IF;
  IF _expected_seq IS NULL OR _expected_seq < 0 THEN RAISE EXCEPTION 'base-invalida'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('prpl:' || _registration_norm));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('prpl-key:' || _idempotency_key));
  SELECT * INTO _dup FROM public.payroll_registration_person_links WHERE idempotency_key = _idempotency_key;
  IF _dup.id IS NOT NULL THEN
    IF _dup.registration_norm = _registration_norm AND _dup.action = _action AND _dup.seq = _expected_seq + 1
       AND _dup.decided_by_user_id = auth.uid() AND _dup.evidence = _evidence
       AND (_action = 'revogar' OR _dup.person_id = _person_id) THEN
      RETURN pg_catalog.jsonb_build_object('status','ja-registrado','seq',_dup.seq); END IF;
    RAISE EXCEPTION 'idempotencia-payload-divergente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll_functional_registrations WHERE registration_norm = _registration_norm) THEN
    RAISE EXCEPTION 'vinculo-inexistente'; END IF;
  SELECT * INTO _last FROM public.payroll_registration_person_links WHERE registration_norm = _registration_norm ORDER BY seq DESC LIMIT 1;
  IF coalesce(_last.seq, 0) <> _expected_seq THEN RAISE EXCEPTION 'base-desatualizada'; END IF;
  IF _action = 'vincular' THEN
    IF _last.action = 'vincular' THEN RAISE EXCEPTION 'ja-vinculado: revogue antes'; END IF;
    IF _person_id IS NULL THEN RAISE EXCEPTION 'pessoa-obrigatoria'; END IF;
    IF _person_id = _actor THEN RAISE EXCEPTION 'autovinculacao-recusada'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_persons WHERE id = _person_id AND actor_nature = 'pessoa-natural') THEN RAISE EXCEPTION 'pessoa-inexistente-ou-nao-natural'; END IF;
  ELSE
    IF _last.action IS DISTINCT FROM 'vincular' THEN RAISE EXCEPTION 'nada-a-revogar'; END IF;
    IF _person_id IS DISTINCT FROM _last.person_id THEN RAISE EXCEPTION 'revogacao-pessoa-divergente'; END IF;
    IF _last.person_id = _actor THEN RAISE EXCEPTION 'autorrevogacao-recusada'; END IF;
    _person_id := NULL;
  END IF;
  INSERT INTO public.payroll_registration_person_links(registration_norm, seq, action, person_id, evidence, decided_by_person_id, decided_by_user_id, idempotency_key)
  VALUES (_registration_norm, coalesce(_last.seq,0)+1, _action, _person_id, _evidence, _actor, auth.uid(), _idempotency_key);
  RETURN pg_catalog.jsonb_build_object('status','registrado','seq',coalesce(_last.seq,0)+1);
END $$;
REVOKE ALL ON FUNCTION public.record_payroll_person_link(text,integer,text,uuid,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_payroll_person_link(text,integer,text,uuid,text,text) TO authenticated;

-- Reconciliação: formato explícito; formatos não elegíveis nunca casam.
CREATE OR REPLACE VIEW public.payroll_staff_registration_matches WITH (security_invoker = true) AS
SELECT s.id AS staff_record_id, s.source_kind, p.id AS payroll_registration_id, p.registration_norm,
       (p.id IS NOT NULL) AS registration_found,
       public.functional_registration_format(s.registration) AS registration_format
FROM public.staff_administrative_records s
LEFT JOIN public.payroll_functional_registrations p
  ON p.registration_norm = public.normalize_functional_registration(s.registration)
WHERE s.registration IS NOT NULL;
