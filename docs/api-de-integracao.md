# API de integração v1 e webhooks

Especificação viva: `GET /api/public/v1/openapi.json` (gerada do registro de endpoints).

## Autenticação
`Authorization: Bearer sgk_<64 hex>`. A chave é emitida em `/integracoes` (capability `administrar-integracoes`), mostrada uma vez e guardada só como SHA-256. Revogação é imediata.

## Scopes
| Scope | Efeito |
|---|---|
| `escolas:ler` | `GET /v1/schools` — id e nome oficial vigente, limitado às escolas do cliente |
| `publicacoes:ler` | `GET /v1/publications` — só conteúdo já publicado no portal |
| `webhooks:ler` | `GET /v1/webhook-deliveries` — entregas das próprias assinaturas |
| `webhooks:testar` | `POST /v1/webhooks/test` — enfileira `integracao.teste` |

Nenhum scope expõe estudante, servidor, turma, nota, frequência ou contato. Nenhum vem marcado por padrão.

## Paginação, limites, erros
- `limit` 1–200 (padrão 50), `cursor` opaco = `next_cursor`.
- Limite por cliente por minuto (padrão 60) → `429` + `Retry-After: 60`. É contagem própria sobre a trilha de chamadas, não uma primitiva da plataforma.
- Escrita exige `Idempotency-Key` (8–128); repetição devolve a resposta original com `Idempotent-Replayed: true`.
- Erro: `{ "error": { "code", "message", "request_id" }, "api_version": "v1" }`; códigos estáveis em `ERROR_CODES`.

## Webhooks
- Eventos: `integracao.teste`, `publicacao.publicada` (catálogo; o segundo ainda não é emitido pelo módulo de publicações).
- Cabeçalhos: `X-SIGEM-Event-Id`, `X-SIGEM-Signature: t=<unix>,v1=<HMAC-SHA256(segredo, t + "." + corpo)>`. O receptor deve recusar diferença > 300 s e deduplicar pelo Event-Id.
- Retentativas: 30 s, 2 min, 10 min, 30 min, 2 h (6 tentativas) só em erro de rede/408/429/5xx; depois `dead-letter`. Outro 4xx vai direto a `dead-letter`.
- Segredo rotacionável; troca invalida o anterior na hora.
- Sem agendador automático: retentativas vencidas rodam em "Processar fila agora" ou no próximo enfileiramento daquele evento.

## Lacunas
- Nenhum endpoint de escrita sobre fatos oficiais: writers canônicos exigem pessoa autenticada com capability; máquina não é ator institucional até haver decisão.
- `administrar-integracoes` não está atribuída a ninguém.
