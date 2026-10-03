# SIGEM — Memória de continuidade técnica (2026-10-03)

Registro de continuidade **dentro do repositório**. Não é promessa de memória externa: quem retomar deve reler este arquivo, os `AGENTS.md` e as fontes duráveis abaixo.

## Sequência auditada
1. Sincronização reconciliada em `7129c0c` (B4.5 recuperada/mesclada; Cloud com 0021/0022).
2. B4.5.1: cache estrito por conta/pessoa e mapper fail-closed — `51d05b2`.
3. B4.5.2: TIME até microssegundos e `block_minutes` conforme o SQL — `d885459`.
4. B4.6.1: estrutura do calendário (0023), readers públicos fechados (`access-denied`) — `a7a8e70`. Auditoria técnica aceita; não é homologação institucional.
5. B4.6.2a (esta entrega; base auditada `a7a8e70`): source tipada + fronteira de sessão nas três rotas do calendário + casos SQL `year-inactive`/`organization-inactive`.
   - O commit é criado automaticamente; o hash não fica registrado aqui.

## Testes reais e gates desta entrega
- Cloud: `supabase/tests/b4_6_1_calendar_structure.sql` → `b46-tests-ok` (rollback). As 9 tabelas de calendário ficaram vazias depois. Policies v1/v2 = 108/117 draft.
- Código: testes novos e afetados, suíte completa isolada, typecheck, build e diff-check com exit code real (ver relatório da entrega). SQL B4.4/B4.5 não foi repetido (não alterado).

## Escopo concluído em B4.6.2a
- `calendar_at`/`calendar_day_at` tipados, só `access-denied`, qualquer outra forma é erro visível.
- `/calendario-escolar`, `/$id` e `/$id/documento`:
  - sessão incerta ⇒ nada monta;
  - sem sessão ⇒ laboratório;
  - com sessão ⇒ consulta institucional somente leitura, sem demo, `?perfil`, impressão ou ações.
- Cache por userId + modo + ID + validOn + knownAt.

## Próximos passos (nenhum iniciado)
- **B4.6.2b**: migrar os consumidores do laboratório (Diário, frequência, avaliação, fechamento; lista em `docs/b4-6-2a-calendario-source-rotas.md`).
- **B4.6.1b**: aplicabilidade/D5.
- **Decisões institucionais abertas:**
  - D4 — leitura de rascunho;
  - competência de consulta do conteúdo homologado;
  - R5 — homologação;
  - D6 — publicação.
- **B4.7**: apresentação/impressão institucional. **B4.8 / B4.9 / B4.10**: integrações.

## Fontes duráveis e regras de retomada
- `docs/sigem-memoria-fontes-historicas.md` e `docs/sigem-memoria-setorial-e-auditoria.md`: contexto histórico e setorial, não estado atual.
- O repositório é a única fonte do estado; o modelo abandonado não é importado (regras, dados ou código).
- Não forçar permissões, capabilities, policies nem normas: sem decisão institucional explícita, a escrita e a consulta continuam fechadas.
