INSERT INTO public.sector_parameter_catalog(key, sector, capability_id, value_kind, allowed, default_value)
VALUES ('protocolos.tipo-de-contagem', 'protocolos', 'configurar-prazos-documentais', 'escolha', '["uteis","corridos"]'::jsonb, '"uteis"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Dias úteis = segunda a sexta (feriados não descontados).
CREATE OR REPLACE FUNCTION public.add_days_by_kind(_from date, _days int, _kind text) RETURNS date
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE WHEN _kind = 'uteis' THEN
    (SELECT d::date FROM generate_series(_from + 1, _from + (_days * 2 + 14), interval '1 day') d
      WHERE extract(isodow FROM d) < 6 ORDER BY d OFFSET _days - 1 LIMIT 1)
  ELSE _from + _days END
$$;

CREATE OR REPLACE FUNCTION public.search_admin_cases_with_due(_term text, _classification text, _year int)
RETURNS TABLE(case_id uuid, case_number text, subject text, classification_code text, unit_id text, opened_at timestamptz, due_on date, due_source text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH s AS (SELECT * FROM public.search_admin_cases(_term, _classification, _year)),
  r AS (
    SELECT DISTINCT ON (x.classification_code) x.classification_code, x.days, x.day_kind
    FROM (SELECT DISTINCT ON (rule_key) rule_key, classification_code, days, day_kind, status
          FROM public.admin_case_deadline_rules ORDER BY rule_key, version DESC) x
    WHERE x.status = 'aprovada' ORDER BY x.classification_code, x.days
  ),
  d AS (SELECT (public.sector_parameter_value('protocolos.prazo-padrao') #>> '{}')::int AS days,
               (public.sector_parameter_value('protocolos.tipo-de-contagem') #>> '{}') AS kind)
  SELECT s.case_id, s.case_number, s.subject, s.classification_code, s.unit_id, s.opened_at,
    public.add_days_by_kind((s.opened_at AT TIME ZONE 'America/Sao_Paulo')::date, coalesce(r.days, d.days), coalesce(r.day_kind, d.kind)) AS due_on,
    CASE WHEN r.days IS NOT NULL THEN 'regra-da-classificacao' ELSE 'padrao' END
  FROM s CROSS JOIN d LEFT JOIN r ON r.classification_code = s.classification_code
  ORDER BY s.opened_at DESC, s.case_id
$$;
REVOKE ALL ON FUNCTION public.search_admin_cases_with_due(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_admin_cases_with_due(text, text, int) TO authenticated;