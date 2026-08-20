# Plano de Padronização e Estabilização - Integração Santander (HomeFin)

Este plano visa corrigir as falhas recorrentes na integração com o Santander, eliminando duplicidades de envio, padronizando dados de estado civil e melhorando a clareza das mensagens de erro para o usuário.

## 1. Padronização de Dados (Estado Civil)
* **Ação:** Modificar o fluxo de gravação e envio para utilizar exclusivamente os códigos do domínio HomeFin (`S`, `CA`, `UE`, `DI`, `VI`, `SL`).
* **Arquivos:** `enviar.server.ts`, `simulacoes.functions.ts`.
* **Backfill:** Execução de script para converter registros existentes de rótulo para código.

## 2. Eliminação de Duplicidade
* **Ação:** Antes de realizar o `POST /simulacao` na HomeFin, verificar se o banco já possui um `homefin_id_simulacao_banco` persistido na oportunidade.
* **Benefício:** Redução de carga na API e maior velocidade no retorno, evitando reprocessamento desnecessário de bancos que já responderam (ou estão pendentes).

## 3. Humanização de Mensagens e Status
* **Ação:** Diferenciar erros definitivos de pendências temporárias (status "P").
* **Mensagem Santander:** "O Santander recebeu a simulação mas ainda não devolveu o cálculo. Isso costuma ser temporário — tente novamente em alguns minutos."
* **Status UI:** Garantir que "aguardando" seja um estado legítimo e não mascarado como "erro" enquanto o banco processa.

## Detalhes Técnicos
* Centralização do `simRespBanco` para evitar erros de escopo.
* Refinamento no `humanizarErroBanco` para tratar casos de recusa sem mensagem explícita.
* Atualização do watchdog para lidar com a reaproveitamento de IDs.
