-- TSEMED.1 — Tabelas SEMED (04, 06, 09, 10, 11): catálogo versionado por ano, submissões por escola e
-- ciclo append-only (rascunho → conferência → envio → recebimento → revisão → fechamento).
-- Valores digitados vivem só nos eventos 'salvar'; dados do cadastro central nunca são copiados.

CREATE TABLE public.semed_table_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  table_code text NOT NULL CHECK (table_code IN ('04','06','09','10','11')),
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL,
  definition jsonb NOT NULL,
  origin text NOT NULL DEFAULT 'guia-tabelas-semed-enviado-pelo-usuario',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, table_code, version)
);
GRANT SELECT ON public.semed_table_catalog TO authenticated;
GRANT ALL ON public.semed_table_catalog TO service_role;
GRANT INSERT ON public.semed_table_catalog TO sandbox_exec; -- carga inicial; revogada na migration seguinte
GRANT SELECT ON public.semed_table_catalog TO sandbox_exec;
ALTER TABLE public.semed_table_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catálogo das Tabelas SEMED legível por contas" ON public.semed_table_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Carga técnica do catálogo" ON public.semed_table_catalog FOR INSERT TO sandbox_exec WITH CHECK (true);
CREATE POLICY "Leitura técnica do catálogo" ON public.semed_table_catalog FOR SELECT TO sandbox_exec USING (true);

CREATE TABLE public.semed_table_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  year int NOT NULL,
  table_code text NOT NULL,
  catalog_id uuid NOT NULL REFERENCES public.semed_table_catalog(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, year, table_code)
);
CREATE TABLE public.semed_table_submission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.semed_table_submissions(id),
  seq int NOT NULL CHECK (seq >= 1),
  act text NOT NULL CHECK (act IN ('salvar','enviar-conferencia','devolver','conferir','enviar','receber','solicitar-revisao','fechar')),
  state_after text NOT NULL,
  field_values jsonb,
  reason text CHECK (reason IS NULL OR length(reason) <= 1000),
  actor_user_id uuid NOT NULL,
  actor_scope text NOT NULL CHECK (actor_scope IN ('escola','rede')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, seq)
);
CREATE INDEX semed_events_submission_idx ON public.semed_table_submission_events (submission_id, seq DESC);
CREATE INDEX semed_submissions_year_idx ON public.semed_table_submissions (year, school_id);

GRANT SELECT ON public.semed_table_submissions, public.semed_table_submission_events TO authenticated;
GRANT ALL ON public.semed_table_submissions, public.semed_table_submission_events TO service_role;

CREATE OR REPLACE FUNCTION public.semed_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'semed:append-only'; END $$;
CREATE TRIGGER semed_catalog_immutable BEFORE UPDATE OR DELETE ON public.semed_table_catalog FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();
CREATE TRIGGER semed_submissions_immutable BEFORE UPDATE OR DELETE ON public.semed_table_submissions FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();
CREATE TRIGGER semed_events_immutable BEFORE UPDATE OR DELETE ON public.semed_table_submission_events FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();

