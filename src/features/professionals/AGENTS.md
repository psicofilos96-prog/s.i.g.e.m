## Dados funcionais do DP administrativo (0076 — `functional-life.ts`, `/departamento-pessoal`)
## Dados funcionais do DP externo (0076 — `functional-life.ts`, `/departamento-pessoal`)
- DP administrativo (vínculos, lotações, eventos, férias/licenças, atos, designações, PAD) vive DENTRO do SIGEM (decisão do proprietário); fora ficam só folha, previdência, pensão e consignações, porque a decisão vigente substitui a premissa antiga de DP externo. Probatório, quinquênio, aposentadoria e acúmulo = DEPENDE_DECISAO até regra homologada.
- Exercício (`professional_exercises`), habilitação (`professional_qualifications`) e processo (`professional_functional_processes`) são fatos próprios, append-only, separados de vínculo/lotação, porque função exercida ≠ lotação e habilitação ≠ autorização.
- Atuação SIGEM só é lida de `institutional_engagements`; nenhum vínculo, cargo ou habilitação concede capability.
- Projeção por escola usa validOn + knownAt (`functionalPicture`); sem lotação registrada ⇒ ausência, nunca quadro zerado.
