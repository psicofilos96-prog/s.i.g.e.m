-- DocServ LOTE 04: painel da escola. Servidores = pessoas com atuação vigente OU lotação vigente na escola (sem duplicar).
CREATE TABLE IF NOT EXISTS public.docserv_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  seq integer NOT NULL,
  school_id text NOT NULL,
  person_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('solicitar-vinculo','solicitar-desvinculo')),
  state text NOT NULL CHECK (state IN ('aberta','encaminhada-ao-dp','recusada','cancelada')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  actor uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, seq)
);
COMMENT ON TABLE public.docserv_link_requests IS 'Solicitação de vínculo/desvínculo vinda do DocServ. Append-only. Nunca cria nem encerra atuação/lotação: encaminha ao DP, que grava pelo writer canônico.';
GRANT SELECT ON public.docserv_link_requests TO authenticated;
GRANT ALL ON public.docserv_link_requests TO service_role;
ALTER TABLE public.docserv_link_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docserv link requests read" ON public.docserv_link_requests;
CREATE POLICY "docserv link requests read" ON public.docserv_link_requests FOR SELECT TO authenticated
  USING (public.has_school_capability('gerir-documentos-funcionais', school_id) OR public.has_network_capability('administrar-docserv'));
DROP TRIGGER IF EXISTS docserv_link_requests_no_change ON public.docserv_link_requests;
CREATE TRIGGER docserv_link_requests_no_change BEFORE UPDATE OR DELETE ON public.docserv_link_requests FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();

