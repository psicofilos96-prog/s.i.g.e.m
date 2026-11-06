-- 0616 — alinhar o default do leitor de posto ao dia operacional de Itaperuna.
-- Sem data explícita, CURRENT_DATE do banco pode virar em UTC antes de São Paulo.
-- A aplicação já passa _on explicitamente; esta migration fecha a via SQL direta.
-- Não concede capacidades e não altera vínculos ou dados.

CREATE OR REPLACE FUNCTION public.followup_seat_authority(
  _on date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS TABLE(capability_id text,engagement_id uuid,policy_id uuid,
  policy_version integer,school_id text,class_id text,component_id text,
  period_id text,person_id uuid,person_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT g.capability_id,g.engagement_id,g.policy_id,g.policy_version,
    g.school_id,NULL::text,NULL::text,NULL::text,g.person_id,g.person_name
  FROM public.followup_seat_effective_grants(_on) g
$$;
REVOKE ALL ON FUNCTION public.followup_seat_authority(date)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.followup_seat_authority(date)
  TO authenticated;
