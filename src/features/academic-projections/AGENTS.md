## Projeções canônicas (`src/features/academic-projections/`)

Módulo separado porque é fronteira de publicação, não motor: uma verdade
institucional (encerramento) publica projeções canônicas, e nenhum consumidor
reconstrói fatos por conta própria.

- Consumidores (13, 14, 15, 18, 26) leem SEMPRE a projeção; o CIECE deriva seus
  fatos dela, nunca diretamente do encerramento — raiz única evita divergência.
- A projeção rica é o contrato primário; o formato tabular é adaptador derivado.
- `projectionSchemaVersion` evolui independentemente do `closingVersion`, para que
  o contrato de consumo mude sem tocar na história congelada.
- `isCurrentClosingVersion` é derivado da cadeia de encerramentos, nunca campo
  persistido, porque estado duplicado divergiria da cadeia real.
- Naturezas (`dimensionKindId`, `issueTypeId`, `sourceTypeId`) são identificadores
  abertos; o projetor não conhece componente, frequência nem módulo.
