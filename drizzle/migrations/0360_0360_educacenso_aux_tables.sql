CREATE TABLE public.educacenso_aux_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_year text NOT NULL,
  table_key text NOT NULL,
  title text NOT NULL,
  file_name text NOT NULL,
  sheet_name text NOT NULL,
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  in_package boolean NOT NULL,
  package_sha256 text,
  header jsonb NOT NULL,
  row_count integer NOT NULL,
  extracted_count integer NOT NULL,
  notes text,
  technical_operation_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference_year, table_key, file_sha256, sheet_name)
);
COMMENT ON TABLE public.educacenso_aux_sources IS 'Tabelas auxiliares do Censo Escolar entregues pelo usuário (fonte documental, não homologação de importação). Append-only; uma linha por arquivo+aba+hash.';

CREATE TABLE public.educacenso_aux_rows (
  source_id uuid NOT NULL REFERENCES public.educacenso_aux_sources(id),
  row_no integer NOT NULL,
  cells jsonb NOT NULL,
  PRIMARY KEY (source_id, row_no)
);
COMMENT ON TABLE public.educacenso_aux_rows IS 'Linhas brutas (texto, como na planilha) de cada tabela auxiliar, para auditoria de fidelidade.';

CREATE TABLE public.educacenso_aux_codes (
  source_id uuid NOT NULL REFERENCES public.educacenso_aux_sources(id),
  row_no integer NOT NULL,
  table_key text NOT NULL,
  reference_year text NOT NULL,
  code text NOT NULL,
  label text,
  parent_code text,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source_id, row_no)
);
CREATE INDEX educacenso_aux_codes_lookup ON public.educacenso_aux_codes (reference_year, table_key, code);
CREATE INDEX educacenso_aux_codes_parent ON public.educacenso_aux_codes (reference_year, table_key, parent_code);

CREATE TABLE public.educacenso_aux_rules (
  source_id uuid NOT NULL REFERENCES public.educacenso_aux_sources(id),
  seq integer NOT NULL,
  table_key text NOT NULL,
  reference_year text NOT NULL,
  rule_kind text NOT NULL,
  left_key text NOT NULL,
  right_key text,
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source_id, seq)
);
CREATE INDEX educacenso_aux_rules_lookup ON public.educacenso_aux_rules (reference_year, rule_kind, left_key);

GRANT SELECT ON public.educacenso_aux_sources, public.educacenso_aux_rows, public.educacenso_aux_codes, public.educacenso_aux_rules TO authenticated;
GRANT ALL ON public.educacenso_aux_sources, public.educacenso_aux_rows, public.educacenso_aux_codes, public.educacenso_aux_rules TO service_role;
ALTER TABLE public.educacenso_aux_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educacenso_aux_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educacenso_aux_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educacenso_aux_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aux sources read" ON public.educacenso_aux_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "aux rows read" ON public.educacenso_aux_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "aux codes read" ON public.educacenso_aux_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "aux rules read" ON public.educacenso_aux_rules FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.educacenso_aux_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'educacenso:aux-append-only'; END $$;
CREATE TRIGGER educacenso_aux_sources_immutable BEFORE UPDATE OR DELETE ON public.educacenso_aux_sources FOR EACH ROW EXECUTE FUNCTION public.educacenso_aux_immutable();
CREATE TRIGGER educacenso_aux_rows_immutable BEFORE UPDATE OR DELETE ON public.educacenso_aux_rows FOR EACH ROW EXECUTE FUNCTION public.educacenso_aux_immutable();
CREATE TRIGGER educacenso_aux_codes_immutable BEFORE UPDATE OR DELETE ON public.educacenso_aux_codes FOR EACH ROW EXECUTE FUNCTION public.educacenso_aux_immutable();
CREATE TRIGGER educacenso_aux_rules_immutable BEFORE UPDATE OR DELETE ON public.educacenso_aux_rules FOR EACH ROW EXECUTE FUNCTION public.educacenso_aux_immutable();

