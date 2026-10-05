## Mapa Estatístico (Frente T — `src/features/statistical-map/`)
- Regra só vale homologada, vigente e cobrindo a escola por `coveredSchoolIds`; o critério da fotografia é tipo estruturado de catálogo fechado validado no banco (0123), versionado com a regra (atual: último dia letivo do calendário oficial), e regras distintas sobrepostas falham por ambiguidade, porque expressão livre ou "a mais nova" criaria norma no código.
- Oficialização exige ano `operacional` no ledger S1, porque 2026 é baseline e 2027 só abre por ato humano.
- Atos humanos (regra, abertura, conferência, oficialização, correção) só por RPC da sessão; nunca service_role/`_actor`, porque automação não é pessoa.
- "Matrícula do mês anterior" é herdada do snapshot oficial anterior; sem predecessor é ausente, porque baseline mensal inventado criaria falso histórico.
- Regentes só de `teaching_assignments_at`; lotação nunca cria regência.
- Exportações saem do motor de relatórios sobre as mesmas células exibidas, porque recálculo paralelo divergiria.
- Oficialização só aceita o snapshot cujo digest o banco gravou na conferência e que continua coerente com regra única e versão de calendário vigentes (0124), porque marca enviada pelo cliente não prova conteúdo.
