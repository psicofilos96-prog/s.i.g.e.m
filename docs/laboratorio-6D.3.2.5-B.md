# 6D.3.2.5 Parte B — Laboratório de Campo A–I (relatório observacional)

Ambiente: rota `/diario/turmas/tur-001/avaliacao/pauta/ins-demo-001`, fixture demonstrativa de 35 estudantes
(`assessment-entry-field-fixture.ts`): nomes curtos e longos, 2 homônimos ("Ana Clara Souza", nº 1 e 4),
5 resultados oficiais preexistentes, 3 `not-applicable` (nº 7, 18, 30). Viewports: 1280 px, 382 px, 640 px (≈ 200% de 1280).
Nenhuma correção foi aplicada durante a observação.

## Cenários
- A Numérico: 32 elegíveis preenchidos só por teclado, 4 teclas/estudante (≈128 no total), foco nunca perdido, `not-applicable` saltado nos três viewports.
- B Conceitual / C Descritivo: não executáveis em campo — a turma demonstrativa só possui configuração numérica. Cobertos apenas pelos testes de componente (36 estudantes).
- D Pauta parcial: vazio nunca virou zero; "sem registro" não bloqueia a conferência; `not-applicable` fora da contagem de trabalho.
- E Interrupção: ao voltar, balanço mostra "N alterações locais" e a última célula alterada ("Ícaro Melo · 81"); não há retorno direto ao ponto de parada.
- F Conferir → Voltar → Conferir → Registrar: voltar preserva o rascunho; só o registro criou versões; grade relida do domínio (5 → 7 registrados).
- G Conflito: não reproduzível no navegador (sem segunda sessão no laboratório); coberto pelo teste automatizado.
- H Correção posterior: painel funciona (v1, "Corrigir resultado", histórico), mas é acessado por um seletor no fim da página, não a partir da linha.
- I Nome e identidade: homônimos aparecem idênticos na pauta e na busca, sem discriminador. No 382 px, 3 nomes longos são cortados com reticências.

## Medições transversais
- Tempo/ações (35): ≈128 teclas, sem mouse; linha tem 109 px (157 px após alteração), alvo era 52–60 px.
- Continuidade de foco: íntegra em todos os viewports.
- Retomada: parcial (sabe-se quanto mudou, não onde se estava).
- Distinção oficial/rascunho/sem registro/não aplicável: não aplicável é inequívoco; oficial e rascunho usam o mesmo campo editável, distinguidos só pela legenda pequena.

## Classificação
Bloqueadores de homologação
1. Digitação sequencial sobrescreve resultados oficiais: o avanço automático entra nas linhas já registradas e transforma digitação em retificação (5 correções não intencionais no cenário A).
2. Resumo da conferência contraditório: "0 alterações de registros existentes" na frase e "Alterações em registros existentes — 5" na seção.
3. Homônimos sem discriminador na pauta e na busca (viola "identificar inequivocamente antes de lançar").
4. Nomes longos cortados em 382 px.

Ajustes necessários
5. Oficial e rascunho com a mesma aparência de campo.
6. Aviso "Alterações locais ainda não registradas" visível mesmo sem alteração.
7. Altura de linha 109–157 px ("Não registrado" e "Descartar alteração" empilhados).
8. Correção focal desconectada da linha.
9. Retomada sem "voltar para onde parei".

Polimento futuro
10. Configurações conceitual/descritiva na turma demonstrativa para executar B e C em campo.
11. Segunda sessão simulada para exercitar G no navegador.

## 6D.3.2.6 — Correções de homologação (re-auditoria curta)

1. Digitar a turma inteira (40× "50"+Enter) não alterou os 5 oficiais: conferência "27 novos registros · 0 alterações de registros existentes".
2. Linha oficial mostra "Registrado: X" como texto, sem campo; alterar exige "Corrigir", que abre a correção focal na própria linha.
3. Cabeçalho e detalhamento da conferência usam a mesma contagem (`existingRecordChangeIds`).
4. Homônimos exibem "Código SIGEM …" apenas nas duas linhas; demais linhas limpas.
5. Nomes longos quebram linha em 382 px, sem reticências.
6. Aviso de alterações não registradas só aparece com alteração local.
7. Altura: 50–66 px no desktop; 57–113 px no 382 px (a maior é nome longo em 3 linhas). "Não registrado" e "Descartar" foram para "Mais ações".
8. "Continuar de onde parei" aparece quando o foco sai da pauta.
9. Estados descritos por texto: "Registrado:", "lançamento local preparado … (ainda não registrado)", "Sem registro oficial.", "Não se aplica ·".

Pendente para congelar a 6D.3.2: ensaios B (conceitual), C (descritivo) e G (conflito) em superfície real.
