-- TSEMED.10 — Tabela 10: escolarização de TODOS os servidores da escola (sem limite de linhas).
-- Identidade/cargo/função só do cadastro central (staff_administrative_records); formação é ledger append-only
-- por servidor (chave = pessoa conciliada ou nome normalizado+matrícula), nunca cria pessoa; comprovação em bucket restrito.
CREATE OR REPLACE FUNCTION public.semed_t10_staff_key(_person uuid, _name text, _reg text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _person IS NOT NULL THEN 'p:' || _person::text
    ELSE 'n:' || lower(regexp_replace(trim(coalesce(_name, '')), '\s+', ' ', 'g')) || '|' || coalesce(nullif(trim(_reg), ''), '') END $$;

CREATE TABLE public.semed_t10_formation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL, version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.semed_t10_formation_versions(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id), year int NOT NULL,
  staff_key text NOT NULL, staff_record_id uuid NOT NULL REFERENCES public.staff_administrative_records(id),
  level text NOT NULL CHECK (level IN ('fundamental','medio','superior','pos')),
  kind text NOT NULL,
  course text CHECK (course IS NULL OR length(course) <= 200),
  institution text CHECK (institution IS NULL OR length(institution) <= 200),
  conclusion_year int CHECK (conclusion_year IS NULL OR conclusion_year BETWEEN 1940 AND 2100),
  withdrawn boolean NOT NULL DEFAULT false,
  reason text CHECK (reason IS NULL OR length(reason) <= 500),
  evidence_path text UNIQUE, evidence_name text, evidence_mime text CHECK (evidence_mime IS NULL OR evidence_mime IN ('application/pdf','image/jpeg','image/png')),
  recorded_by uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formation_id, version),
  CONSTRAINT semed_t10_kind_by_level CHECK (
    (level = 'fundamental' AND kind IN ('completo','incompleto')) OR
    (level = 'medio' AND kind IN ('formacao-geral','normal-magisterio','tecnico')) OR
    (level = 'superior' AND kind IN ('licenciatura','bacharelado','tecnologico')) OR
    (level = 'pos' AND kind IN ('especializacao','mestrado','doutorado')))
);
CREATE INDEX semed_t10_formation_school_idx ON public.semed_t10_formation_versions (school_id, year, staff_key);
GRANT SELECT ON public.semed_t10_formation_versions TO authenticated;
GRANT ALL ON public.semed_t10_formation_versions TO service_role;
ALTER TABLE public.semed_t10_formation_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Formação T10 no escopo" ON public.semed_t10_formation_versions FOR SELECT TO authenticated USING (public.semed_can_read(school_id));
CREATE TRIGGER semed_t10_formation_immutable BEFORE UPDATE OR DELETE ON public.semed_t10_formation_versions FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();

