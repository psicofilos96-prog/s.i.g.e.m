# ALIM-00 — Inventário, proveniência e matriz do Núcleo de Alimentação

Situação atual: Registro de lote (2026-10-10).

## Cobertura verificável
- 128 arquivos de alimentação acessíveis no projeto (39 cartilha/anexos, 30 cardápios, 25 planilhas por unidade, 5 modelos, 21 relatórios de apoio/propostas, 6 entrevista/áudio, 2 formulários); 30 grupos de arquivos idênticos por hash.
- Inventário com SHA-256, classificação e status: `/mnt/documents/alimentacao/alim00-inventario.xlsx` (fora do repositório).
- Os 128 arquivos são os MODELOS representativos enviados intencionalmente (um por tipo); o acervo histórico (502/177) são exemplares preenchidos repetidos e NÃO é requisito de construção. NF/contrato/empenho/ata reais só são necessários para transações oficiais específicas; o fluxo é construído e testado com dados sintéticos.

## Classes
- REGRA DOCUMENTADA: cartilha 2026 (≥2 inspetores, merendeiro não elegível; não conformidade em 24 h/1 dia útil; NF não assinada com inconformidade).
- OBSERVAÇÃO DE ARQUIVO: fórmulas das planilhas (disponível = saldo anterior + recebido; saldo = disponível − saídas).
- PROPOSTA: documento SIGAE (hard freeze 23:59 dia 20, hard-stop de teto).
- A CONFIRMAR: prazo do pedido (15–20 × até 15/20 × 23:59 dia 20); per capita por segmento; restrições por faixa etária.

## Matriz requisito → código existente → teste
| Requisito | Já existe (migration / módulo) | Teste |
|---|---|---|
| Capacidades e escopo escola/rede | 0181 NAE.0, `nae-foundation.ts` | nae-foundation.test |
| Catálogo técnico versionado (gêneros, especificação) | 0182 NAE.1 `meal_master_records` | planning-model.test |
| Pedido com janela configurável e fuso | 0183 NAE.2 `record_meal_order_window` | order-model.test |
| Teto explicado, conversão exata, essencial zerado | **novo** `ceiling-explain.ts` | ceiling-explain.test (6) |
| Programação, recebimento, NF (hash), não conformidade | 0184 NAE.3 | receiving-model.test |
| Estoque ledger, PVPS, contagem, fechamento | 0185 NAE.4 | stock-model.test |
| Execução diária, refeições ≠ alunos, adesão só homologada | 0186 NAE.5 | execution-model.test |
| Central do Núcleo e relatórios | 0187, 0192/0193 | nucleo-model.test, reporting-model.test |
| Evidências em bucket privado | 0190 NAE.8 L2 | evidence-model.test |
| Estação Cozinha | 0191 | operations-l3-model.test |
| Inspetores, amostras/etiquetas, CAE | `inspection-custody.ts` (só regra, sem tela/tabela) | r3-recovery.test |

## Pendente por lote
- ALIM-01: tela e tabela de inspetores designados; fornecedores/contratos/atas/empenhos (sem arquivo-fonte acessível).
- ALIM-02: transcrição dos cardápios .docx para staging com revisão da nutricionista.
- ALIM-03: ligar `ceiling-explain.ts` à tela de pedido.
- ALIM-04/05: casos reais fev→mar exigem notas fiscais, não enviadas.
- ALIM-06: ingestão das 25 planilhas por unidade em staging.
