# Secretaria: câmera, transferência, óbito e rematrícula em lote

Cinco frentes, nesta ordem. Cada uma reaproveita o que já existe e grava só pelos caminhos oficiais. Nada de cadastro duplicado, nada fica "não informado".

## 1. Foto 3x4 ao vivo na matrícula
- O componente de câmera que a Família já usa para a carteirinha (webcam ou câmera do celular, recorte 3x4, opção de enviar arquivo) passa a aparecer no passo de foto da matrícula guiada.
- A foto vai para o mesmo lugar privado das fotos de estudante, presa ao rascunho, e é ligada ao aluno quando a matrícula é concluída. A foto também sai na Ficha de Matrícula.
- Se não houver câmera ou o navegador negar a permissão, aparece uma frase simples e a opção de enviar um arquivo.

## 2. Botão "Receber transferência"
- Novo botão na Secretaria. A busca é só exata: CPF, ou Nome + Data de nascimento, que precisam bater juntos. Nunca busca pelo nome sozinho.
- Mostra a ficha histórica do aluno (escolas, anos, turmas, situações) só para leitura. Os dados de saúde e de inclusão não aparecem.
- Ao confirmar, numa única operação: encerra a matrícula na escola de origem no dia anterior, como "Transferido", abre a matrícula na escola de destino com a forma de ingresso "Transferência recebida" e coloca o aluno na turma escolhida.
- O sistema recusa se o aluno já estiver ativo na escola de destino ou se o ano letivo estiver fechado. Se faltar a turma, nada é gravado.
- Repetir o clique não cria uma segunda matrícula. A origem e o destino aparecem nos mapas dos dois meses.

## 3. Declaração Provisória de Transferência (válida por 30 dias)
- Ao registrar a saída como "Transferido" (pela escola de origem ou pelo botão acima), o sistema gera a declaração em PDF A4, no mesmo padrão visual da Ficha.
- A declaração traz número sequencial da escola, a data de emissão e a validade de 30 dias corridos. O prazo é um parâmetro da Secretaria marcado "Padrão do sistema", que você pode alterar.
- A vaga na turma é liberada na hora, porque o aluno sai da turma na mesma data. O painel de vagas recalcula sozinho.
- Ela sai como modelo-base com a marca "modelo do sistema", até a rede adotar o texto oficial.

## 4. Registro de óbito
- Formulário próprio na ficha do aluno com o número da certidão de óbito, a data do falecimento e uma observação. Antes de gravar, o sistema pede duas confirmações.
- O registro encerra a matrícula com a situação "Falecido" e bloqueia o aluno para sempre: não aceita nova matrícula, transferência, rematrícula nem enturmação, e isso vale também para o banco.
- O registro não pode ser desfeito. Só aceita uma correção de digitação do número ou da data, guardada com motivo e autor, sem apagar o registro original.
- O caso conta como saída no Mapa do mês.

## 5. Rematrícula em lote e Termo de Renovação
- Nova tela na Secretaria: a escola escolhe o ano de origem e o de destino e vê a lista em três grupos: "Prontos", "Exceções" (sem situação final, transferidos, falecidos) e "Já renovados".
- A regra de quem continua é um parâmetro editável, com padrão: aprovado vai para a próxima etapa e retido continua na mesma.
- A escola marca ou desmarca alunos e confirma uma vez. Se a lista mudar depois da prévia, a confirmação é recusada. Cada aluno é gravado à parte e o resultado mostra quem entrou, quem foi recusado e o motivo.
- A renovação cria só a matrícula do novo ano, sem turma. A turma continua sendo escolhida depois.
- Termo de Renovação em PDF, um por aluno ou em lote. Ele usa os campos do quadro original: ano letivo, série/ano, autorização de imagem, mudança de endereço, assinatura do responsável e rubrica do servidor. O termo também preenche a página de Controle de Renovação da Ficha.
- O que for gravado no termo fica guardado à parte da matrícula inicial, sem alterá-la.

## Verificação
- Testes para: busca exata; transferência numa única operação e sem duplicar; validade da declaração; bloqueio por óbito; prévia alterada sendo recusada; repetição sem efeito.
- Teste no navegador com a conta `sec.33001987`: foto pela câmera simulada, transferência entre duas escolas, óbito de um aluno de teste e rematrícula de uma turma da escola de teste 99999901.
- PDFs de exemplo da declaração e do termo salvos em Files para você conferir.

## Detalhes técnicos
- Migrations novas a partir da 0550, todas forward-only e com GRANT:
  - `secretariat_receive_transfer(_cpf|_name+_birth, _dest_school, _class, _on, _idem)`: SECURITY INVOKER, chama os writers existentes (`secretariat_record_exit` e o núcleo de `enrollment_draft_complete_with_origin` / alocação) numa só transação.
  - `student_death_records` (append-only, correções em ledger) + `secretariat_record_death`. Um trigger de guarda nos writers de matrícula, alocação e transição recusa estudante com óbito.
  - `transfer_declarations` com numeração via `allocate_document_number` e validade lida do parâmetro (0536/0537).
  - `renewal_term_records` (append-only) + uso de `record_year_transition_decision` / `confirmReenrollment` (fingerprint + chave idempotente).
- Reaproveitar `PhotoCapture` + `photo-crop` e `uploadPhoto`/`bindPhoto` existentes.
- PDFs da declaração e do termo usam o mesmo motor geométrico da Ficha (`enrollment-form/layout.ts`, `render.ts`).
- Novas regras no `src/features/school-secretariat/AGENTS.md`; migrations entram no manifesto por `invariants:freeze-migrations`.
