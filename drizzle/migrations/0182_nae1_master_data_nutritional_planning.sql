-- NAE.1 — Base mestra, planejamento nutricional e documentos técnicos do Núcleo (sem nenhum valor semeado).
-- Um registro mestre versionado por espécie (kind) com cadeia rascunho → conferida → homologada, retificação = nova versão,
-- base esperada (stale), referências só a registros homologados, autoria por pessoa natural e autorização na data de vigência.
-- Conversão, per capita e elegibilidade só existem se registradas e homologadas: nada é presumido.
-- Conteúdo importado entra por staging (hash+contexto, idempotente, conflito fail-closed) e só vira RASCUNHO após conferência.
-- Restrição alimentar: instrução operacional mínima com trilha de consulta; sem diagnóstico, sem anexo médico.

-- 1 — capabilities adicionais no helper de rede (catálogo; nenhuma regra concedida)
CREATE OR REPLACE FUNCTION public.meal_network_grant_on(_capability text, _on date) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('manter-unidades-de-alimentacao','acompanhar-alimentacao-rede',
      'manter-planejamento-nutricional','manter-catalogo-tecnico-alimentar','manter-parametros-nutricionais',
      'administrar-janela-de-pedido-alimentar','analisar-pedido-alimentar','autorizar-pedido-alimentar',
      'consolidar-demanda-alimentar','registrar-programacao-de-entrega-alimentar','gerir-documentos-alimentacao',
      'exportar-relatorios-alimentacao','conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar',
      'manter-referencias-contratuais-alimentacao','designar-inspetor-alimentacao') THEN RAISE EXCEPTION 'meal:capability-not-allowed'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'meal:fact-date-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_network_grant_on(text, date) FROM PUBLIC, anon, authenticated, service_role;

