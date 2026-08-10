# QA Final — Roteiro de Homologação Ponta a Ponta

> Executar SOMENTE após todas as 10 etapas concluídas. Este é o prompt para um agente QA (humano ou IA) auditar o sistema recém-construído.

## Objetivo

Validar segurança, permissões, fluxo comercial completo, integração com o provedor bancário, LGPD, App Cliente, Portal Parceiro, mobile e qualidade técnica. Entregar **Relatório de QA** com falhas classificadas por severidade.

## Ambiente

- **Nenhum dado mockado. Nenhum seed de negócio.** A base contém apenas dados de referência (níveis de acesso, etapas de pipeline, tipos de documento, bancos). Todo dado de teste é criado pelo próprio QA durante o roteiro, via UI ou SQL registrado no relatório, e removido ao final (ou marcado com prefixo `[QA]` para limpeza).
- HomeFin apontando para **sandbox real** (`HOMEFIN_BASE_URL` de homologação, credenciais de teste fornecidas pelo provedor de integração). Proibido substituir chamadas por resposta falsa; se a sandbox estiver fora, o bloco fica bloqueado e é reportado — não se inventa retorno.
- Contas de usuário criadas pelo QA no início: 1 admin, 1 gestor, 1 imobiliária, 1 corretor, 1 comercial, 1 analista. Clientes, simulações e propostas são criados durante os blocos C–H (não pré-existem).
- Cliente do App: cadastrar 1 cliente real no início do Bloco H e habilitar o App durante o teste.

## Ferramentas

- Playwright headless nos 3 breakpoints: 375×667, 768×1024, 1280×800.
- Console/network capturados por sessão.
- SQL direto no Supabase para validar RLS.
- Prints obrigatórios de cada bloco.

## Blocos de teste

### Bloco A — Segurança e Auth

A1. Login com credencial errada → mensagem genérica; contador incrementa; após 5 tentativas → bloqueio 15 min.
A2. Login com perfil `ativo=false` → não entra; toast “Conta inativa”.
A3. Sessão expira; ao tentar navegar em `_authenticated` → redireciona `/auth`.
A4. XSS: injetar `<script>alert(1)</script>` em campo nome cliente → sanitizado no render.
A5. SQL injection em busca global → sem impacto (query parametrizada).
A6. Chamar server function protegida sem cookie/token → 401.
A7. Chamar server function admin com role `analista` → 403.
A8. Cookie `agz_cliente_app` inspecionado → `HttpOnly` + `Secure` + `SameSite=Lax`.

### Bloco B — Permissões (Matriz)

B1. Admin desmarca `financeiro:view` para `analista` → analista logado NÃO vê item “Financeiro” na sidebar.
B2. Analista tenta URL direta `/financeiro/painel` → 403.
B3. Corretor com escopo `proprios` em `crm.clientes` → só lista seus clientes; SQL prova (`SELECT count(*) FROM clientes` via UI vs. via service_role).
B4. Gestor com escopo `equipe` vê clientes dos membros da equipe, não outros.
B5. Sem `pii:view`, CPF exibido mascarado (`123.***.***-45`); export XLSX também mascarado.

### Bloco C — Fluxo Comercial (Simulação → Proposta → Contrato)

C1. Criar simulação COMPLETA com 3 bancos, cônjuge, LGPD/SCR marcados.
C2. Enviar ao provedor de integração → verificar `homefin_auth_cache` populado; 3 linhas em `simulacao_bancos` com `status='aguardando'`.
C3. Aguardar retorno **real da sandbox do provedor de integração** → status vira `simulada`; parcelas visíveis; ordenadas por menor parcela. Se sandbox demorar, validar polling e timeout — nunca forjar resposta.
C4. Reenviar sem consentimento LGPD → bloqueado com mensagem clara.
C5. Duplicar → nova simulação preserva LGPD/SCR e todos os campos operacionais.
C6. Promover a Proposta com banco X → `PRO-######` gerado; snapshot congelado.
C7. Editar simulação depois → proposta NÃO altera (snapshot).
C8. Enviar proposta sem doc obrigatório → bloqueio.
C9. Upload doc >10MB → rejeitado antes do upload.
C10. Enviar ao banco → status vira `enviada_banco`; cliente na esteira em `banco_remessa_1`.
C11. Simular callback `credito_aprovado` → status atualiza; esteira em `vistoria_agendada`.
C12. Simular `contrato_emitido` → conta a receber + conta a pagar parceiro criadas com valores corretos (validar por `comissao_regras`).
C13. Cancelar proposta com motivo "abc" → bloqueio (mín 5 chars); com motivo válido → cancela + propaga ao provedor de integração.

### Bloco D — Integração com o provedor bancário (campo a campo)

