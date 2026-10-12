-- Matrículas L04: leitores públicos (anon) do portal de ingresso. Só DEFINER com allowlist; sem privilégio de tabela.
CREATE OR REPLACE FUNCTION public.enr_public_campaigns()
RETURNS TABLE(campaign_id uuid, cycle_year int, cycle_term text, kind text, stage_ids text[], modality_ids text[],
  schools jsonb, period_from date, period_to date, state text, edital_verification_code text, published_version int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH pub AS (
    SELECT c.id, c.cycle_year, c.cycle_term, c.kind, public.enr_campaign_state(c.id) AS st,
      (SELECT e.on_version FROM public.enr_campaign_events e WHERE e.campaign_id = c.id AND e.action = 'publicar' ORDER BY e.seq DESC LIMIT 1) AS v
    FROM public.enr_campaigns c)
  SELECT p.id, p.cycle_year, p.cycle_term, p.kind, v.stage_ids, v.modality_ids,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('school_id', s, 'name',
       (SELECT r.official_name FROM public.institutional_school_record_versions r WHERE r.school_id = s ORDER BY r.version_number DESC LIMIT 1)) ORDER BY s), '[]'::jsonb)
     FROM unnest(v.school_keys) s),
    v.period_from, v.period_to, p.st,
    (SELECT g.verification_code FROM public.admin_act_signatures g WHERE g.act_version_id = v.edital_act_version_id ORDER BY g.signed_at LIMIT 1),
    p.v
  FROM pub p JOIN public.enr_campaign_versions v ON v.campaign_id = p.id AND v.version = p.v
  WHERE p.st IN ('publicada','suspensa') AND v.period_to >= current_date - 30
  ORDER BY v.period_from
$$;

-- Consulta de protocolo: número + código de conferência (12 primeiros caracteres do hash do comprovante).
-- Inexistente, código errado ou formato inválido respondem igual ('indisponivel'); nunca devolve assunto, pessoa ou unidade.
CREATE OR REPLACE FUNCTION public.enr_public_protocol_status(_number text, _code text)
RETURNS TABLE(status text, registered_on date, last_update_on date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _r record; _last text; _at timestamptz;
BEGIN
  IF _number IS NULL OR _code IS NULL OR btrim(_number) !~ '^PROT-[0-9]{4}-[0-9]{1,8}$' OR lower(btrim(_code)) !~ '^[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::date, NULL::date; RETURN;
  END IF;
  SELECT id, registered_at, receipt_hash INTO _r FROM public.protocol_registrations WHERE protocol_number = btrim(_number);
  IF _r.id IS NULL OR left(lower(_r.receipt_hash), 12) <> lower(btrim(_code)) THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::date, NULL::date; RETURN;
  END IF;
  SELECT event_type, created_at INTO _last, _at FROM public.protocol_registration_events WHERE registration_id = _r.id ORDER BY seq DESC LIMIT 1;
  RETURN QUERY SELECT CASE WHEN _last = 'arquivado' THEN 'arquivado' WHEN _last IS NULL OR _last = 'registrado' THEN 'recebido' ELSE 'em-andamento' END,
    (_r.registered_at AT TIME ZONE 'America/Sao_Paulo')::date, (coalesce(_at, _r.registered_at) AT TIME ZONE 'America/Sao_Paulo')::date;
END $$;

REVOKE EXECUTE ON FUNCTION public.enr_public_campaigns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enr_public_protocol_status(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enr_public_campaigns() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enr_public_protocol_status(text,text) TO anon, authenticated;