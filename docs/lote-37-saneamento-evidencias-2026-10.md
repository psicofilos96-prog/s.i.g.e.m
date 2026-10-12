# Lote 37 — saneamento das pendências reais dos Lotes 32–36 (2026-10-12)

## Situação atual
- Classe: **Registro de lote**. Base analisada: `5a95d945`. Contagens lidas do Lovable Cloud nesta rodada.
- Nenhuma importação, atribuição de capacidade, aprovação ou homologação foi feita. Nenhuma alteração de banco.

## 1. Link quebrado da documentação
- Causa real: o índice gerado estava desatualizado (`docs-index.mjs --check` → "Índice desatualizado"); não havia link quebrado em documento.
- Correção: `node scripts/docs-index.mjs` → "Índice escrito; 0 documento(s) com referência quebrada"; `--check` → "Índice e referências OK".

## 2. Correção do Lote 33 (infraestrutura) — o relatório anterior estava errado
O registro L33 dizia "nenhuma fonte oficial de infraestrutura do Censo 2026 no projeto". A leitura do banco mostra o contrário:

| Fonte (`source_ref`) | Escolas | Atributos | Observações | Hash distinto |
|---|---|---|---|---|
| INEP/Educacenso 2026 — Aspectos de Infraestrutura (municipais), emitido 31/08/2026 | 40 | 54 | 2.160 | 1 |
| INEP/Educacenso 2026 — Aspectos de Infraestrutura (conveniadas), emitido 31/08/2026 | 15 | 54 | 810 | 1 |

- 55 escolas × 54 atributos = 2.970 observações, 2.970 com valor (0 vazias).
- Mapa por escola e atributo: `docs/data/lote37-infraestrutura-por-escola.json` (origem, hash curto, valores).
- **Comparabilidade:** os recibos oficiais (55) trazem só contagens de turmas/alunos; não há segunda fonte de infraestrutura. Classificação: *dado oficial importado, sem fonte concorrente* — divergência não é aferível, e nenhuma equivalência com recibo foi presumida.
- **Jornadas:** 0 `class_journeys`, 0 `professional_schedule_declarations`. Nenhuma fonte de jornada nas tabelas de staging. Nada inferido; nenhuma grade docente criada.

## 3. Servidores — chaves oficiais persistidas
| Evidência | Valor |
|---|---|
| Pessoas com `institutional_identifier` | 1 de 10.822 (só a conta-órgão da Supervisão) |
| Vínculos com matrícula funcional | 0 de 551 |
| Declarações Educacenso de profissional (`professional_census_declarations`) | 2.403 (1.057 pessoas, 55 escolas), sem matrícula funcional |
| Linhas da SEMED com matrícula | 219 (218 distintas); 0 coincidem com qualquer identificador de pessoa |
| Candidatos já derivados | 815 "candidato-único" e 1.201 "sem-pessoa-censo" — **todos por nome normalizado** |

Conclusão: nenhuma chave oficial liga matrícula a pessoa. Nome (mesmo com escola) não é identidade; os 815 candidatos únicos ficam como candidatos, não vínculos. **Importados: 0.**

### Arquivo mínimo do DP necessário (especificação)
Uma linha por vínculo; CSV ou XLSX; entregue só por staging governado (`stage_import_batch`).
| Coluna | Obrigatória | Uso |
|---|---|---|
| `matricula_funcional` | sim | chave do vínculo |
| `cpf` | sim | só para gerar fingerprint no pipeline seguro; nunca gravado em claro, relatório ou log |
| `inep_escola` ou `codigo_setor` | sim | lotação |
| `cargo` | sim | fato do vínculo |
| `data_inicio_vinculo` | sim | vigência |
| `data_fim_vinculo` | não | vazio ≠ desligado |
| `situacao` | sim | ativo/afastado/cedido etc. (lista aberta) |
| `tipo_arquivo` | sim (cabeçalho) | "completo" ou "delta" — define se ausência significa algo |
Sem CPF (ou outro identificador oficial já presente nas declarações do Censo), a importação continua bloqueada.

