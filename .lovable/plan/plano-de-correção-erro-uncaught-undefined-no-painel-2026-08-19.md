# Plano de Correção — Erro "Uncaught undefined" no Painel

O erro `Uncaught undefined` no `react-dom_client.js` geralmente ocorre quando o React tenta renderizar algo que resultou em `undefined` ou tenta acessar uma propriedade de um objeto nulo/indefinido durante o ciclo de renderização. No contexto do dashboard (`PainelView`), isso costuma acontecer ao processar dados de KPIs, gráficos ou funis que o servidor retornou como parciais ou mal-formatados.

## Passos de Diagnóstico e Correção

### 1. Robustez no `PainelView` (Frontend)
Adicionar proteções (`Optional Chaining` e `Fallback`) em todos os acessos a dados no componente `src/components/reports/painel-view.tsx`.
- Garantir que `data.heros`, `data.minis`, `data.funil`, `data.evolucao`, etc., sempre tenham um fallback seguro (ex: `[]` ou `null`) antes de serem mapeados.
- Tratar especificamente o acesso a `data.evolucao.titulo` e `data.distribuicao.titulo` que são usados como chaves de detalhamento.

### 2. Blindagem do `getPanelDados` (Server Function)
Revisar a função de servidor em `src/lib/relatorios/paineis.functions.ts` para garantir que o objeto de retorno sempre respeite a interface `PanelDados`.
- Garantir que `alertas` seja sempre um array, mesmo em caso de erro nas tabelas secundárias.
- Verificar se `contratosInfo.rows` pode ser nulo antes de chamar `.map()`.
- Adicionar blocos `try/catch` internos nas consultas de tabelas menos críticas (como `financeiro` e `rh`) para que uma falha nessas tabelas não quebre o dashboard inteiro.

### 3. Melhoria do `ErrorComponent` (Root)
Atualizar `src/routes/__root.tsx` para exibir detalhes mais claros quando o erro for "undefined", ajudando a identificar se a falha é no carregamento de um chunk ou na lógica de renderização.

## Detalhes Técnicos
- **Interface Afetada**: `PanelDados` em `src/lib/relatorios/paineis.functions.ts`.
- **Componente Principal**: `PainelView` em `src/components/reports/painel-view.tsx`.
- **Estratégia**: Falha graciosa (Graceful Degradation) — se o financeiro falhar, o painel de produção comercial deve continuar funcionando.
