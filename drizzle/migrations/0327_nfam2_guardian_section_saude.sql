-- NFAM.2: seção 'saude' passa a ser concedível; acesso a dado sensível só quando a Secretaria concede explicitamente.
ALTER TABLE public.guardian_authorizations DROP CONSTRAINT guardian_authorizations_sections_check;
ALTER TABLE public.guardian_authorizations ADD CONSTRAINT guardian_authorizations_sections_check
  CHECK (sections <@ ARRAY['matricula','frequencia','avaliacao','calendario','documentos','comunicados','saude']::text[]);