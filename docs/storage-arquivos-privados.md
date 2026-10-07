# Storage e arquivos privados (NFILE.1)

## Inventário (banco, 2026-10-07)
| Área de armazenamento | Pública | Limite | Tipos aceitos no armazenamento | Objetos |
|---|---|---|---|---|
| fotos-estudantes | não | 5 MB | não restringe | 0 |
| inclusao-sensivel | não | 10 MB | não restringe | 0 |
| planejamento-docente | não | 10 MB | não restringe | 0 |
| avaliacao-docente | não | 10 MB | não restringe | 0 |
| alimentacao-evidencias | não | 10 MB | não restringe | 0 |

## Garantias verificadas
- Todas privadas; nenhum `getPublicUrl` no app (teste).
- Links assinados só com `SIGNED_URL_TTL_SECONDS` = 60 s.
- Uploads com `upsert: false` (nunca sobrescrevem; substituir = novo arquivo + nova referência, histórico preservado).
- Inclusão e alimentação: o servidor só toca o arquivo depois que o banco autoriza a pessoa e grava a trilha.

## Novo nesta rodada
- `src/features/privacy/file-guard.ts`: `checkUpload` (tipo real pela assinatura do arquivo, divergência entre o tipo declarado e o real, tamanho, vazio; fail-closed); `orphanReport` (só reporta; `safeToClean` apenas para `drafts/` sem referência e mais antigo que o prazo; arquivo referenciado nunca é órfão).

## Pendente (NFILE.1.1)
- Ligar `checkUpload` nos 5 uploads (hoje o tipo vem do navegador).
- Restringir tipos aceitos por área de armazenamento: a ferramenta disponível não altera isso → INFRAESTRUTURA_PENDENTE.
- Rotina agendada do relatório de órfãos (0 objetos hoje) e listagem de referências por domínio.
- Testes escola A/B, perfil sem vínculo, arquivo cancelado e link expirado com contas temporárias → só pelo harness; INTERACTIVE_BROWSER_VALIDATION_PENDING.
- Revisar caminho por escopo (escola/pessoa) de planejamento e avaliação docente.
