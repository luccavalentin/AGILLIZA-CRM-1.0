# Lógica de Prazo Unificada e Simplificada

Refatorar a gestão de prazos na simulação completa para eliminar popups em cascata, unificar a fonte de verdade e garantir que a normalização siga regras de negócio claras (idade, operação, produto).

## Alterações

### 1. Estado do Formulário e Tipos
- Remover `_limitadorPrazo` do `ESTADO_INICIAL` em `src/lib/simulacao/use-simulacao-completa/state.ts`.
- Atualizar a tipagem do `Form` para refletir a remoção.

### 2. Lógica Pura de Decisão
- Criar a função `avaliarNovoPrazo` em `src/lib/simulacao/prazo.ts`.
- Entrada: `valorDigitado`, `campo`, `prazoPrincipal`, `prazoSegundo`, `prazoMaximoEfetivo`, `prazoMaximoIdade`, `limitadorPrazo`, `motivoLimitador`.
- Saída: `{ acao: 'aceitar' | 'ajustar' | 'rejeitar_segundo_duplicado', valorFinal, tipoAviso, titulo, descricao }`.
- Esta função conterá toda a lógica de mensagens específicas (idade vs operação vs teto geral) e a detecção de duplicidade do segundo prazo ANTES de alterar o estado.

### 3. Hook `useSimulacaoCompleta`
- **Remover lógica de prazo do método `set`**: Eliminar os blocos que chamam `toast.warning` e alteram `next.prazo` dentro do `set`.
- **Simplificar `definirPrazo`**: Utilizar a nova função `avaliarNovoPrazo` para tomar a decisão, aplicar o valor e emitir exatamente um toast.
- **Efeito de Revalidação Central**: Criar um único `useEffect` dependente de `prazoMaximoEfetivo` que revalida ambos os prazos simultaneamente quando o cliente ou a operação mudam.
- **Valores Derivados**: Garantir que `prazoMaximoEfetivo`, `prazoMaximoIdade` e `limitadorPrazo` sejam calculados via `useMemo`.

### 4. Componente `SecaoOperacaoImovel`
- Atualizar os botões de atalho (60, 120, ..., 420) para usarem `prazoMaximoEfetivo` para desabilitação e exibir tooltips informativos.
- Garantir que o alerta visual de idade só apareça se a idade for o limitador real.

### 5. Backend e Envio
- Manter a "rede de segurança" em `simulacoes.functions.ts` e `envio.ts`, mas garantir que a normalização silenciosa no servidor use os mesmos parâmetros.

## Detalhes Técnicos
- A função `avaliarNovoPrazo` usará strings literais para `motivoLimitador`: `"idade"`, `"operacao"`, `"produto"`, `"limite_geral"`.
- A mensagem de "Segundo Prazo rejeitado" deve orientar o usuário a escolher um valor diferente e inferior ao principal, sem disparar o fluxo de "ajuste" seguido de "remoção".
- `prazoMaximoEfetivo = Math.min(prazoMaximoIdade ?? 420, prazoMaximoOperacional, 420)`.

## Casos de Teste
- **Teste A**: Principal 420, Segundo 3000 -> Segundo null + Toast "Segundo Prazo inválido (máximo 420)".
- **Teste B**: Principal 180, Segundo 3000 -> Segundo 420 + Toast "Segundo Prazo ajustado para 420".
- **Teste C**: Idade limita a 282. Segundo 360 -> Segundo 282 + Toast "Ajustado pela idade de [Nome]".
- **Teste D**: Principal 282, Teto 282, Segundo 360 -> Segundo null + Toast "Já é o Prazo Principal".
- **Teste E**: Mudança de cliente (420 -> 282) -> Principal 282, Segundo null + Único Toast consolidado.
