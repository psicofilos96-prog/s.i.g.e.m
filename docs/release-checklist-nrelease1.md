# NRELEASE.1 — Metadados e checklist de release (sem publicar)

## Situação atual
Classe: Referência vigente (2026-10-08). Prepara homologação reproduzível; **nada foi publicado** e nenhuma produção foi iniciada. Complementa `engenharia-de-release.md`.

## Identificação da versão (área técnica)
`/diagnostico` (só Administrador Geral) mostra: versão do app, commit curto, data do build/modo e esquema (= última migration de `drizzle/migrations`, com contagem). Fonte: `src/config/build-info.ts`; `/api/public/health` expõe só commit e data. Nenhum segredo, chave, e-mail ou dado pessoal. Ausência ⇒ "não definida"/"desconhecido", nunca valor inventado. Teste: `src/config/build-info.test.ts`.

- DEPENDE_DECISAO: número de versão do app (`package.json` não tem `version`; exibe "não definida" até o proprietário definir a numeração).

## Changelog técnico
`bun run release:notes [ref-da-ultima-homologacao]` — agrupa commits por prefixo semântico e, como os commits da plataforma vêm como "Changes", lista também migrations, documentos de lote, testes e `AGENTS.md` alterados no intervalo. Gerar e anexar ao registro da homologação; revisar antes de circular (mensagens de commit não passam por redaction automática).

## Checklist de homologação
Registrar para cada item: responsável, data, resultado, evidência.

### 1. Identificação
- [ ] Commit, esquema e data anotados a partir de `/diagnostico`.
- [ ] `release:notes` gerado desde a homologação anterior.

### 2. Migrations
- [ ] `bun run check:migrations` com `SIGEM_REQUIRE_FROZEN=1` verde (nenhuma migration congelada editada).
- [ ] Toda migration nova está no manifesto (`invariants:freeze-migrations`).
- [ ] Nenhuma migration nova é destrutiva (DROP/RENAME/tipo) — compatível com o app publicado.
- [ ] Migrations com dado oficial: nenhuma (dado oficial entra só por homologação).

### 3. Storage
- [ ] Buckets privados continuam privados (NFILE.2: `scripts/nfile2-storage-scopes.mjs`).
- [ ] Nenhum arquivo novo exposto por URL pública.

### 4. Testes e gates
- [ ] `npm run verify` completo verde (typecheck, suíte, invariantes, build).
- [ ] `bun run test:deep` verde.
- [ ] Varredura de segurança sem achado crítico novo.
- [ ] INTERACTIVE_BROWSER_VALIDATION_PENDING: roteiro com login real (contas de setor e Supervisão).
- [ ] PROVAS_SQL_PENDENTES: `supabase/tests/*.sql` exigem acesso privilegiado.

### 5. Rollback
- [ ] Versão anterior do app identificada (commit) para restauração pelo histórico do editor.
- [ ] Banco: sem rollback; plano de forward-fix descrito para cada migration nova.
- [ ] REVISAR: restauração de backup nunca testada.

### 6. Bloqueios conhecidos (não resolver na homologação)
- (Histórico) STOP 2027 por 198 dias foi superado: CAL.COUNT.1 PASS com 200 dias; abrir 2027 continua decisão do proprietário.
- Gaps decididos de NFINAL.7 abertos.

## Proibido neste lote
Publicar, alterar visibilidade, executar migration, mudar dado oficial ou conceder capacidade.
