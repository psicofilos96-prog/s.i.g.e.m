## Organização da oferta (Frente V — `src/features/offer-organization/`, migrations 0129–0132)
- `offer-source.ts` é a única porta TS: lê só readers canônicos e grava só pelos writers SECURITY DEFINER, porque a tela nunca é garantia.
- Ações aparecem por capacidade na data-alvo (início do ano letivo), nunca no relógio civil, porque a preparação de 2027 acontece antes de 2027.
- Profissional é escolhido só por busca exata (matrícula/QP-MEC) e atuações da pessoa localizada, porque diretório livre exporia o quadro.
- Responsáveis por bloco e horário do professor são projeções de atribuições/substituições; nada é persistido em duplicidade.
- Saldo sem carga contratual de fonte funcional é "não calculável", nunca zero.