-- Validações cruzadas sobre as tabelas do ANO pedido; tabela de outro ano nunca é aplicada.
CREATE OR REPLACE FUNCTION public.educacenso_aux_check(_year text, _kind text, _a text, _b text DEFAULT NULL, _c text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE _n integer; _have boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:unauthenticated'; END IF;
  IF _kind IN ('deficiencia-recurso','transtorno-recurso') THEN
    SELECT EXISTS (SELECT 1 FROM public.educacenso_aux_rules WHERE reference_year = _year AND rule_kind = _kind) INTO _have;
    IF NOT _have THEN RETURN jsonb_build_object('result','sem-tabela-do-ano','year',_year,
      'other_years', (SELECT jsonb_agg(DISTINCT reference_year) FROM public.educacenso_aux_rules WHERE rule_kind = _kind)); END IF;
    SELECT count(*) INTO _n FROM public.educacenso_aux_rules WHERE reference_year = _year AND rule_kind = _kind AND lower(left_key) = lower(btrim(_a)) AND lower(right_key) = lower(btrim(_b));
    RETURN jsonb_build_object('result', CASE WHEN _n > 0 THEN 'permitido' ELSE 'nao-previsto' END);
  ELSIF _kind = 'etapa-tipo-turma' THEN
    SELECT EXISTS (SELECT 1 FROM public.educacenso_aux_rules WHERE reference_year = _year AND rule_kind = _kind) INTO _have;
    IF NOT _have THEN RETURN jsonb_build_object('result','sem-tabela-do-ano'); END IF;
    SELECT count(*) INTO _n FROM public.educacenso_aux_rules WHERE reference_year = _year AND rule_kind = _kind
      AND lower(attrs->>'mediacao') = lower(btrim(_a)) AND lower(attrs->>'tipo_turma') = lower(btrim(_b)) AND right_key = btrim(_c);
    RETURN jsonb_build_object('result', CASE WHEN _n > 0 THEN 'permitido' ELSE 'nao-habilitado' END);
  ELSIF _kind = 'distrito-municipio' THEN
    SELECT count(*) INTO _n FROM public.educacenso_aux_codes WHERE reference_year = _year AND table_key = 'distritos' AND code = _a AND parent_code = _b;
    RETURN jsonb_build_object('result', CASE WHEN _n > 0 THEN 'permitido' WHEN NOT EXISTS (SELECT 1 FROM public.educacenso_aux_codes WHERE reference_year = _year AND table_key = 'distritos') THEN 'sem-tabela-do-ano' ELSE 'nao-pertence' END);
  ELSIF _kind = 'orgao-municipio' THEN
    SELECT count(*) INTO _n FROM public.educacenso_aux_codes WHERE reference_year = _year AND table_key = 'orgaos_regionais' AND code = _a AND parent_code = _b;
    RETURN jsonb_build_object('result', CASE WHEN _n > 0 THEN 'permitido' WHEN NOT EXISTS (SELECT 1 FROM public.educacenso_aux_codes WHERE reference_year = _year AND table_key = 'orgaos_regionais') THEN 'sem-tabela-do-ano' ELSE 'nao-pertence' END);
  ELSIF _kind = 'codigo' THEN
    SELECT count(*) INTO _n FROM public.educacenso_aux_codes WHERE reference_year = _year AND table_key = _b AND code = _a;
    RETURN jsonb_build_object('result', CASE WHEN _n > 0 THEN 'existe' WHEN NOT EXISTS (SELECT 1 FROM public.educacenso_aux_codes WHERE reference_year = _year AND table_key = _b) THEN 'sem-tabela-do-ano' ELSE 'inexistente' END);
  END IF;
  RAISE EXCEPTION 'educacenso:unknown-check';
END $$;
REVOKE ALL ON FUNCTION public.educacenso_aux_check(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.educacenso_aux_check(text, text, text, text, text) TO authenticated;