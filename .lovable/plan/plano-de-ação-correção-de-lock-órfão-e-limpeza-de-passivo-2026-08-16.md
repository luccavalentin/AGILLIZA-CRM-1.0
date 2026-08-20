# Plano de Ação - Correção de Lock Órfão e Limpeza de Passivo

O objetivo deste plano é garantir que o sistema de simulações da HomeFin seja resiliente a falhas de processo, eliminando deadlocks causados por locks órfãos e saneando registros históricos pendentes.

## Alterações Técnicas

### 1. Refatoração do `enviar.server.ts`
- **Isolamento com try/finally**: Envolver o bloco de criação de oportunidade (`POST /oportunidade`) em um `try/finally` para garantir que `oportunidade_lock_em` seja definido como `NULL` mesmo em caso de erro crítico ou interrupção.
- **Timeout de Lock (2 min)**: Ajustar a cláusula `or` na eleição de líder para expirar locks com mais de 2 minutos que não resultaram em um `homefin_id_oportunidade`.
- **Logs de Diagnóstico**: Adicionar captura de stack trace em `simulacao_bancos.mensagem_banco` durante falhas na criação da oportunidade para eliminar o "ponto cego".

### 2. Saneamento do Passivo
- **Liberação de Locks**: Executar `UPDATE` direto no banco para liberar as 12 simulações travadas (incluindo `SIM-001807`).
- **Reprocessamento de Registros "P"**: Executar script de backfill para consultar a HomeFin e fechar os 68 registros que possuem taxa mas estão marcados como erro localmente.

## Passos de Execução

1. **Liberar Locks Atuais**: Executar o comando SQL fornecido pelo usuário via `supabase--read_query` (emulando `psql`).
2. **Atualizar Código**: Aplicar o `try/finally` e a expiração de 2 minutos no arquivo `src/lib/simulacao/enviar.server.ts`.
3. **Executar Backfill**: Rodar o script `scripts/backfill-passivo-p.ts` para reconciliar os 68 registros pendentes.
4. **Verificação**: Consultar o banco para confirmar se `count(*) where oportunidade_lock_em is not null` é zero.

## Critérios de Aceite
- Nenhuma simulação travada em "enviando" sem atividade.
- Locks expirando automaticamente após 2 minutos.
- Registros "P" da HomeFin reconciliados.
