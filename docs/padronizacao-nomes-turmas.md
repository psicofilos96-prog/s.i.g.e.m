# Nomes padronizados de turmas

Situação atual: Registro de lote (20/10/2026).

## Fonte e escopo
- Ordem explícita do proprietário e `Planilha_Padronizacao_Turmas.xlsx`, SHA-256 `f80a7b09129a2d0808edb34492f832b149170678057ae42ee8990037b870f2df`.
- 137 linhas preenchidas da aba mestre correspondem a 136 pares nome/código. A opção PRÉ-ESCOLA UNIFICADA - 80 preserva as duas descrições e linhas de origem.
- Catálogo aplicável desde o ciclo iniciado em 01/01/2027; 2026 permanece histórico. Não foram copiadas instâncias de turmas, escolas, alunos ou quantitativos das abas de referência.
- Registro por ordem do proprietário não é apresentado como homologação humana fictícia.

## Aplicação
- Leitor `class_name_catalog_for_year`, configurações imutáveis e vínculo na versão cadastral. Seleção disponível desde o primeiro passo de Nova turma; nome e código permanecem juntos.
- Migrations 0602–0604 aplicadas. Ausência/ambiguidade/seleção inválida falham fechadas; versões de identidades vinculadas seguem a configuração aplicável ao ano. Identidades históricas não vinculadas preservam seu contrato.
- Duplicidade normalizada por escola/ano e exclusão da própria identidade são revalidadas sob lock no trigger. Nenhuma permissão de criação foi ampliada.

## Evidência e limites
- Navegador autenticado: 2026 retornou zero opções; 2027 retornou 136; comparação exata de todos os pares com a planilha PASS. Seleção BERÇÁRIO I - 40 exibiu código 40; nenhuma turma oficial criada.
- Teste PostgreSQL descartável: `supabase/tests/class_name_catalog.sql`, usando 0602–0604, 136 opções sintéticas locais e tabela-probe com o trigger real. PASS: ano histórico, par exato, nome livre, código incompatível, duplicidade, versão subsequente e preservação de legado. Catálogo aplicável vazio recusado. Essa camada prova reader/trigger, não RLS ou autorização de criação.
- Criação ponta a ponta não exercitada: o catálogo curricular de etapas/anos não está homologado na data selecionada. O catálogo de nomes não substitui posição curricular e nenhuma etapa ou aprovação foi fabricada.
- 160 regressões direcionadas de Diário, Administração, catálogo/modelo de turma e rota de início passaram antes do reforço SQL. Verificação integrada registrada separadamente após conclusão.