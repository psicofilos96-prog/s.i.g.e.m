# Aceite definitivo — SIGEM pronto para piloto?

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Data da verificação: 2026-10-05. Verificação independente; nenhum módulo novo; nenhum dado real importado.
Commit: gerenciado pela plataforma (o identificador da versão aparece em `BUILD_INFO`).

| # | Requisito | Resultado | Evidência objetiva |
|---|-----------|-----------|--------------------|
| 1 | Rotas/módulos, órfãs/duplicadas | PASS (corrigido) | 177 arquivos em `src/routes`. 20 páginas sem entrada no menu → incluídas em `src/config/navigation.ts`. Nenhuma rota duplicada. |
| 2 | Suítes, typecheck, build, audits | PASS | 3.213 testes rápidos + 19 profundos (`test:deep`); `tsgo` limpo; build limpo (11,5 s); `check:migrations` ok; análise de dependências sem achados. Repetido após correções: calendário 356/356, typecheck limpo. |
| 3 | E2E sintético completo isolado | BLOCKED | Prova parcial: 5.000 unidades inseridas e desfeitas por ROLLBACK, 0 residuais. A cadeia completa (importação → matrícula → Diário → documento → Família) exige sessão com atuação vigente; a conta técnica não executa esses writers e não existe ainda nenhuma conta com atuação real. |
| 4 | Cloud × migrations/journal/snapshots | PASS com ressalva | 89 arquivos = 89 snapshots = 89 entradas no journal; os 89 hashes estão aplicados. O banco tem 1 registro aplicado a mais (hash `5eacd366…`, 2026-10-04 22:18 UTC) sem arquivo correspondente: aplicação anterior de uma migration depois reescrita. O estado final do banco contém todas as migrations do repositório; o histórico não é apagado (forward-fix). |
| 5 | Zero fixtures/dados de teste persistentes | PASS | Nenhuma escola, turma, estudante, importação, emissão ou autorização familiar no banco; resíduo da simulação = 0. Laboratório só em memória, sem sessão. |
| 6 | Zero segredos versionados | PASS | `.env` só contém chaves publicáveis geradas; workflow de CI sem segredos; nenhum `service_role` no frontend (invariante). |
| 7 | Política/capabilities/escopos allow/deny | PASS | v4 homologada (`decisao-do-proprietario`, 213 regras, 85 capabilities); v3 preservada; invariantes: draft não autoriza, sem curinga, cargo nunca filtra. Allow/deny com contas reais por perfil depende do item 3. |
| 8 | RLS/ACL/SECURITY DEFINER por risco | PASS | 0 DML anônimo; 0 DEFINER sem `search_path`; 3 funções anônimas intencionais (verificação de documento e portal público, retorno mínimo); 0 GRANT a anon em tabelas sensíveis; buckets sensíveis privados. 258 avisos do linter, todos explicados (escrita só por função; leitura com capability). |
| 9 | Mobile/acessibilidade | PASS | `a11y.test.tsx` e `states.test.tsx` (axe) passam; skip link, `main` único, alvos de 44 px, movimento reduzido. Teste com leitor de tela real não executado. |
| 10 | Relatórios/exports/documentos/minimização | PASS | Motor único com neutralização de fórmula e escape HTML; colunas sensíveis fora por padrão; exportação de auditoria exige capability; verificação pública sem id técnico; `privacy-leak.test.ts` passa. |
| 11 | Importação preview → confirmação → idempotência | PASS (unitário) | Staging isolado, hash, preflight, confirmação humana, writers canônicos; invariante de importadores. Execução no banco com conta real depende do item 3. |
| 12 | Performance com massa sintética | PASS | Números observados: 300 e 1.000 turmas processadas; pico de 9.000 chamadas corrigido para 8 turmas em paralelo; 50 gravações concorrentes da mesma base → exatamente 1 venceu; 5.000 unidades inseridas/revertidas no banco. 9 leituras por turma (aceitável por escola). |
| 13 | Runbooks release/incidente/backup/piloto | PASS / BLOCKED (restore) | `docs/engenharia-de-release.md`, `docs/observabilidade-e-incidentes.md`, `docs/runbook-piloto.md`, `docs/privacidade-e-ciclo-de-vida.md` existem e cobrem os cenários. Restore nunca foi testado: só o proprietário pode executá-lo na plataforma. |
| 14 | Decisão do proprietário sem "ato" artificial | PASS (corrigido) | Política e ativação aceitam `decisao-do-proprietario` sem ato. Formulários do calendário exigiam um texto de ato preenchido à mão → agora vêm preenchidos com "Decisão do proprietário do SIGEM" (`OWNER_DECISION_ACT_REF`), sem deixar de ser editáveis. |
| 15 | Documentos normativos como fonte | PASS | `docs/data/d1-contrato-canonico-cme-3-2026.json`, `deliberacao-cme-3-2026-matrizes-source.json`, `escolas-itaperuna-censo2026.json` preservados com hash/proveniência; memórias históricas em `docs/`. |

## Conclusão

**NÃO PRONTO** — faltam dois bloqueadores mínimos, ambos ações do proprietário e não de código:

1. **Contas reais com atuação** (Secretaria, Direção/OP, Docente; Família, se for habilitada) cadastradas pela Administração. Em seguida, rodar o E2E do item 3 com essas contas, numa escola-piloto.
2. **Teste de restore** do backup da plataforma, confirmado manualmente (runbook do piloto, seção de backup).

Concluídos esses dois passos com resultado positivo, o gate passa a **PRONTO PARA PILOTO COM DADOS REAIS** sem nenhuma alteração de código.
