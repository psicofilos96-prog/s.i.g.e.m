# Aceite integrado — Acompanhamento e Avaliação (LOTE 18)

Situação atual: Registro de lote. Execução de 2026-10-11 (UTC). Não declara prontidão para produção.

## Como reproduzir
`SIGEM_TEST_HARNESS=1 SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup bun scripts/aa-acceptance-e2e.ts`

Camada provada: **autenticada equivalente** (JWT real de 5 contas sintéticas BO contra RLS e funções do banco). Navegador NÃO foi usado.
Contas: registro (rede), homologação (rede), escola A, escola B, sem permissão; mais cliente anônimo. Tudo removido no fim (resíduo verificado = 0).

## Resultado: 57 PASS, 0 FAIL

| Fluxo | Provado |
|---|---|
| Avaliações externas | acerto bruto recusado; escala de outro programa recusada; IDEB ≠ N×P recusado; participantes > previstos recusado; autor não homologa; outra pessoa homologa; sem permissão/anônimo recusados; edição direta bloqueada |
| Comparabilidade | série 2023→2025 só com mesma matriz; edição de matriz diferente excluída com motivo |
| PDF/XLSX | PDF institucional (13 KB) e XLSX gerados pelo motor comum a partir de linhas lidas com a sessão |
| Regras de cálculo | sem regra ⇒ pendente; fórmula fora da lista recusada; autor não homologa; homologada ⇒ indicador pronto; PDF do catálogo |
| Infrequência | escola A lê só a própria; B não lê A; escola não lê a rede; rede lê todas; sem permissão/anônimo recusados; sem chamada = lista vazia (não zero) |
| Busca ativa | 75% exatos não abrem caso; 74,9% abre; B não abre caso de A; contato exige responsável e meio; resolução exige retorno; base antiga recusada; caso encerrado fechado; B não vê caso de A |
| Educação Infantil | retenção/promoção e dado clínico recusados; B não registra nem lê A; retificação exige motivo e preserva v1; família sem vínculo não vê nada; encaminhamento SIPE exige referência |

## Verificações gerais
- Typecheck: limpo. Build de produção (`vite build`): OK.
- Suíte completa: 616 arquivos, 5.500 testes aprovados, 7 ignorados, 0 falhas.

## Falhas e lacunas ainda abertas (não provadas)
- **Navegador autenticado**: nenhuma tela do setor foi aberta com sessão; só a camada de dados.
- **Importação → reconciliação → lançamento**: não exercitado ponta a ponta (lotes Simula aguardam revisão humana e gabaritos).
- **SIA → OP → intervenção → reavaliação** e **SIPE/Diário**: não exercitados com dados reais; Diário sem chamadas concluídas no banco, então percentuais reais e transferências reais não foram observados (cobertos só por testes de regra).
- **Saber Ler e avaliações locais (0371/0372)**: fora deste roteiro; a limpeza BO ainda não cobre essas tabelas.
- **Permissões reais**: nenhuma conta institucional recebeu as capacidades do setor; o teste usou concessões temporárias de 2 horas.
- **CI do GitHub e commit**: não executados daqui; a sincronização do projeto leva as mudanças.

Migrations deste lote: 0377 (concessões BO do setor e limpeza), 0378 (limpeza por marcador da operação).
