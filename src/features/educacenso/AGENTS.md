## Educacenso (`src/features/educacenso/`, `/educacenso`, migrations 0354–0356)
- Controle anual = três ledgers append-only (`educacenso_layout_registrations`, `educacenso_collection_events`, `educacenso_school_status_events`) gravados só por `educacenso_register_layout`/`educacenso_collection_act`/`educacenso_school_act` com base esperada; leitura do painel só por `educacenso_control_at`, porque estado editável perderia a trilha.
- Leiaute nunca é "homologado" pelo SIGEM: sem documento INEP (título + SHA-256) fica `documentacao-pendente`; com documento só "documento registrado", porque homologação do INEP não nasce no sistema.
- Etapa da coleta é chave livre (sugestões só na tela); data de referência é dado configurado na etapa, nunca constante no código.
- "Envio ao INEP declarado" exige conferência anterior e número de protocolo e é declaração da escola; recibo oficial vem só de `census_official_receipt_snapshots`, porque declaração não é confirmação.
- Configurar/abrir/encerrar e devolver só com `preparar-censo-escolar` de rede; escola grava só com a mesma capacidade no seu escopo; aceitação em `scripts/educacenso-e2e.mjs`.
