# Auditoria estrutural final pré-2027 (Frente BP)

Data: 2026-10-06. Commit auditado: `ae56fb3dc6fb46aa4daf4a3d39a1b1c62eac88df` (árvore limpa no início; nenhuma alteração de software durante a BP; este relatório e a entrada no relatório sistêmico são as únicas mudanças).
Migrations: 0000–0200 (201 arquivos SQL + `meta`).

Esta auditoria verificou o repositório, o banco e os testes no estado atual; não herdou PASS dos relatórios.

## 1. Gates executados (estado final)
| Gate | Resultado |
|---|---|
| Suíte completa (vitest) | 311 arquivos, 3.820/3.820 PASS |
| Deep invariants (`SIGEM_DEEP=1`) | 31/31 PASS |
| tsgo `--noEmit` | limpo (exit 0) |
| Build real (`vite build`) | exit 0; saída lida; "error" só aparece em nome de arquivo (`governed-errors-*.js`) |
| Migration integrity/freeze/hash (`scripts/check-migrations.mjs`, `migration-hashes.json` inclui 0200) | ok |
| `git diff --check` | limpo |
| Focais (observability/BK, a11y forms/dialogs BO.5, meals, intelligence, privacy, family) | 7 arquivos, 71/71 PASS |
| Smoke de rotas (Playwright, sem sessão) | `/`, `/auth`, `/diario`, `/relatorios`, `/ajuda`: 200, 1 `main`, 1 `h1`, 0 page errors. `/calendario`, `/alimentacao`, `/portal` deram 404 porque esses caminhos não existem (o teste escolheu nomes que não são rotas reais), não por defeito. `/diario` mostrou `h1` só depois de 6 s: era a sessão ainda carregando |
| Runtime errors | nenhum page error no smoke; sem log de runtime pendente |
| Smoke autenticado / 10 perfis | não reexecutado na BP (sem mudança de software depois da BO.5): última execução BO.5 = harness 69/69 + a11y 33/33 (op `bo-9ddaccdabbc0`) |

## 2. Segurança
- Security Advisor no HEAD: 499 findings (120 INFO RLS sem policy; 3 DEFINER anon; 376 DEFINER authenticated). Baseline BO.5 = 499, delta 0 por tipo. Os 3 anon são `public_portal_get`, `public_portal_list` e `verify_school_document`, intencionais (portal público/verificação de documento). Os DEFINER authenticated são writers/readers com guarda interna de capability. As tabelas sem policy são locked-by-default, acessadas só via função.
- Consultas independentes: 0 DEFINER em `public` sem `search_path`; 0 grants INSERT/UPDATE/DELETE/TRUNCATE para anon/authenticated em `public` (DML direto impossível por papel de app); 0 tabelas `public` sem RLS; 0 buckets públicos (4 privados; signed URL com TTL único, BH); 0 policies de teste/fixture; 0 funções de SQL genérico/arbitrário.
- Fixture 0194: `bo_fixture_accounts` vazia, sem GRANT. Self-grant 0195: recusa reprovada no harness 69/69. Readers set-based 0196–0200: INVOKER, cobertos pela suíte. Imutabilidade de política: trigger, provada no harness. Executor técnico (`technical_operation_id`) não é pessoa nem autor.
- Busca de segredos (sem imprimir valores) em repositório e `dist`: nenhuma chave secreta, JWT, chave privada ou credencial de nuvem. O único acerto, `src/features/help/block-codes.test.ts`, é um padrão de regex de redaction. `.env` versionado contém só URL/ID e chave publicável (pública por design).

## 3. Integridade
- 0000–0200 presentes; hashes congelados conferem. 0057/0059 têm edições históricas de 2026-10-04, anteriores ao congelamento, e o hash atual é o congelado. As recentes (0194–0200) são aditivas.
- Nenhuma policy de teste, nenhum resolver substituto, nenhuma rota técnica genérica.

## 4. Dados reais / zero resíduos
55 escolas, 698 turmas, 9.763 alunos, 9.811 matrículas legadas 2026, 2 atuações reais, 8 políticas (6 homologadas, 2 rascunhos), 2 contas Auth (reais), 0 Auth BO, 0 fixtures, 0 endings, 0 autorizações Família, 0 aulas/frequência/planos/resultados/episódios, 0 objetos de storage, 0 execuções/evidências/movimentos NAE, 0 triggers desligadas, 0 regras de capability BO.
10.822 pessoas = identidades de estudante e de atuação existentes (0 pessoas BO no harness).
Anos: 2026 (Educacenso, 2026-10-05) e 2027 (Supervisão, 2026-10-04). Calendário 2027 = 3 versões e 3 homologações, todas criadas antes da BO e não alteradas por testes.

