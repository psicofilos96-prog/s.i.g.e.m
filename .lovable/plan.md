# Correção: /transferencias/nova ("Esta tela não abriu")

## Erro real reproduzido (site publicado, conta sec.99999901)
```text
TypeError: Cannot read properties of null (reading 'localeCompare')
    at allocation-draft-dEC5lxY5.js:1:45030
    at Array.sort (<anonymous>)
    at Ze (allocation-draft-dEC5lxY5.js:1:44887)   <- MovementSection
governed_error op-e8bdd935991b / op-08163eaaf43c, route /transferencias/nova
```

## Linha provável
`src/features/student-life/institutional-enrollment-workspace.tsx`, dentro de `MovementSection`, no `.sort()` de `options` (cerca da linha 475):
`a.enrollment.logical_id.localeCompare(b.enrollment.logical_id)`.
`name` e `year` já têm valor de reserva; o único valor que pode chegar nulo é `logical_id` de alguma inscrição vinda de `cycle_enrollments_at`. A linha `studentIds` (450) não é a causa: roda antes e não chama `localeCompare`.

## Correção mínima
1. No comparador, trocar por `(a.enrollment.logical_id ?? "").localeCompare(b.enrollment.logical_id ?? "")`.
2. Conferir no banco quais inscrições da escola 99999901 voltam sem `logical_id` (só leitura), e registrar como inconsistência de origem, sem corrigir dado automaticamente.
3. Teste pequeno: ordenar opções com uma inscrição sem `logical_id` não lança erro.
4. Repetir o mesmo teste no navegador como secretaria da escola de teste.
