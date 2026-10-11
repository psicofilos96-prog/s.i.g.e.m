-- DocServ LOTES 05–13. NIE aqui = núcleo da rede do DocServ (capability administrar-docserv/validar-documentos-funcionais), nunca o NEI de inclusão.

-- 06: política parametrizável, versionada; a legada entra como RASCUNHO (nunca vigente sem aprovação).
CREATE TABLE IF NOT EXISTS public.docserv_document_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('rascunho','aprovada')),
  origin text NOT NULL,
  rules jsonb NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  actor uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.docserv_document_policies IS 'Política documental do DocServ (append-only). rules = {tipo: {obrigatorio, validade_meses, aviso_dias, retencao_dias}}. Só status aprovada produz efeito; a legada é rascunho.';
GRANT SELECT ON public.docserv_document_policies TO authenticated;
GRANT ALL ON public.docserv_document_policies TO service_role;
ALTER TABLE public.docserv_document_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docserv policies read" ON public.docserv_document_policies;
CREATE POLICY "docserv policies read" ON public.docserv_document_policies FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS docserv_policies_no_change ON public.docserv_document_policies;
CREATE TRIGGER docserv_policies_no_change BEFORE UPDATE OR DELETE ON public.docserv_document_policies FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();
INSERT INTO public.docserv_document_policies (version, status, origin, rules, reason)
SELECT 1, 'rascunho', 'legado DocServ',
  '{"antecedente_criminal":{"obrigatorio":true,"validade_meses":null,"aviso_dias":30,"retencao_dias":null},"antecedente_civil":{"obrigatorio":false,"validade_meses":null,"aviso_dias":30,"retencao_dias":null}}'::jsonb,
  'Transcrição da regra do DocServ de origem; sem efeito até aprovação'
WHERE NOT EXISTS (SELECT 1 FROM public.docserv_document_policies);

CREATE OR REPLACE FUNCTION public.docserv_policy_current() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'approved', (SELECT to_jsonb(p) FROM public.docserv_document_policies p WHERE p.status = 'aprovada' ORDER BY p.version DESC LIMIT 1),
    'latest', (SELECT to_jsonb(p) FROM public.docserv_document_policies p ORDER BY p.version DESC LIMIT 1))
$$;

CREATE OR REPLACE FUNCTION public.docserv_record_policy(_rules jsonb, _status text, _reason text, _expected_version integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head int; k text; r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _status NOT IN ('rascunho','aprovada') THEN RAISE EXCEPTION 'docserv:invalid-status'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'docserv:reason-required'; END IF;
  IF jsonb_typeof(_rules) <> 'object' THEN RAISE EXCEPTION 'docserv:invalid-rules'; END IF;
  FOR k, r IN SELECT * FROM jsonb_each(_rules) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.docserv_document_types t WHERE t.code = k) THEN RAISE EXCEPTION 'docserv:unknown-type'; END IF;
    IF jsonb_typeof(r->'obrigatorio') <> 'boolean' THEN RAISE EXCEPTION 'docserv:invalid-rules'; END IF;
    IF (r ? 'validade_meses' AND jsonb_typeof(r->'validade_meses') NOT IN ('null','number'))
       OR (r ? 'aviso_dias' AND jsonb_typeof(r->'aviso_dias') NOT IN ('null','number'))
       OR (r ? 'retencao_dias' AND jsonb_typeof(r->'retencao_dias') NOT IN ('null','number')) THEN RAISE EXCEPTION 'docserv:invalid-rules'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('docserv-policy'));
  SELECT coalesce(max(version), 0) INTO _head FROM public.docserv_document_policies;
  IF _head <> _expected_version THEN RAISE EXCEPTION 'docserv:stale-base'; END IF;
  INSERT INTO public.docserv_document_policies (version, status, origin, rules, reason, actor) VALUES (_head + 1, _status, 'rede', _rules, btrim(_reason), auth.uid());
  INSERT INTO public.docserv_audit_events (action, actor, subject_ref, detail) VALUES ('politica-' || _status, auth.uid(), 'policy', jsonb_build_object('version', _head + 1));
  RETURN _head + 1;
END $$;

