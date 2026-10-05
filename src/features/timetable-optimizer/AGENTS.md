## Otimizador assistido de horários (`src/features/timetable-optimizer/`, sem migration)
- Só restrições com representação canônica são consideradas (tempos configurados da turma, um bloco por tempo, pessoa sem simultaneidade; disponibilidade apenas com fonte); as demais aparecem em `constraintsOf` como "não consideradas", porque presumir D3/D7/D8 seria norma no código.
- Busca determinística própria, sem dependência de solver, com limite de passos; quantidade de blocos por componente vem da grade vigente, nunca de carga inventada.
- Sugestão nunca é aplicada: aplicar = diff + motor de lote com executor do writer canônico e base esperada; sem executor, recusa e encaminha a /horarios.
