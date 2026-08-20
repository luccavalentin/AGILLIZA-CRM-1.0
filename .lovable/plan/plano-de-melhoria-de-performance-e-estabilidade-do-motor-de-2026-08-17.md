# Plano de Melhoria de Performance e Estabilidade do Motor de Simulação

Melhorar o tempo de arranque das simulações, otimizar o polling de bancos e garantir que falhas de envio sejam devidamente registradas para permitir o reenvio.

## Melhorias e Correções

1.  **Arranque (Performance):**
    *   Instrumentar a fase inicial no `enviarSimulacaoImpl` com logs de servidor detalhados (carregamento de dados, obtenção de token, montagem de payload, eleição de líder).
    *   Mover operações não críticas (como o watchdog e liberações de locks genéricos) para fora do caminho crítico do primeiro envio ou executá-las em segundo plano.
2.  **Otimização do Polling:**
    *   Garantir que, se o `POST /integracao` retornar `valorParcelaBanco` (ou campos equivalentes), o banco seja marcado como `simulada` imediatamente, persistindo os dados e pulando o agendamento do polling `GET`.
3.  **Estabilidade de Envio (Defeito SIM-001822):**
    *   Garantir que nenhuma simulação terminada pelo usuário fique com status "rascunho" se o envio for tentado.
    *   Se o processamento falhar antes de qualquer chamada HTTP, registrar o erro na simulação e nos bancos para que o usuário possa visualizar o motivo e reenviar.

## Detalhes Técnicos

*   **Arquivo:** `src/lib/simulacao/enviar.server.ts`
    *   Adicionar logs `[PERF]` em etapas chave:
        1.  Início da função.
        2.  Após `simPreCheck` e `validarCamposSimulacao`.
        3.  Após o Watchdog (avaliar se o Watchdog pode ser ignorado se `bancoIds` estiver presente ou executado de forma assíncrona).
        4.  Após carregar dados do cliente e endereço.
        5.  Antes e depois de `obterToken`.
        6.  Antes e depois da eleição de líder/criação da oportunidade.
    *   No processamento da resposta do `POST /integracao`:
        *   Se `!vazio(dadosApi)`, salvar os dados e retornar `status: "simulada"`.
        *   Mover o log de "Short-circuiting polling" para antes do bloco que inicia o loop de polling, assegurando que o loop nem seja entrado.
    *   No bloco `catch` principal do `enviarSimulacaoImpl`:
        *   Garantir que o `status` da simulação seja atualizado para `erro_banco` e `ultimo_erro` seja preenchido, mesmo que a falha ocorra antes de atingir o loop de bancos.
        *   Marcar os bancos selecionados como `erro` com a mensagem do erro global.

*   **Arquivo:** `src/lib/simulacao/simulacoes.functions.ts`
    *   Verificar se a `enviarSimulacaoBanco` está lidando corretamente com erros para que a simulação não fique órfã em status "rascunho".

## Critérios de Aceite

*   Log de servidor mostrando `seg_ate_1a` (tempo até o primeiro POST) abaixo de 5s.
*   Log de performance mostrando `gets = 0` para bancos que respondem no POST (Itaú, Bradesco).
*   Simulações que falham no arranque devem exibir erro claro na UI e status `erro_banco` no banco de dados.