-- 09: temporadas (ano + ciclo 1/2/3), append-only por versão.
CREATE TABLE IF NOT EXISTS public.docserv_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year text NOT NULL CHECK (year ~ '^\d{4}$'),
  cycle smallint NOT NULL CHECK (cycle IN (1,2,3)),
  seq integer NOT NULL,
  opens_on date NOT NULL,
  closes_on date NOT NULL CHECK (closes_on >= opens_on),
  status text NOT NULL CHECK (status IN ('aberta','encerrada')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  actor uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, cycle, seq)
);
GRANT SELECT ON public.docserv_seasons TO authenticated;
GRANT ALL ON public.docserv_seasons TO service_role;
ALTER TABLE public.docserv_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docserv seasons read" ON public.docserv_seasons;
CREATE POLICY "docserv seasons read" ON public.docserv_seasons FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS docserv_seasons_no_change ON public.docserv_seasons;
CREATE TRIGGER docserv_seasons_no_change BEFORE UPDATE OR DELETE ON public.docserv_seasons FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();

CREATE OR REPLACE FUNCTION public.docserv_record_season(_year text, _cycle smallint, _opens date, _closes date, _status text, _reason text, _expected_seq integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docserv-season:' || _year || ':' || _cycle));
  SELECT coalesce(max(seq), 0) INTO _head FROM public.docserv_seasons WHERE year = _year AND cycle = _cycle;
  IF _head <> _expected_seq THEN RAISE EXCEPTION 'docserv:stale-base'; END IF;
  INSERT INTO public.docserv_seasons (year, cycle, seq, opens_on, closes_on, status, reason, actor) VALUES (_year, _cycle, _head + 1, _opens, _closes, _status, btrim(_reason), auth.uid());
  INSERT INTO public.docserv_audit_events (action, actor, subject_ref, detail) VALUES ('temporada-' || _status, auth.uid(), _year || '/' || _cycle, jsonb_build_object('seq', _head + 1));
  RETURN _head + 1;
END $$;

CREATE OR REPLACE FUNCTION public.docserv_seasons_current() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.year DESC, s.cycle), '[]'::jsonb)
  FROM (SELECT DISTINCT ON (year, cycle) * FROM public.docserv_seasons ORDER BY year, cycle, seq DESC) s
$$;

-- 07/09: envio v2 com ciclo e sugestão de leitura do PDF (guardada como sugestão, nunca decisão).
ALTER TABLE public.docserv_document_versions ADD COLUMN IF NOT EXISTS cycle smallint CHECK (cycle IS NULL OR cycle IN (1,2,3));
ALTER TABLE public.docserv_document_versions ADD COLUMN IF NOT EXISTS extraction_suggestion jsonb;
COMMENT ON COLUMN public.docserv_document_versions.extraction_suggestion IS 'Datas/emissor lidos do PDF no navegador e se a pessoa aceitou ou corrigiu. Sugestão: a validade gravada é a confirmada pela pessoa.';

CREATE OR REPLACE FUNCTION public.docserv_submit_document_v2(_document uuid, _person uuid, _type text, _season text, _cycle smallint, _school text,
  _path text, _sha text, _mime text, _size integer, _issuer text, _issued date, _valid_until date, _extraction jsonb, _expected_version integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _vid uuid; _has_seasons boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.docserv_seasons s WHERE s.year = _season) INTO _has_seasons;
  IF _has_seasons THEN
    IF _cycle IS NULL OR NOT EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (year, cycle) * FROM public.docserv_seasons WHERE year = _season AND cycle = _cycle ORDER BY year, cycle, seq DESC) s
       WHERE s.status = 'aberta' AND current_date BETWEEN s.opens_on AND s.closes_on) THEN RAISE EXCEPTION 'docserv:season-closed'; END IF;
  END IF;
  IF _extraction IS NOT NULL AND (jsonb_typeof(_extraction) <> 'object' OR length(_extraction::text) > 4000) THEN RAISE EXCEPTION 'docserv:invalid-extraction'; END IF;
  _vid := public.docserv_submit_document(_document, _person, _type, _season, _school, _path, _sha, _mime, _size, _issuer, _issued, _valid_until, _expected_version);
  PERFORM set_config('sigem.docserv_v2_patch', _vid::text, true);
  UPDATE public.docserv_document_versions SET cycle = _cycle, extraction_suggestion = _extraction WHERE id = _vid;
  PERFORM set_config('sigem.docserv_v2_patch', '', true);
  RETURN _vid;
