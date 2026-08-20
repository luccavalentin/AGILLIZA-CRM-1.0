# Plano de Correção: Edição Real de Simulações

Corrigir o comportamento do botão "Editar Simulação" para que realize uma edição real dos dados (pré-preenchimento completo), em vez de apenas duplicar a simulação sem os dados de cliente e configurações.

## Módulos Afetados
- **CRM/Simulações**: Lista de simulações e roteamento.
- **Simulação Completa**: Hook de estado e carregamento de dados.

## Alterações Propostas

### 1. Hook de Estado (`src/lib/simulacao/use-simulacao-completa.ts`)
- Adicionar suporte ao parâmetro `editar` na busca de busca.
- Implementar efeito para carregar a simulação original quando o modo for `editar` ou `duplicar`.
- Garantir que todos os campos (cliente, cônjuge, participantes, bancos e dados da operação) sejam restaurados corretamente no estado do formulário.

### 2. Funções do CRM (`src/lib/simulacao/simulacoes.functions.ts`)
- Exportar uma função auxiliar ou garantir que `obterSimulacao` retorne todos os detalhes necessários, incluindo participantes e bancos selecionados.

### 3. Roteamento e Lista (`src/routes/_authenticated/operacional.simulacoes.tsx`)
- Alterar o `handleEditar` para passar o ID da simulação via parâmetro `editar` (ou manter `duplicar`, mas com lógica de preenchimento completa no hook).
- *Decisão*: Como o sistema já usa `duplicar`, vou aprimorar a lógica de preenchimento quando `duplicar` está presente para que ele seja um "Clone Completo" (Deep Clone).

## Detalhes Técnicos
- O hook `useSimulacaoCompleta` já possui um `useQuery` para `origem` (simulação a ser duplicada).
- Falta a lógica de `useEffect` que mapeia `origem.data` para o estado `f` (form).
- Vou garantir o mapeamento de:
  - Dados do Titular (Nome, CPF, Renda, etc)
  - Dados do Cônjuge (se houver)
  - Dados da Operação (Produto, Valor Imóvel, Prazo, Amortização)
  - Bancos Selecionados (SAC e PRICE)
  - Participantes Adicionais

---
Módulo atual: **Arquitetura de Dados — Persistência de Edição**.
Próximos passos: Implementar mapeamento de pre-fill no hook `useSimulacaoCompleta`.