-- 2 — especificação fechada das espécies: capability de manutenção, campos exigidos e referências tipadas
CREATE FUNCTION public.meal_master_spec(_kind text, OUT capability text, OUT required text[], OUT refs text[])
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $fn$
  SELECT s.c, s.r, s.f FROM (VALUES
    ('item-alimentar','manter-catalogo-tecnico-alimentar', ARRAY['nome'], ARRAY[]::text[]),
    ('unidade-de-medida','manter-catalogo-tecnico-alimentar', ARRAY['nome','simbolo'], ARRAY[]::text[]),
    ('apresentacao-embalagem','manter-catalogo-tecnico-alimentar', ARRAY['descricao','quantidade'], ARRAY['item_ref:item-alimentar','unidade_ref:unidade-de-medida']),
    ('especificacao-tecnica','manter-catalogo-tecnico-alimentar', ARRAY['texto'], ARRAY['item_ref:item-alimentar']),
    ('fator-de-conversao','manter-parametros-nutricionais', ARRAY['fator'], ARRAY['de_unidade_ref:unidade-de-medida','para_unidade_ref:unidade-de-medida']),
    ('publico-de-atendimento','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('parametro-per-capita','manter-parametros-nutricionais', ARRAY['quantidade'], ARRAY['item_ref:item-alimentar','publico_ref:publico-de-atendimento','unidade_ref:unidade-de-medida']),
    ('regra-de-elegibilidade-item','manter-parametros-nutricionais', ARRAY['efeito'], ARRAY['item_ref:item-alimentar','publico_ref:publico-de-atendimento']),
    ('necessidade-alimentar-especial','manter-planejamento-nutricional', ARRAY['rotulo'], ARRAY[]::text[]),
    ('receita-ficha-tecnica','manter-planejamento-nutricional', ARRAY['nome','ingredientes'], ARRAY[]::text[]),
    ('cardapio-planejado','manter-planejamento-nutricional', ARRAY['competencia','tipo','entradas'], ARRAY['publico_ref:publico-de-atendimento']),
    ('fornecedor','manter-referencias-contratuais-alimentacao', ARRAY['nome'], ARRAY[]::text[]),
    ('referencia-contratual','manter-referencias-contratuais-alimentacao', ARRAY['natureza','numero'], ARRAY['fornecedor_ref:fornecedor']),
    ('marca-aprovada','manter-referencias-contratuais-alimentacao', ARRAY['marca'], ARRAY['item_ref:item-alimentar','contrato_ref:referencia-contratual']),
    ('programacao-de-entrega','manter-referencias-contratuais-alimentacao', ARRAY['frequencia'], ARRAY['item_ref:item-alimentar','contrato_ref:referencia-contratual']),
    ('designacao-inspetor','designar-inspetor-alimentacao', ARRAY['pessoa_id'], ARRAY[]::text[]),
    ('treinamento-inspetor','designar-inspetor-alimentacao', ARRAY['realizado_em'], ARRAY['designacao_ref:designacao-inspetor']),
    ('documento-tecnico','gerir-documentos-alimentacao', ARRAY['titulo','categoria','natureza','sha256'], ARRAY[]::text[])
  ) AS s(k, c, r, f) WHERE s.k = _kind
$fn$;

CREATE TABLE public.meal_master_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.meal_master_records(id),
  status text NOT NULL CHECK (status IN ('rascunho','conferida','homologada','retirada')),
  school_id text REFERENCES public.institutional_schools(id),
  valid_from date NOT NULL,
  valid_to date CHECK (valid_to IS NULL OR valid_to >= valid_from),
  payload jsonb NOT NULL,
  source_staging_id uuid,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE INDEX meal_master_records_kind_idx ON public.meal_master_records(kind, logical_id, version DESC);
GRANT SELECT ON public.meal_master_records TO service_role;
ALTER TABLE public.meal_master_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_master_records_append_only BEFORE UPDATE OR DELETE ON public.meal_master_records FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE TABLE public.meal_content_stagings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  context_key text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  source_name text,
  rows jsonb NOT NULL CHECK (jsonb_typeof(rows) = 'array'),
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, context_key, sha256)
);
CREATE TABLE public.meal_content_staging_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id uuid NOT NULL REFERENCES public.meal_content_stagings(id),
  action text NOT NULL CHECK (action IN ('conferencia','rejeicao','aplicacao')),
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staging_id, action)
);
CREATE TABLE public.meal_sensitive_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  consulted_on date NOT NULL,
  purpose text NOT NULL,
  rows_returned integer NOT NULL,
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meal_content_stagings, public.meal_content_staging_events, public.meal_sensitive_access_events TO service_role;
ALTER TABLE public.meal_content_stagings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_content_staging_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_sensitive_access_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meal_content_stagings_append_only BEFORE UPDATE OR DELETE ON public.meal_content_stagings FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_content_staging_events_append_only BEFORE UPDATE OR DELETE ON public.meal_content_staging_events FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER meal_sensitive_access_events_append_only BEFORE UPDATE OR DELETE ON public.meal_sensitive_access_events FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- 3 — cabeça vigente e referência homologada
CREATE FUNCTION public.meal_master_head(_logical uuid) RETURNS public.meal_master_records
LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT r.* FROM public.meal_master_records r WHERE r.logical_id = _logical ORDER BY r.version DESC LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION public.meal_master_head(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_master_homologated(_logical uuid, _kind text, _on date) RETURNS boolean
LANGUAGE sql STABLE SET search_path TO '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.meal_master_records r
    WHERE r.logical_id = _logical AND r.kind = _kind AND r.status = 'homologada'
      AND r.version = (SELECT max(x.version) FROM public.meal_master_records x WHERE x.logical_id = _logical)
      AND r.valid_from <= _on AND (r.valid_to IS NULL OR r.valid_to >= _on))
$fn$;
REVOKE ALL ON FUNCTION public.meal_master_homologated(uuid, text, date) FROM PUBLIC, anon, authenticated, service_role;

