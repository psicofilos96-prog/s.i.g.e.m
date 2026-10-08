# Engenharia de release do SIGEM

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


## Checks obrigatórios (`.github/workflows/ci.yml`, job `required`)
1. `bun run check:migrations` com `SIGEM_REQUIRE_FROZEN=1`: falha se migration congelada foi editada/removida, se journal e arquivos divergem, ou se há migration nova sem hash. Só lê arquivos; nunca reexecuta histórico.
2. Typecheck (`tsgo`, com `tsc` de reserva).
3. `bun run test` (suíte rápida, inclui invariantes arquiteturais).
4. `bun run build`.
Job `deep` (após `required`): `bun run test:deep` (property tests).

O workflow não usa segredo nem acessa banco. Local: `bun run ci`.

## Migrations: ordem segura app ↔ DB
- Migrations são aplicadas pela plataforma na hora em que são criadas, **antes** de o app ser publicado. Portanto toda migration precisa ser compatível com o app publicado atual (expandir → publicar app → só então deixar de usar o antigo; nunca DROP/RENAME direto).
- Após criar migration: `bun run invariants:freeze-migrations` (acrescenta hash; nunca reescreve).
- Correção de migration aplicada = **nova** migration (forward-fix). Ledgers append-only nunca são "desfeitos"; erro vira registro de correção/revogação.

## Rollback
- Aplicação: restaurar versão anterior pelo histórico do editor e publicar de novo. Banco não volta junto — por isso a regra de compatibilidade acima.
- Banco: sem rollback automático; forward-fix. Restore de backup **nunca foi testado** (pendência do piloto).

## Versão identificável
`src/config/build-info.ts`: versão do app, commit curto e data do build, injetados no build; esquema = última migration; tudo exibido em `/diagnostico`; ausente ⇒ "desconhecido". Não contém segredo. Checklist: `release-checklist-nrelease1.md`.

## Changelog
`bun run release:notes [ref]` agrupa commits por prefixo semântico (`feat:`, `fix:`, `sec:`, `db:`, `docs:`, `test:`, `chore:`).

## Feature flags
Não implementadas: nenhuma necessidade real identificada. Gating atual é por capability homologada (auditável).

## Lacunas (não inventadas)
- Não existe staging separado: uma única instância de backend serve preview e publicado. Preview de app existe; preview de banco não.
- O CI só roda se o repositório for conectado ao GitHub; branch protection exigindo `required` precisa ser ligada pelo dono do repo.
- Commits do editor chegam como "Changes", sem prefixo semântico: o changelog só fica útil com commits semânticos.
- Não há gate que impeça publicar com CI vermelho: publicar é manual na plataforma.