END $$;

-- append-only com uma exceção: o v2 completa ciclo/sugestão da versão recém-criada na MESMA transação.
CREATE OR REPLACE FUNCTION public.docserv_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND coalesce(current_setting('sigem.docserv_cleanup_op', true), '') ~ '^bo-[0-9a-f]{12}$' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'docserv_document_versions' AND coalesce(current_setting('sigem.docserv_v2_patch', true), '') = OLD.id::text
     AND (to_jsonb(NEW) - 'cycle' - 'extraction_suggestion') = (to_jsonb(OLD) - 'cycle' - 'extraction_suggestion')
     AND OLD.cycle IS NULL AND OLD.extraction_suggestion IS NULL THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'docserv:append-only';
END $$;

-- 08: download/ZIP registrado; exclusão permanente só com retenção aprovada e prazo cumprido.
CREATE TABLE IF NOT EXISTS public.docserv_purges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  storage_path text NOT NULL,
  policy_version integer NOT NULL,
  reason text NOT NULL,
  actor uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_path)
);
COMMENT ON TABLE public.docserv_purges IS 'Autorização de exclusão permanente do ARQUIVO; metadados e hash permanecem como prova.';
GRANT SELECT ON public.docserv_purges TO authenticated;
GRANT ALL ON public.docserv_purges TO service_role;
ALTER TABLE public.docserv_purges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docserv purges read" ON public.docserv_purges;
CREATE POLICY "docserv purges read" ON public.docserv_purges FOR SELECT TO authenticated USING ((SELECT public.has_network_capability('administrar-docserv')));
DROP TRIGGER IF EXISTS docserv_purges_no_change ON public.docserv_purges;
CREATE TRIGGER docserv_purges_no_change BEFORE UPDATE OR DELETE ON public.docserv_purges FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();

CREATE OR REPLACE FUNCTION public.docserv_authorize_purge(_document uuid, _reason text) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pol public.docserv_document_policies; del timestamptz; ty text; days numeric; paths text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'docserv:reason-required'; END IF;
  SELECT * INTO pol FROM public.docserv_document_policies WHERE status = 'aprovada' ORDER BY version DESC LIMIT 1;
  IF pol.id IS NULL THEN RAISE EXCEPTION 'docserv:retention-undecided'; END IF;
  SELECT type_code INTO ty FROM public.docserv_document_versions WHERE document_id = _document LIMIT 1;
  days := (pol.rules->ty->>'retencao_dias')::numeric;
  IF days IS NULL THEN RAISE EXCEPTION 'docserv:retention-undecided'; END IF;
  SELECT e.recorded_at INTO del FROM public.docserv_document_events e WHERE e.document_id = _document ORDER BY e.seq DESC LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM public.docserv_document_events e WHERE e.document_id = _document AND e.kind = 'excluido-logico'
     AND e.seq = (SELECT max(seq) FROM public.docserv_document_events x WHERE x.document_id = _document)) THEN RAISE EXCEPTION 'docserv:not-deleted'; END IF;
  IF del + make_interval(days => days::int) > now() THEN RAISE EXCEPTION 'docserv:retention-not-reached'; END IF;
  SELECT array_agg(storage_path) INTO paths FROM public.docserv_document_versions WHERE document_id = _document;
  INSERT INTO public.docserv_purges (document_id, storage_path, policy_version, reason, actor)
    SELECT _document, p, pol.version, btrim(_reason), auth.uid() FROM unnest(paths) p ON CONFLICT (storage_path) DO NOTHING;
  INSERT INTO public.docserv_audit_events (action, actor, subject_ref, detail) VALUES ('exclusao-permanente-autorizada', auth.uid(), _document::text, jsonb_build_object('files', coalesce(array_length(paths,1),0), 'policy', pol.version));
  RETURN paths;
