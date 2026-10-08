## Avaliação e Desempenho (`src/features/performance/`, migration 0075)

- Avaliação institucional/externa vive em `inst_assessment_versions`, separada dos instrumentos do professor (`assessment_instruments`), porque a camada analítica não pode virar segunda caderneta.
- População-alvo é lista aberta `{axis_id, value_id}` declarada na versão; nunca ano/série no código, porque etapa é configuração.
- Resultado bruto é fato append-only (`record_inst_assessment_result`, `plan_key` = idempotência); métrica é derivação em `performance-model.ts` sobre primitivas declaradas (`media`, `contagem-observados`, `proporcao-em-valores`), nunca persistida, porque total gravado divergiria da origem.
- Indicador só aparece com métrica registrada (fórmula, versão, chave de população, fonte); meta é registro próprio com fonte, mostrada separada do valor, porque observado, calculado e meta não se confundem.
- Comparação temporal exige mesma fórmula, mesma `population_key` e mesma população declarada; caso contrário recusa por extenso.
- Supressão de grupos pequenos só com `performance_disclosure_versions` registrada (supressão complementar); sem política nada é suprimido nem inventado e a tela sinaliza a ausência.
- Importação de resultados usa o adaptador `resultado-avaliacao-institucional` do framework de importações (leiaute próprio do SIGEM), sem colunas de leiautes oficiais presumidas.
- N6.2.4: exportações, evolução (3+ edições), home e relatórios da estação só em `performance-station.ts` sobre o motor e o `report-engine`; ordem cronológica/do motor, nunca por valor, e exportação bloqueada sem política de divulgação, porque ranking ou agregado sem supressão seria decisão escondida.
