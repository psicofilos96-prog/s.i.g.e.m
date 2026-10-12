-- Referência do arquivo do certificado externo sai só pelo DocServ com sua ACL.
REVOKE SELECT ON public.dev_external_training_versions FROM authenticated;
GRANT SELECT (id, training_id, version, title, provider, modality, hours_minutes, period_start, period_end, certificate_sha256, reason, author_person, created_at)
  ON public.dev_external_training_versions TO authenticated;