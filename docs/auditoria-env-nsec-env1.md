# NSEC.ENV.1 — auditoria do `.env` versionado

## Situação atual (2026-10-12)
- Classe: **Registro de lote**. Em conflito, prevalecem os `AGENTS.md`.

## Achado (sem imprimir valores)
- `.env` está versionado desde `d804ee1d` (2 versões: `d804ee1d`, `a37fac41`), sempre com as mesmas 6 chaves: ID do projeto, URL e chave publicável (com e sem prefixo `VITE_`).
- Todos os valores são públicos por natureza (vão para o navegador). Nenhuma chave secreta, `service_role` ou senha.
- Histórico inteiro: 9 commits citam o prefixo `sb_secret_`, todos em código/docs/testes como padrão de detecção; 0 ocorrências com forma de valor real.
- Conclusão: **sem exposição de segredo comprovada; rotação não recomendada.**

## Ações
- `.gitignore`: `.env.*` ignorado (exceto `.env.example`).
- `.env.example`: modelo sem valores.
- Guarda no CI: `src/test/invariants/env-file-public-only.test.ts` (allowlist de chaves; falha se aparecer valor com forma de segredo).

## Não feito (decisão)
- `.env` **não** foi removido do índice: o arquivo é gerado e mantido pela plataforma Lovable Cloud, e remover do índice exige comando git de estado, fora do mecanismo de sincronização permitido. Como só contém valores públicos, o risco é nulo.
- Histórico **não** reescrito.
