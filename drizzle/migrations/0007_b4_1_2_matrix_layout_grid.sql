-- B4.1.2 — Quadro (layout) genérico da matriz curricular: grupos, colunas, linhas e células.
-- Aditiva: 0005/0006 intactas; readers e writer de 10 argumentos inalterados.
-- O quadro é filho imutável da versão e é gravado na MESMA transação da versão
-- (writer de 11 argumentos). Células guardam o texto do documento (X, --, *, 40...)
-- como evidência; nenhum símbolo recebe significado. numeric_literal só existe
-- quando o texto é literalmente um número; nunca é derivado de X ou '*'.
-- Unidade de célula só por catálogo homologado (vazio ⇒ recusa). Nada é semeado.

CREATE TABLE public.curricular_matrix_layouts (
  matrix_version_id uuid PRIMARY KEY REFERENCES public.curricular_matrix_versions(id),
  source_locator text NOT NULL CHECK (btrim(source_locator) <> ''),
  source_page text CHECK (source_page IS NULL OR btrim(source_page) <> ''),
  source_document_sha256 text CHECK (source_document_sha256 IS NULL OR source_document_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.curricular_matrix_layout_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_layouts(matrix_version_id),
  column_key text NOT NULL CHECK (column_key ~ '^[a-z0-9][a-z0-9-]*$'),
  position integer NOT NULL CHECK (position >= 0),
  parent_column_key text,
  header_text text NOT NULL CHECK (btrim(header_text) <> ''),
  ref_scheme_id text, ref_value_id text, ref_value_version integer,
  UNIQUE (matrix_version_id, column_key),
  FOREIGN KEY (matrix_version_id, parent_column_key) REFERENCES public.curricular_matrix_layout_columns(matrix_version_id, column_key),
  CHECK ((ref_value_id IS NULL) = (ref_scheme_id IS NULL) AND (ref_value_id IS NULL) = (ref_value_version IS NULL))
);

CREATE TABLE public.curricular_matrix_layout_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_layouts(matrix_version_id),
  group_key text NOT NULL CHECK (group_key ~ '^[a-z0-9][a-z0-9-]*$'),
  position integer NOT NULL CHECK (position >= 0),
  parent_group_key text,
  label_text text NOT NULL CHECK (btrim(label_text) <> ''),
  UNIQUE (matrix_version_id, group_key),
  FOREIGN KEY (matrix_version_id, parent_group_key) REFERENCES public.curricular_matrix_layout_groups(matrix_version_id, group_key)
);

-- row_role é papel técnico de diagramação (linha de item, linha de total transcrito, linha de rótulo),
-- não taxonomia normativa. Linha de item referencia o item da própria versão (componente B2.3 por ID).
CREATE TABLE public.curricular_matrix_layout_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_layouts(matrix_version_id),
  row_key text NOT NULL CHECK (row_key ~ '^[a-z0-9][a-z0-9-]*$'),
  position integer NOT NULL CHECK (position >= 0),
  group_key text,
  row_role text NOT NULL CHECK (row_role IN ('item','total','rotulo')),
  item_key text,
  label_text text,
  UNIQUE (matrix_version_id, row_key),
  UNIQUE (matrix_version_id, item_key),
  FOREIGN KEY (matrix_version_id, group_key) REFERENCES public.curricular_matrix_layout_groups(matrix_version_id, group_key),
  FOREIGN KEY (matrix_version_id, item_key) REFERENCES public.curricular_matrix_items(matrix_version_id, item_key),
  CHECK ((row_role = 'item') = (item_key IS NOT NULL)),
  CHECK (row_role = 'item' OR coalesce(btrim(label_text),'') <> '')
);

CREATE TABLE public.curricular_matrix_layout_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_layouts(matrix_version_id),
  row_key text NOT NULL,
  column_key text NOT NULL,
  source_text text NOT NULL CHECK (btrim(source_text) <> ''),
  numeric_literal numeric,
  unit_scheme_id text, unit_value_id text, unit_value_version integer,
  UNIQUE (matrix_version_id, row_key, column_key),
  FOREIGN KEY (matrix_version_id, row_key) REFERENCES public.curricular_matrix_layout_rows(matrix_version_id, row_key),
  FOREIGN KEY (matrix_version_id, column_key) REFERENCES public.curricular_matrix_layout_columns(matrix_version_id, column_key),
  CHECK ((numeric_literal IS NOT NULL) = (btrim(source_text) ~ '^[0-9]+([.,][0-9]+)?$')),
  CHECK ((unit_value_id IS NULL) = (unit_scheme_id IS NULL) AND (unit_value_id IS NULL) = (unit_value_version IS NULL)),
  CHECK (unit_value_id IS NULL OR numeric_literal IS NOT NULL)
);

