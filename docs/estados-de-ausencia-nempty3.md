# NEMPTY.3 — Estados de ausência nas telas

## Situação atual
Classe: Registro de lote (2026-10-08). Nenhum dado inventado; nenhuma regra alterada.

## Vocabulário (componente `AbsenceState` em `src/components/sigem/states.tsx`)
- Zero observado: é valor, aparece como número (`FactValue`).
- Sem dado · Ainda não configurado · Sem permissão · Nenhum resultado · Nenhum registro: cada um com frase própria; nenhum diz "zero" nem "está tudo bem".

## Corrigido (zero usado como ausência)
- Calendário: período sem cálculo mostrava "0" dias letivos; agora "Não calculado".
- Mapa da rede: sem consulta de cobertura mostrava "0 de N escolas com Mapa oficializado" e barra de andamento zerada; agora "Cobertura oficial não consultada" e a barra não aparece.
- Preparação do ano: servidor encontrado sem lista de vínculos mostrava "vínculos: 0"; agora "não informados".

## Conferido sem mudança
- Contadores calculados de listas lidas (ex.: relatório da Alimentação sem linhas = 0 observado), sino de avisos (zero não é exibido), demais `?? 0` são cálculo interno ou versão esperada.
- Telas de Comunicação, Inclusão, Alimentação, Transporte e Acompanhamento já diferenciam "sem permissão/alcance" de lista vazia.

## Testes
`src/components/sigem/absence-states.test.tsx`.

## Pendências
- Migrar gradualmente os `EmptyState` existentes para `AbsenceState` quando a tela for tocada (sem regressão de texto hoje).
- INTERACTIVE_BROWSER_VALIDATION_PENDING.
