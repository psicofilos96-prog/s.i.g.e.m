# Diagnóstico das 6 falhas da suíte (sem correção aplicada)

## Conclusão
Todas as falhas têm a mesma causa comprovada: a pasta `supabase/migrations` não existe no repositório remixado (`ls` → "No such file or directory"). Os testes leem essa pasta com `readdirSync` para auditar o SQL e quebram com `ENOENT: no such file or directory, scandir 'supabase/migrations'`.

Não são regressão da B2.5.4. Nenhum desses arquivos de teste nem suas pastas foram alterados (git status limpo). O histórico do git mostra que a pasta existia (commits B2.5.2 e B2.5.3) e saiu no commit do remix "Add integration configuration from remix". É um problema ambiental do remix, já conhecido e adiado para antes da B2.6.

## Falhas, uma a uma
Todas com a mesma mensagem (`ENOENT ... scandir 'supabase/migrations'`):

1. `src/features/ciece/age-grade-distortion.test.ts`: o arquivo inteiro falha ao carregar, porque a leitura fica no escopo do módulo (linha 91).
2. `src/features/statistical-map/map-domain.test.ts`: o arquivo inteiro falha ao carregar (linha 106).
3. `src/features/statistical-map/map-integrity.test.ts`: falha o teste "14.10.1 › arquitetura: o cliente não envia fotografia e o banco só aceita escrita do servidor" (linha 65).
4. `src/features/professionals/functional-record.test.ts`: falha o teste "14.12 › atuação não é lotação e cargo não concede capacidade" (linha 63).
5. `src/features/school-visits/visit-record.test.ts`: falha o teste "14.13 › banco: RLS por escola, capacidade, tipo homologado, anulação, sem concessão" (linha 45).
6. `src/features/student-life/institutional-enrollment.test.ts`: falha o teste "14.5 › 17–19. escrita só por função com capacidade na escola, tipo homologado e sem cargo" (linha 94).

Sobre a contagem:
- O relatório anterior mostrou "7 arquivos / 6 testes". Os dois arquivos que quebram ao carregar não contam testes, e os 4 testes individuais acima também falham.
- O sétimo arquivo era `institutional-period-source.test.ts`. Ele falhou por uma mudança minha de tipagem em `_known_at` e já foi corrigido (41/41 passam).
- Vale rodar a suíte de novo e confirmar a contagem exata.

## Correção mínima recomendada (não aplicada)
- **Opção A, a correta:** restaurar `supabase/migrations/` a partir do histórico do git anterior ao remix. Isso é só o arquivo-fonte, sem reaplicar nada no banco. É a reconciliação já planejada para antes da B2.6.
- **Opção B, para fechar a B2.5.4 agora:** nos 6 testes, pular a auditoria de SQL quando a pasta não existir (`existsSync` + `it.skipIf`) e registrar isso como dívida. Isso mantém a suíte verde sem mascarar uma regressão de domínio.

## Recomendação
Fechar a B2.5.4 declarando as 6 falhas como ambientais. Tratar a Opção A na reconciliação de migrations antes da B2.6.
