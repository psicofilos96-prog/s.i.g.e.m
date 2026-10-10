# Ordem de fechamento — 2026-10-10

Situação atual: Registro de lote.

## Feito nesta etapa
- GitHub: HEAD do projeto = GitHub `main` = `df2b05e9` (confirmado via API pública do GitHub). Não há divergência; `cec0de18`→`a5980748` já estão incorporados na sequência linear.
- Revisão INEP: 6 escolas / 28 mapas identificados nominalmente em planilha fora do repositório (`/mnt/documents/base-2026/revisao-inep-mapas-2026.xlsx`). Nenhum mapa reatribuído.
  - 33097461 E M José Ferreira Salles — INEP ausente (8)
  - 33205299 E M 10 de Maio — INEP ausente (3)
  - 33185050 Assoc. Educacional Criarte — declarou 33005050, inexistente (7)
  - 33100047 Creche Leão Adherbal Carneiro Terra — declarou 33001987 (8)
  - 33189781 Assoc. Benef. Cantinho dos Pimpolhos — declarou 33001987 (1)
  - 33211604 Assoc. Benef. Tida Faria — declarou 33001987 (1)
  - 33001987 pertence à E M Nossa Sra das Graças.
- Atuações: 2.016 registros de pessoal, 0 correspondências determinísticas (1.797 sem matrícula funcional; 219 sem escola; cadastro sem matrícula funcional). Pendências em planilha restrita fora do repositório.

## Matriz requisito → fonte → código → teste (estado)
| Requisito | Fonte no projeto | Código | Teste | Estado |
|---|---|---|---|---|
| Resultado por etapa | docs de avaliação | `diary/stage-engine.ts` | sim | lógica; tela pendente |
| Boletim/amostras/impressão | Diário legado | `diary/bulletin.ts` | sim | lógica; tela pendente |
| SIA A–H + correção | — | `teacher-assessment/variant-key.ts` | sim | lógica; tela pendente |
| Mapa mensal + declarados | mapas enviados | `statistical-map/*` | sim | tela pronta |
| Inspetores/amostras/CAE | docs Alimentação | módulos R3 | sim | lógica; tela/persistência pendentes |
| SAEB/devolutivas | — | módulos R3 | sim | lógica; tela/persistência pendentes |
| Dossiê anual/QR | Document Studio | `document-studio/*` | sim | verificação pronta; dossiê pendente |
| SIPE anexos privados | — | — | — | pendente |

## Limite declarado
E2E com conta institucional real depende de contas reais; testes A/B sintéticos não equivalem a sessão real.
