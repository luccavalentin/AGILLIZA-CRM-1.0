# QA Final 2.0 — Roteiro de Homologação Ponta a Ponta

> Executar após todas as etapas concluídas. Substitui `11-qa-homologacao.md`.

## 1. Objetivo

Validar segurança, permissões, fluxo comercial completo, integração bancária (polling), LGPD, App Cliente, Portal do Parceiro unificado, RH, chats, mobile e qualidade técnica. Entregar **Relatório de QA** com falhas por severidade.

## 2. Ambiente

- **Nenhum dado mockado.** Referência de domínio já semeada (níveis, etapas, tipos de doc, bancos). Todo dado de teste criado pelo QA durante o roteiro; limpar ou prefixar `[QA]` no final.
- **Integração Bancária** apontando para sandbox real (`HOMEFIN_BASE_URL` de homologação). Nunca substituir resposta por fake; se sandbox cair, marca `PENDENTE`.
- Contas criadas no início: 1 admin, 1 correspondente-raiz (auto-cadastro), 1 gestor, 1 comercial, 1 analista, 1 financeiro, 1 imobiliária, 1 corretor. Cliente do App: cadastrar no CRM durante Bloco H.

## 3. Ferramentas

- Playwright headless em 375×667, 768×1024, 1280×800.
- Console + network capturados por sessão.
- SQL direto no Supabase para validar RLS.
- Screenshots por bloco em `/tmp/browser/qa/`.

## 4. Blocos

### A — Segurança e Auth

- A1: login errado → mensagem genérica; contador; 5 fails → bloqueio 15min.
- A2: perfil `ativo=false` → não entra.
- A3: sessão expira → redirect `/auth`.
- A4: XSS `<script>` em nome cliente → sanitizado.
- A5: SQL injection em busca global → sem impacto (parametrizada).
- A6: server fn protegida sem token → 401.
- A7: server fn admin com role `analista` → 403.
- A8: cookie `agz_cliente_app` → HttpOnly + Secure + SameSite=Lax.
- A9: **reprompt de senha** obrigatório em ação crítica admin (2.0).

### B — Permissões e escopo

- B1: correspondente desmarca `financeiro:view` para analista → analista NÃO vê o item.
- B2: analista URL direta `/financeiro/painel` → 403.
- B3: corretor escopo `proprios` em `crm.clientes` → só seus + vinculados via `cliente_parceiros`.
- B4: gestor escopo `equipe` → membros da equipe, não outros.
- B5: sem `pii:view` → CPF mascarado (`123.***.***-45`) na tela, XLSX e PDF.
- B6: **escopo personalizado** (2.0) — permission_escopo_alvos filtra corretamente.
- B7: parceiro `portal_parceiro` logado em `/auth` → recusa + redirect `/parceiro`.

### C — Fluxo comercial (Simulação → Proposta → Contrato)

- C1: simulação COMPLETA com 3 bancos + cônjuge + LGPD/SCR.
- C2: envio → `homefin_auth_cache` populado; 3 linhas em `simulacao_bancos` `aguardando`.
- C3: retorno real da sandbox → status `simulada`; ordenadas por menor parcela.
- C4: reenvio sem LGPD → bloqueado.
- C5: duplicar → nova simulação preserva LGPD/SCR.
- C6: Promover a Proposta com banco X → `PRO-######` + snapshot congelado.
- C7: editar simulação → proposta NÃO altera.
- C8: enviar proposta sem doc obrigatório → bloqueio.
- C9: upload doc >10MB ou mimetype não-whitelisted → rejeitado.
- C10: enviar ao banco → `enviada_banco`; esteira `banco_remessa_1`.
- C11: cron `/api/public/sync-propostas` chama `sincronizarProposta` → status atualiza; esteira `vistoria_agendada` ao `credito_aprovado`.
- C12: `contrato_emitido` → CR + CP parceiro + `comissoes_usuario` criadas.
- C13: cancelar com motivo curto (<5) → bloqueio; com válido → cancela + propaga.
- C14: bifurcação: `credito_recusado` → timeline encerra; etapas seguintes desabilitadas.
- C15: reenvio isolado por banco funciona (Santander HE Somahome).

### D — Integração Bancária (campo a campo)

- D1: payload `POST /oportunidade` — obrigatórios presentes; CPF/celular só dígitos; data ISO.
- D2: bancos `flagSimulacao='S'`.
- D3: simulação por banco `fgAutorizacaoDados=true`.
- D4: update usa `PUT` (não novo POST).
- D5: docs multipart correto + `POST /incluir-documentos-integracao`.
- D6: auth token cache ~55min.
- D7: PII mascarada em `proposta_logs_homefin`.
- D8: **sem webhook** (2.0) — apenas polling; `/api/public/homefin/callback` inexistente ou removida.
- D9: cron `/api/public/sync-propostas` bloqueado sem `CRON_SECRET`.
- D10: Santander HE Somahome (`idOperacao=6`, `idBanco=96`) usa endereço completo + Mãe/Sexo/Profissão.

### E — CRM e Esteira

- E1..E7: mesmos do v1 (criar cliente → cadastro_basico; endereço → cadastro_completo; simulação → simulacao; retorno → aprovacao; enviar → banco_remessa_1; contrato → contrato_emitido; nunca retrocede).
- E8: Portal do Cliente habilitado → login em `/portal` OK; revogado → falha imediatamente.
- E9: chat CRM 3 colunas: etiqueta cria/aplica; filtro funciona; SLA vencido → badge.
- E10: Scan IA gera leitura + auditoria + campos com confiança.