CREATE OR REPLACE FUNCTION public.semed_t10_roster(_school text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_can_read(_school) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  WITH r AS (
    SELECT s.*, c.outcome, CASE WHEN c.outcome = 'candidato-unico' THEN c.candidate_person_id END AS person_id
    FROM public.staff_administrative_records s
    LEFT JOIN LATERAL (SELECT x.outcome, x.candidate_person_id FROM public.staff_reconciliation_candidates x
      WHERE x.staff_record_id = s.id ORDER BY x.derived_at DESC LIMIT 1) c ON true
    WHERE s.school_id = _school
  ), k AS (SELECT r.*, public.semed_t10_staff_key(r.person_id, r.full_name, r.registration) AS staff_key,
      lower(regexp_replace(trim(r.full_name), '\s+', ' ', 'g')) AS nname FROM r),
  g AS (
    SELECT staff_key, (array_agg(id ORDER BY imported_at, row_no))[1] AS staff_record_id,
      min(full_name) AS full_name, min(registration) AS registration, min(nname) AS nname,
      array_remove(array_agg(DISTINCT cargo), NULL) AS cargos, array_remove(array_agg(DISTINCT funcao), NULL) AS funcoes,
      array_remove(array_agg(DISTINCT vinculo), NULL) AS vinculos, array_remove(array_agg(DISTINCT situacao), NULL) AS situacoes,
      count(*) AS rows, bool_or(person_id IS NOT NULL) AS conciliado, string_agg(DISTINCT reference_period, ', ') AS periodos
    FROM k GROUP BY staff_key)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'staff_key', g.staff_key, 'staff_record_id', g.staff_record_id, 'nome', g.full_name, 'matricula', g.registration,
    'cargo', array_to_string(g.cargos, ' / '), 'funcao', array_to_string(g.funcoes, ' / '),
    'vinculo', array_to_string(g.vinculos, ' / '), 'situacao', array_to_string(g.situacoes, ' / '), 'periodos', g.periodos,
    'divergencias', to_jsonb(array_remove(ARRAY[
      CASE WHEN g.rows > 1 THEN 'linhas-repetidas:' || g.rows END,
      CASE WHEN g.registration IS NULL OR trim(g.registration) = '' THEN 'sem-matricula' END,
      CASE WHEN cardinality(g.cargos) > 1 THEN 'cargos-diferentes' END,
      CASE WHEN cardinality(g.cargos) = 0 THEN 'sem-cargo' END,
      CASE WHEN NOT g.conciliado THEN 'sem-pessoa-conciliada' END,
      CASE WHEN EXISTS (SELECT 1 FROM g g2 WHERE g2.nname = g.nname AND g2.staff_key <> g.staff_key) THEN 'homonimo-na-escola' END
    ], NULL))) ORDER BY g.full_name), '[]'::jsonb) INTO out FROM g;
  RETURN out;
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_t10_roster(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_t10_roster(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.semed_t10_record_formation(_school text, _year int, _staff_record_id uuid, _formation_id uuid,
  _expected_version int, _level text, _kind text, _course text, _institution text, _conclusion_year int, _withdraw boolean,
  _reason text, _evidence_path text DEFAULT NULL, _evidence_name text DEFAULT NULL, _evidence_mime text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); s public.staff_administrative_records; skey text; pid uuid; last public.semed_t10_formation_versions;
  fid uuid; nv int; st text; nid uuid;
BEGIN
  IF uid IS NULL OR NOT public.semed_can_fill(_school) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  SELECT * INTO s FROM public.staff_administrative_records WHERE id = _staff_record_id AND school_id = _school;
  IF s.id IS NULL THEN RAISE EXCEPTION 'semed:t10-servidor-fora-da-escola'; END IF;
  SELECT CASE WHEN c.outcome = 'candidato-unico' THEN c.candidate_person_id END INTO pid FROM public.staff_reconciliation_candidates c
    WHERE c.staff_record_id = s.id ORDER BY c.derived_at DESC LIMIT 1;
  skey := public.semed_t10_staff_key(pid, s.full_name, s.registration);
  SELECT e.state_after INTO st FROM public.semed_table_submissions sub JOIN public.semed_table_submission_events e ON e.submission_id = sub.id
    WHERE sub.school_id = _school AND sub.year = _year AND sub.table_code = '10' ORDER BY e.seq DESC LIMIT 1;
  IF coalesce(st, 'rascunho') NOT IN ('rascunho','devolvido','revisao-solicitada') THEN RAISE EXCEPTION 'semed:t10-tabela-bloqueada:%', st; END IF;
  IF _level IN ('superior','pos') AND NOT coalesce(_withdraw, false) AND coalesce(length(trim(_course)), 0) < 3 THEN RAISE EXCEPTION 'semed:t10-curso-obrigatorio'; END IF;
  IF _evidence_path IS NOT NULL THEN
    IF _evidence_path NOT LIKE _school || '/' || _year || '/%' THEN RAISE EXCEPTION 'semed:caminho-invalido'; END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'semed-t10-comprovantes' AND o.name = _evidence_path) THEN RAISE EXCEPTION 'semed:arquivo-ausente'; END IF;
  END IF;
  IF _formation_id IS NULL THEN
    IF coalesce(_withdraw, false) THEN RAISE EXCEPTION 'semed:t10-nada-a-retirar'; END IF;
    fid := gen_random_uuid(); nv := 1;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('semed-t10:' || _formation_id::text));
    SELECT * INTO last FROM public.semed_t10_formation_versions WHERE formation_id = _formation_id ORDER BY version DESC LIMIT 1;
    IF last.id IS NULL OR last.school_id <> _school OR last.staff_key <> skey THEN RAISE EXCEPTION 'semed:t10-formacao-invalida'; END IF;
    IF last.withdrawn THEN RAISE EXCEPTION 'semed:t10-ja-retirada'; END IF;
    IF last.version <> coalesce(_expected_version, -1) THEN RAISE EXCEPTION 'semed:base-desatualizada'; END IF;
    IF coalesce(length(trim(_reason)), 0) < 5 THEN RAISE EXCEPTION 'semed:motivo-obrigatorio'; END IF;
    fid := _formation_id; nv := last.version + 1;
  END IF;
  -- Comprovante anterior permanece na versão em que foi anexado; a tela mostra o mais recente da cadeia.
  INSERT INTO public.semed_t10_formation_versions (formation_id, version, supersedes_id, school_id, year, staff_key, staff_record_id,
      level, kind, course, institution, conclusion_year, withdrawn, reason, evidence_path, evidence_name, evidence_mime, recorded_by)
    VALUES (fid, nv, last.id, _school, _year, skey, s.id,
      coalesce(CASE WHEN _withdraw THEN last.level END, _level), coalesce(CASE WHEN _withdraw THEN last.kind END, _kind),
      CASE WHEN _withdraw THEN last.course ELSE nullif(trim(_course), '') END,
      CASE WHEN _withdraw THEN last.institution ELSE nullif(trim(_institution), '') END,
      CASE WHEN _withdraw THEN last.conclusion_year ELSE _conclusion_year END,
      coalesce(_withdraw, false), nullif(trim(_reason), ''), _evidence_path, _evidence_name, _evidence_mime, uid)
    RETURNING id INTO nid;
  RETURN jsonb_build_object('id', nid, 'formation_id', fid, 'version', nv);
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_t10_record_formation(text,int,uuid,uuid,int,text,text,text,text,int,boolean,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_t10_record_formation(text,int,uuid,uuid,int,text,text,text,text,int,boolean,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.semed_t10_can_see_evidence(_school text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (public.semed_can_fill(_school) OR public.semed_is_network()) $$;
REVOKE EXECUTE ON FUNCTION public.semed_t10_can_see_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_t10_can_see_evidence(text) TO authenticated;
CREATE POLICY "semed-t10 comprovante envio" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'semed-t10-comprovantes' AND public.semed_can_fill((storage.foldername(name))[1]));
CREATE POLICY "semed-t10 comprovante leitura restrita" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'semed-t10-comprovantes' AND public.semed_t10_can_see_evidence((storage.foldername(name))[1]));

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_semed(_operation_id text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.semed_table_submission_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_submissions s WHERE public.semed_fixture_row(to_jsonb(s))
    AND NOT EXISTS (SELECT 1 FROM public.semed_table_submission_events e WHERE e.submission_id = s.id); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t04_adjustments a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t04_rule_versions a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t06_rule_versions a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_attachments a WHERE a.withdrawn_of IS NOT NULL AND public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_attachments a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  LOOP
    DELETE FROM public.semed_t10_formation_versions a WHERE public.semed_fixture_row(to_jsonb(a))
      AND NOT EXISTS (SELECT 1 FROM public.semed_t10_formation_versions b WHERE b.supersedes_id = a.id);
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c; EXIT WHEN c = 0;
  END LOOP;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;