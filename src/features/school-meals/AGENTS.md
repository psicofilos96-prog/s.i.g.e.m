## Alimentação Escolar (`src/features/school-meals/`, migration 0074)

- Cardápio, previsão, execução e restrição são tabelas append-only próprias, gravadas só por `record_meal_menu`/`record_meal_forecast`/`record_meal_service`/`record_dietary_restriction` e lidas só pelos readers `*_at` com `knownAt`, porque alimentação não pode reescrever matrícula nem saúde.
- Preparação, refeição, grupo de atendimento e restrição só vêm de catálogos homologados sem seed; nenhum valor nutricional, PNAE, estoque ou compra existe no módulo até haver contrato e regra oficial configurada.
- Previsão é fato declarado com base escrita, distinto da execução; nenhuma previsão é derivada de matrícula sem regra configurada. `compare`/`coverage` (puros) mostram diferença só com os dois lados e ausência como "não informado", nunca zero.
- Restrição alimentar exige `consultar-restricao-alimentar` própria (consultar alimentação não basta), guarda só restrição + manejo curto, sem diagnóstico; sem permissão a seção some sem revelar existência.
- Dia de oferta × calendário só por mapa de dias já resolvido (`DayKind`); sem calendário aplicável resolvido nada é presumido letivo.