CREATE OR REPLACE FUNCTION public.docserv_school_people(_school text) RETURNS TABLE(person_id uuid, sources text[], functions text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH eng AS (
    SELECT g.person_id, 'atuacao:' || g.engagement_kind_id AS src, NULL::text AS fn FROM public.institutional_engagements g
    WHERE g.school_id = _school AND g.valid_from <= current_date AND (g.valid_until IS NULL OR g.valid_until >= current_date)
  ), pst AS (
    SELECT l.person_id, 'lotacao' AS src, nullif(concat_ws(' / ', p.function_id, p.functional_status_id), '') AS fn
    FROM (SELECT DISTINCT ON (logical_id) * FROM public.professional_postings ORDER BY logical_id, version DESC) p
    JOIN (SELECT DISTINCT ON (logical_id) * FROM public.professional_functional_links ORDER BY logical_id, version DESC) l ON l.logical_id = p.functional_link_logical_id
    WHERE p.school_id = _school AND p.valid_from <= current_date AND (p.valid_until IS NULL OR p.valid_until >= current_date)
  )
  SELECT u.person_id, array_agg(DISTINCT u.src ORDER BY u.src), coalesce(array_agg(DISTINCT u.fn) FILTER (WHERE u.fn IS NOT NULL), '{}')
  FROM (SELECT * FROM eng UNION ALL SELECT * FROM pst) u
  JOIN public.institutional_persons ip ON ip.id = u.person_id AND ip.actor_nature = 'pessoa-natural'
  GROUP BY u.person_id
$$;
REVOKE ALL ON FUNCTION public.docserv_school_people(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.docserv_school_roster(_school text, _season text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _out jsonb; _can_validate boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_school_capability('gerir-documentos-funcionais', _school) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _season !~ '^\d{4}$' THEN RAISE EXCEPTION 'docserv:invalid-season'; END IF;
  _can_validate := public.has_school_capability('validar-documentos-funcionais', _school);
  WITH ppl AS (SELECT * FROM public.docserv_school_people(_school)),
  docs AS (
    SELECT DISTINCT ON (v.person_id, v.type_code) v.person_id, v.type_code, v.document_id, v.version, v.valid_until, v.storage_path, v.school_id,
      e.kind AS last_kind, e.seq,
      (SELECT e2.status FROM public.docserv_document_events e2 WHERE e2.version_id = v.id AND e2.status IS NOT NULL ORDER BY e2.seq DESC LIMIT 1) AS st
    FROM (SELECT DISTINCT ON (document_id) * FROM public.docserv_document_versions ORDER BY document_id, version DESC) v
    JOIN LATERAL (SELECT * FROM public.docserv_document_events x WHERE x.document_id = v.document_id ORDER BY x.seq DESC LIMIT 1) e ON true
    WHERE v.person_id IN (SELECT person_id FROM ppl) AND v.season = _season AND e.kind <> 'excluido-logico'
    ORDER BY v.person_id, v.type_code, v.submitted_at DESC
  ), rows AS (
    SELECT p.person_id, p.sources, p.functions,
      (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = p.person_id) AS masked,
      (SELECT count(DISTINCT g.school_id) FROM public.institutional_engagements g WHERE g.person_id = p.person_id AND g.school_id IS NOT NULL
         AND g.valid_from <= current_date AND (g.valid_until IS NULL OR g.valid_until >= current_date)) AS schools_count,
      (SELECT jsonb_object_agg(d.type_code, jsonb_build_object('document_id', d.document_id, 'version', d.version, 'seq', d.seq, 'path', d.storage_path,
          'valid_until', d.valid_until, 'by_school', d.school_id IS NOT NULL,
          'status', CASE WHEN d.valid_until IS NOT NULL AND d.valid_until < current_date THEN 'vencido' ELSE coalesce(d.st, 'pendente_validacao') END))
        FROM docs d WHERE d.person_id = p.person_id) AS docs
    FROM ppl p
  )
  SELECT jsonb_build_object('school_id', _school, 'season', _season, 'can_validate', _can_validate,
    'staff_records_without_person', (SELECT count(*) FROM public.staff_administrative_records r WHERE r.school_id = _school
       AND NOT EXISTS (SELECT 1 FROM public.staff_reconciliation_decisions d WHERE d.staff_record_id = r.id AND d.person_id IS NOT NULL)),
    'people', coalesce((SELECT jsonb_agg(jsonb_build_object('person_id', r.person_id, 'masked_name', r.masked, 'sources', r.sources, 'functions', r.functions,
        'other_schools', greatest(r.schools_count - 1, 0), 'docs', coalesce(r.docs, '{}'::jsonb)) ORDER BY r.masked NULLS LAST) FROM rows r), '[]'::jsonb),
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('request_id', q.request_id, 'seq', q.seq, 'kind', q.kind, 'state', q.state, 'reason', q.reason,
        'person_masked', (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = q.person_id), 'at', q.recorded_at) ORDER BY q.recorded_at DESC)
      FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests WHERE school_id = _school ORDER BY request_id, seq DESC) q), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;

CREATE OR REPLACE FUNCTION public.docserv_link_request(_request uuid, _school text, _person uuid, _kind text, _state text, _reason text, _expected_seq integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE h public.docserv_link_requests; _net boolean := public.has_network_capability('administrar-docserv');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'docserv:reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docserv-req:' || _request::text));
  SELECT * INTO h FROM public.docserv_link_requests WHERE request_id = _request ORDER BY seq DESC LIMIT 1;
  IF coalesce(h.seq, 0) <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'docserv:stale-base'; END IF;
  IF h.id IS NULL THEN
    IF _state <> 'aberta' THEN RAISE EXCEPTION 'docserv:invalid-transition'; END IF;
    IF NOT public.has_school_capability('gerir-documentos-funcionais', _school) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural') THEN RAISE EXCEPTION 'docserv:person-unknown'; END IF;
    IF _kind = 'solicitar-desvinculo' AND NOT EXISTS (SELECT 1 FROM public.docserv_school_people(_school) x WHERE x.person_id = _person) THEN RAISE EXCEPTION 'docserv:not-linked'; END IF;
    IF _kind = 'solicitar-vinculo' AND EXISTS (SELECT 1 FROM public.docserv_school_people(_school) x WHERE x.person_id = _person) THEN RAISE EXCEPTION 'docserv:already-linked'; END IF;
  ELSE
    IF h.state <> 'aberta' THEN RAISE EXCEPTION 'docserv:invalid-transition'; END IF;
    _school := h.school_id; _person := h.person_id; _kind := h.kind;
    IF _state = 'cancelada' AND NOT public.has_school_capability('gerir-documentos-funcionais', _school) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
    IF _state IN ('encaminhada-ao-dp','recusada') AND NOT _net THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
    IF _state NOT IN ('cancelada','encaminhada-ao-dp','recusada') THEN RAISE EXCEPTION 'docserv:invalid-transition'; END IF;
  END IF;
  INSERT INTO public.docserv_link_requests (request_id, seq, school_id, person_id, kind, state, reason, actor)
  VALUES (_request, coalesce(h.seq, 0) + 1, _school, _person, _kind, _state, btrim(_reason), auth.uid());
  INSERT INTO public.docserv_audit_events (action, actor, school_id, subject_ref, detail)
  VALUES ('solicitacao-' || _state, auth.uid(), _school, _request::text, jsonb_build_object('kind', _kind));
  RETURN coalesce(h.seq, 0) + 1;
