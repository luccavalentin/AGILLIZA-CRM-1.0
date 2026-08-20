# Plano de Implementação: Resumo de Performance da Simulação

Adicionar um componente de resumo sofisticado no cabeçalho da tela de resultados da simulação (`ResultadoInlineAmbos`), exibindo a quantidade real de simulações bancárias e o tempo total de processamento/retorno em tempo real.

## Alterações Propostas

### 1. Novo Componente: `ResumoPerformanceSimulacao`
- **Localização**: `src/components/simulacao/completa/resumo-performance.tsx`.
- **Funcionalidade**:
  - Recebe a lista de `linhas` calculadas no componente pai.
  - Calcula o tempo total decorrido desde o início da primeira simulação até o término da última.
  - Mantém um timer interno se houver simulações pendentes.
  - Exibe a quantidade real de simulações (bancos × prazos × sistemas).
- **Design**: 
  - Fundo off-white, borda sutil, cantos arredondados (12px).
  - Azul Agilliza `#000F9F` para destaques.
  - Tipografia: Números destacados (600 weight) e labels discretos.
  - Indicador de atividade pulsante sutil durante o processamento.
  - Tooltips detalhando a composição das simulações e os horários de início/fim.

### 2. Integração no `ResultadoInlineAmbos`
- Importar e renderizar o `ResumoPerformanceSimulacao` no canto superior direito do card, aproveitando o espaço vazio.
- Garantir responsividade: alinhado à direita no desktop, abaixo do título/botões no mobile.

### 3. Lógica de Tempo e Status
- **Início**: Menor valor entre `created_at` e `ultimo_envio_em` de todas as simulações irmãs.
- **Conclusão**: Maior valor de `simulado_em` ou `updated_at` (se status for erro) entre todos os `simulacao_bancos`.
- **Formatação**: Conversão automática para `s`, `m s` ou `h m`.

## Detalhes Técnicos
- **Sem alteração de schema**: Uso de timestamps existentes (`created_at`, `updated_at`, `simulado_em`).
- **Performance**: O componente utilizará dados já carregados pelo `useQuery` do componente pai.
- **Responsividade**: Tailwind classes para ajuste de layout (`hidden lg:flex` vs `flex w-full mt-2`).

## Verificação
- Testar exibição com simulações em andamento (contador ativo).
- Verificar travamento do contador após conclusão total ou parcial (erros incluídos).
- Validar design contra as especificações (azul #000F9F, fontes, padding).
