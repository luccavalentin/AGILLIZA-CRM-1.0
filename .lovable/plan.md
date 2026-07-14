## Auditoria — onde falta o seletor "Minhas / Gerais"

Já têm (mantém como está):
- Painel Visão geral · Painel Operacional · CRM Painel
- Simulações · Propostas (lista, kanban, enviar) · Tarefas (lista) · Demandas (lista)
- Relatórios (todos usam `VisionSelector`)

Faltando o seletor visível na UI (a função-servidor já aceita escopo, só falta expor o controle):
1. `dashboard.tsx` — home do usuário
2. `crm.clientes.tsx` — listagem de clientes
3. `crm.chat.tsx` — caixa de conversas
4. `operacional.tarefas_.kanban.tsx` — hoje fixo `escopo: "todas"`
5. `operacional.tarefas_.calendario.tsx` — hoje fixo `escopo: "todas"`
6. `operacional.demandas_.kanban.tsx` — hoje fixo `escopo: "equipe"`

Financeiro (contas a pagar/receber, fluxo de caixa, comissões) — hoje NÃO tem coluna `criador_id/responsavel_id` para separar "minhas" x "gerais"; o módulo é organizacional. Proposta: **não** adicionar seletor no financeiro por enquanto (não faria sentido semântico) — se você quiser, incluo depois um filtro "Minhas comissões" na tela de comissões, que é o único onde há vínculo pessoal (`profissional_id`).

## O que vou fazer

Padrão único em todas as telas:
- Estado local `escopo: "minha" | "geral"` (default `"minha"`).
- Chip inline com as duas opções, na mesma linha do título/filtros, usando o mesmo estilo do `VisionSelector` já existente (cor da marca no ativo).
- Passa o escopo para a server function correspondente (todas já aceitam).
- Persiste a preferência em `localStorage` por tela.
- Respeita permissões: se o usuário não tem `podeEquipe/podeGeral`, o chip nem aparece (força "minha").

## Arquivos a mudar

- `src/routes/_authenticated/dashboard.tsx` + a função de dados que ele consome
- `src/routes/_authenticated/crm.clientes.tsx`
- `src/routes/_authenticated/crm.chat.tsx`
- `src/routes/_authenticated/operacional.tarefas_.kanban.tsx`
- `src/routes/_authenticated/operacional.tarefas_.calendario.tsx`
- `src/routes/_authenticated/operacional.demandas_.kanban.tsx`

Se você confirmar, executo tudo agora. Se quiser incluir também financeiro (mesmo sem lógica de dono clara) ou deixar de fora alguma tela, me diga antes de eu começar.