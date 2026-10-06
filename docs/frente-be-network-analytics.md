# Frente BE — fechamento da AM (CIECE analytics)

- Tela: `/paineis` → "Indicadores da rede (CIECE)" consome `src/features/dashboards/network-analytics.ts`.
- Ano letivo: natureza vem só de `academic_year_operational_states` (2026 = histórico importado; 2027 = sem estado até ato humano de abertura).
- Comparação: só com mesma versão da definição, recorte, natureza do ano e fonte; caso contrário mostra o motivo.
- Estados distintos: Disponível, Zero comprovado, Desconhecido, Indisponível; bloqueios (BLOCKED) em seção própria: CONTRACTUAL_BALANCE (planilha oficial do DP), MAX_CAPACITY (PARAMETER_PENDING), TERRITORIAL_DATA_PENDING, CONTENT_SOURCE_PENDING (BNCC/SAEB), EDUCACENSO_LAYOUT. GPE não é citado.
- Qualidade: incompleto, ambíguo, conflito, fonte pendente, não homologado, reconferência — sem nota nem ranking.
- Exportação: `analyticsCsv` → `runReport`/`toCsv` sobre as mesmas linhas devolvidas pelo reader (mesma ACL), com asOf, knownAt, recorte, ano, natureza, fonte e rótulo "projeção dinâmica".
- Medição: NÃO realizada. `network_indicators_at` exige sessão com capability; a ferramenta de leitura não tem permissão de execução e nenhuma sessão real estava disponível. Sem SLA. Linha de base anterior: `docs/performance-baseline-au.md`.
