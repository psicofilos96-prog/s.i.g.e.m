# NAE.8 — Hardening e homologação transacional do Núcleo de Alimentação Escolar

NAE.8 vai em 5 lotes, nesta ordem. Cada lote fecha com gates próprios. O status final só é marcado depois do lote 5, quando o E2E de banco e as lacunas estiverem realmente fechados.

## Lote 1 — E2E transacional no banco (prioridade)
- Criar `supabase/tests/nae8_meal_chain_e2e.sql` no mesmo padrão já provado em `z2_planning_e2e.sql`:
  - um bloco DO que cria pessoas, atuações e uma política homologada sintéticas, todas com o prefixo `nae8-e2e-`;
  - a troca de usuário é simulada com `request.jwt.claims` e `role=authenticated`;
  - o bloco chama só os writers e readers canônicos e termina com `RAISE 'nae8-e2e-ok: …'`, então a transação inteira é revertida.
- Cadeia coberta: janela de pedido → pedido → submissão → análise/autorização → consolidação → 3 entregas → recebimento integral, parcial e rejeitado → aceite idempotente → ledger → perda, devolução e ajuste → inventário divergente → consumo observado → execução com planejado diferente do executado → não conformidade → documento → completude → readers 0187.
- Casos negativos (cada um com o código de erro esperado): anon; papel técnico chamando writer humano; outra escola (IDOR); capability ausente ou revogada; DML direto; retry; base desatualizada (stale-head); unidade incompatível; conversão ausente; regra ausente; rejeitado entrando no estoque; ficha técnica gerando baixa; reader escrevendo; 0 diferente de NULL; executor técnico usado como autor.
- Execução: pelo canal privilegiado da camada 0100. A prova é a mensagem sentinela. Depois, consultas confirmam zero resíduos, 55 escolas, 2026 intacto e 2027 sem mudança.

## Lote 2 — Anexos binários (lacuna da NAE.3)
- Bucket privado `meal-evidence`, criado pela ferramenta de storage.
- Migration aditiva `0188`:
  - ledger `meal_evidence_objects`, append-only, com hash SHA-256, MIME, tamanho, caminho e `supersedes`;
  - writer `record_meal_evidence`, que exige `meal_grant_on` sobre o recebimento, a não conformidade ou o documento de origem;
  - políticas em `storage.objects` limitadas ao caminho `<escola>/<id>` e à mesma capability.
- Download só por URL assinada com `SIGNED_URL_TTL_SECONDS`.
- MIME e tamanho são recusados tanto na tela quanto no banco.
- Enviar um anexo não implica aceite nem pagamento.

## Lote 3 — Estoque, Cozinha e Fechamento (telas)
- **Estoque:** ficha por item e lote, movimentos, contagem física com aprovador diferente, transferência só com política homologada e fechamento com manifesto. Tudo sobre os writers da 0185, sem saldo editável.
- **Rota `/alimentacao-escolar/cozinha`:** pensada para celular e tablet. Mostra o cardápio do dia, as entregas esperadas, alertas de lote e validade, o checklist, o registro rápido de execução e consumo, e os documentos permitidos.
  - O acesso é decidido no banco pela capability da atuação vigente. Esconder botão não conta como controle.
- **Fechamento por competência:** tela com o checklist `competenceChecklist`. Ausência aparece como pendente, nunca como zero. Corrigir algo depois do fechamento é uma nova versão com motivo.

## Lote 4 — Relatórios, filtros e inteligência
- Novas `ReportDefinition` no registry existente: solicitado × autorizado; consolidação; previsto/recebido/aceito/rejeitado/pendente; perdas, devoluções e ajustes; lotes e validade; inventário físico × calculado; cardápios e publicações; documentos; trilha completa; exceções e retificações. Cada uma usa um reader agregado único (migration `0189`, só leitura).
- Filtros e drill-down Rede → Escola → Pedido/Entrega/Estoque/Execução, com paginação.
- A inteligência da rede recebe só agregados autorizados. Alimentação continua fora do Mapa Estatístico.

## Lote 5 — Performance, mobile/a11y e gates finais
- Massa sintética dentro do bloco revertido. A medição usa `clock_timestamp()` nos readers de rede e confirma que não há N+1.
- Smoke com Playwright em 3 tamanhos de tela e testes de teclado, foco e dupla submissão nos componentes compartilhados.
- Gates completos: E2E de banco, suíte, tsgo, build, freeze de migrations, invariantes profundas, auditoria SQL, Security Advisor antes e depois, resíduos, 55 escolas, 2026 e 2027.
- Atualizar `docs/frente-nae-auditoria-final.md` com evidência literal.

## Fora do escopo (continuam bloqueados com código explícito)
Prazo 15/20, teto/per capita, saldo no pedido, restrição por categoria, adesão, baixa teórica, conversões, estoque mínimo, prazo de não conformidade e fluxo financeiro.

## Suposições
- O padrão DO + RAISE com usuários sintéticos é aceito como "rollback verificável", como já foi nas frentes Z2 e Y.
- Os lotes 1 a 5 levam várias mensagens. Ao fim de cada uma, informo o lote concluído e a evidência.
