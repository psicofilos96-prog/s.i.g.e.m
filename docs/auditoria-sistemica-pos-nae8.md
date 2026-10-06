# Auditoria sistêmica pós-NAE.8 (Frente BN) — 2026-10-06

## Decisão final
**PARTIAL — SIGEM_STRUCTURAL_CYCLE_NOT_COMPLETE.**
`PASS — SIGEM_STRUCTURAL_CYCLE_COMPLETE` e `PASS — READY_FOR_2027_CONTROLLED_HUMAN_CONFIGURATION` **não** são declarados, por dois motivos técnicos:
1. **BD (STILL_TECHNICAL):** ainda não existe a simulação integrada 2027 da cadeia inteira, de escola até correções. Há só provas por módulo.
2. **Gates autenticados persistentes não provados:** NAE.8, BF e BH. No caso da NAE, o bloqueio é configuração institucional. Nos perfis acadêmicos, há um caminho técnico viável que ainda não foi executado (§5).

## 1. Base canônica
- HEAD auditado: `c46db44f2cbb6020ebab745cac6697811f978785`.
- Migrations: 0000–0193 (194 arquivos). Nenhuma migration nesta frente.
- Política de capacidades: `politica-capacidades-diario` v8 homologada desde 2026-10-05, com 8 versões. Tipos de atuação com regras: administrador-geral, cadastro-institucional, ciece-auditoria, ciece-estatística, direção, gestão pedagógica, orientação, professor, RH e secretaria.
- Atuações vigentes reais: 2 (administrador-geral e autoridade do calendário). Não há atuação real de professor, secretaria, direção, família, Núcleo ou cozinha.
- Banco: 55 escolas, 698 turmas, 9.763 alunos, 3 versões de calendário, ano 2026 `historico-importado`, 2027 não configurado.

## 2. Matriz BD / BL / BM / NAE (evidência atual)
| Item | Estado | Evidência executada no HEAD | Falta |
|---|---|---|---|
| BD simulação integrada 2027 | **STILL_TECHNICAL** | provas por módulo (w2 diário, z2 planejamento, v1 oferta, ac2 família, b4_2_4 resolução) | orquestrador integrado da cadeia, com revogação, stale, knownAt, outra escola, ator técnico e rollback |
| BL/BF administração e acesso | STILL_TECHNICAL (parcial) | bf_admin_privilege_e2e (self-grant); revogação imediata provada pelo resolver real em NAE.8 L5 | E2E de revogação, IDOR, vigência e conta sem pessoa no domínio administrativo |
| BL/BH privacidade por perfil | STILL_TECHNICAL (parcial) | inventário + E2E da Família | E2E de AEE, professor, Secretaria e Supervisão; IDOR em download/export |
| BL/BI acessibilidade autenticada | STILL_TECHNICAL | smoke em 3 larguras sem login; `a11y.test.tsx` | estados com login, diálogos/ESC, formulários |
| BL/BJ concorrência/escala | parcial | locks/base esperada/idempotência provados em sequência (NAE, Pauta, fechamentos) | concorrência paralela **UNPROVEN** (o ambiente não oferece duas conexões de dono); escala acadêmica não medida |
| BL/BJ observabilidade | RESOLVED (técnico) + EXTERNAL_SERVICE | telemetry.ts, governError, /diagnostico | provedor de monitoramento externo |
| BL/BK códigos e mensagens | parcial | block-codes.ts e glossário | mensagens por tela ligadas ao registro; CONTENT_SOURCE_PENDING |
| BL/BG importações | RESOLVED (técnico) | bg_governed_import_e2e | contrato DP/Educacenso (OFFICIAL_SOURCE) |
| BL ajuda/documentação | RESOLVED (técnico) | ajuda contextual, docs canônicas | conteúdo por perfil (HUMAN_CONFIGURATION) |
| BM.0–BM.1 | RESOLVED (técnico) | `bm_intelligence_foundation_e2e` reexecutado agora: `BM_E2E_OK 8/8`; semantic-layer tests | as 5 capabilities BM não estão em nenhuma política (REAL_ROLE_ASSIGNMENT_PENDING) |
| BM editor/montagem livre | RESOLVED como escopo | painel guarda só `queryRef`; widget com dados é recusado | — |
| Handoff NAE L4 → BM.1 | RESOLVED | `MEAL_EXECUTION_SEMANTIC`, somente leitura, escalas separadas | adesão, risco e eficiência = INSTITUTIONAL_RULE |
| NAE.0–NAE.8 L1–L4 | RESOLVED (técnico) | provas L1–L4 verdes; L2 reexecutada no L5; sem migration desde então | — |
| NAE.8 resolver real | RESOLVED | `nae8_lote5_real_resolver_e2e` → `nae8-l5-ok` | — |
| NAE.8 sessão persistente | **HUMAN_CONFIGURATION (verificação bloqueada)** | — | AUTHENTICATED_UI_SMOKE_PENDING, AUTHENTICATED_EVIDENCE_UI_E2E_PENDING: nenhuma política homologada concede capabilities de alimentação; política de teste permanente foi recusada pelo proprietário |