CREATE TABLE public.curricular_matrix_layout_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_version_id uuid NOT NULL REFERENCES public.curricular_matrix_layouts(matrix_version_id),
  note_key text NOT NULL CHECK (note_key ~ '^[a-z0-9][a-z0-9-]*$'),
  position integer NOT NULL CHECK (position >= 0),
  marker text CHECK (marker IS NULL OR btrim(marker) <> ''),
  note_text text NOT NULL CHECK (btrim(note_text) <> ''),
  UNIQUE (matrix_version_id, note_key)
);

CREATE TRIGGER curricular_matrix_layouts_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_layouts FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_layout_columns_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_layout_columns FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_layout_groups_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_layout_groups FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_layout_rows_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_layout_rows FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_layout_cells_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_layout_cells FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER curricular_matrix_layout_notes_immutable BEFORE UPDATE OR DELETE ON public.curricular_matrix_layout_notes FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

GRANT SELECT ON public.curricular_matrix_layouts, public.curricular_matrix_layout_columns, public.curricular_matrix_layout_groups,
  public.curricular_matrix_layout_rows, public.curricular_matrix_layout_cells, public.curricular_matrix_layout_notes TO authenticated;
GRANT ALL ON public.curricular_matrix_layouts, public.curricular_matrix_layout_columns, public.curricular_matrix_layout_groups,
  public.curricular_matrix_layout_rows, public.curricular_matrix_layout_cells, public.curricular_matrix_layout_notes TO service_role;
REVOKE ALL ON public.curricular_matrix_layouts, public.curricular_matrix_layout_columns, public.curricular_matrix_layout_groups,
  public.curricular_matrix_layout_rows, public.curricular_matrix_layout_cells, public.curricular_matrix_layout_notes FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.curricular_matrix_layouts, public.curricular_matrix_layout_columns,
  public.curricular_matrix_layout_groups, public.curricular_matrix_layout_rows, public.curricular_matrix_layout_cells,
  public.curricular_matrix_layout_notes FROM authenticated;
DO $acl$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.curricular_matrix_layouts, public.curricular_matrix_layout_columns,
      public.curricular_matrix_layout_groups, public.curricular_matrix_layout_rows, public.curricular_matrix_layout_cells,
      public.curricular_matrix_layout_notes FROM sandbox_exec;
  END IF;
END $acl$;
ALTER TABLE public.curricular_matrix_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_layout_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_layout_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_layout_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_layout_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_matrix_layout_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matrix layouts readable by linked accounts" ON public.curricular_matrix_layouts FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix layout columns readable by linked accounts" ON public.curricular_matrix_layout_columns FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix layout groups readable by linked accounts" ON public.curricular_matrix_layout_groups FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix layout rows readable by linked accounts" ON public.curricular_matrix_layout_rows FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix layout cells readable by linked accounts" ON public.curricular_matrix_layout_cells FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "matrix layout notes readable by linked accounts" ON public.curricular_matrix_layout_notes FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);

