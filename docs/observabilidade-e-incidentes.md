# Observabilidade e resposta a incidentes

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Atualização: complementado por `observabilidade-nobs3.md` (IDs de correlação, classificação e trilha de recuperação).


## O que existe
- **Log estruturado** (`src/lib/observability/telemetry.ts`): uma linha JSON por evento (`ts`, `level`, `event`, `requestId`, campos). Objetos/arrays nunca são logados; chaves sensíveis (senha, token, cookie, CPF, documento, nota, diagnóstico, e-mail, telefone, endereço, payload/body) viram `[redacted]`; texto livre passa por `redactText` (Bearer, JWT, chaves `sb_`, CPF, e-mail, cookies).
- **Correlation id**: `x-request-id` válido é reaproveitado; senão um UUID é gerado (`src/start.ts`) e devolvido na página de erro.
- **Classificação**: `expected.auth`, `expected.forbidden`, `expected.validation` (respostas normais, nível `warn`, sem alerta) × `incident.dependency`, `incident.internal` (nível `error`, contam para alerta).
- **Métricas técnicas**: evento `metric` com `metric`, `durationMs`, `outcome` e rótulos não sensíveis (rota com ids mascarados, método). `timed(name, fn)` mede writers/importações/geração de documento sem logar conteúdo.
- **Health**: `GET /api/public/health` (liveness: status + commit + data do build) e `?ready=1` (readiness: auth e API do banco; 503 se algum indisponível). Sem dados, `no-store`.
- **Release**: commit/data do build em `BUILD_INFO`; migrations rastreadas pelo manifesto de hashes e `bun run check:migrations` (ver `docs/engenharia-de-release.md`).

## Lacunas (não inventadas)
- Nenhum provedor de alertas/APM está conectado: os logs ficam nos registros do servidor da plataforma (retenção curta). Alertas abaixo são **configuração proposta**, não automação ativa.
- Fila/importação: não há fila assíncrona; importações são síncronas. Métrica disponível = duração/resultado via `timed`, quando aplicado.
- Erros de frontend continuam pelo `lovable-error-reporting`; sem coleta própria de telemetria no navegador.

## Alertas propostos (ativar quando houver provedor)
| Sinal | Limiar | Severidade |
|---|---|---|
| `/api/public/health?ready=1` ≠ 200 | 2 checagens seguidas (1 min) | crítica |
| `level=error` com `incident.*` | > 5 em 5 min | alta |
| `http.request` p95 `durationMs` | > 3000 ms por 10 min | média |
| `expected.forbidden` | pico 10× a linha de base | investigar (possível enumeração) |

## Runbooks
Primeiro passo comum: anotar `requestId`, horário UTC, rota e `commit` (health).

**Auth indisponível** — health `auth: indisponivel`; logs `expected.auth` em massa ou `incident.dependency` em `/auth`. Ação: confirmar status da plataforma; não alterar configuração de auth nem criar contas; comunicar usuários; reavaliar health até `pronto`.

**Banco indisponível** — `database: indisponivel`, códigos `08*`/`57P01`. Ação: não repetir gravações em laço; writers são idempotentes/otimistas, então o usuário pode tentar de novo após retorno; verificar saúde do backend; se persistir, escalar ao suporte da plataforma.

**Migration falhou** — a ferramenta desfaz a migration falha; nada aplicado. Ação: corrigir com **nova** migration (forward-fix), nunca editar migration congelada; rodar `check:migrations`. Se aplicada e com efeito errado: nova migration corretiva compatível com o app publicado.

**Importação travada** — staging sem confirmação ou erro no commit. Ação: nunca editar staging direto; reabrir preview em `/importacoes`, verificar conflitos; o commit pelos writers canônicos é atômico, então repetir é seguro após corrigir a causa.

**Geração de documento falhou** — emissões são append-only; uma falha não grava snapshot parcial. Ação: verificar template homologado e dados obrigatórios (`expected.validation`); se `incident.*`, repetir após estabilização; nunca editar emissão existente — usar retificação.

**Degradação de performance** — p95 alto em `http.request`. Ação: identificar rota pelo rótulo; checar N+1 conhecido (leitura por turma, `CLASS_CONCURRENCY`); consultas lentas no backend; rollback de app pelo histórico se coincidir com release (DB não volta: forward-fix).

## Erro esperado × incidente
Autorização negada, sessão expirada, validação e conflito otimista são comportamento correto do sistema: aparecem como `warn` com `expected.*` e **não** abrem incidente. Só `incident.*` conta para alerta.
