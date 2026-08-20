# Plano de Correção: Duplicidade, Reenvios e Status da Integração HomeFin

O objetivo deste plano é eliminar a criação de simulações duplicadas na HomeFin, evitar reenvios desnecessários (especialmente para o Santander), corrigir os critérios de conclusão (polling) e garantir que todas as simulações de um par (titular/cônjuge) sejam disparadas corretamente.

## Problemas Identificados
1. **Duplicidade no POST /oportunidade**: O payload atual envia `flagSimulacao: "S"` para cada banco, o que faz a HomeFin criar simulações automáticas. O CRM então faz um `POST /simulacao` manual, gerando o segundo ID.
2. **Reenvios no Santander**: O código atual não bloqueia novos `POST /simulacao` se o registro já possuir um `homefin_id_simulacao_banco`.
3. **Critério de Conclusão Falho**: O uso de `dataHoraRetornoIntegracao` é inconsistente. O critério correto deve ser a presença de `valorParcelaBanco > 0`.
4. **Simulações Órfãs**: A simulação secundária (cônjuge) às vezes não entra no fluxo de envio, ficando em rascunho.
5. **Short-circuit de Polling**: O polling continua mesmo após o valor ser obtido ou se houver erro.

## Mudanças Propostas

### 1. Eliminar Duplicidade na Oportunidade
- **Onde**: `src/lib/simulacao/enviar.server.ts`
- **O que**: Alterar `flagSimulacao: "S"` para `"N"` no array de bancos do `POST /oportunidade`. Isso garante que a oportunidade seja criada sem simulações automáticas, deixando o controle total para o passo seguinte (`POST /simulacao`).

### 2. Bloquear Reenvios de Bancos já Identificados
- **Onde**: `src/lib/simulacao/enviar.server.ts`
- **O que**: Adicionar uma trava no loop de bancos: se `homefin_id_simulacao_banco` já estiver preenchido em `simulacao_bancos`, pular os `POSTs` (`/simulacao` e `/integracao`) e ir direto para o polling/reconciliação se o valor ainda estiver zerado.

### 3. Ajustar Critério de Conclusão e Polling
- **Onde**: `src/routes/api/public/reconciliar-simulacoes.ts`
- **O que**: 
    - Remover a dependência de `dataHoraRetornoIntegracao`.
    - Considerar "concluído" apenas se `valorParcelaBanco > 0`.
    - Garantir que `taxa_juros_ano` e `taxa_cet_ano` só sejam gravados se > 0 (preservando valores anteriores se nulos).

### 4. Garantir Disparo da Simulação Secundária
- **Onde**: `src/lib/simulacao/simulacoes.functions.ts`
- **O que**: Mover a lógica de disparo automático da simulação secundária para garantir que ela ocorra de forma resiliente, mesmo em caso de falhas na transação da principal. (Ajustar o `enviarSimulacaoImpl` chamado via background).

### 5. Limpeza de Logs e Mensagens
- **Onde**: `src/lib/simulacao/enviar.server.ts`
- **O que**: Remover mensagens de "Enviando..." quando o banco já está simulado ou em erro.

## Detalhes Técnicos
- Alteração em `payloadOp.bancos` em `enviar.server.ts` para `flagSimulacao: "N"`.
- Implementação de `if (b.homefin_id_simulacao_banco) { ... skip ... }` no motor de envio.
- Refatoração da condição `concluiu` no endpoint de reconciliação.
- Verificação de RLS e permissões para garantir que o service_role consiga atualizar os campos corretamente durante a reconciliação.

## Verificação (Aceite)
- Executar query de telemetria para confirmar que não existem mais bancos duplicados por oportunidade.
- Confirmar que o Santander sai de "aguardando" via polling sem criar novos IDs na HomeFin.
- Validar que o par Titular+Cônjuge conclui ambos os bancos.
