# Plano de Correção: Erro de Renderização (.length) na Simulação Completa

O objetivo é corrigir o erro `Cannot read properties of undefined (reading 'length')` que ocorre na tela de Simulação Completa, garantindo que o formulário e seus componentes lidem corretamente com estados iniciais ou parciais de dados (especialmente listas e objetos opcionais).

## 1. Módulo useSimulacaoCompleta
- **Normalização de Listas no Hook:** Garantir que `bancos_ids`, `bancos_sac_ids`, `bancos_price_ids` e `participantes` sejam sempre arrays no estado inicial e ao atualizar.
- **Proteção do ctxRef:** Garantir que todas as propriedades acessadas por componentes (como `isHomeEquity`, `bancos`, etc.) estejam presentes no objeto `ctxRef.current` desde o primeiro render.
- **Atomicidade no Vínculo do CRM:** Revisar as funções `selecionarClienteCRM` e `inverterPrincipal` para garantir que o estado do formulário e metadados (como `cadastroNome`) sejam atualizados de forma consistente.

## 2. Componentes de Seção
- **SecaoBancos:** Proteger o acesso a `bancos.length` e garantir que o filtro `.filter(aceitaPrice)` lide com `bancos` nulo ou indefinido.
- **SecaoComposicaoRenda:** Garantir que o mapeamento da lista de participantes seja resiliente a `f.participantes` ausente e que os cálculos de `totalConsiderado` usem `?.length`.
- **SecaoConjuge:** Proteger o cálculo de `prazoNovo` contra datas de nascimento inválidas ou proponentes indefinidos.

## 3. Orquestração de Envio (envio.ts)
- **Cálculo de totalSimulacoes:** Adicionar optional chaining em todos os acessos a `bancos_sac_ids.length`, `bancos_price_ids.length` e `bancos_ids.length`.
- **Normalização de bancosParaEnviar:** Garantir que, se a lista de IDs vier vazia, o código não tente acessar `.length` sem proteção.

## 4. Dashboard (Painel Comercial)
- **Hardening de Métricas:** Aplicar optional chaining e valores padrão (`?? 0`, `?? []`) em todos os componentes que renderizam listas de alertas, rankings ou dados de gráficos.

## Detalhes Técnicos
- Utilizar `Array.isArray(valor) ? valor : []` na entrada dos dados.
- Substituir acessos diretos como `sims.length` por `sims?.length`.
- Garantir que o hook retorne um objeto estável mesmo durante o carregamento inicial (`isLoading`).
