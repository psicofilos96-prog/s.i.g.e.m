# Storage e arquivos privados (NFILE.1)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


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

## NFILE.1.1 — validação conectada (2026-10-07)
Status: PASS — UPLOAD_VALIDATION_AND_PRIVATE_STORAGE_COMPLETE (0 pontos de upload fora do padrão).

Abstração única: `src/features/privacy/upload-policy.ts` (`guardUpload` sobre `checkUpload`, `safeLabel`, `assertSafePath`, `UPLOAD_POLICY` por área).

| Ponto | Área (privada) | Tipos | Limite | Caminho | Leitura |
|---|---|---|---|---|---|
| Foto do estudante (matrícula) | fotos-estudantes | JPG/PNG/WEBP | 5 MB | escola/rascunho/uuid.ext | política por capacidade da escola; apagar foto já versionada é recusado pelo banco |
| Anexo de inclusão | inclusao-sensivel | JPG/PNG/WEBP/PDF | 10 MB | escola/aluno/uuid (derivado pelo banco) | só servidor após autorização + finalidade registrada; sem política direta |
| Anexo do planejamento | planejamento-docente | JPG/PNG/WEBP/PDF | 10 MB | usuário/plano/uuid | só o próprio prefixo |
| Mídia de item de avaliação | avaliacao-docente | JPG/PNG/WEBP/PDF | 10 MB | usuário/item/uuid | só o próprio prefixo |
| Evidência da Alimentação | alimentacao-evidencias | JPG/PNG/WEBP/PDF | 10 MB | reservado pelo banco (escola) | só servidor após autorização |

- MIME real por assinatura; tipo declarado divergente é recusado; o tipo gravado é o real, não o do navegador.
- Rótulo do arquivo neutralizado (`safeLabel`); caminho nunca usa nome do usuário; traversal recusado.
- Limite por área também aplicado na própria área de armazenamento (5 MB / 10 MB conferidos). Tipos por área no armazenamento continuam INFRAESTRUTURA_PENDENTE; a política do app cobre.
- Signed URL de 60 s (`SIGNED_URL_TTL_SECONDS`); nenhum `getPublicUrl`; `upsert:false` em todos.
- Base64 só em trânsito para o servidor (inclusão, alimentação), com teto de tamanho; nada de base64 em tabela.
- Substituição/remoção: inclusão e planejamento/avaliação revogam por evento (arquivo histórico fica); alimentação substitui por nova versão com motivo; foto versionada não pode ser apagada.
- Órfãos: `orphanReport` só reporta; limpeza apenas para `drafts/` sem referência e antigos; arquivo referenciado nunca é limpável. Nenhuma rotina automática agendada.
- Testes: `src/features/privacy/upload-policy.test.ts` (5 pontos ligados; MIME falso; grande/vazio; traversal/nome hostil; recusa vira validação; histórico protegido).
- Escola A lê B, sem vínculo, URL expirada, arquivo revogado: garantidos pelas políticas conferidas no banco e pelo TTL; execução com contas temporárias = INTERACTIVE_BROWSER_VALIDATION_PENDING (só pelo harness).

## NFILE.2 — auditoria de órfãos e escopos (2026-10-07)
Status: **PASS técnico**; INFRAESTRUTURA_PENDENTE em tipos por área.

| Área | Domínio | Pública | Limite | Tipos no armazenamento | Objetos | Referências vivas | Órfãos | Leitura |
|---|---|---|---|---|---|---|---|---|
| fotos-estudantes | Secretaria | não | 5 MB | não restringe (app: JPG/PNG/WEBP) | 0 | `student_photo_current` (0) | 0 | capacidade da escola (pasta = escola) |
| inclusao-sensivel | Inclusão | não | 10 MB | não restringe (app: +PDF) | 0 | `inclusion_attachments` 0 | 0 | só servidor após autorização + finalidade |
| planejamento-docente | Docente | não | 10 MB | não restringe | 0 | `teaching_plan_attachments` 0 | 0 | só o próprio prefixo |
| avaliacao-docente | Avaliação | não | 10 MB | não restringe | 0 | `assessment_item_media` 0 | 0 | só o próprio prefixo |
| alimentacao-evidencias | NAE | não | 10 MB | não restringe | 0 | `meal_evidence_attachments` 0, `meal_fiscal_documents` 0 | 0 | só servidor após autorização |

- Links assinados: só `SIGNED_URL_TTL_SECONDS` = 60 s; nenhum link público.
- Nenhuma área tem regra de atualizar; apagar só existe para foto em rascunho (foto vinculada recusada) — histórico preservado.
- Limpeza: nenhum rascunho abandonado comprovado (0 objetos) ⇒ nada apagado; `orphanReport` continua só reportando, `safeToClean` apenas para `drafts/` sem referência e vencido.
- Escopos (`scripts/nfile2-storage-scopes.mjs`, contas temporárias, 23/23): prefixo alheio, foto de outra escola, Professor sem foto, gravação direta em inclusão/alimentação, listagem pelo CIECE, anônimo gravando ou obtendo link — todos recusados; 0 arquivos criados, 0 resíduos.
- Correções: nenhuma necessária.
- Pendente: restringir tipos no próprio armazenamento (a ferramenta disponível não altera essa opção) — INFRAESTRUTURA_PENDENTE; download por link real com login (INTERACTIVE_BROWSER_VALIDATION_PENDING).
- Gates: suíte completa 379 arquivos OK; varredura de segurança: 26 achados, todos em catálogos normativos lidos por qualquer pessoa logada (já conhecidos), nenhum sobre arquivos.

## NFILE.3 — revisão após os novos módulos (2026-10-08)
Status: **PASS técnico**; INFRAESTRUTURA_PENDENTE (tipos por área no armazenamento) e INTERACTIVE_BROWSER_VALIDATION_PENDING mantidos.

- Áreas: as mesmas 5, todas privadas, limites 5/10 MB conferidos; 0 objetos guardados; 0 referências em `student_photo_versions`, `inclusion_attachments`, `teaching_plan_attachments`, `assessment_item_media`, `meal_evidence_attachments`, `meal_fiscal_documents` ⇒ 0 órfãos, 0 referências quebradas. Nada apagado.
- Envios ao armazenamento: continuam só os 5 pontos com `guardUpload` (tipo real, tamanho, caminho seguro, `upsert:false`); nenhum novo módulo grava no armazenamento; nenhum `getPublicUrl`; links só com `SIGNED_URL_TTL_SECONDS` = 60 s.
- Arquivos lidos só no navegador (não vão ao armazenamento): imagens do calendário externo e do layout (reduzidas antes de salvar), logotipo da identidade (`validateLogoBytes`), JSON de layout do calendário, fonte curricular, Censo e Central de Importações.
- Referências históricas: substituir = novo arquivo + nova versão/evento; foto versionada não pode ser apagada; nenhuma regra de atualizar em área de armazenamento.

Correções técnicas:
- Importações lidas no navegador (layout do calendário, referência curricular, Censo, Central de Importações) não tinham teto de tamanho: agora recusam acima de 20 MB (`IMPORT_MAX_BYTES` em `import-kernel.ts`, teste `import-size.test.ts`), sem gravar nada. É limite técnico, não norma.
- Anexo de inclusão e anexo de planejamento não indicavam ao seletor os tipos aceitos; agora indicam JPG/PNG/WEBP/PDF, os mesmos da política (que continua sendo a garantia).
