# Prontidão operacional e recuperação (NOPS.1)

Runner único, somente leitura: `node scripts/ops-readiness.mjs` (sai ≠ 0 se algo falhar; `SIGEM_HEALTH_BASE` muda o alvo do health). Não lê segredos nem exporta dados.

| Item | Estado | Como verificar |
|---|---|---|
| Integridade de migrations | OK | `check-migrations.mjs` + manifesto congelado (`invariants:freeze-migrations`) |
| Versão do schema | OK | última migration em `supabase/migrations` (nome por timestamp ordena depois da numeração antiga) |
| Versão da aplicação | OK | `/api/public/health` devolve commit + data do build |
| Health | OK | `/api/public/health` (vivo) e `?ready=1` (login e banco); 503 quando não pronto |
| Dependências externas | OK | só o backend do Lovable Cloud (login, banco, armazenamento); GPE = EXTERNAL_INTEGRATION_UNDEFINED |
| Armazenamento | OK | 5 áreas privadas, 0 objetos (ver docs/storage-arquivos-privados.md) |
| Filas/jobs | Nenhum | sem pg_cron/pg_net instalados; nenhuma rotina agendada |
| Rollback de release | Documentado | código: reverter pelo histórico do Lovable; banco: só forward-fix compatível (docs/engenharia-de-release.md) |
| Backup lógico | INFRAESTRUTURA_PENDENTE | backups do banco são da plataforma; não há ferramenta para gerar/baixar dump; o schema é reproduzível pelas migrations do repositório |
| Restauração em ambiente de teste | INFRAESTRUTURA_PENDENTE | não existe banco efêmero separado; simular falha no banco real é proibido |
| Manutenção/indisponibilidade | PENDENTE | não há aviso de manutenção nem modo somente leitura na aplicação |

Regras: nenhuma credencial neste documento; nenhum export de dados pessoais; simulação de falha só em ambiente efêmero (hoje inexistente → não executada).
