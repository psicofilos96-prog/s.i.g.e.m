-- T.1 — decisão do proprietário: homologação não exige ato externo. A CHECK legada exigia
-- homologation_act_ref e faria o writer de sessão (0119, ref opcional) falhar; troca-se por autoria humana.
ALTER TABLE public.map_competence_rules DROP CONSTRAINT IF EXISTS map_competence_rules_check;
ALTER TABLE public.map_competence_rules ADD CONSTRAINT map_competence_rules_homologation_authorship
  CHECK (status <> 'homologada' OR homologated_person_id IS NOT NULL OR homologation_act_ref IS NOT NULL);
