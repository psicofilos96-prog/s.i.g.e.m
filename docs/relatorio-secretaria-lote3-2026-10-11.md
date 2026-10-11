# Secretaria Escolar — Lote 3/4 (frequência administrativa, pessoal, ofícios, kits, arquivo)

Situação atual: Registro de lote (2026-10-11).

Pasta de referência: nenhum dado pessoal bruto foi importado.

## Reaproveitado (não refeito)
Busca ativa/infrequência (A&A), notificações (`emit_notification_event`), DP administrativo (`functional-life.ts`, `staff_administrative_records`), numeração e tramitação de ofícios (`ged-core.ts`), arquivos privados (DocServ).

## Novo
`src/features/school-secretariat/admin-operations.ts` (+7 testes): Diário de Corredor, faltosos por limiar homologado, bloqueio do Bolsa Família sem leiaute validado, situação de pessoal só por lotação vigente, substituição, recibo de kits, revisão e trilha de acesso do arquivo escolar.

## Lacunas
- Leiaute oficial do Bolsa Família: ausente (bloqueado).
- Limiar de faltosos, tipos de justificativa, taxonomia do arquivo, catálogo de kits: decisões institucionais.
- Ponto eletrônico: sem fonte; não implementado.
- Lotações vigentes: 0 registradas (planilhas de ago/set 2026 são só histórico).
- Tabelas, telas e E2E autenticado escola A/B: não criados/executados.
