# Prontidão operacional e recuperação (NOPS.1 → NOPS.3)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.
- NOPS.3 (2026-10-08): checklist reexecutado após a campanha; resultado na seção NOPS.3. Nada publicado; nenhum dado pessoal ou segredo copiado.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


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

## NOPS.3 — execução de 2026-10-08
| Item | Estado | Evidência |
|---|---|---|
| Health | PASS | `pronto`, login ok, banco ok |
| Versão da aplicação | PASS com ressalva | repositório `c1de62c9`; o health do preview responde `f30bba5b` (build anterior). Não é falha: o preview serve o último build concluído. Conferir o commit pelo health após cada publicação |
| Versão do schema | PASS | legado `20261001111311_b2_5_3…` + atual `0250_ndb4…` |
| Migrations | PASS | integridade ok; manifesto 300/300 |
| Saúde do banco | PASS | banco e pool no ar, 0 reinícios, disco 27%, memória 67%, 8/60 conexões, 211 MB, sem alerta de esgotamento em 48 h |
| Dependências externas | PASS | 4 variáveis presentes (só nome, nunca valor); GPE/Educacenso = EXTERNAL_INTEGRATION_UNDEFINED |
| Dependências de pacotes | PENDENTE (risco conhecido) | 55 pacotes; `exceljs@4.4.0` traz `brace-expansion` e `uuid` vulneráveis (5 alta/moderada de negação de serviço, 1 moderada). Não há versão do `exceljs` com correção; o uso é só no navegador, sobre arquivo escolhido pelo próprio usuário e com teto de 20 MB. Reavaliar quando sair versão nova |
| Armazenamento | PASS | 5 áreas privadas, 0 arquivos |
| Ensaio de restauração efêmero | PASS | 55 versões cadastrais de escolas exportadas/restauradas com a mesma impressão digital, em transação com ROLLBACK; nada persistiu |
| Restauração completa de backup | INFRAESTRUTURA_PENDENTE | sem banco efêmero separado |
| Verificação de rotina | PASS PARCIAL | `npm run verify` (NVERIFY.2): 13 PASS, 2 NOT RUN (harness e navegador) |

## Checklist de manutenção (cada release ou mensal)
1. `npm run verify` → nenhum FAIL; registrar NOT RUN.
2. `node scripts/ops-readiness.mjs` → todos ✔ (o ensaio de restauração incluído).
3. Saúde do banco pelo backend: disco < 80%, sem alerta de esgotamento.
4. Varredura de dependências; vulnerabilidade nova com correção disponível = atualizar em lote próprio.
5. Varredura de segurança da plataforma; nunca ampliar acesso para zerar aviso.
6. Após publicar: o commit do health deve ser o publicado.
7. Migration nova: congelar pelo `invariants:freeze-migrations`; nunca reescrever hash.

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
