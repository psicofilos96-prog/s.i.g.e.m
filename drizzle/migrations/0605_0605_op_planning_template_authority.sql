-- Decisão do proprietário 2026-10-23: só a Orientação Pedagógica (e o Administrador, por cobertura explícita) configura modelos de planejamento.
INSERT INTO public.sigem_capability_catalog (capability_id, origin)
VALUES ('configurar-modelo-planejamento', 'decisao-proprietario-2026-10-23-modelo-planejamento')
ON CONFLICT (capability_id) DO NOTHING;
INSERT INTO public.sector_station_rule_versions (rules_version, status, valid_from, decision_ref)
VALUES (7, 'homologated', DATE '2026-10-23', 'decisao-proprietario-2026-10-23-modelo-planejamento');
INSERT INTO public.sector_station_rules (rules_version, station_code, capability_id, decision_ref)
SELECT 7, station_code, capability_id, decision_ref FROM public.sector_station_rules WHERE rules_version = 6;
INSERT INTO public.sector_station_rules (rules_version, station_code, capability_id, decision_ref) VALUES
 (7, 'orientacao_pedagogica', 'configurar-modelo-planejamento', 'decisao-proprietario-2026-10-23-modelo-planejamento'),
 (7, 'administracao_geral', 'configurar-modelo-planejamento', 'decisao-proprietario-2026-10-23-modelo-planejamento')
ON CONFLICT DO NOTHING;