END $$;
DROP POLICY IF EXISTS "docserv objects purge" ON storage.objects;
CREATE POLICY "docserv objects purge" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'docserv-documentos' AND public.has_network_capability('administrar-docserv')
  AND EXISTS (SELECT 1 FROM public.docserv_purges p WHERE p.storage_path = name));

CREATE OR REPLACE FUNCTION public.docserv_log_download(_documents uuid[], _zip boolean) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF coalesce(array_length(_documents, 1), 0) = 0 OR array_length(_documents, 1) > 50 THEN RAISE EXCEPTION 'docserv:invalid-batch'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_documents) d WHERE NOT EXISTS (SELECT 1 FROM public.docserv_document_versions v WHERE v.document_id = d AND public.docserv_can_read(v.person_id, v.school_id)))
    THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  SELECT array_length(_documents, 1) INTO n;
  INSERT INTO public.docserv_audit_events (action, actor, subject_ref, detail) VALUES (CASE WHEN _zip THEN 'download-zip' ELSE 'download' END, auth.uid(), 'lote', jsonb_build_object('documents', n));
  RETURN n;
END $$;

-- 09: snapshots de vínculos e confirmação anual da escola.
CREATE TABLE IF NOT EXISTS public.docserv_link_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  season text NOT NULL,
  cycle smallint,
  kind text NOT NULL CHECK (kind IN ('confirmacao-anual','fotografia-rede','restauracao')),
  people jsonb NOT NULL,
  people_count integer NOT NULL,
  sha256 text NOT NULL,
  restores_id uuid REFERENCES public.docserv_link_snapshots(id),
  reason text,
  actor uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.docserv_link_snapshots IS 'Fotografia dos servidores vinculados (atuação OU lotação) por escola e temporada. Restauração não grava vínculo: gera solicitações ao DP.';
GRANT SELECT ON public.docserv_link_snapshots TO authenticated;
GRANT ALL ON public.docserv_link_snapshots TO service_role;
ALTER TABLE public.docserv_link_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docserv snapshots read" ON public.docserv_link_snapshots;
CREATE POLICY "docserv snapshots read" ON public.docserv_link_snapshots FOR SELECT TO authenticated
  USING (public.has_school_capability('gerir-documentos-funcionais', school_id) OR public.has_network_capability('administrar-docserv'));
DROP TRIGGER IF EXISTS docserv_snapshots_no_change ON public.docserv_link_snapshots;
CREATE TRIGGER docserv_snapshots_no_change BEFORE UPDATE OR DELETE ON public.docserv_link_snapshots FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();

CREATE OR REPLACE FUNCTION public.docserv_snapshot_school(_school text, _season text, _cycle smallint, _kind text, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p jsonb; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF _kind = 'confirmacao-anual' AND NOT public.has_school_capability('gerir-documentos-funcionais', _school) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _kind = 'fotografia-rede' AND NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _kind NOT IN ('confirmacao-anual','fotografia-rede') THEN RAISE EXCEPTION 'docserv:invalid-kind'; END IF;
  IF _season !~ '^\d{4}$' THEN RAISE EXCEPTION 'docserv:invalid-season'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('person_id', x.person_id, 'sources', x.sources, 'functions', x.functions) ORDER BY x.person_id), '[]'::jsonb) INTO _p
    FROM public.docserv_school_people(_school) x;
  INSERT INTO public.docserv_link_snapshots (school_id, season, cycle, kind, people, people_count, sha256, reason, actor)
  VALUES (_school, _season, _cycle, _kind, _p, jsonb_array_length(_p), encode(extensions.digest(_p::text, 'sha256'), 'hex'), nullif(btrim(_reason), ''), auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.docserv_audit_events (action, actor, school_id, subject_ref, detail) VALUES ('snapshot-' || _kind, auth.uid(), _school, _id::text, jsonb_build_object('people', jsonb_array_length(_p), 'season', _season));
  RETURN _id;
END $$;

-- 10: solicitações com natureza (titular/dobra/AJT) e conflitos explícitos.
ALTER TABLE public.docserv_link_requests ADD COLUMN IF NOT EXISTS nature text CHECK (nature IS NULL OR nature IN ('titular','dobra','ajt','nao-informado'));

CREATE OR REPLACE FUNCTION public.docserv_link_request_v2(_request uuid, _school text, _person uuid, _kind text, _nature text, _state text, _reason text, _expected_seq integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _seq int;
BEGIN
  IF _expected_seq = 0 THEN
    IF EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests ORDER BY request_id, seq DESC) q
               WHERE q.person_id = _person AND q.school_id = _school AND q.kind = _kind AND q.state = 'aberta') THEN RAISE EXCEPTION 'docserv:conflict-open-request'; END IF;
    IF _nature = 'titular' AND EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests ORDER BY request_id, seq DESC) q
               WHERE q.person_id = _person AND q.nature = 'titular' AND q.kind = 'solicitar-vinculo' AND q.state = 'aberta' AND q.school_id <> _school) THEN RAISE EXCEPTION 'docserv:conflict-titular-elsewhere'; END IF;
  END IF;
  _seq := public.docserv_link_request(_request, _school, _person, _kind, _state, _reason, _expected_seq);
  IF _expected_seq = 0 AND _nature IS NOT NULL THEN
    PERFORM set_config('sigem.docserv_req_patch', _request::text, true);
    UPDATE public.docserv_link_requests SET nature = _nature WHERE request_id = _request AND seq = 1;
    PERFORM set_config('sigem.docserv_req_patch', '', true);
  END IF;
  RETURN _seq;
