
## Dados funcionais do DP externo (0076 — `functional-life.ts`, `/departamento-pessoal`)
- O SIGEM não tem módulo RH/DP: a rota é consulta dos dados que o DP externo informa; tabelas e a capability `rh-profissionais-da-rede`/`manter-registro-funcional` são legado histórico preservado, nunca perfil operacional futuro, porque a autoridade funcional é externa.
- Exercício (`professional_exercises`), habilitação (`professional_qualifications`) e processo (`professional_functional_processes`) são fatos próprios, append-only, separados de vínculo/lotação, porque função exercida ≠ lotação e habilitação ≠ autorização.
- Atuação SIGEM só é lida de `institutional_engagements`; nenhum vínculo, cargo ou habilitação concede capability.
- Projeção por escola usa validOn + knownAt (`functionalPicture`); sem lotação registrada ⇒ ausência, nunca quadro zerado.
