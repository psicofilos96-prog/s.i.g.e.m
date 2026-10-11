CREATE OR REPLACE FUNCTION public.rtv_validate_dashboard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE w jsonb; b jsonb; kinds text[] := ARRAY['bar','barh','stacked','stacked100','combo','pivot','map','line','area','pie','donut','scatter','bubble','histogram','heatmap','treemap','funnel','radar','waterfall','boxplot','gauge','table','kpi'];
BEGIN
  IF NEW.sector <> 'painel' THEN RETURN NEW; END IF;
  IF NEW.choice->>'kind' IS DISTINCT FROM 'dashboard-v1' THEN RAISE EXCEPTION 'painel:formato-desconhecido'; END IF;
  b := NEW.choice->'board';
  IF jsonb_typeof(b->'widgets') <> 'array' OR jsonb_array_length(b->'widgets') > 24 THEN RAISE EXCEPTION 'painel:widgets-invalidos'; END IF;
  IF b ? 'rows' OR b ? 'data' OR b ? 'values' THEN RAISE EXCEPTION 'painel:dado-gravado-recusado'; END IF;
  IF coalesce(b->'theme'->>'logo','') NOT IN ('', 'brasao', 'prefeitura', 'educacao', 'sigem') THEN RAISE EXCEPTION 'painel:logo-recusado'; END IF;
  IF coalesce(b->'theme'->>'font','sans') NOT IN ('sans','serif') OR coalesce(b->'theme'->>'palette','0') NOT IN ('0','1','2','3','4','5') THEN RAISE EXCEPTION 'painel:tema-invalido'; END IF;
  FOR w IN SELECT * FROM jsonb_array_elements(b->'widgets') LOOP
    IF NOT (w->>'kind' = ANY(kinds)) THEN RAISE EXCEPTION 'painel:tipo-desconhecido'; END IF;
    IF w ? 'rows' OR w ? 'data' OR w ? 'values' THEN RAISE EXCEPTION 'painel:dado-gravado-recusado'; END IF;
    IF jsonb_typeof(w->'spec') <> 'object' OR coalesce(w->'spec'->>'source','') = '' THEN RAISE EXCEPTION 'painel:consulta-ausente'; END IF;
    IF w ? 'span' AND NOT ((w->>'span') IN ('1','2','3')) THEN RAISE EXCEPTION 'painel:tamanho-invalido'; END IF;
    IF w ? 'height' AND NOT ((w->>'height') IN ('s','m','l')) THEN RAISE EXCEPTION 'painel:altura-invalida'; END IF;
    IF char_length(coalesce(w->>'description','')) > 300 OR char_length(coalesce(w->>'title','')) > 120 THEN RAISE EXCEPTION 'painel:texto-longo'; END IF;
  END LOOP;
  RETURN NEW;
END $$;