END $$;

CREATE OR REPLACE FUNCTION public.docserv_link_requests_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND coalesce(current_setting('sigem.docserv_req_patch', true), '') = OLD.request_id::text AND OLD.nature IS NULL
     AND (to_jsonb(NEW) - 'nature') = (to_jsonb(OLD) - 'nature') THEN RETURN NEW; END IF;
  RETURN public.docserv_append_only_row(TG_OP, OLD);
END $$;
CREATE OR REPLACE FUNCTION public.docserv_append_only_row(_op text, _old public.docserv_link_requests) RETURNS public.docserv_link_requests LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF _op = 'DELETE' AND coalesce(current_setting('sigem.docserv_cleanup_op', true), '') ~ '^bo-[0-9a-f]{12}$' THEN RETURN _old; END IF;
  RAISE EXCEPTION 'docserv:append-only';
END $$;
DROP TRIGGER IF EXISTS docserv_link_requests_no_change ON public.docserv_link_requests;
CREATE TRIGGER docserv_link_requests_no_change BEFORE UPDATE OR DELETE ON public.docserv_link_requests FOR EACH ROW EXECUTE FUNCTION public.docserv_link_requests_guard();

-- Restauração auditada: compara snapshot × hoje e abre solicitações para quem saiu (nunca grava vínculo).
CREATE OR REPLACE FUNCTION public.docserv_restore_snapshot(_snapshot uuid, _reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.docserv_link_snapshots; n int := 0; pid uuid; _new uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'docserv:reason-required'; END IF;
  SELECT * INTO s FROM public.docserv_link_snapshots WHERE id = _snapshot;
  IF s.id IS NULL THEN RAISE EXCEPTION 'docserv:not-found'; END IF;
  IF NOT public.has_school_capability('gerir-documentos-funcionais', s.school_id) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  FOR pid IN SELECT (e->>'person_id')::uuid FROM jsonb_array_elements(s.people) e
             WHERE NOT EXISTS (SELECT 1 FROM public.docserv_school_people(s.school_id) x WHERE x.person_id = (e->>'person_id')::uuid) LOOP
    IF NOT EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests ORDER BY request_id, seq DESC) q
                   WHERE q.person_id = pid AND q.school_id = s.school_id AND q.kind = 'solicitar-vinculo' AND q.state = 'aberta') THEN
      PERFORM public.docserv_link_request(gen_random_uuid(), s.school_id, pid, 'solicitar-vinculo', 'aberta', 'Restauração da fotografia ' || left(s.sha256, 8) || ': ' || btrim(_reason), 0);
      n := n + 1;
    END IF;
  END LOOP;
  SELECT id INTO _new FROM public.docserv_link_snapshots WHERE false;
  INSERT INTO public.docserv_link_snapshots (school_id, season, cycle, kind, people, people_count, sha256, restores_id, reason, actor)
  VALUES (s.school_id, s.season, s.cycle, 'restauracao', s.people, s.people_count, s.sha256, s.id, btrim(_reason), auth.uid());
  INSERT INTO public.docserv_audit_events (action, actor, school_id, subject_ref, detail) VALUES ('snapshot-restauracao', auth.uid(), s.school_id, s.id::text, jsonb_build_object('requests', n));
  RETURN n;