-- Writer de 11 argumentos: versão (pelo writer de 10, inalterado) + quadro, atomicamente.
CREATE FUNCTION public.record_curricular_matrix_version(
  _matrix text, _base_version_id uuid, _change_kind text, _official_name text,
  _valid_from date, _valid_until date, _reason text, _act_ref text,
  _items jsonb, _applicability jsonb, _layout jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  r jsonb; _vid uuid; s jsonb; x jsonb; _pos integer; _txt text; _num numeric;
BEGIN
  IF _layout IS NULL OR pg_catalog.jsonb_typeof(_layout) <> 'object' THEN RAISE EXCEPTION 'matrix:layout-required'; END IF;
  IF _items IS NOT NULL AND pg_catalog.jsonb_typeof(_items) = 'array' AND EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements(_items) i WHERE i ? 'quantity' AND i->>'quantity' IS NOT NULL)
  THEN RAISE EXCEPTION 'matrix:layout-quantity-belongs-to-cells'; END IF;
  s := _layout->'source';
  IF s IS NULL OR pg_catalog.jsonb_typeof(s) <> 'object' OR coalesce(pg_catalog.btrim(s->>'locator'),'') = '' THEN
    RAISE EXCEPTION 'matrix:layout-source-locator-required'; END IF;
  FOREACH _txt IN ARRAY ARRAY['columns','groups','rows','cells','notes'] LOOP
    IF _layout ? _txt AND pg_catalog.jsonb_typeof(_layout->_txt) <> 'array' THEN RAISE EXCEPTION 'matrix:layout-invalid'; END IF;
  END LOOP;

  r := public.record_curricular_matrix_version(_matrix, _base_version_id, _change_kind, _official_name,
         _valid_from, _valid_until, _reason, _act_ref, _items, _applicability);
  _vid := (r->>'version_id')::uuid;

  INSERT INTO public.curricular_matrix_layouts(matrix_version_id, source_locator, source_page, source_document_sha256)
  VALUES (_vid, pg_catalog.btrim(s->>'locator'), nullif(pg_catalog.btrim(coalesce(s->>'page','')),''),
          nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(s->>'sha256',''))),''));

  _pos := 0;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_layout->'columns','[]'::jsonb)) e LOOP
    IF x ? 'ref' AND x->'ref' <> 'null'::jsonb AND NOT public.attribute_value_homologated(x->'ref'->>'scheme', x->'ref'->>'value',
         (x->'ref'->>'version')::integer, _valid_from) THEN RAISE EXCEPTION 'matrix:layout-column-ref-not-homologated'; END IF;
    INSERT INTO public.curricular_matrix_layout_columns(matrix_version_id, column_key, position, parent_column_key, header_text,
      ref_scheme_id, ref_value_id, ref_value_version)
    VALUES (_vid, x->>'key', _pos, nullif(x->>'parent',''), x->>'header',
      x->'ref'->>'scheme', x->'ref'->>'value', (x->'ref'->>'version')::integer);
    _pos := _pos + 1;
  END LOOP;

  _pos := 0;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_layout->'groups','[]'::jsonb)) e LOOP
    INSERT INTO public.curricular_matrix_layout_groups(matrix_version_id, group_key, position, parent_group_key, label_text)
    VALUES (_vid, x->>'key', _pos, nullif(x->>'parent',''), x->>'label');
    _pos := _pos + 1;
  END LOOP;

  _pos := 0;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_layout->'rows','[]'::jsonb)) e LOOP
    INSERT INTO public.curricular_matrix_layout_rows(matrix_version_id, row_key, position, group_key, row_role, item_key, label_text)
    VALUES (_vid, x->>'key', _pos, nullif(x->>'group',''), x->>'role', nullif(x->>'item',''), nullif(pg_catalog.btrim(coalesce(x->>'label','')),''));
    _pos := _pos + 1;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.curricular_matrix_items i WHERE i.matrix_version_id = _vid
             AND NOT EXISTS (SELECT 1 FROM public.curricular_matrix_layout_rows lr WHERE lr.matrix_version_id = _vid AND lr.item_key = i.item_key))
  THEN RAISE EXCEPTION 'matrix:layout-item-without-row'; END IF;

  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_layout->'cells','[]'::jsonb)) e LOOP
    _txt := pg_catalog.btrim(coalesce(x->>'text',''));
    IF _txt = '' THEN RAISE EXCEPTION 'matrix:layout-cell-text-required'; END IF;
    _num := CASE WHEN _txt ~ '^[0-9]+([.,][0-9]+)?$' THEN pg_catalog.replace(_txt, ',', '.')::numeric END;
    IF x ? 'unit' AND x->'unit' <> 'null'::jsonb THEN
      IF _num IS NULL THEN RAISE EXCEPTION 'matrix:layout-unit-without-number'; END IF;
      IF x->'unit'->>'scheme' IS DISTINCT FROM 'unidade-de-carga-da-matriz'
        OR NOT public.attribute_value_homologated('unidade-de-carga-da-matriz', x->'unit'->>'value', (x->'unit'->>'version')::integer, _valid_from)
      THEN RAISE EXCEPTION 'matrix:unit-not-homologated'; END IF;
    END IF;
    INSERT INTO public.curricular_matrix_layout_cells(matrix_version_id, row_key, column_key, source_text, numeric_literal,
      unit_scheme_id, unit_value_id, unit_value_version)
    VALUES (_vid, x->>'row', x->>'column', _txt, _num,
      CASE WHEN x ? 'unit' AND x->'unit' <> 'null'::jsonb THEN 'unidade-de-carga-da-matriz' END,
      CASE WHEN x ? 'unit' AND x->'unit' <> 'null'::jsonb THEN x->'unit'->>'value' END,
      CASE WHEN x ? 'unit' AND x->'unit' <> 'null'::jsonb THEN (x->'unit'->>'version')::integer END);
  END LOOP;

  _pos := 0;
  FOR x IN SELECT e FROM pg_catalog.jsonb_array_elements(coalesce(_layout->'notes','[]'::jsonb)) e LOOP
    INSERT INTO public.curricular_matrix_layout_notes(matrix_version_id, note_key, position, marker, note_text)
    VALUES (_vid, x->>'key', _pos, nullif(pg_catalog.btrim(coalesce(x->>'marker','')),''), x->>'text');
    _pos := _pos + 1;
  END LOOP;

  RETURN r;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'matrix:layout-key-duplicate';
  WHEN foreign_key_violation THEN RAISE EXCEPTION 'matrix:layout-reference-not-found';
  WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'matrix:layout-invalid';