-- Quem pode o quê (capabilities existentes; nada novo é presumido).
CREATE OR REPLACE FUNCTION public.semed_can_fill(_school text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_school_capability('preparar-mapa-estatistico', _school) OR public.has_school_capability('manter-matricula-e-enturmacao', _school) $$;
CREATE OR REPLACE FUNCTION public.semed_can_review(_school text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_school_capability('oficializar-mapa-estatistico', _school) $$;
CREATE OR REPLACE FUNCTION public.semed_is_network() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_network_capability('preparar-censo-escolar') OR public.has_network_capability('consultar-matricula-e-movimentacao') $$;
CREATE OR REPLACE FUNCTION public.semed_can_read(_school text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.semed_can_fill(_school) OR public.semed_can_review(_school) OR public.semed_is_network()
      OR public.has_school_capability('consultar-matricula-e-movimentacao', _school) $$;
REVOKE EXECUTE ON FUNCTION public.semed_can_fill(text), public.semed_can_review(text), public.semed_is_network(), public.semed_can_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_can_fill(text), public.semed_can_review(text), public.semed_is_network(), public.semed_can_read(text) TO authenticated;

ALTER TABLE public.semed_table_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semed_table_submission_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Submissões no escopo" ON public.semed_table_submissions FOR SELECT TO authenticated USING (public.semed_can_read(school_id));
CREATE POLICY "Eventos no escopo" ON public.semed_table_submission_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.semed_table_submissions s WHERE s.id = submission_id AND public.semed_can_read(s.school_id)));

-- Especificação de uma chave digitável segundo a definição do catálogo (centrais nunca são digitáveis).
CREATE OR REPLACE FUNCTION public.semed_key_spec(_def jsonb, _key text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH p AS (SELECT string_to_array(_key, '.') AS a)
  SELECT (SELECT CASE
      WHEN s->>'kind' = 'fields' AND cardinality(p.a) = 2 THEN
        (SELECT f FROM jsonb_array_elements(s->'fields') f WHERE f->>'key' = p.a[2] AND NOT (f ? 'central'))
      WHEN s->>'kind' = 'grid' AND cardinality(p.a) = 3 AND EXISTS (SELECT 1 FROM jsonb_array_elements(s->'rows') r WHERE r->>'key' = p.a[2]) THEN
        (SELECT c FROM jsonb_array_elements(s->'cols') c WHERE c->>'key' = p.a[3])
      END
    FROM jsonb_array_elements(_def->'sections') s WHERE s->>'id' = p.a[1] LIMIT 1)
  FROM p $$;

CREATE OR REPLACE FUNCTION public.semed_validate_values(_def jsonb, _values jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE k text; v jsonb; spec jsonb; t text;
BEGIN
  IF _values IS NULL OR jsonb_typeof(_values) <> 'object' THEN RAISE EXCEPTION 'semed:valores-invalidos'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(_values) LOOP
    spec := public.semed_key_spec(_def, k);
    IF spec IS NULL THEN RAISE EXCEPTION 'semed:campo-desconhecido:%', k; END IF;
    CONTINUE WHEN jsonb_typeof(v) = 'null';
    t := spec->>'type';
    IF t = 'int' THEN
      IF jsonb_typeof(v) <> 'number' OR (v::text)::numeric <> trunc((v::text)::numeric) OR (v::text)::numeric < 0 OR (v::text)::numeric > 100000 THEN
        RAISE EXCEPTION 'semed:inteiro-invalido:%', k; END IF;
    ELSIF t = 'text' THEN
      IF jsonb_typeof(v) <> 'string' OR length(v #>> '{}') > 500 THEN RAISE EXCEPTION 'semed:texto-invalido:%', k; END IF;
    ELSIF t = 'enum' THEN
      IF jsonb_typeof(v) <> 'string' OR NOT ((spec->'options') ? (v #>> '{}')) THEN RAISE EXCEPTION 'semed:opcao-invalida:%', k; END IF;
    ELSE RAISE EXCEPTION 'semed:tipo-desconhecido:%', k; END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.semed_next_state(_state text, _act text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN _act = 'salvar' AND _state IN ('rascunho','devolvido','revisao-solicitada') THEN 'rascunho'
    WHEN _act = 'enviar-conferencia' AND _state = 'rascunho' THEN 'em-conferencia'
    WHEN _act = 'devolver' AND _state = 'em-conferencia' THEN 'devolvido'
    WHEN _act = 'conferir' AND _state = 'em-conferencia' THEN 'conferido'
    WHEN _act = 'enviar' AND _state = 'conferido' THEN 'enviado'
    WHEN _act = 'receber' AND _state = 'enviado' THEN 'recebido'
    WHEN _act = 'solicitar-revisao' AND _state = 'recebido' THEN 'revisao-solicitada'
    WHEN _act = 'fechar' AND _state = 'recebido' THEN 'fechado'
  END $$;

-- Writer único. Base esperada = último seq visto pela tela (0 = nenhuma ação ainda).
CREATE OR REPLACE FUNCTION public.semed_table_act(_school text, _year int, _code text, _act text, _expected_seq int, _values jsonb DEFAULT NULL, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); sub public.semed_table_submissions; cat public.semed_table_catalog;
  last public.semed_table_submission_events; cur text; nxt text; scope text; last_filler uuid; vals jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'semed:sem-sessao'; END IF;
  IF _act IN ('salvar','enviar-conferencia') THEN
    IF NOT public.semed_can_fill(_school) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF; scope := 'escola';
  ELSIF _act IN ('devolver','conferir','enviar') THEN
    IF NOT public.semed_can_review(_school) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF; scope := 'escola';
  ELSIF _act IN ('receber','solicitar-revisao','fechar') THEN
    IF NOT public.semed_is_network() THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF; scope := 'rede';
  ELSE RAISE EXCEPTION 'semed:acao-desconhecida'; END IF;
  IF _act IN ('devolver','solicitar-revisao') AND coalesce(length(trim(_reason)), 0) < 3 THEN RAISE EXCEPTION 'semed:motivo-obrigatorio'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('semed:' || _school || ':' || _year || ':' || _code));
  SELECT * INTO sub FROM public.semed_table_submissions WHERE school_id = _school AND year = _year AND table_code = _code;
  IF sub.id IS NULL THEN
    IF _act <> 'salvar' THEN RAISE EXCEPTION 'semed:sem-rascunho'; END IF;
    SELECT * INTO cat FROM public.semed_table_catalog WHERE year = _year AND table_code = _code ORDER BY version DESC LIMIT 1;
    IF cat.id IS NULL THEN RAISE EXCEPTION 'semed:catalogo-ausente'; END IF;
    INSERT INTO public.semed_table_submissions (school_id, year, table_code, catalog_id, created_by)
      VALUES (_school, _year, _code, cat.id, uid) RETURNING * INTO sub;
  ELSE
    SELECT * INTO cat FROM public.semed_table_catalog WHERE id = sub.catalog_id;
  END IF;

  SELECT * INTO last FROM public.semed_table_submission_events WHERE submission_id = sub.id ORDER BY seq DESC LIMIT 1;
  IF coalesce(last.seq, 0) <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'semed:base-desatualizada'; END IF;
  cur := coalesce(last.state_after, 'rascunho');
  nxt := public.semed_next_state(cur, _act);
  IF nxt IS NULL THEN RAISE EXCEPTION 'semed:transicao-invalida:%:%', cur, _act; END IF;

  IF _act = 'salvar' THEN
    PERFORM public.semed_validate_values(cat.definition, coalesce(_values, '{}'::jsonb));
    vals := jsonb_strip_nulls(coalesce(_values, '{}'::jsonb));
  ELSIF _act = 'enviar-conferencia' AND NOT EXISTS (SELECT 1 FROM public.semed_table_submission_events WHERE submission_id = sub.id AND act = 'salvar') THEN
    RAISE EXCEPTION 'semed:sem-rascunho';
  END IF;
  IF _act = 'conferir' THEN
    SELECT actor_user_id INTO last_filler FROM public.semed_table_submission_events WHERE submission_id = sub.id AND act = 'salvar' ORDER BY seq DESC LIMIT 1;
    IF last_filler = uid THEN RAISE EXCEPTION 'semed:conferente-igual-preenchedor'; END IF;
  END IF;

  INSERT INTO public.semed_table_submission_events (submission_id, seq, act, state_after, field_values, reason, actor_user_id, actor_scope)
    VALUES (sub.id, coalesce(last.seq, 0) + 1, _act, nxt, vals, nullif(trim(_reason), ''), uid, scope);
  RETURN jsonb_build_object('submission_id', sub.id, 'seq', coalesce(last.seq, 0) + 1, 'state', nxt);
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_table_act(text, int, text, text, int, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_table_act(text, int, text, text, int, jsonb, text) TO authenticated;

-- Dados do cadastro central para a tabela (nunca copiados para a submissão).
CREATE OR REPLACE FUNCTION public.semed_table_central(_school text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; inep text; act bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_can_read(_school) THEN RETURN NULL; END IF;
  SELECT official_name, district, location_kind, phone, institutional_email INTO r
    FROM public.institutional_school_record_versions WHERE school_id = _school AND (valid_from IS NULL OR valid_from <= current_date)
    ORDER BY version_number DESC LIMIT 1;
  SELECT value INTO inep FROM public.institutional_school_identifiers WHERE school_id = _school AND identifier_kind = 'inep';
  SELECT cardinality(active_ids) INTO act FROM public.active_enrollments_at(_school, current_date, now());
  RETURN jsonb_build_object('escola', r.official_name, 'inep', inep, 'distrito', r.district, 'zona', r.location_kind,
    'telefone', r.phone, 'email', r.institutional_email, 'matricula-ativa', act, 'diretor', NULL);
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_table_central(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_table_central(text) TO authenticated;

-- Escolas que a conta pode ver nas Tabelas SEMED (escopo escola ou rede).
CREATE OR REPLACE FUNCTION public.semed_scope_schools() RETURNS TABLE (school_id text, can_fill boolean, can_review boolean, network boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id, public.semed_can_fill(s.id), public.semed_can_review(s.id), public.semed_is_network()
  FROM public.institutional_schools s WHERE auth.uid() IS NOT NULL AND public.semed_can_read(s.id) $$;
REVOKE EXECUTE ON FUNCTION public.semed_scope_schools() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_scope_schools() TO authenticated;
