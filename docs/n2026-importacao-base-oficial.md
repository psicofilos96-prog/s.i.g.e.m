# N2026.IMPORT.0 — Base oficial/histórica 2026: inventário, proveniência e plano de carga

## Situação atual (2026-10-09)
- Classe: **Referência vigente** (plano). Nada foi importado neste lote; o banco não foi alterado.
- Contém só agregados, nomes de arquivo, hashes e códigos INEP de escola (públicos). Nenhum nome, CPF, data de nascimento ou identificador individual.
- Em conflito, prevalecem os `AGENTS.md` (`src/features/data-import/`, `src/features/ciece/`, `supabase/`) e `docs/baseline-2026-vs-operacao-2027.md`.

## 1. Constatação principal
Parte da base 2026 **já foi carregada** em 2026-10-05 pela camada técnica (`technical_execution_operations`, executor técnico, sem autoria humana). Os arquivos anexados agora são, byte a byte, as **mesmas fontes** daquela carga, mais fontes novas que nunca entraram: recibos de fechamento (11/09/2026), painéis, consolidados e privadas. A campanha N2026 portanto **reconcilia e completa**; não recarrega. Nenhum arquivo foi reaproveitado por nome: a identidade é o SHA-256.

## 2. Inventário das fontes (16 pedidas + complementares)
Todas as cópias `-2`, `-3`, `-4` têm SHA-256 idêntico ao original: são **duplicatas exatas**, não versões. Nenhum FILE_PENDING.

| # | Arquivo (cópias idênticas) | SHA-256 (12) | Natureza | Data de referência | Granularidade | Chaves | Cobertura |
|---|---|---|---|---|---|---|---|
| 1 | Aspectos_Infraestrutura_conveniadas (+-2,-3) | db804fad43d6 | Fonte primária (relatório INEP de infraestrutura) | 2026-08-31 | escola × atributo | INEP | 15 escolas, 68 col. |
| 2 | Aspectos_Infraestrutura_municipais (+-2,-3) | 5b82d0194573 | Fonte primária | 2026-08-31 | escola × atributo | INEP | 40 escolas |
| 3 | Todas_as_jornadas (+-2,-3,-4) | e7f33aa1cdf1 | Fonte primária nominal (concatenação de exportações por escola, cabeçalhos repetidos, coluna `Arquivo_Origem`) | 31/07 e 31/08/2026 | pessoa × vínculo/jornada | ID INEP pessoa, código turma, INEP escola | 10.609 linhas brutas |
| 4 | Todas_as_turmas (+-2,-3,-4) ≡ Consolidado_-_Dados_das_Turmas (+-2) | 43b79beb6a33 | Fonte primária nominal | emissão 31/07/2026 | turma | código turma, INEP escola | 698 turmas, 55 escolas |
| 5 | Todos_os_alunos (+-2,-3,-4) ≡ Consolidado_-_Dados_dos_Alunos (+-2) | 11cdd65a8c6e | Fonte primária nominal | emissão 31/07/2026 | aluno × matrícula/turma | ID INEP, CPF, código matrícula, código turma | 10.295 vínculos, 9.763 pessoas |
| 6 | Todos_os_prof (+-2,-3,-4) | 0e7ff5940f3e | Fonte primária nominal | 31/07/2026 | profissional × turma/função | ID INEP, CPF, código turma | 2.403 linhas, 1.057 pessoas |
| 7 | Painel_das_Conveniadas_compressed (+-2) | 15eddc9ecc41 | Painel agregado (captura de tela Educacenso) | 2026 (1ª etapa) | escola | INEP | 15 escolas, 195 p. |
| 8 | Painel_das_Rurais_compressed (+-2) | a3df2247be92 | Painel agregado | 2026 | escola | INEP | 13 escolas, 169 p. |
| 9 | Painel_das_Urbanas_compressed (+-2) | f1547a4fb983 | Painel agregado | 2026 | escola | INEP | **24 de 27** escolas, 351 p. |
| 10 | Painel_1_-_Município | af1606640014 | Painel agregado municipal (todas as redes) | 2026 × 2025 | município | — | 2 p. |
| 11 | Relatórios_-_Urbanas (+-2) | 1bdabb8c28fa | **Recibo oficial** de fechamento | encerramento 11/09/2026 | escola | INEP | 27 escolas, 85 p. |
| 12 | Relatórios_de_Fechamento_-_Rurais (+-2) | 051eb47ee547 | **Recibo oficial** | 11/09/2026 | escola | INEP | 13 escolas, 39 p. |
| 13 | Relatórios_de_Fechamento_-_Conveniadas (+-2) | eb7477c16a2b | **Recibo oficial** | 11/09/2026 | escola | INEP | 15 escolas, 49 p. |
| 14 | Consolidado_Escolas_Municipais_Conveniadas_Itaperuna (+-2) | 1d212c63655d | Consolidado derivado (junta 1–6, 11–13) | mista | escola/turma/aluno/prof./jornada | INEP + códigos | 55 escolas (+2 linhas sem dependência) |
| 15 | Consolidado_Escolas_Privadas_Itaperuna (+-2) | 12b4f27dd980 | Consolidado derivado, **rede privada** | mista | idem | INEP + códigos | 21–25 escolas privadas |
| 16 | Matriz_Escolas_Itaperuna_Censo2026 (+-2) | fd2e288bf598 | Consolidado derivado por escola (identificação, contato, gestão, recibo, infra) | 2026 | escola | INEP | 55 escolas + aba Gestores (contém CPF) |

