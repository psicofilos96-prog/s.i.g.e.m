-- AL: knownAt padrão = instante da leitura (clock_timestamp), coerente com recorded_at; achado do E2E.
CREATE OR REPLACE FUNCTION public.school_supervision_records_at(_school text, _known_at timestamptz, _logical_id uuid)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, school_id text, modality_value_id text, subject text,
  occurred_on date, referral text, responsible_label text, return_on date, status_value_id text, school_visible boolean,
  reason text, recorded_at timestamptz, own boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE k timestamptz := coalesce(_known_at, clock_timestamp()); full_access boolean; school_access boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  full_access := public.al_supervision_grant('consultar-acompanhamento-da-supervisao', _school) IS NOT NULL
              OR public.al_supervision_grant('registrar-acompanhamento-da-supervisao', _school) IS NOT NULL;
  school_access := public.al_supervision_grant('consultar-supervisao-da-propria-escola', _school) IS NOT NULL;
  IF NOT full_access AND NOT school_access THEN RAISE EXCEPTION 'access-denied'; END IF;
  RETURN QUERY SELECT r.id, r.logical_id, r.version, r.event_kind, r.school_id, r.modality_value_id, r.subject, r.occurred_on,
      r.referral, r.responsible_label, r.return_on, r.status_value_id, r.school_visible, r.reason, r.recorded_at, r.author_user_id = auth.uid()
    FROM public.school_supervision_records r
   WHERE r.school_id = _school AND r.recorded_at <= k
     AND (full_access OR r.school_visible)
     AND (CASE WHEN _logical_id IS NOT NULL THEN r.logical_id = _logical_id
          ELSE NOT EXISTS (SELECT 1 FROM public.school_supervision_records s WHERE s.supersedes_id = r.id AND s.recorded_at <= k) END)
   ORDER BY r.occurred_on DESC, r.recorded_at DESC LIMIT 500;
END $$;