## Inteligência Educacional — Acompanhamento e Avaliação (`src/features/educational-intelligence/`, migrations 0179–0180)
- Estende 0075 (instrumento/resultado/métrica): programa, edição, comparabilidade, painel e definição de análise são versões append-only gravadas só pelos writers `record_*` (capability de rede + pessoa natural; painel pessoal só capability) e lidas só pelos readers `*_at`, porque nova tabela de resultado criaria segunda verdade.
- Origem, responsável pela aplicação e pela correção e forma de entrega do resultado são campos do programa, nunca presumidos, porque cada programa funciona de um jeito.
- `semantic-layer.ts` é a única consulta analítica: um `SemanticResult` alimenta tabela, pivot, KPI, gráfico e exportação (pelo `report-engine`), porque segundo motor divergiria.
- Escalas diferentes nunca se agregam (`scale_key`); comparabilidade só por declaração registrada, ausente = unknown; nome do componente nunca decide.
- Painel guarda só referências a consultas (`queryRef`); widget com `rows`/`data`/`values` é recusado no banco, porque cópia viraria fato paralelo.
- Análise/previsão é só definição (algoritmo, versão, parâmetros, insumos); nenhuma projeção é gravada nem sobrescreve fato.
- Ciclo da avaliação (0227): estado da edição é só o último evento de `assessment_edition_cycle_events` (append-only, base esperada), nunca campo da edição, porque estado duplicado divergiria.
