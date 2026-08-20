# Plano de Estabilização: Trava de Prazo por Idade

Restaurar o funcionamento rigoroso da trava de prazo por idade nas três camadas do sistema (UI, Validação e Servidor) para eliminar erros de integração por prazos excedidos.

## 1. Camada de Servidor (Crítica)
- **Arquivo**: `src/lib/simulacao/enviar.server.ts`
- **Ação**: Impedir a criação de simulações com prazo inválido antes de qualquer chamada à API HomeFin.
- **Lógica**: Recalcular o teto de prazo usando o proponente mais velho (incluindo cônjuge e participantes da composição de renda) e comparar com o prazo da simulação. Se excedido, registrar erro e interromper o processo para aquele banco.

## 2. Camada de Interface (UI)
- **Arquivo**: `src/components/simulacao/completa/secao-operacao-imovel.tsx`
- **Ação**: 
  - Aplicar `max={prazoMaximo}` nos campos de prazo.
  - Exibir label dinâmico: "Prazo máximo: X meses (limite pela idade)." sob cada campo.
  - Desabilitar atalhos (360, 420) se excederem o teto.
  - Garantir que `onBlur` chame a função de ajuste com mensagem explicativa via Toast.

## 3. Camada de Validação
- **Arquivo**: `src/lib/simulacao/use-simulacao-completa.ts`
- **Ação**: Bloquear o envio se qualquer um dos prazos (principal ou segundo) exceder o teto calculado em tempo real.
- **Mensagem**: Exibir mensagem personalizada identificando o proponente limitador: "Prazo ajustado de X para Y meses pela idade de {nome} ({idade} anos), o proponente mais velho."

## Detalhes Técnicos
- Utilizar `prazoMaximoParaProponentes` e `ajustarPrazoPorIdade` de `src/lib/simulacao/prazo.ts`.
- O cálculo do teto deve considerar `compoe_renda_conjuge` e participantes com `compoe_renda: true`.
- Manter as constantes `IDADE_MAX_TERMINO_MESES = 963` e `PRAZO_MAX = 420`.
