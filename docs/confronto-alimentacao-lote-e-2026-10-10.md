# Lote E — Confronto dos documentos da Alimentação com o SIGEM (2026-10-10)

Situação atual: **Registro de lote**. Confronta os arquivos enviados pelo setor de Alimentação com o que o módulo `src/features/school-meals/` (NAE.0–NAE.8) já implementa. Não é fonte normativa; nenhum conteúdo dos documentos foi transformado em regra homologada.

## Separação de atribuições (cartilha 2026)
| Ator | O que a cartilha atribui | No SIGEM |
|---|---|---|
| Nutricionista / quadro técnico (Núcleo) | Elabora cardápios, fichas técnicas, cardápios especiais | `record_meal_master` (rascunho → conferida → homologada, pessoas distintas) e `record_meal_menu`; capabilities de rede |
| Direção escolar | Pedido mensal (janela declarada na cartilha: dias 15–20) | `record_meal_order` dentro de janela configurada por `record_meal_order_window`; a janela 15–20 **não** está gravada — depende de ato do Núcleo |
| Inspetor de alimentação (≥2 servidores, não merendeiro) | Monitora cardápio, recebimento, armazenamento, higiene | **Ausente**: não há designação de inspetor nem a vedação "merendeiro não é inspetor". Precisa de capability própria e regra homologada |
| Cozinha | Execução diária, refeições servidas, desvios | Estação Cozinha (`meal_kitchen_day_at`, `record_meal_execution`) |
| CAE | Controle social | **Ausente**: não existe perfil nem leitura própria do CAE |

## Documentos × cobertura
| Documento | Cobertura | Observação |
|---|---|---|
| CARTILHA_DA_ALIMENTAÇÃO_ESCOLAR_2026 / 03_CARTILHA (2 cópias) | Parcial | Fluxo pedido→recebimento→estoque→execução coberto; inspetor e CAE ausentes |
| Cardápio desjejum/lanche e almoço/jantar CRECHE | Estrutura pronta, sem dado | Cardápios em Word com células mescladas exigem revisão técnica; nenhum item foi importado (`stage_meal_content` gera só rascunho) |
| ANEXO 3 — Cronograma dos cardápios | Parcial | Dia de oferta só por calendário resolvido; cronograma não foi gravado como versão |
| ANEXO 1 — Termo de compromisso do inspetor | Ausente | Depende da designação de inspetor |
| ANEXO 4 — Circular ao profissional de saúde; ANEXO 5 — Caderno NAE; ANEXO 6 — Cartaz ANAE | Parcial | Restrição alimentar sigilosa (`record_dietary_restriction`, capability `consultar-restricao-alimentar`); sem diagnóstico/laudo no módulo |
| ANEXO 8 — Formulário de não conformidade | Coberto | `record_meal_nonconformity` + evidências (fotos/NF) no armazenamento privado |
| ANEXO 9 — Especificações de gêneros | Estrutura pronta, sem dado | Catálogo de itens/unidades homologável; lista não importada (preços/marcas ligados ao contrato) |
| ANEXOS 10–13 — Etiquetas (manipulados, estocáveis, refil, amostras) e 4 cópias do Anexo 11 | Parcial | Lote/validade e sugestão PVPS existem; impressão de etiquetas e registro de coleta de amostras ausentes; cópias tratadas como duplicatas |

## Sigilo verificado no banco (2026-10-10)
Tabelas `dietary_restrictions`, `inclusion_clinical_records`, `inclusion_records`, `inclusion_mediation_assignments` e `guardian_authorizations`: RLS ativa, **sem SELECT direto** para `authenticated` e `anon`; leitura só pelos readers autorizados (restrição, clínico com finalidade e trilha, mediação vigente, família por vínculo).

## Pendências que dependem de decisão humana
- Designação de inspetor (capability, regra "não merendeiro", termo).
- Perfil CAE de leitura.
- Gravar a janela de pedido 15–20 e o cronograma 2026 como versões homologadas.
- Importar cardápios, fichas técnicas e especificações após revisão técnica do Núcleo.
- Nenhuma atuação de nutricionista, cozinha, mediador, NEI ou família existe hoje no banco; nenhum fluxo foi testado com conta real.