END $$;

-- 05: painel central (rede): por escola sem duplicar pessoa entre escolas no total.
CREATE OR REPLACE FUNCTION public.docserv_network_overview(_season text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT (public.has_network_capability('administrar-docserv') OR public.has_network_capability('validar-documentos-funcionais')) THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _season !~ '^\d{4}$' THEN RAISE EXCEPTION 'docserv:invalid-season'; END IF;
  WITH sp AS (
    SELECT s.id::text AS school_id, s.name AS school_name, x.person_id FROM public.institutional_schools s CROSS JOIN LATERAL public.docserv_school_people(s.id::text) x
  ), cur AS (
    SELECT DISTINCT ON (v.person_id, v.type_code) v.person_id, v.type_code, v.document_id, v.valid_until, e.kind,
      (SELECT e2.status FROM public.docserv_document_events e2 WHERE e2.version_id = v.id AND e2.status IS NOT NULL ORDER BY e2.seq DESC LIMIT 1) AS st
    FROM (SELECT DISTINCT ON (document_id) * FROM public.docserv_document_versions ORDER BY document_id, version DESC) v
    JOIN LATERAL (SELECT * FROM public.docserv_document_events x WHERE x.document_id = v.document_id ORDER BY x.seq DESC LIMIT 1) e ON true
    WHERE v.season = _season AND e.kind <> 'excluido-logico' ORDER BY v.person_id, v.type_code, v.submitted_at DESC
  ), crim AS (
    SELECT p.person_id, CASE WHEN c.document_id IS NULL THEN 'sem-envio' WHEN c.valid_until < current_date THEN 'problema'
      WHEN c.st = 'valido' THEN 'valido' WHEN coalesce(c.st, 'pendente_validacao') = 'pendente_validacao' THEN 'pendente' ELSE 'problema' END AS st
    FROM (SELECT DISTINCT person_id FROM sp) p LEFT JOIN cur c ON c.person_id = p.person_id AND c.type_code = 'antecedente_criminal'
  )
  SELECT jsonb_build_object('season', _season,
    'can_validate', public.has_network_capability('validar-documentos-funcionais'),
    'totals', jsonb_build_object('servidores', (SELECT count(*) FROM crim),
       'sem-envio', (SELECT count(*) FROM crim WHERE st = 'sem-envio'), 'pendente', (SELECT count(*) FROM crim WHERE st = 'pendente'),
       'problema', (SELECT count(*) FROM crim WHERE st = 'problema'), 'valido', (SELECT count(*) FROM crim WHERE st = 'valido'),
       'multiescola', (SELECT count(*) FROM (SELECT person_id FROM sp GROUP BY person_id HAVING count(*) > 1) m),
       'escolas_sem_servidor', (SELECT count(*) FROM public.institutional_schools s WHERE NOT EXISTS (SELECT 1 FROM sp WHERE sp.school_id = s.id::text))),
    'schools', coalesce((SELECT jsonb_agg(jsonb_build_object('school_id', g.school_id, 'name', g.school_name, 'servidores', g.n, 'sem_envio', g.se, 'pendente', g.pe, 'problema', g.pr, 'valido', g.va) ORDER BY g.school_name)
       FROM (SELECT sp.school_id, sp.school_name, count(DISTINCT sp.person_id) n,
               count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'sem-envio') se, count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'pendente') pe,
               count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'problema') pr, count(DISTINCT sp.person_id) FILTER (WHERE c.st = 'valido') va
             FROM sp JOIN crim c ON c.person_id = sp.person_id GROUP BY 1, 2) g), '[]'::jsonb),
    'queue', coalesce((SELECT jsonb_agg(jsonb_build_object('document_id', c.document_id, 'type', c.type_code,
        'masked_name', (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = c.person_id),
        'status', coalesce(c.st, 'pendente_validacao'),
        'seq', (SELECT max(seq) FROM public.docserv_document_events e WHERE e.document_id = c.document_id),
        'path', (SELECT v.storage_path FROM public.docserv_document_versions v WHERE v.document_id = c.document_id ORDER BY v.version DESC LIMIT 1)))
      FROM cur c WHERE coalesce(c.st, 'pendente_validacao') IN ('pendente_validacao','alerta_revisao_urgente') AND (c.valid_until IS NULL OR c.valid_until >= current_date)
      LIMIT 300), '[]'::jsonb),
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('request_id', q.request_id, 'seq', q.seq, 'school_id', q.school_id, 'kind', q.kind, 'nature', q.nature, 'state', q.state, 'reason', q.reason, 'at', q.recorded_at,
        'person_masked', (SELECT public.educacenso_mask_name(ip.display_name) FROM public.institutional_persons ip WHERE ip.id = q.person_id),
        'conflict', EXISTS (SELECT 1 FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests ORDER BY request_id, seq DESC) o
                            WHERE o.person_id = q.person_id AND o.request_id <> q.request_id AND o.state = 'aberta' AND o.nature = 'titular' AND q.nature = 'titular')) ORDER BY q.recorded_at DESC)
      FROM (SELECT DISTINCT ON (request_id) * FROM public.docserv_link_requests ORDER BY request_id, seq DESC) q WHERE q.state = 'aberta'), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('action', a.action, 'school_id', a.school_id, 'at', a.recorded_at, 'detail', a.detail) ORDER BY a.recorded_at DESC)
      FROM (SELECT * FROM public.docserv_audit_events ORDER BY recorded_at DESC LIMIT 200) a), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;