## 5. Matriz final
| Frente | Status | Evidência | Pendência | Classificação |
|---|---|---|---|---|
| Núcleo/cadastro institucional (B1/B2) | completo | writers `register_*`, AGENTS institutional-admin, suíte | — | RESOLVED |
| Pessoas/atuações/capabilities/política v8 | completo | `effective_capabilities`, 0195, harness 69/69 | atribuições reais | RESOLVED + HUMAN_CONFIGURATION |
| Escolas/turmas/alunos/matrículas/enturmação/alocação/posição curricular (B3) | completo | 0196–0200, benchmarks BO.5 | — | RESOLVED |
| Calendário | completo; 2027 real homologado | `calendar_*_at`, 3 homologações | conferência humana do conteúdo | RESOLVED + SUBJECTIVE_HUMAN_VALIDATION |
| Planejamento | completo | planning-source, export ACL | — | RESOLVED |
| Oferta/aulas, Diário/frequência | completo | lesson/attendance writers, a11y BO.5 | política de correção do diário por escola | RESOLVED + INSTITUTIONAL_RULE |
| Avaliação/desempenho | completo | `register_assessment_results`, benchmark de 97 ms | correção/norma por instrumento | RESOLVED + INSTITUTIONAL_RULE |
| Acompanhamento/Orientação | completo | readers com minimização | — | RESOLVED |
| Família | reader/minimização/revogação/IDOR provados | BO.4/BO.5 | writer de concessão sem capability v8 | INSTITUTIONAL_MODEL_PENDING |
| AEE | estrutura de dados existe | tabelas `aee_*` | tipo de atuação/regra v8, se adotado | INSTITUTIONAL_MODEL_PENDING |
| Direção/Gestão/Supervisão | completo | export ACL 42/42 | — | RESOLVED |
| CIECE | completo | fact-loader, sem ranking | layouts Educacenso | RESOLVED + OFFICIAL_SOURCE |
| Relatórios/exportações/documentos | completo | report-engine, export ACL 42/42 | templates oficiais da Secretaria | RESOLVED + INSTITUTIONAL_RULE |
| BF administração/acesso | completo | central de acessos, harness | — | RESOLVED |
| BG imports | completo | import_batches, staging com hash | arquivos oficiais futuros | RESOLVED + OFFICIAL_SOURCE |
| BH privacidade | completo | DATA_INVENTORY, testes privacy | prazos de retenção | RESOLVED + INSTITUTIONAL_RULE |
| BI acessibilidade | completo | smoke 33/33, 5/5 dialogs/forms | usabilidade percebida | RESOLVED + SUBJECTIVE_HUMAN_VALIDATION |
| BJ performance/observabilidade | completo | benchmarks até 97 ms, telemetry | — | RESOLVED |
| BJ concorrência | locks, base esperada, `plan_id`, double-submit provados; corrida paralela real não executada | writers com lock, testes stale | banco descartável | VERIFICATION_LIMITATION — PARALLEL_CONCURRENCY_UNPROVEN — IMMUTABLE_FACT_RESIDUE |
| BK ajuda/bloqueios | completo | 23 testes, 5 telas ligadas | — | RESOLVED |
| BM.0/BM.1 | foundation/readers/editor/queryRef/handoff NAE→BM presentes e testados | intelligence tests | capabilities BM sem regra homologada (0 regras) | RESOLVED + INSTITUTIONAL_MODEL_PENDING |
| NAE.0–NAE.8 | L1–L5, evidence/storage privado, estoque/cozinha/fechamento, handoff, segurança e zero resíduos provados | meals tests, 0 resíduos | política Núcleo/Cozinha; adesão, desperdício, estoque mínimo, prazo NC, baixa teórica, transferência; custo; visual | HUMAN_CONFIGURATION / INSTITUTIONAL_MODEL_PENDING; INSTITUTIONAL_RULE; OFFICIAL_SOURCE; SUBJECTIVE_HUMAN_VALIDATION |
| BO fechamento acadêmico | PASS BO.5 | relatório BO | — | RESOLVED |