D1. Payload `POST /oportunidade` inspecionado: todos os campos obrigatórios presentes; CPF só dígitos; celular só dígitos com DDD; data ISO.
D2. Bancos: `flagSimulacao='S'` para os selecionados.
D3. Simulação por banco: `fgAutorizacaoDados=true` sempre.
D4. Update de simulação usa `PUT` (não novo `POST`).
D5. Documento upload: multipart correto; ao final, `POST /incluir-documentos-integracao` disparado.
D6. Webhook `/api/public/homefin/callback` com HMAC inválido → 401 + log.
D7. Auth token cacheado por ~55 min (validar timestamp).
D8. PII mascarada em `proposta_logs_homefin` (nenhum CPF completo em `request_payload`).

### Bloco E — CRM e Esteira

E1. Criar cliente → esteira em `cadastro_basico`.
E2. Preencher endereço com CEP válido → avança para `cadastro_completo`.
E3. Criar simulação → `simulacao`.
E4. Simulação com retorno positivo → `aprovacao`.
E5. Proposta enviada → `banco_remessa_1`.
E6. Contrato emitido → `contrato_emitido`.
E7. Nunca retrocede: forçar `avancar_para('cadastro_basico')` quando está em `simulacao` → sem efeito.

### Bloco F — App Cliente

F1. `clienteRequestCode` com documento inexistente → resposta genérica (não revela); código não enviado.
F2. Rate-limit: 4º código em 1h → bloqueado.
F3. Login OK → cookie selado; ao inspecionar body, não há `cliente_id` reutilizável.
F4. Modificar body de `clienteObterProcesso` para `cliente_id` de outro → 403 (session prevalece).
F5. Etapa avançou no interno → App atualiza em <5s (realtime).
F6. Upload de foto pela câmera (mobile) → aparece na lista de docs.
F7. PWA instalável (manifest válido, ícones 192/512).
F8. Sessão 8h expira → redireciona `/auth`.

### Bloco G — Portal Parceiro

G1. Corretor logado vê exatamente: Meus Clientes, Simulações, Propostas, Comissões, Documentos.
G2. Tentar `/admin/*` → 403.
G3. Vê SOMENTE clientes onde é parceiro/responsável.
G4. Comissão vista mostra só o split parceiro.

### Bloco H — Mobile / A11y

H1. 375px: TODOS os `<Select>` do sistema abrem e permitem tocar em opção (fix do Viewport height).
H2. Formulário simulação completa navegável mobile.
H3. Kanban usável no tablet.
H4. Contraste AA em textos.
H5. Foco visível em todos os interativos (`focus-visible:ring`).
H6. Sem overflow horizontal em 320px.

### Bloco I — Financeiro

I1. Cálculo comissão bate com `comissao_regras`.
I2. Baixa parcial → status `parcial`.
I3. Estorno cria nova linha e reverte KPIs.
I4. Recorrência gera próxima ocorrência.

### Bloco J — Relatórios

J1. Painel geral carrega <1s com volume real de produção (medir com dados existentes no ambiente de homologação; não gerar propostas fake para "inflar" métrica — se volume for baixo, registrar no relatório e reavaliar após rollout).
J2. Filtros persistem por query string.
J3. XLSX abre no Excel sem quebra; PII mascarada se sem permissão.
J4. Export loga em `report_audit_logs`.

### Bloco K — Qualidade Técnica

K1. `bun run build:dev` conclui sem warning.
K2. `tsgo` sem erro.
K3. Zero `console.log` em código de produção.
K4. Sem imports mortos.
K5. Sem `any` sem justificativa.
K6. SSR: nenhum crash `window is not defined` em prerender.
K7. Bundle inicial <300KB gzip.
K8. Nenhum secret em `.env.local` commitado.

## Formato do relatório final

```
# Relatório de QA — {data}

## Sumário executivo
- Blocos testados: A–K
- Aprovados: X/Y
- Reprovados: Z falhas (Crítica: n, Alta: n, Média: n, Baixa: n)

## Falhas por severidade

### Crítica (bloqueia produção)
- [ID] Título — passo p/ reproduzir — evidência (screenshot/log) — fix proposto

### Alta (bloqueia release)
- ...

### Média (deve ser corrigido no ciclo)
- ...

### Baixa (backlog)
- ...

## Anexos
- Screenshots em /qa-report/screenshots/
- Queries SQL executadas em /qa-report/sql/
- Logs HAR em /qa-report/har/
```

## Critérios de severidade

- **Crítica**: perda de dado, vazamento de PII, bypass de auth/permissão, cálculo financeiro errado, falha no envio ao provedor de integração.
- **Alta**: fluxo comercial quebrado, mobile inutilizável em telas críticas, notificação essencial não dispara.
- **Média**: UX ruim, mensagem confusa, performance abaixo do alvo.
- **Baixa**: cosmético, texto, alinhamento.

## Definition of Done do QA

Sistema aprovado quando: 0 críticas, 0 altas, ≤ 5 médias documentadas com plano.
