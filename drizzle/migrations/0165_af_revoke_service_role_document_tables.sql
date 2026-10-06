-- AF: documentos escolares só nascem pelos writers humanos; automação apenas lê.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.school_document_templates, public.school_document_template_versions,
  public.school_document_emissions, public.school_document_emission_events FROM service_role;