-- 13: resolução idempotente (mesmo resultado ⇒ não regrava).
CREATE OR REPLACE FUNCTION public.docserv_resolve_identity(_kind text, _matricula text, _cpf text, _inep text, _commit boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _hm text; _cands jsonb; _n int; _out text; _key text; h public.docserv_identity_links; _pid uuid; _sid text; _written boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _kind NOT IN ('servidor','escola') THEN RAISE EXCEPTION 'docserv:invalid-kind'; END IF;
  _matricula := nullif(btrim(coalesce(_matricula,'')), ''); _inep := nullif(regexp_replace(coalesce(_inep,''), '\s', '', 'g'), '');
  IF _cpf IS NOT NULL AND regexp_replace(_cpf, '\D', '', 'g') ~ '^\d{11}$' THEN _hm := public.technical_cpf_hmac(regexp_replace(_cpf, '\D', '', 'g')); END IF;
  IF _kind = 'escola' THEN
    IF _inep IS NULL THEN RAISE EXCEPTION 'docserv:identifier-required'; END IF;
    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('school_id', i.school_id::text)), '[]'::jsonb) INTO _cands
      FROM public.institutional_school_identifiers i WHERE i.identifier_kind = 'inep' AND i.value = _inep;
  ELSE
    IF _hm IS NULL AND _matricula IS NULL AND _inep IS NULL THEN RAISE EXCEPTION 'docserv:identifier-required'; END IF;
    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('person_id', x.pid::text, 'via', x.via)), '[]'::jsonb) INTO _cands FROM (
      SELECT i.person_id AS pid, 'cpf' AS via FROM public.institutional_person_identifiers i WHERE _hm IS NOT NULL AND i.identifier_kind = 'cpf-hmac' AND i.value = _hm
      UNION SELECT i.person_id, 'inep' FROM public.institutional_person_identifiers i WHERE _inep IS NOT NULL AND i.identifier_kind = 'inep-pessoa' AND i.value = _inep
      UNION SELECT d.person_id, 'matricula' FROM public.staff_reconciliation_decisions d JOIN public.staff_administrative_records r ON r.id = d.staff_record_id
        WHERE _matricula IS NOT NULL AND r.registration = _matricula AND d.person_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.staff_reconciliation_decisions s2 WHERE s2.supersedes_id = d.id)) x;
  END IF;
  SELECT count(DISTINCT coalesce(e->>'person_id', e->>'school_id')) INTO _n FROM jsonb_array_elements(_cands) e;
  _out := CASE WHEN _n = 1 THEN 'vinculado' WHEN _n = 0 THEN 'sem-correspondencia' ELSE 'ambiguo' END;
  IF _out = 'vinculado' THEN IF _kind = 'servidor' THEN _pid := (_cands->0->>'person_id')::uuid; ELSE _sid := _cands->0->>'school_id'; END IF; END IF;
  _key := md5(_kind || '|' || coalesce(_matricula,'') || '|' || coalesce(_hm,'') || '|' || coalesce(_inep,''));
  IF _commit THEN
    PERFORM pg_advisory_xact_lock(hashtext('docserv-link:' || _key));
    SELECT * INTO h FROM public.docserv_identity_links WHERE link_key = _key ORDER BY seq DESC LIMIT 1;
    IF h.id IS NULL OR (NOT h.decided_manually AND (h.outcome <> _out OR h.candidates <> _cands)) THEN
      INSERT INTO public.docserv_identity_links (link_key, seq, subject_kind, matricula, cpf_hmac, inep, outcome, person_id, school_id, candidates, recorded_by)
      VALUES (_key, coalesce(h.seq, 0) + 1, _kind, _matricula, _hm, _inep, _out, _pid, _sid, _cands, auth.uid());
      INSERT INTO public.docserv_audit_events (action, actor, subject_ref, detail) VALUES ('identidade-resolvida', auth.uid(), _key, jsonb_build_object('kind', _kind, 'outcome', _out, 'candidates', _n));
      _written := true;
    END IF;
  END IF;
  RETURN jsonb_build_object('outcome', _out, 'candidates', _cands, 'key', _key, 'cpf_informado', _hm IS NOT NULL, 'written', _written,
    'existing', (SELECT l.outcome FROM public.docserv_identity_links l WHERE l.link_key = _key ORDER BY l.seq DESC LIMIT 1));