Complementares encontrados no acervo (mesmos domínios):
| Arquivo | SHA-256 (12) | Classificação |
|---|---|---|
| Matriz_Escolas_Itaperuna_Censo2026_PREENCHIDA.xlsx | e90925860f0d | **Versão diferente** da #16: recorte Educação Infantil com colunas “(preencher)” de preenchimento manual → referência, não fonte |
| Aspectos_Infraestrutura_privadas.xlsx | d69df648c4a4 | Fonte primária da rede privada (45 linhas) |
| TODAS_AS_TABELAS_URBANAS/RURAIS/CONVENIADAS (+-2) | 2afa471d67b5 / 436f6e7d9125 / fb2f3e602493 | Tabelas da Prefeitura (Mapa Estatístico) — domínio Mapa, fora deste plano |
| TODOS_OS_MAPAS_ESTATÍSTICOS (+-2) | 7b8b8b52de7e | Mapas mensais consolidados — domínio Mapa, fora deste plano |
| Situacao_Escolas_Matriculas_municipais/conveniadas (cargas anteriores) | b7aa8abcbd71 / 53bf5e4edda1 | Já usadas na reconciliação Frente G; não reanexadas agora |

## 3. Precedência das fontes
1. **Recibos de fechamento 11/09/2026** (#11–13): oficial para totais declarados ao Censo (turmas confirmadas, alunos, docentes, matrículas). Nunca criam pessoa/turma.
2. **Planilhas nominais** (#3–6): fonte de fatos individualizados, só com chave forte (ID INEP, CPF válido, código de matrícula/turma, INEP da escola).
3. **Fontes primárias de escola** (#1, #2, Aspectos privadas): atributos de infraestrutura.
4. **Consolidados** (#14–16, PREENCHIDA): apoio e reconciliação; nunca origem de linha quando a primária existe (são derivados dela).
5. **Painéis** (#7–10): verificação cruzada agregada; nunca criam fato individual.
Data mais recente prevalece **só para totais declarados** (recibo 11/09 > emissão 31/07); divergência vira exceção, não overwrite.

## 4. Mapa fonte → domínio → destino → writer
| Fonte | Domínio | Destino canônico | Writer/operação técnica | Situação |
|---|---|---|---|---|
| #16 (Matriz) | Escola / INEP | `institutional_schools`, `institutional_school_identifiers`, `institutional_school_record_versions` | `technical_import_educacenso_2026_schools` → `register_school_record_version` | **Carregada** (55) |
| #1, #2 | Infraestrutura | `school_infrastructure_observations` | `technical_import_educacenso_2026_infrastructure` | **Carregada** (2.970 = 55 × 54) |
| #4 | Turmas | `institutional_classes`, `institutional_class_identifiers`, `class_census_declarations`, `class_source_observations` | `technical_import_educacenso_2026_classes` (+ `technical_correct_educacenso_2026_temporal`) | **Carregada** (698) |
| #5 | Alunos / matrícula observada | `institutional_persons`, `institutional_person_identifiers`, `institutional_students`, `institutional_student_persons`, `school_enrollments`, `student_class_bond_observations` | `technical_import_educacenso_2026_students_enrollments` | **Carregada** (9.763 / 9.811 / 10.295) |
| #6 | Profissionais | pessoas + `professional_census_declarations`, `professional_functional_links` | `technical_import_educacenso_2026_professionals` | **Parcial** (2.403 decl., 551 vínculos) |
| #3 | Jornada | `class_journey_*`, `class_schedule_*`, `student_school_day_observations` | `technical_import_educacenso_2026_professional_schedules` (existe, nunca executada sobre e7f33aa1) | **Não carregada** |
| #11–13 | Totais declarados | `census_source_imports` / `census_cycles` (`census_stage_source`, parser registrado) | precisa de parser registrado para o leiaute do recibo | **Não carregada** |
| #7–10 | Verificação | nenhum (projeção `census-reconciliation`, não persistida) | — | Só reconciliação |
| #14, #15, #16, PREENCHIDA | Apoio | nenhum | — | Só reconciliação |
| #16 aba Gestores | Direção | **nenhum** sem decisão (BQ.1: não inventar pessoa/autoridade) | — | Pendência de decisão |

Idempotência (camada 0100, já vigente): chave = `operation_kind` + `source_hash` + `payload_fingerprint`; repetição devolve a mesma operação. Proveniência gravada: arquivo, SHA-256, aba, linha/bloco (`Arquivo_Origem`), `known_at` da fonte, operação técnica e executor técnico (não pessoa). CPF só como HMAC (`technical_cpf_hmac`).

## 5. Contagens esperadas × banco
| Fato | Fonte (recibo / nominal) | Banco hoje | Situação |
|---|---|---|---|
| Escolas municipais+conveniadas | 55 (27 urb. + 13 rur. + 15 conv.) | 55 | Bate |
| Turmas | 698 confirmadas / 698 códigos | 698 identificadores | Bate |
| Alunos (pessoas) | recibo 9.811 “Total de Alunos” / 9.763 IDs distintos | 9.763 alunos | Diferença de 48 — exceção a reconciliar (recibo conta por escola) |
| Matrículas | recibo 10.295 / 10.295 códigos | 9.811 matrículas escolares + 10.295 vínculos de turma | Bate por definição (aluno-escola × aluno-turma) |
| Docentes | recibo 708 / 1.057 pessoas nominais | 551 vínculos | Parcial: 1.078 linhas sem regime declarado |
| Jornadas | 10.609 linhas brutas (9.204 no consolidado) | 0 operações sobre e7f33aa1; 9.692 observações de dia escolar de aluno | Verificar origem das 9.692 antes do lote 5 |
| Privadas | recibo 312 turmas, 5.008 alunos, 5.015 matr., 433 docentes (21 escolas) | 0 | Fora da rede — decisão |
| Município (Painel 1) | 94 escolas (2025: 91); ~15,4 mil matrículas, todas as redes | — | Só verificação |

## 6. Conflitos e ambiguidades
1. **48 alunos** a mais no recibo que IDs distintos nominais → mesmo aluno em duas escolas; exceção por escola, nunca merge.
2. **Docentes**: recibo 708 vs 1.057 pessoas (inclui auxiliares/apoio) vs 551 vínculos → função ≠ cargo; sem inferir regime.
3. **Painel Urbanas** sem 3 escolas (INEP 33002045, 33002460, 33185689) → lacuna de evidência, não ausência de escola.
4. **Datas**: emissão 31/07, referência 31/08, encerramento 11/09 — todas `known_at`, nenhuma vira início de vigência.
5. **Consolidado municipal**: 57 linhas no resumo, 2 sem dependência/localização → linhas de totalização, descartar como não-escola.
6. **Privadas**: decidir se entram como escolas de referência do município (sem operação SIGEM) ou ficam fora.
7. **Gestores** (#16) com CPF: sem decisão institucional não criam atuação de Direção.
8. **PREENCHIDA** tem campos preenchidos à mão sem autoria → não é fonte.
9. **Painéis** trazem identificação do operador do Censo no cabeçalho → não registrar em logs nem docs.
10. Lacunas herdadas: sem início efetivo de matrícula/participação/alocação; limites do ano 2026 neutralizados.

## 7. Plano dos lotes
| Lote | Escopo | Gate de saída |
|---|---|---|
| N2026.IMPORT.1 | Escolas + infraestrutura: retry idempotente (deve dar 0 linhas novas); decisão sobre privadas e linhas de totalização | 55 = 55; 2.970 = 2.970 |
| N2026.IMPORT.2 | Turmas: reconciliação 698 vs recibo por escola | 0 divergências não explicadas |
| N2026.IMPORT.3 | Alunos/matrículas: reconciliação por escola vs recibo; 48 exceções registradas | exceções listadas, 0 overwrite |
| N2026.IMPORT.4 | Profissionais: 1.078 linhas pendentes de regime; docentes vs recibo | sem inferir regime nem cargo |
| N2026.IMPORT.5 | Jornadas (e7f33aa1): identificar a origem das 9.692 observações; executar a operação técnica de jornada | idempotente, regência não criada |
| N2026.IMPORT.6 | Recibos 11/09: parser registrado no banco + `census_stage_source`; reconciliação final com painéis; gate | relatório só agregado |

## 8. Baseline do banco antes da carga (2026-10-09)
Escolas 55 · identificadores de escola 55 (INEP) · versões cadastrais 55 · pessoas 10.822 · identificadores de pessoa 21.599 · alunos 9.763 · matrículas escolares 9.811 · vínculos aluno-turma observados 10.295 (698 turmas) · observações de dia escolar 9.692 · identificadores de turma 698 · declarações de turma 9.169 · observações de fonte de turma 698 · declarações de profissional 2.403 · vínculos funcionais 551 · lotações 0 · atuações 2 · enturmações 0 · lotes de importação 0 · importações censitárias 0 · ciclos de censo 0 · anos letivos 2 (2026 = `historico-importado`) · operações técnicas 7 (todas `concluida`, 2026-10-05).
