-- L46: servidor funcional estável por grupo da fonte (nome normalizado + nascimento) e crosswalk de candidatos.
-- Agrupamento da fonte NÃO é identidade comprovada; nenhum vínculo a institutional_persons é criado.
CREATE TABLE IF NOT EXISTS public.payroll_functional_servants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servant_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  birth_date date,
  grouping_rule text NOT NULL DEFAULT 'nome-normalizado+nascimento',
  source_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payroll_functional_servant_registrations (
  registration_id uuid PRIMARY KEY REFERENCES public.payroll_functional_registrations(id),
  servant_id uuid NOT NULL REFERENCES public.payroll_functional_servants(id),
  registration_norm text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pfsr_servant_idx ON public.payroll_functional_servant_registrations(servant_id);
CREATE TABLE IF NOT EXISTS public.payroll_servant_identity_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servant_id uuid NOT NULL REFERENCES public.payroll_functional_servants(id),
  registration_norm text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('registro-administrativo','pessoa-institucional','inep')),
  target_id text NOT NULL,
  evidence_kind text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'candidato' CHECK (status = 'candidato'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (servant_id, registration_norm, target_kind, target_id, evidence_kind)
);
CREATE INDEX IF NOT EXISTS psic_servant_idx ON public.payroll_servant_identity_candidates(servant_id);

CREATE OR REPLACE FUNCTION public.payroll_servant_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'append-only: %', TG_TABLE_NAME; END $$;
DROP TRIGGER IF EXISTS pfs_append_only ON public.payroll_functional_servants;
CREATE TRIGGER pfs_append_only BEFORE UPDATE OR DELETE ON public.payroll_functional_servants FOR EACH ROW EXECUTE FUNCTION public.payroll_servant_append_only();
DROP TRIGGER IF EXISTS pfsr_append_only ON public.payroll_functional_servant_registrations;
CREATE TRIGGER pfsr_append_only BEFORE UPDATE OR DELETE ON public.payroll_functional_servant_registrations FOR EACH ROW EXECUTE FUNCTION public.payroll_servant_append_only();
DROP TRIGGER IF EXISTS psic_append_only ON public.payroll_servant_identity_candidates;
CREATE TRIGGER psic_append_only BEFORE UPDATE OR DELETE ON public.payroll_servant_identity_candidates FOR EACH ROW EXECUTE FUNCTION public.payroll_servant_append_only();

-- Backfill idempotente (mesma regra da view payroll_servant_registrations).
INSERT INTO public.payroll_functional_servants (servant_key, display_name, birth_date, grouping_rule, source_sha256)
SELECT DISTINCT ON (k) k, p.full_name, p.birth_date,
  CASE WHEN k LIKE 'mat:%' THEN 'matricula-sem-nascimento' ELSE 'nome-normalizado+nascimento' END, p.source_sha256
FROM (SELECT public.payroll_servant_key(full_name, birth_date, registration_norm) k, * FROM public.payroll_functional_registrations) p
ORDER BY k, p.registration_norm
ON CONFLICT (servant_key) DO NOTHING;

INSERT INTO public.payroll_functional_servant_registrations (registration_id, servant_id, registration_norm)
SELECT p.id, s.id, p.registration_norm FROM public.payroll_functional_registrations p
JOIN public.payroll_functional_servants s ON s.servant_key = public.payroll_servant_key(p.full_name, p.birth_date, p.registration_norm)
ON CONFLICT (registration_id) DO NOTHING;

-- Candidatos: só matrícula idêntica (dígitos) com registro administrativo SEMED. Nome isolado nunca gera candidato.
INSERT INTO public.payroll_servant_identity_candidates (servant_id, registration_norm, target_kind, target_id, evidence_kind, evidence)
SELECT r.servant_id, r.registration_norm, 'registro-administrativo', a.id::text, 'matricula-identica',
  jsonb_build_object('nome_identico', upper(btrim(a.full_name)) = upper(btrim(p.full_name)), 'fonte', a.source_kind)
FROM public.payroll_functional_servant_registrations r
JOIN public.payroll_functional_registrations p ON p.id = r.registration_id
JOIN public.staff_administrative_records a ON regexp_replace(coalesce(a.registration,''), '\D', '', 'g') = r.registration_norm
ON CONFLICT DO NOTHING;

GRANT SELECT ON public.payroll_functional_servants, public.payroll_functional_servant_registrations, public.payroll_servant_identity_candidates TO authenticated;
GRANT SELECT ON public.payroll_functional_servants, public.payroll_functional_servant_registrations, public.payroll_servant_identity_candidates TO service_role;
ALTER TABLE public.payroll_functional_servants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_functional_servant_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_servant_identity_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pfs_read ON public.payroll_functional_servants;
CREATE POLICY pfs_read ON public.payroll_functional_servants FOR SELECT TO authenticated USING ((SELECT public.has_network_capability('consultar-registro-funcional')));
DROP POLICY IF EXISTS pfsr_read ON public.payroll_functional_servant_registrations;
CREATE POLICY pfsr_read ON public.payroll_functional_servant_registrations FOR SELECT TO authenticated USING ((SELECT public.has_network_capability('consultar-registro-funcional')));
DROP POLICY IF EXISTS psic_read ON public.payroll_servant_identity_candidates;
CREATE POLICY psic_read ON public.payroll_servant_identity_candidates FOR SELECT TO authenticated USING ((SELECT public.has_network_capability('consultar-registro-funcional')));