## 4. Testes autenticados reexecutados nesta rodada
| Harness | Resultado | Resíduos |
|---|---|---|
| `lote12-authenticated-e2e.mjs` | 29/29 PASS (`bo-a0510bf75e1c`) | 0 |
| `lote20-development-e2e.mjs` | 19/19 PASS (`bo-841588163361`) | 0 |
| `lote16-concurrency-e2e.mjs` | 2 PASS, 0 FAIL, 2 BLOQUEADO | 0 |
| `bo-fixture-sweep.mjs` | 3 operações antigas limpas, 9 contas de teste removidas | `{"endings":0,"persons":0,"policies":0,"registry":0,"engagements":0}` |

Achado: havia 9 contas sintéticas de execuções anteriores ainda presentes; a varredura as removeu. Risco: os harnesses limpam dados de domínio mas não sempre a conta; rodar a varredura após cada execução.
Navegador logado: não executado (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`; não personifico contas institucionais).

## 5. Matriz executado × bloqueado (só esta rodada)
| Perfil | Executado (PASS) | Bloqueado (motivo) |
|---|---|---|
| Secretaria | escopo da própria escola; IDOR recusado; RLS de matrículas; autoconcessão recusada | inscrição/matrícula positiva: 0 campanhas, permissões sem titular |
| Gestão de Pessoas | servidor sem vínculo = 0 capacidades | lotação/atribuição: 0 lotações, fonte DP ausente |
| Docente | — | 0 regências, 0 grades |
| Mediador | — | 0 designações de mediação |
| NEI | — | 0 papéis NEI |
| Família | protocolo inexistente → resposta uniforme; upload sem pedido recusado | acompanhamento positivo: 0 inscrições, 0 vínculos responsáveis |
| Relatórios | anônimo não registra emissão | revalidação com dados importados: nada importado |
| Desenvolvimento | 19 recusas/regras | gravações: sem titulares |
| Concorrência | recusas paralelas não gravam | numeração (sem regra aprovada), reservas (sem quadro de vagas) |

## 6. Correções técnicas
Nenhuma migration. Correções só documentais (índice, matriz, roadmap, registro L33).

## 7. SHA e GitHub
Base `5a95d945`. Este lote entra no próximo registro automático; o número só existe depois desta resposta, e o CI dele não foi conferido.

## 8. Planilhas de pessoal enviadas após o L37 (análise só de contagens)
- `PLANILHA_MESTRA_SERVIDORES_SEMED_1.xlsx` (aba Consolidado): 2.000 linhas, 2.000 matrículas distintas; CPF válido em 884 (845 CPFs distintos; 39 CPFs com mais de uma matrícula = vínculos múltiplos); 1.116 sem CPF. É planilha consolidada (tem "Nome Corrigido", "Revisão Manual", aba "Fontes e Metodologia"), não arquivo emitido pelo DP. Contém coluna de CID (dado de saúde): nunca importável para o DP.
- `MATRÍCULA_-_SEMED_-_AGOSTO_-_2026-3.xlsx`: 2.037 linhas com matrícula, nome, admissão, cargo, nascimento — sem CPF.
- `QP-MEC_ATUALIZADO_-_2026-3.xlsx`, `Memorandos_2026.xlsx`, `26-_Quadro_de_Pessoal...xlsx`, `CONSOLIDADO_-_QUADRO_DE_PESSOAL.xlsx`: matrícula/QP-MEC/lotação, sem CPF.
- Impedimento que permanece: as 10.822 pessoas do banco não guardam CPF nem impressão dele (só `docserv_identity_links` e inscrições têm `cpf_hmac`). Mesmo com CPF na planilha, não há chave do lado do banco para casar. **Importados: 0.**
