# Plano de Implementação — Confirmação de Ajuste de Prazo (Frontend ↔ Backend)

Implementar uma confirmação explícita via AlertDialog antes de qualquer ajuste automático de prazo por limite de idade, operação ou produto. O objetivo é garantir que o valor enviado à HomeFin seja exatamente o que o usuário viu e confirmou.

## Alterações

### 1. Centralização da Lógica de Avaliação
- Refatorar `src/lib/simulacao/prazo.ts`:
    - Manter a função pura `avaliarNovoPrazo` para cálculos.
    - Remover ajustes automáticos silenciosos em outras funções utilitárias.
    - Garantir que ela retorne os dados necessários para o popup (valor original, novo teto, limitador).

### 2. Orquestração de Estado no Hook
- Modificar `src/lib/simulacao/use-simulacao-completa.ts`:
    - Adicionar estado `confirmarAjustePrazo` (null | { campo, valorDigitado, teto, limitador, motivo }).
    - Alterar `definirPrazo` para não mutar o estado `f.prazo` imediatamente se ultrapassar o limite.
    - Implementar `confirmarAjusteManual` (fecha popup, mantém valor inválido) e `aplicarAjusteAutomatico` (fecha popup, seta valor = teto).
    - Impedir o envio (`formInvalido`) se o valor atual no estado for maior que o teto.

### 3. Interface de Confirmação (UI)
- Atualizar `src/components/simulacao/completa/secao-operacao-imovel.tsx`:
    - Adicionar o componente `AlertDialog` que reage ao estado `confirmarAjustePrazo`.
    - Exibir mensagens personalizadas conforme o `motivoLimitador` (Idade, Operação, Produto).
    - Garantir que o `onBlur` do input de prazo dispare a avaliação.
    - Exibir alerta fixo discreto abaixo do input com o prazo máximo e o proponente limitador.

### 4. Segurança no Backend
- Revisar `src/lib/simulacao/enviar.server.ts`:
    - O servidor deve validar o prazo recebido.
    - Se `prazoRecebido > teto`, retornar um erro estruturado `PRAZO_ACIMA_LIMITE` em vez de ajustar silenciosamente (ou manter o ajuste apenas como "última rede de segurança" com log de warning, mas priorizar a rejeição para que o frontend peça confirmação).

## Detalhes Técnicos
- O input será controlado pelo estado `f.prazo`.
- Durante a digitação, o valor é aceito livremente.
- A validação com popup ocorre no `onBlur`, `Enter` ou tentativa de envio.
- Se o usuário ignorar o ajuste ("Corrigir manualmente"), o campo ganhará borda vermelha e o botão "Gerar Simulação" será desabilitado via `formInvalido`.

## Critérios de Aceite
1. Digitar 320 com máximo 250 -> Input mostra 320 -> Popup abre ao sair do campo.
2. Clicar em "Ajustar para 250" -> Input vira 250 -> Estado vira 250 -> HomeFin recebe 250.
3. Clicar em "Corrigir manualmente" -> Input continua 320 -> Botão "Gerar" desabilitado.
4. Trocar cliente por um mais velho -> Prazo atual de 360 vira inválido -> Popup abre informando a redução.
5. Logs no console comprovam a paridade: Front 235 = Request 235 = Server 235 = HomeFin 235.