### F — App Cliente

- F1: `validarAcessoCliente` documento inexistente → resposta genérica.
- F2: rate-limit — 5 fails/15min soft; 10 → 24h hard.
- F3: login OK → cookie selado; sem `cliente_id` no body.
- F4: modificar body de `clienteObterProcesso` com cliente_id alheio → 403.
- F5: etapa muda no interno → App reflete <5s.
- F6: upload câmera mobile OK.
- F7: PWA instalável (manifest válido, ícones 192/512).
- F8: sessão 8h expira → redirect `/portal`.
- F9: LGPD "Baixar dados" → ZIP em <10s; "Solicitar exclusão" → demanda para DPO.
- F10: chat piscando + som ao receber msg em background.

### G — Portal do Parceiro Unificado (2.0)

- G1: corretor logado usa shell interno; nav reduzida (Clientes/Simulações/Propostas/Comissões/Documentos/Chat).
- G2: `/admin/*` → 403.
- G3: só vê clientes vinculados via `cliente_parceiros`.
- G4: comissão vê apenas próprio split.
- G5: rotas antigas `/parceiro/clientes` etc. redirecionam para rotas internas.

### H — Mobile / A11y

- H1: 375px — TODOS os Select do sistema abrem/tocam.
- H2: form simulação completa navegável mobile.
- H3: Kanban usável em tablet.
- H4: contraste AA nos dois temas.
- H5: foco visível em todos os interativos.
- H6: sem overflow horizontal em ≥320px.

### I — Financeiro

- I1: cálculo comissão bate com `comissao_regras`.
- I2: baixa parcial → `parcial`.
- I3: estorno cria nova linha + motivo obrigatório.
- I4: recorrência gera próxima ocorrência.
- I5: comissões_usuario (repasses) recalculam ao mudar %.
- I6: RH → CP idempotente por `(funcionario_id, competencia)`.
- I7: papel `financeiro` acessa módulo completo.

### J — Relatórios (2.0)

- J1: painel geral carrega <1s.
- J2: filtros persistem via query string.
- J3: XLSX e PDF (portrait/landscape) abrem sem quebra; PII mascarada se sem permissão.
- J4: export loga em `report_audit_logs` com hash de filtros.
- J5: cache invalida quando status de proposta muda.
- J6: `runReport` engine única atende os 18 recortes.
- J7: rate-limit de export (10/hora/usuário) funciona; PDF grande vai para job assíncrono.
- J8: constructor de personalizados salva/carrega.

### K — RH (2.0 — novo)

- K1: cadastrar funcionário com CEP → auto-preenche endereço via ViaCEP.
- K2: vincular a usuário do sistema → auto-preenche nome/CPF/e-mail.
- K3: dia de pagamento + toggle "Gerar CP automático" → CP criado com `origem_ref` idempotente.
- K4: PDF ficha do funcionário sai portrait com marca d'água.
- K5: holerite calcula INSS/IRRF 2025 corretamente.
- K6: prévia da folha bate com holerite gerado.
- K7: status "em experiência" automático até 90d.
- K8: férias vencendo/vencidas geram alerta.

### L — Chats (2.0 — novo)

- L1: Central de Chats (`/operacional/chats`) mostra clientes + DMs + demandas.
- L2: som + piscar em chat minimizado (respeitando pref usuário).
- L3: `{numero_proposta}` substituído nos templates do chat CRM.
- L4: chat da demanda tem indicador digitando + realtime + threading.

### M — Qualidade técnica

- M1: `bun run build:dev` OK sem warning.
- M2: `tsgo` sem erro.
- M3: zero `console.log` em produção.
- M4: sem imports mortos.
- M5: sem `any` sem justificativa.
- M6: SSR: nenhum `window is not defined` em prerender.
- M7: bundle inicial <300KB gzip.
- M8: nenhum secret em `.env` commitado.
- M9: `rg -i "homefin|lovable"` limpo no que é renderizado.
- M10: `supabase--linter` sem warning novo.

## 5. Formato do relatório final

```
# Relatório de QA — {data}
## Sumário executivo
- Blocos testados: A–M
- Aprovados: X/Y
- Reprovados: Z falhas (Crítica: n, Alta: n, Média: n, Baixa: n)

## Falhas por severidade
### Crítica
- [ID] Título — passo p/ reproduzir — evidência — fix proposto
### Alta / Média / Baixa
- ...

## Anexos
- Screenshots em /qa-report/screenshots/
- Queries SQL em /qa-report/sql/
- Logs HAR em /qa-report/har/
```

## 6. Critérios de severidade

- **Crítica**: vazamento de PII, bypass de auth/permissão, perda de dado, cálculo financeiro errado, falha no envio ao banco, cross-tenant leak.
- **Alta**: fluxo comercial quebrado, mobile inutilizável em tela crítica, notificação essencial não dispara, LGPD "Baixar meus dados" falha.
- **Média**: UX ruim, mensagem confusa, performance abaixo do alvo.
- **Baixa**: cosmético, texto, alinhamento.

## 7. DoD do QA

Sistema aprovado quando: 0 críticas, 0 altas, ≤5 médias documentadas com plano.
