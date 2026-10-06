-- V.1.2: automação técnica (service_role) não executa helper legado de responsáveis (B4.4, sem consumidor
-- desde V.2) nem funções de trigger da oferta; nada muda para authenticated.
REVOKE EXECUTE ON FUNCTION public.class_schedule_engagement_valid(uuid, text, text, date, timestamptz) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.guard_class_journey_interval() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.guard_class_journey_version() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.guard_class_journey_version_has_intervals() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.guard_class_schedule_block() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.guard_class_schedule_block_engagement() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.guard_class_schedule_version() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.guard_class_schedule_version_has_blocks() FROM service_role;