## 3. Matriz por perfil
| Perfil | Tipo de atuação / política | Escrita | Negativos provados | Homologação | Bloqueio |
|---|---|---|---|---|---|
| Admin Geral | administrador-geral (110 capabilities) | sim | self-grant recusado (BF) | 1 atuação real | revogação/IDOR administrativo não provados em E2E |
| CIECE | ciece-auditoria/estatística | só leitura | sem writer acadêmico (testes) | regra existe; sem atuação | REAL_ROLE_ASSIGNMENT_PENDING |
| Secretaria | secretaria-escolar (37) | matrícula e cadastro | B3/b3_1 em rollback | sem atuação | E2E persistente pendente |
| Direção/Gestão | direcao-escolar (36) | decisões e oficializações | testes de domínio | sem atuação | idem |
| Supervisão | autoridade-calendario + gestão pedagógica | calendário/matriz | designação explícita | 1 atuação real | E2E BH pendente |
| Orientação | orientacao-pedagogica (17) | acompanhamento | supressão por campo (testes) | sem atuação | idem |
| Docente | professor (19) | diário/frequência/avaliação | w2/z2 em rollback | sem atuação | idem |
| Família | autorização familiar (não é atuação) | não | ac2_family_e2e | — | E2E persistente pendente |
| Acompanhamento e Avaliação | capabilities BM | definições | BM_E2E 8/8 | **sem regra** | REAL_ROLE_ASSIGNMENT_PENDING |
| Núcleo Alimentação | capabilities de rede da alimentação | pedidos/estoque/fechamento | L1–L5 | **sem regra** | idem |
| Cozinha | registrar-execucao-alimentacao | execução | L3/L5 (outra escola, revogação) | **sem regra** | idem |
| RH / cadastro institucional | rh / cadastro-institucional | cadastro | testes de domínio | sem atuação | DP externo (OFFICIAL_SOURCE) |

## 4. Classificação consolidada
- **Software concluído (RESOLVED):** NAE L1–L4 e resolver real; BM.0–BM.1; importações governadas; observabilidade interna; relatórios/report-engine; privacidade (inventário, bucket privado, URLs de 60s).
- **Software técnico ainda incompleto (STILL_TECHNICAL):** BD (orquestrador integrado 2027); E2E por perfil BF/BH; a11y com login; mensagens por tela (BK); concorrência paralela real; escala acadêmica.
- **Verificação bloqueada por configuração institucional:** sessão persistente NAE (sem regra de alimentação homologada).
- **HUMAN_CONFIGURATION:** atribuição real de papéis; configuração de 2027; catálogos homologados; conteúdo de ajuda por perfil.
- **OFFICIAL_SOURCE:** planilha do DP, leiaute do Educacenso, BNCC/SAEB, custo da alimentação, dados territoriais, modelos oficiais.
- **INSTITUTIONAL_RULE:** adesão, desperdício, estoque mínimo, prazo de NC, baixa teórica, transferência, retenção/base legal, capacidade máxima.
- **EXTERNAL_SERVICE:** provedor de monitoramento externo; adaptadores de integração (vazios por design).
- **SUBJECTIVE_HUMAN_VALIDATION:** HUMAN_UI_VALIDATION_PENDING / HUMAN_USABILITY_VALIDATION_PENDING.

## 5. Caminho técnico viável não executado (sem inventar política)
Os perfis acadêmicos (professor, secretaria, direção, orientação, CIECE) **já têm regras homologadas** na v8. Uma sessão persistente sintética é tecnicamente viável **sem criar política**: usuário Auth de teste, pessoa sintética e atuação sintética do tipo existente, tudo removível. Isso destrava BD, BF, BH e a11y com login para esses perfis. Para alimentação e BM continua impossível até haver regra real. É o próximo trabalho técnico; não foi executado nesta auditoria.

## 6. Concorrência e performance
- Provado: unique(logical_id, version), lock por fato lógico, base esperada (`meal:stale` etc.), aceite idempotente e dupla submissão recusada, tudo em sequência.
- **Concorrência paralela: UNPROVEN** (limitação de ambiente).
- Baseline real: só NAE L4 (60 mil movimentos; resumo da rede 1,5 s, resumo da escola 37 ms, drill-down 100–670 ms). Nenhum gargalo acadêmico comprovado nem medido.

## 7. Segurança e privacidade
- Security Advisor: 494 = 119 INFO (RLS sem policy, tabelas só de writer, por design) + 372 DEFINER para authenticated (com guarda interna) + 3 DEFINER anon (`verify_school_document`, `public_portal_list`, `public_portal_get`; portal público intencional). Baseline pré-NAE.8: 485; o delta são readers NAE intencionais.
- Nenhum DML do app em `meal_*`/BM; writers sem anon; regras de política sem escrita; bucket privado; nenhum dublê de resolver presente.

## 8. Integridade e resíduos
55 escolas, 698 turmas, 9.763 alunos, 8 políticas, 2 atuações, 0 pessoas sintéticas, 0 objetos no bucket, 0 dublês, 2026 `historico-importado`, 2027 inalterado.

## 9. Gates
Nenhum código ou migration foi alterado nesta frente; vale o conjunto verde do HEAD (L5): 3.792/3.792 testes, invariantes profundas 31/31, tsgo limpo, build OK, diff limpo. Reexecutados agora: BM_E2E 8/8, Security Advisor e consultas de integridade.

## Frente BO — fechamento técnico acadêmico

Resultado: PARTIAL — BO_SYNTHETIC_AUTH_SESSION_PROVISIONING_UNAVAILABLE. Nenhum item STILL_TECHNICAL passou a RESOLVED. Detalhes: `docs/frente-bo-fechamento-tecnico-academico.md`.

### BO — continuação
Sessões persistentes sintéticas por perfil + BF (self-grant, DML, política, revogação, conta sem pessoa) → RESOLVED (harness 69/69, 0 resíduos; defeito de self-grant corrigido em 0195). BD integrada, BK, escala e correções de a11y autenticada → STILL_TECHNICAL. Concorrência → UNPROVEN (fato imutável). Detalhe em `docs/frente-bo-fechamento-tecnico-academico.md`.
