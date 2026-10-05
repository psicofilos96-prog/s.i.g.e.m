## Reconciliação censitária (`src/features/census-reconciliation/`, sem migration)
- A reconciliação é uma projeção derivada e não grava nada, porque um fato reconciliado persistido seria uma segunda verdade sobre a origem.
- Entrada só agregada (sem PII); `null` = ausente e nunca zero; diferença só é EXPLAINED por regra declarada com delta exato, porque explicação aproximada mascara divergência.
- Fontes com o mesmo sha256 contam uma vez; snapshots diferentes são comparações diferentes, porque emissão/referência é known_at e não vigência nem movimento.
- Etapa vem só do literal declarado (`stageGroup`), nunca do nome da turma; fechamento censitário é NOT_COMPARABLE com status da escola.
