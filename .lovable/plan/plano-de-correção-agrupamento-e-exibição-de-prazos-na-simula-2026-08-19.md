# Plano de Correção: Agrupamento e Exibição de Prazos na Simulação

O objetivo é corrigir a exibição de simulações agrupadas na tela de resultados e no PDF, garantindo que bancos com prazos diferentes (ex: 360m e 160m) sejam exibidos em blocos separados e com seus respectivos rótulos de prazo corretos, evitando a percepção de duplicação.

## Alterações Técnicas

### 1. Backend: Mapeamento de Prazos Individuais
No arquivo `src/lib/simulacao/simulacoes.functions.ts`, na função `obterSimulacao`:
- Adicionar um mapeamento de `prazoPorSim` (Map<id, prazo>) iterando sobre a simulação principal e suas irmãs.
- No mapeamento da variável `bancos`, injetar o campo `_prazo` resgatado do mapa para cada linha de banco.

### 2. UI: Agrupamento Visual por Prazo e Sistema
No arquivo `src/components/simulacao/completa/resultado-inline-ambos.tsx`:
- Refatorar a lógica de renderização para criar dois níveis de agrupamento: primeiro por **Prazo**, depois por **Sistema de Amortização** (SAC/PRICE).
- Ordenar os blocos de prazo do maior para o menor.
- Garantir que a coluna "Prazo" na tabela utilize o valor `b._prazo` específico daquela simulação.
- Ajustar as etiquetas de comparação ("Menor parcela", "Menor CET") para operarem apenas dentro do contexto do mesmo bloco (mesmo prazo e sistema).

### 3. PDF: Consolidação com Separação de Prazos
No arquivo `src/lib/simulacao/simulacao-pdf.ts`:
- Atualizar a função `baixarSimulacaoPDF` para que a tabela comparativa inclua a coluna "Prazo" sempre que houver múltiplos prazos detectados (`_multi_prazo`).
- Garantir que a função `gerarNomeArquivoPdf` reflita o prazo correto se for um extrato individual.

### 4. Lista de Simulações (Visão Geral)
No arquivo `src/components/simulacao/lista-detalhe.tsx`:
- Garantir que na listagem geral, quando houver múltiplos prazos, o rótulo principal não induza ao erro (já exibe "Múltiplos prazos" em alguns pontos, mas vamos revisar a consistência).

## Verificação
- Abrir a simulação do agrupador citado (`1ed5890e`).
- Validar se aparecem blocos distintos para 360m e 160m.
- Conferir se os valores do Santander/Bradesco/Itaú estão com os rótulos de 360m ou 160m conforme o banco de dados.
- Gerar o PDF e verificar se a estrutura de blocos e prazos está preservada.
