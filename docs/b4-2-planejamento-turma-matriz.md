# B4.2 — Turma → Matriz (planejamento; NÃO iniciada)

Nenhum schema, código ou dado criado. Consome `curricular_matrices_at` (B4.1).

## Decidido
- **D2 (cardinalidade temporal):** "Só existe uma matriz vigente, nunca mais de uma" — para cada turma e data, nunca mais de UMA matriz vigente. Obrigatoriedade de haver matriz para toda turma/data **não decidida**; ausência nunca é preenchida por default e a leitura a sinaliza.
- **Origem normativa:** matrizes vêm de deliberação (proveniência: Deliberação CME nº 3/2026 de Itaperuna, art. 1º–2º, Anexos I–V); construção no SIGEM pela Supervisão Escolar; alterações por nova deliberação preservando versão, vigência, ato e histórico. Ver `docs/b4-1-matriz-curricular.md` (tensão com D4 e proposta de reconciliação).

## Bloqueios (B4.2 não pode começar)
- **D2-critério:** qual campo canônico da turma escolhe a matriz/anexo. A deliberação mostra variantes (EI, EF regular 1º/2º seg., EJA 1º/2º seg.) mas não define esse campo; não foi inferido.
- **D1:** eixo de oferta educacional.
- Reconciliação D4 × Supervisão Escolar (quem constrói, registra a norma e homologa).

## Contrato previsto (após decisões)
Vínculo histórico append-only; recusa de sobreposição por turma; duas matrizes na mesma data ⇒ inconsistência fail-closed; compatibilidade fail-closed até D1/D2-critério.
