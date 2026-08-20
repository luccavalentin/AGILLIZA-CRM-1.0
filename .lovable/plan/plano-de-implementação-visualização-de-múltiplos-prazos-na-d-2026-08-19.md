# Plano de Implementação: Visualização de Múltiplos Prazos na Detalhe da Simulação

Este plano detalha as alterações necessárias para consolidar simulações de múltiplos prazos e sistemas de amortização em uma única visualização, agrupando por prazo e sistema, e garantindo que o PDF contenha todos os dados.

## Alterações

### 1. Servidor: Inclusão do Prazo no Mapeamento de Bancos
- **Arquivo**: `src/lib/simulacao/simulacoes.functions.ts`
- **Ação**: Na função `obterSimulacao`, atualizar o mapeamento de `bancosRaw` para incluir o campo `_prazo`, extraído da simulação correspondente no `agrupador_id`.
- **Objetivo**: Permitir que a interface saiba exatamente a qual prazo cada retorno bancário pertence, evitando confusão visual entre prazos diferentes (ex: 360m vs 180m).

### 2. Interface: Agrupamento por Prazo e Sistema
- **Arquivo**: `src/components/simulacao/completa/resultado-inline-ambos.tsx`
- **Ações**:
    - Alterar a lógica de ordenação e agrupamento das linhas para processar primeiro por **Prazo** (do maior para o menor) e depois por **Sistema** (SAC/PRICE).
    - Repetir o cabeçalho de Prazo ("PRAZO: 360 MESES") para cada bloco de prazos distintos encontrados no agrupador.
    - Garantir que as etiquetas de "Melhor taxa", "Menor parcela" e "Menor CET" sejam calculadas **dentro do mesmo bloco** de prazo e sistema.
    - Corrigir a coluna de prazo para exibir `b._prazo` em vez do prazo da simulação principal.

### 3. PDF: Consolidação de Todos os Prazos e Sistemas
- **Arquivo**: `src/lib/simulacao/simulacao-pdf.ts`
- **Ação**: Refatorar a geração do PDF para iterar sobre todos os bancos de todas as simulações irmãs do agrupador, organizando-os em blocos de prazos e sistemas, similar à UI.
- **Objetivo**: Garantir que o botão de "Baixar PDF" no topo da tela gere um único documento contendo o panorama completo da consulta (ex: 4 combinações: SAC 360, PRICE 360, SAC 180, PRICE 180).

### 4. Validação de Listagem
- **Arquivo**: `src/lib/simulacao/simulacoes.functions.ts` (função `listarSimulacoes`)
- **Ação**: Verificar se a lógica de colapso por `agrupador_id` está funcionando corretamente para evitar linhas duplicadas na lista principal de simulações.

## Detalhes Técnicos
- Utilização de `Map` no servidor para associar `simulacao_id` a `prazo` de forma eficiente.
- Ajuste nos seletores de "Melhor Taxa" na UI para considerar a chave de grupo `${l.prazo}-${l.sistema}`.
- Garantia de que bancos em estado de erro possam ser reenviados individualmente sem quebrar o agrupamento.
