-- Decisão do proprietário (2026-10-16): ligar professores às turmas é liberado às Secretarias
-- Escolares, à CIECE e ao Administrador. Secretaria e Administrador já tinham (v5); versão 6 =
-- cópia integral da v5 + manter-atribuicao-docente para a CIECE. v5 fica como história.
INSERT INTO public.sector_station_rule_versions (rules_version, status, valid_from, decision_ref)
VALUES (6, 'homologated', DATE '2026-10-16', 'decisao-proprietario-atribuicao-docente-2026-10-16');

INSERT INTO public.sector_station_rules (rules_version, station_code, capability_id, decision_ref)
SELECT 6, station_code, capability_id, decision_ref FROM public.sector_station_rules WHERE rules_version = 5;

INSERT INTO public.sector_station_rules (rules_version, station_code, capability_id, decision_ref)
SELECT 6, 'ciece', 'manter-atribuicao-docente', 'decisao-proprietario-atribuicao-docente-2026-10-16'
WHERE NOT EXISTS (SELECT 1 FROM public.sector_station_rules WHERE rules_version = 6 AND station_code = 'ciece' AND capability_id = 'manter-atribuicao-docente');