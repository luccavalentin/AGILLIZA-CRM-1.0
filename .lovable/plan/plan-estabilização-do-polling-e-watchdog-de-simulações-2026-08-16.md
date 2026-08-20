# Plan: Estabilização do Polling e Watchdog de Simulações

Corrigir a persistência do ID da simulação HomeFin e estabilizar o watchdog para evitar simulações presas em "enviando" indefinidamente.

## User Review Required

> [!IMPORTANT]
> A taxa de erro do Santander deve convergir com a dos demais após estas correções, pois o sistema deixará de "desistir" precocemente quando o banco devolve status "P" (Pendente).

- **Persistência Imediata**: O ID da simulação retornado pela HomeFin será gravado no banco de dados IMEDIATAMENTE após a criação, antes de qualquer chamada de integração bancária.
- **Watchdog Reforçado**: O watchdog no servidor agora monitora bancos parados em "aguardando" por mais de 5 minutos, marcando-os como erro com a mensagem específica solicitada.
- **Polling Estabilizado**: O polling foi revisado para garantir que continue até o desfecho final ou timeout de 5 minutos.

## Technical Details

### 1. Persistência de ID (Problema 2)
- Local: `src/lib/simulacao/enviar.server.ts`
- Alteração: Mover o `update` da tabela `simulacao_bancos` para logo após o `POST /oportunidade/{id}/simulacao`. Atualmente ele ocorre apenas no final do bloco de sucesso ou no `finally`.
- Objetivo: Garantir que `homefin_id_simulacao_banco` nunca seja NULL se a HomeFin retornou um ID.

### 2. Polling e Timeout (Problema 1 e 3)
- Local: `src/lib/simulacao/enviar.server.ts`
- Alteração:
    - Ajustar a lógica de polling para garantir que o laço `while (vazio(dadosApi) ...)` seja resiliente.
    - Implementar a mensagem de erro específica: "O banco não respondeu no tempo previsto. Clique em reenviar." quando o orçamento de 5 minutos esgotar.
    - Garantir que `recalcularStatusGlobalProposta` (ou equivalente para simulações) seja chamado para tirar a simulação do estado "enviando".

### 3. Watchdog de Servidor (Problema 3)
- Local: `src/lib/simulacao/enviar.server.ts`
- Alteração: O watchdog existente será aprimorado para identificar bancos em `status_banco = 'aguardando'` com `homefin_id_simulacao_banco` preenchido que não tiveram atividade nos últimos 5 minutos.

### 4. Reprocessamento do Passivo (Problema 4)
- Ação: Criar e executar um script de migração/correção pontual para normalizar os 68+ registros do Santander que estão com ID mas marcados como erro falso "P".

## Proposed Changes

### Integration Logic
- `src/lib/simulacao/enviar.server.ts`:
    - Persistir `homefin_id_simulacao_banco` assim que recebido.
    - Refinar o loop de polling e o tratamento do timeout de 5 minutos.
    - Atualizar o watchdog para ser mais agressivo com registros órfãos.
