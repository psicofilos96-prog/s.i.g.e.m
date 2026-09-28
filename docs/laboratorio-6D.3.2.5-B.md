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

---

## 6D.3.2.7 — Ensaios finais B, C e G (observacional; nada corrigido)

Mecanismos de laboratório (não pertencem ao produto): seletor "Ensaio" (escala conceitual demonstrativa de 4 conceitos; configuração descritiva) e "Simular alteração por outra sessão". Cada ensaio tem repositório próprio na aba.

### B — Conceitual (1280 / 382 / zoom 200%)
- Teclado integral: Enter abre, Enter confirma e avança; letra abre e destaca o conceito (busca incremental). 27 elegíveis sem registro em 2 teclas cada.
- Registros oficiais (nº 2, 10, 16, 23, 31) e não aplicáveis (7, 18, 30) nunca receberam foco.
- Oficial ("Registrado: …" + botão Corrigir) e rascunho ("lançamento local preparado … (ainda não registrado)") distinguíveis por texto.
- Conferir → Registrar: 5 → 32 registrados, 0 sem registro. Sem bloqueadores.

### C — Descritivo
- Enter quebra linha (preservada), Ctrl+Enter valida e avança, Alt+↓ move para o próximo estudante. Contrato cumprido.
- Custo visual: página com 5.183 px (1280), 6.407 px (200%) e 8.789 px (382); linha de ~128–200 px.
- Achados: (C1) o texto do rascunho aparece duas vezes — na legenda da linha e no campo; (C2) o resumo "última alteração" mostra o texto inteiro, formando um bloco enorme no topo; (C3) no último estudante, Ctrl+Enter não avança nem avisa que a lista acabou.
- Evidência: a grade compacta funciona, mas o descritivo pede apresentação especializada (legenda resumida, resumo truncado), mantendo o mesmo contrato.

### G — Conflito
- Após "Conferir", simulada alteração em Caio Rocha (nº 3, que estava no lote).
- A conferência se refez com os fatos atuais: nomeia "Caio Rocha: O resultado deste estudante mudou desde que a pauta foi aberta (vigente: versão 1)" e desativa "Registrar lançamentos". Nenhum registro parcial.
- "Voltar à pauta" preserva os 27 rascunhos; Caio mostra o novo oficial e o rascunho dele lado a lado.
- Achados: (G1) o conflito é detectado antes do clique, não no momento do registro — o caminho de falha do commit continua coberto só por teste; (G2) o botão chama-se "Voltar à pauta", e não "Voltar à pauta e revisar"; a frase "Nenhum lançamento foi registrado" não aparece porque nada foi tentado.

Bloqueadores: nenhum. Ajustes candidatos: C1, C2, C3; G1/G2 são decisão de produto.
