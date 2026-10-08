# Runbook — entrada da primeira escola real (piloto)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Atualização: rotina de checagem vigente é `npm run verify` (`rotina-de-verificacao.md`).


Uso: seguir na ordem. Cada etapa tem **verificação** objetiva. Nenhuma etapa importa dados automaticamente.
Página de apoio: `/prontidao-piloto` (go/no-go técnico) e `/configuracao-inicial` (pendências por turma).

## Papéis (sem nomes)
| Papel | Responsabilidade |
|---|---|
| Proprietário do SIGEM | Decide go/no-go e homologa políticas/normas |
| Administrador Geral (admin@) | Contas, atuações, política de permissões |
| Supervisão (supervisao@) | Calendário da rede |
| Gestão pedagógica da rede | Matrizes e correspondências |
| Secretaria da escola piloto | Turmas, matrículas, alocações |
| Responsável técnico | Backup, monitoramento, contingência |

## 1. Pré-requisitos
- Política de capacidades homologada vigente (`/central-de-acessos`). Verificação: item "Política" concluído.
- Contas criadas pela administração; senha provisória entregue fora do sistema.
- Suíte verde: `bun run test` e `bun run test:invariants`.

## 2. Backup / ponto de restauração
- Responsável técnico registra data/hora do ponto de restauração do banco antes de qualquer cadastro real.
- **Limite honesto:** o restore nunca foi testado neste projeto. Item "Ponto de restauração" fica pendente até confirmação manual; sem ele, NO-GO.

## 3. Unidade
- Cadastrar/conferir em `/unidades` (writer `register_school_record_version`). Verificação: unidade aparece em `/configuracao-inicial`.

## 4. Usuários e atuações mínimas
- Secretaria escolar, Direção/OP (se no piloto) e docentes com atuação de escopo escolar (atuações pela administração/Central de Acessos; `/profissionais` é laboratório sem login desde NDEMO.2). Cargo não concede permissão.

## 5. Importação / reconciliação (opcional)
- Só por `/importacoes`: prévia → divergências → confirmação humana. Linhas rejeitadas mantêm motivo. Sem lote ⇒ item "não aplicável".

## 6. Turmas e matrículas
- `/turmas`, `/matriculas`, `/enturmacoes`. Turma sem aluno é válida. Conferir em `/configuracao-inicial`.

## 7. Matriz, jornada, grade, regência, calendário
- Por turma, todos os itens obrigatórios em `/configuracao-inicial` devem estar "✓". Exatamente um calendário aplicável.

## 8. Smoke test do Diário (conta docente real)
1. Docente vê só suas turmas. 2. Abre a chamada, marca e conclui. 3. Recarrega: marcação persiste. 4. Outra conta docente não vê a turma.

## 9. Documentos
- Emitir uma declaração de teste para estudante real somente se o modelo existir; conferir código de verificação público sem dados sensíveis. Cancelar se foi apenas teste (cancelamento é append-only).

## 10. Mapa/CIECE
- `/mapa-estatistico-rede` no mês: ausências aparecem como "não informado", nunca zero; drill-down chega aos registros.

## 11. Família (somente se habilitada)
- Uma autorização real de responsável; ver só o próprio educando; trocar o id na URL deve negar.

## 12. Critérios de GO (todos obrigatórios)
- `/prontidao-piloto` mostra "GO" (nenhum item obrigatório pendente/bloqueado).
- Smoke test do Diário (seção 8) aprovado por escrito pelo papel Secretaria.
- Ponto de restauração registrado.
Qualquer falha ⇒ NO-GO; corrigir na tela indicada e reverificar.

## 13. Rollback / contingência
- Fatos são append-only: erro de cadastro corrige-se por nova versão/retificação/encerramento, nunca apagando.
- Falha grave de dados: restaurar o ponto da seção 2 (procedimento manual, não testado — risco aceito pelo proprietário).
- Indisponibilidade: escola registra em papel e lança depois pelas telas oficiais, com a data real do fato.

## 14. Checklist pós-entrada
- [ ] Todas as turmas "prontas" em `/configuracao-inicial`
- [ ] Primeira chamada real concluída
- [ ] Nenhum erro na trilha de `/auditoria` sem explicação
- [ ] Docentes confirmam que veem só suas turmas

## 15. Monitoramento (manual — não há alerta automático)
- **Primeiras 24h:** responsável técnico revisa `/auditoria` e os registros de erro do backend 2× ao dia; Secretaria reporta problemas por canal combinado.
- **7 dias:** revisão diária de `/prontidao-piloto` e `/configuracao-inicial`; reunião de encerramento com decisão de continuidade pelo proprietário.
