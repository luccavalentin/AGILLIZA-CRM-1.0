# Plano de Correção: Trava de Idade e Performance HomeFin

## 1. Trava de Idade (Segurança no Servidor e UI)

### Servidor (`src/lib/simulacao/enviar.server.ts`)
- Mover a validação de prazo para **antes** de qualquer chamada de API (incluindo autenticação).
- Utilizar `prazoMaximoParaProponentes` para calcular o teto dinâmico (963 meses).
- Se `sim.prazo > teto`, lançar erro descritivo interrompendo o fluxo e registrando no banco o motivo.
- Arquivo e linha alvo: `src/lib/simulacao/enviar.server.ts`, por volta da linha 11.

### UI (`src/components/simulacao/completa/secao-operacao-imovel.tsx`)
- Garantir que `ajustarPrazoPorIdade` seja disparado no `onBlur` de **ambos** os campos de prazo (`prazo` e `prazo_2`).
- Aplicar o atributo `max` aos inputs e garantir que atalhos (360/420) fiquem desabilitados visualmente quando excederem o limite.

## 2. Otimização de Performance (Gaps e Redundância)

### Gaps de Espera e Telemetria (`src/lib/simulacao/homefin.server.ts`)
- Instrumentar as chamadas com `queue_wait_ms` (tempo na fila global de serialização) e `api_duration_ms` (tempo real da resposta HTTP).
- Logs detalhados para identificar se o gargalo é interno ou externo.

### Redundância e Paralelismo (`src/lib/simulacao/enviar.server.ts`)
- **Eliminar GETs e PUTs repetidos**: Otimizar a preparação da oportunidade. Atualmente, o fluxo faz chamadas redundantes de "Preparação" antes das integrações.
- **Processamento por Oportunidade**: Agrupar todas as simulações da mesma oportunidade bancária para serem processadas em um único bloco, evitando alternância (`25287 -> 25289 -> 25287`).
- **Cache de Participante**: Garantir que o participante seja criado/atualizado apenas uma vez por oportunidade.

## 3. Critérios de Aceite (SQL)
- Validar via SQL que nenhuma simulação nova (`created_at > agora`) possui prazo acima do teto calculado por proponente.
- Validar via logs que não existem gaps de 5s+ entre chamadas preparação -> integração.