## 6. Revalidação dos itens STILL_TECHNICAL da BN
- BD integrada com Auth real: BO.4 PASS → RESOLVED.
- BF/BH E2E por perfil: 69/69 + 42/42 + Família → RESOLVED.
- BI: 33/33, dialogs e forms/double-submit → RESOLVED.
- BK: 23 testes + 5 telas → RESOLVED.
- Escala: benchmarks com máximo de 97 ms; defeito real corrigido em 0200 → RESOLVED.
- Concorrência: VERIFICATION_LIMITATION — PARALLEL_CONCURRENCY_UNPROVEN — IMMUTABLE_FACT_RESIDUE.

**Impacto da concorrência nos gates.** O Gate 1 só é bloqueado por STILL_TECHNICAL, então essa limitação não bloqueia. O Gate 2 também não: a configuração controlada é feita por poucas pessoas e em série. A serialização está implementada no banco (lock por fato lógico, base esperada, idempotência por `plan_id`), e o double-submit é bloqueado na interface. Antes de produção com carga concorrente, a corrida paralela real precisa ser provada em ambiente descartável (item 9 do checklist).

Nenhum STILL_TECHNICAL restante.

## 7. Pendências não técnicas (lista exata)
1. HUMAN_CONFIGURATION: atribuições reais de atuações (hoje há 2: administração e Supervisão) para Professor, Secretaria, Direção, Gestão, Orientação, CIECE, Núcleo/Cozinha.
2. INSTITUTIONAL_MODEL_PENDING: capabilities BM; capabilities NAE/Cozinha; writer de concessão Família; AEE (se adotado).
3. INSTITUTIONAL_RULE: adesão, desperdício, estoque mínimo, prazo de NC, baixa teórica e transferência (NAE); correção de diário/avaliação; retenção (BH); fórmulas de déficit/aulas; templates oficiais.
4. OFFICIAL_SOURCE: layouts Educacenso; planilha oficial de DP; referências BNCC/SAEB; custos de alimentação.
5. EXTERNAL_SERVICE: nenhuma dependência bloqueante identificada.
6. SUBJECTIVE_HUMAN_VALIDATION: UX e conteúdo por perfil, visual NAE, conferência do calendário 2027.
7. VERIFICATION_LIMITATION: concorrência paralela real.

## 8. Decisões
**Gate 1 — PASS — SIGEM_STRUCTURAL_CYCLE_COMPLETE.** Não há STILL_TECHNICAL. Segurança, integridade e gates estão verdes. As lacunas restantes estão todas listadas na seção 7, em categorias não técnicas.

**Gate 2 — PASS — READY_FOR_2027_CONTROLLED_HUMAN_CONFIGURATION.** Os fluxos oficiais estão prontos: capability/policy (rascunho → preview → homologação com base esperada), versionamento append-only, auditoria por projeção, writers e readers, e bloqueios governados. Nenhuma configuração exige bypass técnico. Isto NÃO significa que 2027 esteja configurado.

## 9. Checklist de configuração 2027 (não executado)
1. **Perfis:** registrar pessoas reais e atuações por `record_engagement`, por escola/turma, com vigência 2027.
2. **Capabilities sem regra:** decidir e homologar, em nova versão de política, as regras de BM, NAE/Cozinha, writer Família e AEE (se adotado). Cada uma passa por `preview_capability_policy`.
3. **Calendário/ano 2027:** conferir as versões homologadas, a organização de períodos e a ligação turma → organização.
4. **Currículo:** matrizes (B4.1) e homologações, correspondências E2/E3/E4, catálogos institucionais.
5. **Fontes oficiais:** Educacenso 2027, planilha de DP, BNCC/SAEB e custos de alimentação, todos via import com hash e proveniência.
6. **Regras institucionais:** políticas de correção (diário/avaliação), fechamento, retenção e parâmetros NAE.
7. **Templates/conteúdos:** documentos escolares oficiais, ajuda institucional, portal público.
8. **Validação humana:** UX e conteúdo por perfil, em desktop, tablet e celular.
9. **Homologação por perfil antes de produção:** roteiro tipo harness por perfil real (próprio escopo, IDOR, revogação) e prova de concorrência paralela em ambiente descartável.

## 10. Não executado nesta BP
Configuração real de 2027, criação de políticas/capabilities/regras, atribuição de pessoas, carga de fontes oficiais, decisão sobre AEE, persistência de fatos sintéticos, prova de concorrência paralela, nova reexecução do harness autenticado de 10 perfis (vale a última execução da BO.5 sobre o mesmo software).
