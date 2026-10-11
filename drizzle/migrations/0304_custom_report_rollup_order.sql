CREATE OR REPLACE FUNCTION public.report_custom_query(_spec jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $f$
DECLARE
  cat jsonb := public.rcq_catalog_internal();
  base text := _spec->>'source';
  aliases jsonb := '{}'::jsonb;
  jdef jsonb; jid text; from_sql text; used_joins text[] := '{}';
  sens boolean := COALESCE((_spec->>'includeSensitive')::boolean, false);
  sel text[] := '{}'; grp text[] := '{}'; outcols jsonb := '[]'; i int := 0;
  item jsonb; expr text; where_sql text; order_sql text := ''; q text;
  lim int := LEAST(GREATEST(COALESCE((_spec->>'limit')::int, 100), 1), 1000);
  off int := GREATEST(COALESCE((_spec->>'offset')::int, 0), 0);
  has_measures boolean := jsonb_array_length(COALESCE(_spec->'measures','[]')) > 0;
  has_group boolean := jsonb_array_length(COALESCE(_spec->'groupBy','[]')) > 0;
  rollup boolean := COALESCE((_spec->>'subtotals')::boolean, false) AND jsonb_array_length(COALESCE(_spec->'groupBy','[]')) > 0;
  res jsonb; tot bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'rcq:auth-required'; END IF;
  IF base IS NULL OR NOT (cat->'sources' ? base) THEN RAISE EXCEPTION 'rcq:unknown-source'; END IF;
  IF jsonb_array_length(COALESCE(_spec->'joins','[]')) > 4 THEN RAISE EXCEPTION 'rcq:too-many-joins'; END IF;
  aliases := jsonb_build_object(base, base);
  from_sql := format('(%s) %I', cat->'sources'->base->>'sql', base);
  FOR jid IN SELECT jsonb_array_elements_text(COALESCE(_spec->'joins','[]')) LOOP
    jdef := NULL;
    SELECT j INTO jdef FROM jsonb_array_elements(cat->'joins') j WHERE j->>'id' = jid;
    IF jdef IS NULL THEN RAISE EXCEPTION 'rcq:unknown-join %', jid; END IF;
    IF NOT aliases ? (jdef->>'from') THEN RAISE EXCEPTION 'rcq:join-not-connected %', jid; END IF;
    IF aliases ? (jdef->>'to') THEN RAISE EXCEPTION 'rcq:source-twice %', jdef->>'to'; END IF;
    aliases := aliases || jsonb_build_object(jdef->>'to', jdef->>'to');
    used_joins := used_joins || jid;
    from_sql := from_sql || format(' LEFT JOIN (%s) %I ON %I.%I = %I.%I', cat->'sources'->(jdef->>'to')->>'sql', jdef->>'to',
      jdef->>'from', jdef->'on'->>0, jdef->>'to', jdef->'on'->>1);
  END LOOP;

  IF has_group OR has_measures THEN
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'groupBy','[]')) LOOP
      expr := public.rcq_field(cat, aliases, item #>> '{}', sens);
      i := i + 1; sel := sel || format('%s AS c%s', expr, i); grp := grp || expr;
      outcols := outcols || jsonb_build_object('id', 'c'||i, 'field', item #>> '{}', 'kind', 'group');
    END LOOP;
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'measures','[]')) LOOP
      i := i + 1;
      CASE item->>'agg'
        WHEN 'count' THEN expr := 'count(*)';
        WHEN 'percent' THEN expr := 'round(count(*) * 100.0 / NULLIF(sum(count(*)) OVER (PARTITION BY ' || CASE WHEN rollup THEN 'GROUPING(' || array_to_string(grp, ',') || ')' ELSE '1' END || '),0), 2)';
        WHEN 'count_distinct' THEN expr := format('count(DISTINCT %s)', public.rcq_field(cat, aliases, item->>'field', sens));
        WHEN 'sum' THEN expr := format('sum(%s)', public.rcq_num(cat, aliases, item->>'field'));
        WHEN 'avg' THEN expr := format('round(avg(%s), 2)', public.rcq_num(cat, aliases, item->>'field'));
        WHEN 'min' THEN expr := format('min(%s)', public.rcq_field(cat, aliases, item->>'field', sens));
        WHEN 'max' THEN expr := format('max(%s)', public.rcq_field(cat, aliases, item->>'field', sens));
        ELSE RAISE EXCEPTION 'rcq:unknown-aggregate';
      END CASE;
      sel := sel || format('%s AS c%s', expr, i);
      outcols := outcols || jsonb_build_object('id', 'c'||i, 'field', item->>'field', 'agg', item->>'agg', 'kind', 'measure');
    END LOOP;
    IF rollup THEN sel := sel || format('GROUPING(%s) AS _nivel', array_to_string(grp, ',')); END IF;
  ELSE
    FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'columns','[]')) LOOP
      expr := public.rcq_field(cat, aliases, item #>> '{}', sens);
      i := i + 1; sel := sel || format('%s AS c%s', expr, i);
      outcols := outcols || jsonb_build_object('id', 'c'||i, 'field', item #>> '{}', 'kind', 'column');
    END LOOP;
  END IF;
  IF i = 0 THEN RAISE EXCEPTION 'rcq:no-columns'; END IF;
  IF i > 40 THEN RAISE EXCEPTION 'rcq:too-many-columns'; END IF;

  where_sql := public.rcq_filter(cat, aliases, _spec->'filter', sens, 0);
  q := format('SELECT %s FROM %s%s', array_to_string(sel, ', '), from_sql, CASE WHEN where_sql IS NULL THEN '' ELSE ' WHERE ' || where_sql END);
  IF has_group THEN q := q || CASE WHEN rollup THEN ' GROUP BY ROLLUP(' ELSE ' GROUP BY (' END || array_to_string(grp, ',') || ')'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(_spec->'sort','[]')) LOOP
    IF COALESCE(item->>'col','') !~ '^c[0-9]{1,2}$' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(outcols) o WHERE o->>'id' = item->>'col') THEN RAISE EXCEPTION 'rcq:bad-sort'; END IF;
    order_sql := order_sql || CASE WHEN order_sql = '' THEN '' ELSE ', ' END || format('%I %s NULLS LAST', item->>'col', CASE WHEN item->>'dir' = 'desc' THEN 'DESC' ELSE 'ASC' END);
  END LOOP;
  IF rollup THEN
    -- Hierarquia: total geral por último; grupos externos antes da ordem escolhida; subtotal depois do bloco.
    order_sql := format('(_nivel = %s)', (1 << array_length(grp,1)) - 1)
      || (SELECT COALESCE(string_agg(format(', c%s NULLS LAST', k), '' ORDER BY k), '') FROM generate_series(1, array_length(grp,1) - 1) k)
      || ', _nivel' || CASE WHEN order_sql = '' THEN '' ELSE ', ' || order_sql END;
  END IF;
  IF order_sql = '' THEN order_sql := 'c1'; END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(z) - ''_rn'' - ''_total'' ORDER BY z._rn), ''[]''::jsonb), max(z._total) FROM (SELECT t.*, row_number() OVER (ORDER BY %s) AS _rn, count(*) OVER () AS _total FROM (%s) t ORDER BY %s LIMIT %s OFFSET %s) z',
    order_sql, q, order_sql, lim, off) INTO res, tot;

  INSERT INTO public.report_custom_runs(base_source, joins, spec_sha256, row_total)
  VALUES (base, used_joins, encode(sha256(convert_to(_spec::text, 'UTF8')), 'hex'), COALESCE(tot, 0));

  RETURN jsonb_build_object('columns', outcols, 'rows', res, 'total', COALESCE(tot, 0), 'limit', lim, 'offset', off);
END $f$;
REVOKE ALL ON FUNCTION public.report_custom_query(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_custom_query(jsonb) TO authenticated;