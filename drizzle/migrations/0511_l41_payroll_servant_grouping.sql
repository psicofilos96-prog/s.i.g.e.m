-- L41: servidor da folha = mesmo nome (normalizado só por espaços/caixa) + mesma data de nascimento (regra do proprietário).
-- Cada matrícula continua sendo um vínculo próprio; sem nascimento a matrícula fica sozinha; homônimos com nascimento distinto nunca se juntam.
-- Nenhuma ligação a institutional_persons é inferida: só por identificador comprovado (ledger payroll_registration_person_links).
CREATE OR REPLACE FUNCTION public.payroll_servant_key(_name text, _birth date, _registration_norm text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _birth IS NULL OR coalesce(pg_catalog.btrim(_name),'') = '' THEN 'mat:' || _registration_norm
    ELSE 'srv:' || pg_catalog.md5(pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(_name), '\s+', ' ', 'g')) || '|' || _birth::text) END
$$;

CREATE OR REPLACE VIEW public.payroll_servant_registrations WITH (security_invoker = true) AS
SELECT p.id AS registration_id,
       public.payroll_servant_key(p.full_name, p.birth_date, p.registration_norm) AS servant_key,
       p.reference_period, p.registration_raw, p.registration_norm, p.full_name, p.birth_date,
       p.admission_date, p.monthly_hours, p.weekly_workload_text, p.cargo_code, p.cargo_label,
       l.person_id AS linked_person_id
FROM public.payroll_functional_registrations p
LEFT JOIN LATERAL (
  SELECT x.person_id, x.action FROM public.payroll_registration_person_links x
  WHERE x.registration_norm = p.registration_norm ORDER BY x.seq DESC LIMIT 1) l ON l.action = 'vincular';
COMMENT ON VIEW public.payroll_servant_registrations IS 'L41: um registro por matrícula (vínculo) com chave de servidor nome+nascimento; ligação a pessoa institucional só do ledger humano.';
REVOKE ALL ON public.payroll_servant_registrations FROM PUBLIC, anon;
GRANT SELECT ON public.payroll_servant_registrations TO authenticated;
