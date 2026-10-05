# Privacidade e ciclo de vida dos dados — auditoria técnica

Não é parecer jurídico. Base legal, prazo de retenção e política de eliminação **não estão decididos** e ficam como configuração institucional futura.

## Inventário
Fonte única e testada: `src/features/privacy/data-inventory.ts` (`DATA_INVENTORY`): domínio, categoria, sensibilidade, titular menor de idade, fonte, finalidade funcional, escopo de acesso, tabelas, readers, exportação, logs, anexos e projeções.

Proteção reforçada (menores e/ou sensível): vida escolar, Diário (frequência/notas/pareceres), **Inclusão** (sensível), **restrições alimentares** (sensível), Família, documentos emitidos, staging de importação.

## Controles verificados
| Controle | Onde | Prova |
|---|---|---|
| Sem GRANT a anon em tabelas de menores/sensíveis | migrations + banco | teste `privacy-leak.test.ts`; consulta ao banco: 0 privilégios anon/PUBLIC nas 17 tabelas sensíveis |
| Anexos segregados | buckets privados `inclusao-sensivel`, `planejamento-docente`, `avaliacao-docente` | banco: os três `public = false` |
| Expiração de links | `SIGNED_URL_TTL_SECONDS` (60 s) único nos 3 pontos de URL assinada | teste |
| Trilha de acesso sensível | `inclusion_access_events` (sem conteúdo) antes de servir anexo | já existente |
| Minimização de export | colunas `sensitive` fora por padrão; Inclusão `minimizedExport`; auditoria exige `exportar-auditoria` | teste |
| Redaction de logs | telemetria descarta objetos e mascara CPF/e-mail/token/nota/diagnóstico | teste |
| Redaction da auditoria | `redact` (documento, e-mail, termos clínicos) | teste |
| Busca | `global_search` não toca inclusão, alimentação, notas, Família | teste |
| Portal público/verificação | allowlist de campos; inexistente=rascunho=revogado | teste |

## Retenção, arquivamento, anonimização
- `LIFECYCLE_UNDECIDED`: todo domínio com `legalBasis`, `retentionDays`, `disposal`, `decidedBy` = `null`. `lifecycleAction` só retorna algo diferente de `reter` com decisão completa e autor declarado.
- `anonymizeFields` substitui valores por marcador preservando IDs e versões; não há operação de anonimização ligada a nenhum dado, porque nenhuma foi decidida.
- Ledgers append-only nunca são apagados por esse mecanismo.

## Backups
Gerenciados pela plataforma; contêm todos os dados, inclusive sensíveis. Restore nunca testado. Não há export de backup pelo app.

## Decisões institucionais pendentes
1. Base legal por domínio.
2. Prazo de retenção por domínio e por trilha (auditoria, acessos sensíveis).
3. Destino ao fim do prazo (eliminar, anonimizar, arquivar) e quem decide.
4. Atribuição de `exportar-auditoria`.
5. Procedimento de atendimento a titular/responsável (acesso, correção).