-- 4 — writer único: registro/retificação (rascunho), conferência, homologação, retirada
CREATE FUNCTION public.record_meal_master(_kind text, _logical uuid, _expected_version integer, _action text,
  _payload jsonb, _school text, _from date, _to date, _reason text, _staging uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sp record; me uuid; g uuid; head public.meal_master_records; st text; p jsonb; k text; ref text; rk text; rv text; lid uuid;
BEGIN
  me := public.af_natural_person();
  SELECT * INTO sp FROM public.meal_master_spec(_kind);
  IF sp.capability IS NULL THEN RAISE EXCEPTION 'meal:kind-unknown'; END IF;
  IF _action NOT IN ('registro','retificacao','conferencia','homologacao','retirada') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF _logical IS NULL THEN
    IF _action <> 'registro' OR _expected_version IS NOT NULL THEN RAISE EXCEPTION 'meal:base-required'; END IF;
    lid := gen_random_uuid();
  ELSE
    lid := _logical;
    PERFORM 1 FROM public.meal_master_records WHERE logical_id = lid FOR UPDATE;
    head := public.meal_master_head(lid);
    IF head.id IS NULL THEN RAISE EXCEPTION 'meal:base-unknown'; END IF;
    IF head.kind <> _kind THEN RAISE EXCEPTION 'meal:kind-mismatch'; END IF;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'meal:stale'; END IF;
    IF _action = 'registro' THEN RAISE EXCEPTION 'meal:base-not-allowed'; END IF;
    IF head.status = 'retirada' THEN RAISE EXCEPTION 'meal:already-withdrawn'; END IF;
  END IF;

  IF _action IN ('registro','retificacao') THEN
    st := 'rascunho'; p := _payload;
    IF _from IS NULL THEN RAISE EXCEPTION 'meal:valid-from-required'; END IF;
    g := public.meal_network_grant_on(sp.capability, _from);
  ELSE
    p := head.payload; _school := head.school_id; _from := head.valid_from; _to := coalesce(_to, head.valid_to);
    IF _action = 'conferencia' THEN
      IF head.status <> 'rascunho' THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
      IF head.author_person_id = me THEN RAISE EXCEPTION 'meal:self-review-not-allowed'; END IF;
      g := public.meal_network_grant_on('conferir-conteudo-tecnico-alimentar', _from); st := 'conferida';
    ELSIF _action = 'homologacao' THEN
      IF head.status <> 'conferida' THEN RAISE EXCEPTION 'meal:transition-invalid'; END IF;
      IF head.author_person_id = me THEN RAISE EXCEPTION 'meal:self-review-not-allowed'; END IF;
      g := public.meal_network_grant_on('homologar-conteudo-tecnico-alimentar', _from); st := 'homologada';
    ELSE
      g := public.meal_network_grant_on(sp.capability, _from); st := 'retirada';
      IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
    END IF;
  END IF;

  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RAISE EXCEPTION 'meal:payload-required'; END IF;
  FOREACH k IN ARRAY sp.required LOOP
    IF p->k IS NULL OR jsonb_typeof(p->k) = 'null' OR (jsonb_typeof(p->k) = 'string' AND btrim(p->>k) = '') THEN RAISE EXCEPTION 'meal:field-required:%', k; END IF;
  END LOOP;
  IF _kind IN ('fator-de-conversao','parametro-per-capita','apresentacao-embalagem') THEN
    k := CASE _kind WHEN 'fator-de-conversao' THEN 'fator' ELSE 'quantidade' END;
    IF jsonb_typeof(p->k) <> 'number' OR (p->>k)::numeric <= 0 THEN RAISE EXCEPTION 'meal:quantity-invalid'; END IF;
  END IF;
  IF _kind = 'fator-de-conversao' AND p->>'de_unidade_ref' = p->>'para_unidade_ref' THEN RAISE EXCEPTION 'meal:conversion-same-unit'; END IF;
  -- referências: só a registros homologados e vigentes no início da vigência; ausência = recusa (nada presumido)
  FOREACH ref IN ARRAY sp.refs LOOP
    rk := split_part(ref, ':', 1); rv := split_part(ref, ':', 2);
    IF p->>rk IS NULL THEN RAISE EXCEPTION 'meal:reference-required:%', rk; END IF;
    IF NOT public.meal_master_homologated((p->>rk)::uuid, rv, _from) THEN RAISE EXCEPTION 'meal:reference-not-homologated:%', rk; END IF;
  END LOOP;
  IF _kind = 'cardapio-planejado' AND p->>'tipo' NOT IN ('geral','especial') THEN RAISE EXCEPTION 'meal:menu-type-invalid'; END IF;
  IF _kind = 'cardapio-planejado' AND p->>'tipo' = 'especial' THEN
    IF p->>'necessidade_ref' IS NULL OR NOT public.meal_master_homologated((p->>'necessidade_ref')::uuid, 'necessidade-alimentar-especial', _from)
      THEN RAISE EXCEPTION 'meal:reference-not-homologated:necessidade_ref'; END IF;
    IF p ? 'estudante_id' OR p ? 'student_id' OR p ? 'diagnostico' THEN RAISE EXCEPTION 'meal:sensitive-field-not-allowed'; END IF;
  END IF;
  IF _kind = 'documento-tecnico' AND p->>'natureza' NOT IN ('modelo','normativo','evidencia') THEN RAISE EXCEPTION 'meal:document-nature-invalid'; END IF;
  IF _kind = 'designacao-inspetor' THEN
    IF _school IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'meal:school-required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_persons x WHERE x.id::text = p->>'pessoa_id') THEN RAISE EXCEPTION 'meal:person-unknown'; END IF;
  ELSIF _kind <> 'treinamento-inspetor' THEN _school := NULL;
  END IF;

  INSERT INTO public.meal_master_records(kind, logical_id, version, supersedes_id, status, school_id, valid_from, valid_to, payload, source_staging_id, reason, author_user_id, author_person_id, author_engagement)
  VALUES (_kind, lid, coalesce(head.version,0)+1, head.id, st, _school, _from, _to, p, _staging, nullif(btrim(_reason),''), auth.uid(), me, g);
  RETURN lid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_master(text, uuid, integer, text, jsonb, text, date, date, text, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_master(text, uuid, integer, text, jsonb, text, date, date, text, uuid) TO authenticated;

-- 5 — leitura: cabeças por espécie; rascunhos só para quem mantém/confere/homologa; inspetor da escola para a própria escola
CREATE FUNCTION public.meal_has_network(_caps text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
    WHERE c.policy_id IS NOT NULL AND c.scope_level = 'rede' AND c.capability_id = ANY(_caps))
$fn$;
REVOKE ALL ON FUNCTION public.meal_has_network(text[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.meal_master_at(_kind text, _on date, _known_at timestamptz, _include_drafts boolean)
RETURNS TABLE(logical_id uuid, version integer, status text, school_id text, valid_from date, valid_to date, payload jsonb,
              author_person_id uuid, recorded_at timestamptz, functional_validation text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sp record; k timestamptz := coalesce(_known_at, now()); maint boolean; net boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT * INTO sp FROM public.meal_master_spec(_kind);
  IF sp.capability IS NULL THEN RAISE EXCEPTION 'meal:kind-unknown'; END IF;
  maint := public.meal_has_network(ARRAY[sp.capability,'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar']);
  net := maint OR public.meal_has_network(ARRAY['acompanhar-alimentacao-rede']);
  RETURN QUERY
  SELECT h.logical_id, h.version, h.status, h.school_id, h.valid_from, h.valid_to, h.payload, h.author_person_id, h.recorded_at,
         CASE WHEN h.kind = 'designacao-inspetor' THEN 'FUNCTIONAL_SOURCE_REQUIRED' END
  FROM (SELECT DISTINCT ON (r.logical_id) r.* FROM public.meal_master_records r
         WHERE r.kind = _kind AND r.recorded_at <= k ORDER BY r.logical_id, r.version DESC) h
  WHERE h.status <> 'retirada'
    AND (h.status = 'homologada' OR (coalesce(_include_drafts,false) AND maint))
    AND (_on IS NULL OR (h.valid_from <= _on AND (h.valid_to IS NULL OR h.valid_to >= _on)))
    AND (net OR (h.school_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
           WHERE c.policy_id IS NOT NULL AND c.capability_id = 'consultar-alimentacao-escolar' AND c.scope_level = 'escola' AND c.school_id = h.school_id)))
  ORDER BY h.valid_from, h.logical_id LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_master_at(text, date, timestamptz, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_master_at(text, date, timestamptz, boolean) TO authenticated;

CREATE FUNCTION public.meal_master_history(_logical uuid)
RETURNS TABLE(version integer, status text, valid_from date, valid_to date, payload jsonb, reason text, author_person_id uuid, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE head public.meal_master_records; sp record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  head := public.meal_master_head(_logical);
  IF head.id IS NULL THEN RETURN; END IF;
  SELECT * INTO sp FROM public.meal_master_spec(head.kind);
  IF NOT public.meal_has_network(ARRAY[sp.capability,'conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar']) THEN RETURN; END IF;
  RETURN QUERY SELECT r.version, r.status, r.valid_from, r.valid_to, r.payload, r.reason, r.author_person_id, r.recorded_at
    FROM public.meal_master_records r WHERE r.logical_id = _logical ORDER BY r.version;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_master_history(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_master_history(uuid) TO authenticated;

-- 6 — staging de conteúdo: idempotente por (espécie, contexto, hash); contexto com outro hash pendente = conflito
CREATE FUNCTION public.stage_meal_content(_kind text, _context text, _sha256 text, _source text, _rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sp record; me uuid; s uuid;
BEGIN
  me := public.af_natural_person();
  SELECT * INTO sp FROM public.meal_master_spec(_kind);
  IF sp.capability IS NULL THEN RAISE EXCEPTION 'meal:kind-unknown'; END IF;
  PERFORM public.meal_network_grant_on(sp.capability, CURRENT_DATE);
  IF nullif(btrim(_context),'') IS NULL THEN RAISE EXCEPTION 'meal:context-required'; END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'meal:rows-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('meal-stage:' || _kind || ':' || _context));
  SELECT id INTO s FROM public.meal_content_stagings WHERE kind = _kind AND context_key = _context AND sha256 = _sha256;
  IF s IS NOT NULL THEN RETURN s; END IF;
  IF EXISTS (SELECT 1 FROM public.meal_content_stagings x WHERE x.kind = _kind AND x.context_key = _context
             AND NOT EXISTS (SELECT 1 FROM public.meal_content_staging_events e WHERE e.staging_id = x.id AND e.action IN ('rejeicao','aplicacao')))
    THEN RAISE EXCEPTION 'meal:staging-conflict'; END IF;
  INSERT INTO public.meal_content_stagings(kind, context_key, sha256, source_name, rows, author_user_id, author_person_id)
  VALUES (_kind, btrim(_context), _sha256, nullif(btrim(_source),''), _rows, auth.uid(), me) RETURNING id INTO s;
  RETURN s;
END $fn$;
REVOKE ALL ON FUNCTION public.stage_meal_content(text, text, text, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.stage_meal_content(text, text, text, text, jsonb) TO authenticated;

-- conferência técnica por outra pessoa; aplicação cria só RASCUNHOS pelo writer (tudo-ou-nada); nunca homologa
CREATE FUNCTION public.review_meal_content_staging(_staging uuid, _action text, _valid_from date, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; st public.meal_content_stagings; row jsonb; n integer := 0;
BEGIN
  me := public.af_natural_person();
  SELECT * INTO st FROM public.meal_content_stagings WHERE id = _staging FOR UPDATE;
  IF st.id IS NULL THEN RAISE EXCEPTION 'meal:staging-unknown'; END IF;
  IF _action NOT IN ('conferencia','rejeicao','aplicacao') THEN RAISE EXCEPTION 'meal:action-invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.meal_content_staging_events e WHERE e.staging_id = st.id AND e.action IN ('rejeicao','aplicacao')) THEN RAISE EXCEPTION 'meal:staging-closed'; END IF;
  IF _action = 'conferencia' THEN
    IF st.author_person_id = me THEN RAISE EXCEPTION 'meal:self-review-not-allowed'; END IF;
    PERFORM public.meal_network_grant_on('conferir-conteudo-tecnico-alimentar', CURRENT_DATE);
  ELSIF _action = 'rejeicao' THEN
    PERFORM public.meal_network_grant_on('conferir-conteudo-tecnico-alimentar', CURRENT_DATE);
    IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'meal:reason-required'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.meal_content_staging_events e WHERE e.staging_id = st.id AND e.action = 'conferencia') THEN RAISE EXCEPTION 'meal:staging-not-reviewed'; END IF;
    FOR row IN SELECT * FROM jsonb_array_elements(st.rows) LOOP
      PERFORM public.record_meal_master(st.kind, NULL, NULL, 'registro', row, NULL, _valid_from, NULL, 'carga conferida ' || st.context_key, st.id);
      n := n + 1;
    END LOOP;
  END IF;
  INSERT INTO public.meal_content_staging_events(staging_id, action, reason, author_user_id, author_person_id)
  VALUES (st.id, _action, nullif(btrim(_reason),''), auth.uid(), me);
  RETURN n;
END $fn$;
REVOKE ALL ON FUNCTION public.review_meal_content_staging(uuid, text, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.review_meal_content_staging(uuid, text, date, text) TO authenticated;

CREATE FUNCTION public.meal_content_stagings_list()
RETURNS TABLE(id uuid, kind text, context_key text, sha256 text, source_name text, row_count integer, state text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NOT public.meal_has_network(ARRAY['conferir-conteudo-tecnico-alimentar','homologar-conteudo-tecnico-alimentar','manter-planejamento-nutricional','manter-catalogo-tecnico-alimentar','manter-parametros-nutricionais']) THEN RETURN; END IF;
  RETURN QUERY SELECT s.id, s.kind, s.context_key, s.sha256, s.source_name, jsonb_array_length(s.rows),
    coalesce((SELECT e.action FROM public.meal_content_staging_events e WHERE e.staging_id = s.id ORDER BY e.recorded_at DESC LIMIT 1), 'pendente'), s.recorded_at
    FROM public.meal_content_stagings s ORDER BY s.recorded_at DESC LIMIT 500;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_content_stagings_list() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_content_stagings_list() TO authenticated;

-- 7 — instrução operacional mínima de restrição (sem identificar diagnóstico), com trilha de consulta
CREATE FUNCTION public.dietary_restriction_instructions(_school text, _on date, _purpose text)
RETURNS TABLE(student_id text, restriction_value_id text, handling_note text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE n integer;
BEGIN
  PERFORM public.meal_grant_on('consultar-restricao-alimentar', _school, _on);
  IF nullif(btrim(_purpose),'') IS NULL THEN RAISE EXCEPTION 'meal:purpose-required'; END IF;
  SELECT count(*) INTO n FROM public.dietary_restrictions d
   WHERE d.school_id = _school AND d.event_kind <> 'revogacao' AND d.valid_from <= _on AND (d.valid_to IS NULL OR d.valid_to >= _on)
     AND NOT EXISTS (SELECT 1 FROM public.dietary_restrictions s WHERE s.supersedes_id = d.id);
  INSERT INTO public.meal_sensitive_access_events(school_id, consulted_on, purpose, rows_returned, author_user_id)
  VALUES (_school, _on, btrim(_purpose), n, auth.uid());
  RETURN QUERY SELECT d.student_id, d.restriction_value_id, d.handling_note FROM public.dietary_restrictions d
   WHERE d.school_id = _school AND d.event_kind <> 'revogacao' AND d.valid_from <= _on AND (d.valid_to IS NULL OR d.valid_to >= _on)
     AND NOT EXISTS (SELECT 1 FROM public.dietary_restrictions s WHERE s.supersedes_id = d.id)
   ORDER BY d.student_id LIMIT 2000;
END $fn$;
REVOKE ALL ON FUNCTION public.dietary_restriction_instructions(text, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.dietary_restriction_instructions(text, date, text) TO authenticated;
REVOKE ALL ON FUNCTION public.meal_master_spec(text) FROM PUBLIC, anon;
