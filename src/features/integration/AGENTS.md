## API de integração e webhooks (`src/features/integration/`, `/api/public/v1/*`, migration 0091)
- Cliente externo autentica só por chave de máquina `sgk_` guardada como SHA-256 (`integration_keys`), nunca por sessão humana nem credencial do banco, porque service_role entregue a terceiro anularia toda a autorização.
- Endpoints são lista fechada em `ENDPOINTS` (scope explícito por endpoint; OpenAPI gerado do mesmo registro); não existe rota genérica nem SQL, porque endpoint novo de dado sensível precisa ser decisão explícita.
- Pipeline fixo em `handleApi`: autenticação → cliente ativo → scope → limite por minuto (contagem na trilha `integration_requests`, append-only) → Idempotency-Key em escrita → handler; toda chamada, inclusive recusada, entra na trilha.
- Leitura do cliente é sempre filtrada pelo próprio `client_id`/`school_ids`, porque id vindo da requisição nunca autoriza (IDOR).
- Webhooks: eventos só do `EVENT_CATALOG` com payload por allowlist; assinatura `t=,v1=HMAC-SHA256`; entrega única por (assinatura, evento); retentativa só em rede/408/429/5xx, esgotada = dead-letter; replay só pela administração.
- Administração só por funções DEFINER com `administrar-integracoes` (não atribuída); segredo e chave aparecem em texto uma única vez e a visão administrativa só devolve prefixo/últimos 4.
- Sem cron: a fila é processada ao enfileirar e por "Processar fila agora", porque varredura permanente custaria sem trabalho.
- Central institucional (`institutional-registry.ts`, `/central-de-integracoes`, migration 0092): configuração é versão append-only com base esperada; guarda só o NOME do segredo (`secret_ref`), e configuração com campo/valor de credencial é recusada na tela e no banco, porque segredo exposto não se desfaz.
- `ADAPTERS` nasce vazio: sem adaptador, inativa, sem segredo ou mapeamento inválido ⇒ health "recusado"; nenhum provedor real é conectado sem configuração real, e dry-run nunca chama writer de domínio.
