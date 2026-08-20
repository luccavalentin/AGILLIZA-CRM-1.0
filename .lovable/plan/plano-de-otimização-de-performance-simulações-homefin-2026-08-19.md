# Plano de Otimização de Performance - Simulações HomeFin

O objetivo é reduzir o tempo total de processamento das simulações, eliminando a serialização desnecessária entre bancos e entre sistemas (SAC/PRICE), mantendo a integridade comercial e as travas de concorrência essenciais.

## 1. Separação de Preparação e Integração
Refatorar o processamento bancário para que a criação da simulação no provedor (fase rápida) ocorra em paralelo para todos os bancos, e a integração pesada (fase lenta) seja executada com concorrência controlada.

- **Fase A (Preparação):** Validar, obter IDs de simulação bancária e persistir no banco local.
- **Fase B (Integração):** Chamar o endpoint de integração (`/integracao`) de forma assíncrona.

## 2. Otimização de Fila e Concorrência
- **Fila Independente por Banco:** Remover integrações da fila serial da simulação (`_hf_queue_<simulacao_id>`) e utilizar chaves específicas por banco/ID, permitindo que bancos rápidos não esperem por lentos.
- **Concorrência Controlada:** Limitar a `3` o número de integrações simultâneas por simulação para evitar sobrecarga no provedor.

## 3. Paralelização SAC e PRICE
Permitir que os grupos de simulação SAC e PRICE processem simultaneamente quando pertencerem a oportunidades independentes.

## 4. Eficiência de Orquestração
- **Deduplicação de Polling:** Garantir que disparos do reconciliador sejam únicos por janela de tempo curta.
- **Evitar Reprocessamento:** Otimizar a montagem do plano de execução para que cada combinação sistema/prazo seja processada exatamente uma vez.

## Detalhes Técnicos
- Alteração em `src/lib/simulacao/homefin.server.ts` para permitir execução paralela de integrações.
- Refatoração de `src/lib/simulacao/enviar.server.ts` para implementar o fluxo de duas fases (Preparação + Integração).
- Ajuste em `src/lib/simulacao/use-simulacao-completa/envio.ts` para orquestrar SAC e PRICE em paralelo.
- Implementação de telemetria estendida (`scenario_wait_ms`) para monitoramento.

**Segurança:** Todas as travas de concorrência para criação de `/oportunidade` e `/participante` serão mantidas. Não haverá alterações em payloads ou regras financeiras.