# Prontidão operacional e recuperação (NOPS.1 → NOPS.2)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Runner único: `node scripts/ops-readiness.mjs`. Ele só lê dados e sai com código ≠ 0 se algo falhar; `SIGEM_HEALTH_BASE` muda o endereço verificado. Nada foi colocado em produção. O runner não imprime segredos (só se a variável está "presente" ou "ausente") e não exporta dados pessoais.

## Checklist (execução de 2026-10-07)
| Item | Estado | Como é verificado |
|---|---|---|
| Health | OK | `/api/public/health?ready=1` deve dizer "pronto", com login e banco ok; 503 quando não está pronto |
| Versão da aplicação | OK | commit do repositório + commit e data do build devolvidos pelo health |
| Versão do schema | OK | última migration antiga (`supabase/migrations`) + última atual (`drizzle/migrations`, hoje `0237`) |
| Integridade de migrations | OK | `check-migrations.mjs` + manifesto congelado |
| Dependências externas | OK | só o backend do Lovable Cloud (login, banco, armazenamento) e a chave de IA; o runner confere só se cada variável existe; GPE/Educacenso = EXTERNAL_INTEGRATION_UNDEFINED |
| Armazenamento | OK | 5 áreas, todas privadas, 0 arquivos; qualquer área pública faz o checklist falhar |
| Filas/rotinas agendadas | Nenhuma | não há rotinas agendadas instaladas |
| Ensaio de restauração | OK (lógico, efêmero) | numa transação que termina em ROLLBACK: as 55 versões cadastrais de escola são exportadas para JSON, restauradas numa tabela temporária e comparadas por contagem + impressão digital MD5; nada persiste (0 tabelas temporárias restantes) |
| Restauração completa de backup | INFRAESTRUTURA_PENDENTE | os backups são da plataforma; não há banco efêmero separado nem ferramenta para baixar um dump |
| Rollback de release | Documentado | abaixo |
| Manutenção/indisponibilidade | Documentado; aviso na tela PENDENTE | abaixo |

## Rollback de release
1. **Código:** restaurar a versão anterior pelo histórico do Lovable e publicar de novo. O health mostra qual commit está no ar.
2. **Banco:** nunca reverter uma migration aplicada. A correção é sempre uma migration nova e compatível com o app publicado, porque a plataforma aplica as migrations antes da publicação (ver `docs/engenharia-de-release.md`).
3. **Ordem segura:** primeiro reverter o código, se a migration nova for aditiva; se não for, primeiro publicar o forward-fix.
4. **Depois:** rodar `ops-readiness.mjs` com `SIGEM_HEALTH_BASE` apontando para o endereço publicado e registrar o incidente (`docs/observabilidade-e-incidentes.md`).

## Manutenção e indisponibilidade
- **Health "não pronto" (503):** o banco ou o login não respondem. Verificar o estado do backend, reiniciar só se o estado confirmar o problema e rodar o checklist de novo.
- **Disco cheio:** o banco passa a só leitura. A saída é aumentar o disco pelas configurações avançadas do backend; apagar dados oficiais nunca é solução.
- **Manutenção planejada:** avisar as escolas por canal institucional; o app não tem modo só leitura nem faixa de aviso (PENDENTE, depende de decisão sobre quem anuncia).
- **Comunicação:** dizer o que está fora, o que continua funcionando e quando o sistema volta; nunca incluir dados de estudantes.

## Limitações
- O ensaio prova o caminho exportar → restaurar → conferir, mas não restaura um backup da plataforma.
- A conta técnica do checklist não lê as tabelas de política de permissões (permissão recusada, como esperado); por isso o ensaio usa o cadastro das escolas.
