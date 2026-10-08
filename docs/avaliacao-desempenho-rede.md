# Avaliação e Desempenho — camada analítica da rede (migration 0075)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Rota: `/avaliacao-desempenho`. Fontes: `inst_assessment_versions`, `inst_assessment_results`, `performance_metric_versions`, `performance_disclosure_versions`, `performance_goals` (todas append-only, leitura por readers `*_at` com knownAt).

## Entregue
- Catálogo versionado de avaliações institucionais/externas, separado das avaliações do professor.
- População-alvo aberta (eixo + valor), itens (com vínculo opcional a referência curricular) e escala declarada (numérica com mín./máx. opcionais ou categórica).
- Resultados brutos com situação observado/ausente/não aplicado, retificação/revogação com motivo, idempotência por `plan_key`.
- Métricas como primitivas declaradas, com versão, chave de população e fonte; agregação por escola/turma/item; posição curricular só por mapa explícito.
- Comparação temporal recusada entre fórmulas ou populações diferentes.
- Supressão de grupos pequenos (com supressão complementar) somente com política registrada.
- Metas com fonte, exibidas à parte do valor; sem base ⇒ "sem base para avaliar".
- Importação pelo framework de staging com adaptador de leiaute próprio do SIGEM.

## Pendente de decisão do proprietário
- Capabilities sem regra de política: `manter-avaliacao-institucional` (rede), `registrar-resultado-avaliacao-institucional` (escola|rede), `manter-metrica-desempenho` (rede), `consultar-desempenho-educacional` (escola|rede).
- Limiar de divulgação (nenhum semeado).
- Leiautes oficiais de avaliações externas (SAEB, estaduais) não estão no repositório; nenhuma coluna presumida. IDEB, proficiência, faixas, pesos e metas oficiais não existem até serem registrados.
- Agrupamento por posição curricular na tela aguarda ligar o reader de posições (`allocation_curricular_positions_at`) ao painel.
- Formulários de cadastro de avaliação/métrica/meta na tela: gravação existe pelos RPCs; tela atual é de consulta.
