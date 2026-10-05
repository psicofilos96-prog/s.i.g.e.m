## Mapa Estatístico (Frente T — `src/features/statistical-map/`)
- Regra só vale homologada, vigente e cobrindo a escola por `coveredSchoolIds`; a fotografia é o último dia letivo do mês do calendário oficial aplicável (único critério aceito, 0122), sem fallback, porque data digitada ou civil divergiria do calendário.
- Oficialização exige ano `operacional` no ledger S1, porque 2026 é baseline e 2027 só abre por ato humano.
- Atos humanos (regra, abertura, conferência, oficialização, correção) só por RPC da sessão; nunca service_role/`_actor`, porque automação não é pessoa.
- "Matrícula do mês anterior" é herdada do snapshot oficial anterior; sem predecessor é ausente, porque baseline mensal inventado criaria falso histórico.
- Regentes só de `teaching_assignments_at`; lotação nunca cria regência.
- Exportações saem do motor de relatórios sobre as mesmas células exibidas, porque recálculo paralelo divergiria.