END $$;

-- fixture cleanup estendido (temporadas/políticas/snapshots/purgas da operação).
CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_docserv_extra(_operation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer := 0; m integer; users uuid[];
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  SELECT coalesce(array_agg(a.user_id), '{}') INTO users FROM public.bo_fixture_accounts a WHERE a.operation_id = _operation_id;
  PERFORM set_config('sigem.docserv_cleanup_op', _operation_id, true);
  DELETE FROM public.docserv_purges p WHERE p.actor = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_link_snapshots s WHERE s.actor = ANY(users) AND s.restores_id IS NOT NULL; GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_link_snapshots s WHERE s.actor = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_seasons s WHERE s.actor = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.docserv_document_policies p WHERE p.actor = ANY(users); GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  PERFORM set_config('sigem.docserv_cleanup_op', '', true);
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.docserv_policy_current(), public.docserv_record_policy(jsonb, text, text, integer), public.docserv_record_season(text, smallint, date, date, text, text, integer),
  public.docserv_seasons_current(), public.docserv_submit_document_v2(uuid, uuid, text, text, smallint, text, text, text, text, integer, text, date, date, jsonb, integer),
  public.docserv_authorize_purge(uuid, text), public.docserv_log_download(uuid[], boolean), public.docserv_snapshot_school(text, text, smallint, text, text),
  public.docserv_link_request_v2(uuid, text, uuid, text, text, text, text, integer), public.docserv_restore_snapshot(uuid, text), public.docserv_network_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.docserv_policy_current(), public.docserv_record_policy(jsonb, text, text, integer), public.docserv_record_season(text, smallint, date, date, text, text, integer),
  public.docserv_seasons_current(), public.docserv_submit_document_v2(uuid, uuid, text, text, smallint, text, text, text, text, integer, text, date, date, jsonb, integer),
  public.docserv_authorize_purge(uuid, text), public.docserv_log_download(uuid[], boolean), public.docserv_snapshot_school(text, text, smallint, text, text),
  public.docserv_link_request_v2(uuid, text, uuid, text, text, text, text, integer), public.docserv_restore_snapshot(uuid, text), public.docserv_network_overview(text) TO authenticated;
REVOKE ALL ON FUNCTION public.bo_fixture_cleanup_docserv_extra(text), public.docserv_append_only_row(text, public.docserv_link_requests) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bo_fixture_cleanup_docserv_extra(text) TO service_role;