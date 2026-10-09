## Preparação do ano (`src/features/year-preparation/`, `/preparacao-2027`)
- Central só lê com a sessão do usuário e só navega; nunca grava, abre ano nem chama writer, porque o assistente não pode ganhar superpoder.
- Item só fica pronto com dependências técnicas prontas; leitura negada/erro/não lida é UNKNOWN, nunca zero; sem percentual, porque pesos não são homologados.
- BB: leituras só por `readiness-probes.ts` (SELECT paginado, cliente mínimo sem escrita); cada item declara `scope` annual|timeless e itens anuais contam só registros do ano-alvo (turma→ano; oferta/grade/atribuição→turma do ano; matriz→aplicabilidade no ano; atuação/política→vigência que alcança o ano), porque registro de 2026 jamais pode aprontar 2027.
- N2026.REFERENCE.2027: "Referência 2026" (`prior-year-reference.ts`) só lê com a sessão, com knownAt capturado uma vez, e "Usar como ponto de partida" só navega ao writer do domínio, porque copiar fato de 2026 criaria 2027 falso.