END $fn$;

-- Reader do quadro: o da versão vigente em _on conforme conhecida em _known_at; NULL se não houver.
CREATE FUNCTION public.curricular_matrix_layout_at(_matrix text, _on date, _known_at timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
  SELECT pg_catalog.jsonb_build_object(
    'version_id', m.version_id,
    'source', pg_catalog.jsonb_build_object('act', m.originating_act_ref, 'locator', l.source_locator,
               'page', l.source_page, 'sha256', l.source_document_sha256),
    'columns', (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', c.column_key, 'parent', c.parent_column_key,
                 'header', c.header_text, 'ref', CASE WHEN c.ref_value_id IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
                 'scheme', c.ref_scheme_id, 'value', c.ref_value_id, 'version', c.ref_value_version) END) ORDER BY c.position), '[]'::jsonb)
                FROM public.curricular_matrix_layout_columns c WHERE c.matrix_version_id = m.version_id),
    'groups', (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', g.group_key, 'parent', g.parent_group_key,
                 'label', g.label_text) ORDER BY g.position), '[]'::jsonb)
               FROM public.curricular_matrix_layout_groups g WHERE g.matrix_version_id = m.version_id),
    'rows', (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', r.row_key, 'group', r.group_key, 'role', r.row_role,
               'item', r.item_key, 'label', r.label_text) ORDER BY r.position), '[]'::jsonb)
             FROM public.curricular_matrix_layout_rows r WHERE r.matrix_version_id = m.version_id),
    'cells', (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('row', x.row_key, 'column', x.column_key,
                'text', x.source_text, 'number', x.numeric_literal, 'unit', CASE WHEN x.unit_value_id IS NULL THEN NULL ELSE
                pg_catalog.jsonb_build_object('scheme', x.unit_scheme_id, 'value', x.unit_value_id, 'version', x.unit_value_version) END)
                ORDER BY x.row_key, x.column_key), '[]'::jsonb)
              FROM public.curricular_matrix_layout_cells x WHERE x.matrix_version_id = m.version_id),
    'notes', (SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', n.note_key, 'marker', n.marker,
                'text', n.note_text) ORDER BY n.position), '[]'::jsonb)
              FROM public.curricular_matrix_layout_notes n WHERE n.matrix_version_id = m.version_id))
  FROM public.curricular_matrices_at(_on, _known_at) m
  JOIN public.curricular_matrix_layouts l ON l.matrix_version_id = m.version_id
  WHERE m.matrix_id = _matrix
$fn$;

REVOKE ALL ON FUNCTION public.record_curricular_matrix_version(text, uuid, text, text, date, date, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_curricular_matrix_version(text, uuid, text, text, date, date, text, text, jsonb, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.curricular_matrix_layout_at(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.curricular_matrix_layout_at(text, date, timestamptz) TO authenticated;

COMMENT ON TABLE public.curricular_matrix_layout_cells IS
  'Célula transcrita do documento-fonte. source_text é evidência literal (X, --, *, número); nenhum símbolo tem significado atribuído pelo sistema. numeric_literal só quando o texto é um número; célula ausente = nada transcrito.';
