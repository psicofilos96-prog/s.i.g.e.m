-- Tecnologia L11: equipamento = bem permanente (ops_assets). Quais categorias são de tecnologia é declaração
-- append-only aprovada por pessoa ≠ autor; ficha técnica é versão append-only do bem (sem campos contábeis),
-- lida pela mesma RLS do bem. Inventário é projeção; nenhum cadastro de equipamento paralelo.
CREATE TABLE public.tech_equipment_category_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq int NOT NULL UNIQUE CHECK (seq >= 1),
  category_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('incluir','retirar')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_equipment_category_mark_approvals (
  mark_id uuid PRIMARY KEY REFERENCES public.tech_equipment_category_marks(id),
  decision text NOT NULL CHECK (length(btrim(decision)) >= 10),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_equipment_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id),
  version int NOT NULL CHECK (version >= 1),
  equipment_type text NOT NULL CHECK (equipment_type ~ '^[a-z0-9-]{2,60}$'),
  manufacturer text CHECK (manufacturer IS NULL OR length(btrim(manufacturer)) BETWEEN 1 AND 120),
  model text CHECK (model IS NULL OR length(btrim(model)) BETWEEN 1 AND 120),
  serial_number text CHECK (serial_number IS NULL OR length(btrim(serial_number)) BETWEEN 1 AND 120),
  specs jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(specs) = 'object'),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, version), CHECK (version = 1 OR reason IS NOT NULL),
  CHECK (NOT (specs ?| ARRAY['valor','custo','preco','depreciacao','nota_fiscal','senha','password']))
);
CREATE INDEX tech_sheet_serial ON public.tech_equipment_sheets(lower(btrim(serial_number))) WHERE serial_number IS NOT NULL;
GRANT SELECT ON public.tech_equipment_category_marks, public.tech_equipment_category_mark_approvals, public.tech_equipment_sheets TO authenticated;
GRANT ALL ON public.tech_equipment_category_marks, public.tech_equipment_category_mark_approvals, public.tech_equipment_sheets TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_equipment_category_marks, public.tech_equipment_category_mark_approvals, public.tech_equipment_sheets FROM anon, authenticated, service_role;
ALTER TABLE public.tech_equipment_category_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_equipment_category_mark_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_equipment_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech eqmark read" ON public.tech_equipment_category_marks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech eqmark appr read" ON public.tech_equipment_category_mark_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech sheet read" ON public.tech_equipment_sheets FOR SELECT TO authenticated USING (public.ops_asset_readable(asset_id));
CREATE TRIGGER tech_eqmark_immutable BEFORE UPDATE OR DELETE ON public.tech_equipment_category_marks FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_eqmark_appr_immutable BEFORE UPDATE OR DELETE ON public.tech_equipment_category_mark_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_sheet_immutable BEFORE UPDATE OR DELETE ON public.tech_equipment_sheets FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.mark_tech_equipment_category(_category text, _action text, _reason text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s int;
BEGIN
  SELECT seq INTO _s FROM public.tech_equipment_category_marks WHERE idempotency_key = _key;
  IF _s IS NOT NULL THEN RETURN _s; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('gerir-tecnologia-da-rede') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_asset_category_versions v JOIN public.ops_asset_category_approvals a ON a.category_version_id = v.id WHERE v.category_key = _category)
  THEN RAISE EXCEPTION 'categoria-patrimonial-nao-aprovada'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('techeqmark'));
  SELECT coalesce(max(seq), 0) + 1 INTO _s FROM public.tech_equipment_category_marks;
  INSERT INTO public.tech_equipment_category_marks(seq, category_key, action, reason, person_id, idempotency_key)
  VALUES (_s, _category, _action, btrim(_reason), _p, _key);
  RETURN _s;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_equipment_category_mark(_mark uuid, _decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _m public.tech_equipment_category_marks;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-categorias-de-chamado') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _m FROM public.tech_equipment_category_marks WHERE id = _mark;
  IF _m.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _m.person_id = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_equipment_category_mark_approvals WHERE mark_id = _mark) THEN RETURN; END IF;
  INSERT INTO public.tech_equipment_category_mark_approvals(mark_id, decision, person_id) VALUES (_mark, btrim(_decision), _p);
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_equipment_sheet(_asset uuid, _expected_version int, _type text, _manufacturer text, _model text,
  _serial text, _specs jsonb, _reason text, _key text) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _sch text; _last int; _prev int;
BEGIN
  SELECT version INTO _prev FROM public.tech_equipment_sheets WHERE idempotency_key = _key;
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  PERFORM 1 FROM public.ops_assets WHERE id = _asset FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'indisponivel'; END IF;
  SELECT school_id INTO _sch FROM public.ops_asset_events WHERE asset_id = _asset AND kind = 'localizacao' ORDER BY seq DESC LIMIT 1;
  IF EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _asset AND kind = 'baixa') THEN RAISE EXCEPTION 'bem-baixado'; END IF;
  IF NOT public.tech_can_manage(_sch) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT coalesce(max(version), 0) INTO _last FROM public.tech_equipment_sheets WHERE asset_id = _asset;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_equipment_sheets(asset_id, version, equipment_type, manufacturer, model, serial_number, specs, reason, person_id, idempotency_key)
  VALUES (_asset, _last + 1, _type, nullif(btrim(_manufacturer), ''), nullif(btrim(_model), ''), nullif(btrim(_serial), ''), coalesce(_specs, '{}'::jsonb), _reason, _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

REVOKE ALL ON FUNCTION public.mark_tech_equipment_category(text, text, text, text), public.approve_tech_equipment_category_mark(uuid, text),
  public.record_tech_equipment_sheet(uuid, int, text, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_tech_equipment_category(text, text, text, text), public.approve_tech_equipment_category_mark(uuid, text),
  public.record_tech_equipment_sheet(uuid, int, text, text, text, text, jsonb, text, text) TO authenticated;