END $$;

CREATE OR REPLACE FUNCTION public.docserv_person_in_school(_person uuid, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.docserv_school_people(_school) x WHERE x.person_id = _person)
$$;

REVOKE ALL ON FUNCTION public.docserv_school_roster(text, text), public.docserv_link_request(uuid, text, uuid, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.docserv_school_roster(text, text), public.docserv_link_request(uuid, text, uuid, text, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.bo_fixture_grant_capability(_operation_id text, _user_id uuid, _capability text, _school text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE _a public.bo_fixture_accounts; _id uuid;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  IF _capability NOT IN ('manter-regras-de-resultado','registrar-folha-final','consultar-folha-final','manter-quadro-permanente-op',
      'manter-catalogo-tecnico-alimentar','manter-referencias-contratuais-alimentacao','designar-inspetor-alimentacao',
      'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar','acompanhar-alimentacao-rede','consolidar-demanda-alimentar',
      'manter-parametros-nutricionais','manter-planejamento-nutricional','administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'registrar-programacao-de-entrega-alimentar','gerir-documentos-alimentacao','fechar-estoque-alimentar','exportar-relatorios-alimentacao',
      'consultar-alimentacao-escolar','submeter-pedido-alimentar','conferir-recebimento-alimentar','registrar-estoque-alimentar',
      'ajustar-estoque-alimentar','aprovar-inventario-alimentar','registrar-execucao-alimentacao','registrar-nao-conformidade-alimentar',
      'manter-modelo-de-documento-escolar','emitir-documento-escolar','consultar-documento-escolar','emitir-carteirinha-estudantil',
      'preparar-mapa-estatistico','oficializar-mapa-estatistico','preparar-censo-escolar','gerir-documentos-funcionais','validar-documentos-funcionais','administrar-docserv')
    THEN RAISE EXCEPTION 'bo:capability-not-allowlisted'; END IF;
  SELECT * INTO _a FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id AND a.user_id = _user_id;
  IF _a.user_id IS NULL OR _a.person_id IS NULL THEN RAISE EXCEPTION 'bo:not-a-fixture-account'; END IF;
  IF _school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'bo:school-unknown'; END IF;
  INSERT INTO public.bo_fixture_capability_grants(operation_id, user_id, person_id, capability_id, scope_level, school_id, expires_at)
    VALUES (_operation_id, _user_id, _a.person_id, _capability, CASE WHEN _school IS NULL THEN 'rede' ELSE 'escola' END, _school, now() + interval '2 hours')
    RETURNING id INTO _id;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_docserv_requests(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer; users uuid[];
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  SELECT coalesce(array_agg(a.user_id), '{}') INTO users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  IF EXISTS (SELECT 1 FROM public.docserv_link_requests r WHERE r.request_id IN (SELECT request_id FROM public.docserv_link_requests WHERE actor = ANY(users)) AND NOT r.actor = ANY(users))
    THEN RAISE EXCEPTION 'bo:docserv-mixed-chain'; END IF;
  PERFORM set_config('sigem.docserv_cleanup_op', _operation_id, true);
  DELETE FROM public.docserv_link_requests r WHERE r.actor = ANY(users); GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('sigem.docserv_cleanup_op', '', true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_docserv_requests(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_docserv_requests(text) TO service_role;

CREATE OR REPLACE FUNCTION public.docserv_can_read(_person uuid, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _person = public.docserv_my_person()
    OR public.has_network_capability('validar-documentos-funcionais')
    OR EXISTS (SELECT 1 FROM public.institutional_schools s WHERE public.has_school_capability('gerir-documentos-funcionais', s.id::text)
       AND public.docserv_person_in_school(_person, s.id::text)))
$$;
DROP POLICY IF EXISTS "docserv objects insert" ON storage.objects;
CREATE POLICY "docserv objects insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'docserv-documentos' AND (
    (storage.foldername(name))[1] = public.docserv_my_person()::text
    OR EXISTS (SELECT 1 FROM public.institutional_schools s WHERE public.has_school_capability('gerir-documentos-funcionais', s.id::text)
       AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
       AND public.docserv_person_in_school(((storage.foldername(name))[1])::uuid, s.id::text))));