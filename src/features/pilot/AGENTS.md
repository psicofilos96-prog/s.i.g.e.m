## Prontidão para piloto (`src/features/pilot/`, `/prontidao-piloto`)
- Go/no-go técnico é derivado de leituras (concluído/pendente/não aplicável/bloqueado; falha de leitura = bloqueado) e itens não verificáveis pelo sistema, como restore, ficam pendentes até confirmação manual, porque o sistema não pode afirmar o que não consegue ver. Leitura por turma é limitada em paralelo (`CLASS_CONCURRENCY`).
- Escola piloto é escolhida só por `pilot-school-selection.ts` (dimensões canônicas presentes, depois volume, desempate por INEP), porque escolha manual ou por nome não é reproduzível.
