# Etapa 04 — Simulações + Integração Bancária (APROFUNDADA)

> **Marca branca**: nesta etapa, nenhum texto visível ao usuário pode conter "HomeFin", "Lovable" ou nome de fornecedor de infra. Ver regra em `00-convencoes-globais.md → Marca branca / Nomenclatura`. Rótulos, botões, mensagens de erro, PDFs, `<title>`, notificações e badges usam **"Integração Bancária"**, **"Enviar ao banco"**, **"Ambiente de homologação"**, **"Logs de Integração"**. Identificadores técnicos internos (nomes de tabelas, colunas, env vars, server fns) permanecem como estão.

> Requer Etapas 01–03.

## Dependências e Produtos
**Depende de:** 00 (seed de bancos: Bradesco/Santander/Itaú `ativo=true`; Inter/Caixa cadastrados inativos), 00b, **01** (RLS/`correspondente_id`), **02** (shell + notificações), **03** (`clientes`, `documentos`, `pipeline_stages`, ação "Puxar do CRM"), **10** (credenciais do provedor bancário — em dev usa `.env`, em runtime lê de `banco_credenciais` mantida pela Etapa 10).
**Produz (consumido por 05, 06, 08, 09, 10):**
- Tabelas: `simulacoes` (com `homefin_id_oportunidade`, `status`, snapshot do cliente/imóvel), `simulacao_bancos` (retorno por banco), `logs_integracao` (todas chamadas ao provedor).
- Server fns: `criarSimulacao`, `enviarSimulacaoBanco`, `receberRetornoSimulacao` (webhook), `gerarPdfSimulacao`.
- Handler webhook `/api/public/webhook/homefin/simulacao` — Etapa 10 mostra logs e status; Etapa 08 usa para KPI de conversão.
- **NÃO** define `criarProposta` — apenas dispara para Etapa 05 via botão "Promover a Proposta" chamando `criarProposta({simulacao_id, banco_id})` (definido em 05).


## Fontes autoritativas da HomeFin (pasta `Logos e a API/APIS/`)
Antes de escrever **qualquer** chamada, ler:
- `Logos e a API/APIS/4 - swagger-output 29012026.json` — contrato OpenAPI oficial. **Gerar tipos** com `openapi-typescript` para `src/integrations/homefin/types.ts` e usar em todos os `createServerFn`. Nunca tipar `any` nem inventar campos.
- `Logos e a API/APIS/2 - Documentacao API Homefin.pdf` — regras funcionais (obrigatórios por produto, comportamento por banco, códigos de erro).
- `Logos e a API/APIS/3 - Fluxograma API Homefin.pdf` e `1 - image001.png` — fluxo Oportunidade → Simulação → Proposta → Contrato.
- `Logos e a API/APIS/5 - API Homefin.postman_collection.json` — importar no Postman para validar payloads antes de codar.

**PDF gerado da simulação** deve usar a logo Agilliza de `Logos e a API/Logo PNG/` (variação horizontal) no cabeçalho e `Logos e a API/Logo Vetor/AGILLIZA-LOGO.pdf` como referência de proporção.


## Objetivo do módulo
Coletar dados do cliente + imóvel + operação, criar uma **Oportunidade** no provedor de integração bancária, disparar **Simulações** contra 1..N bancos parceiros **ativos** e receber os retornos (parcela, taxa, prazo máximo, IOF), exibir comparativo, gerar PDF e permitir promover uma simulação escolhida para **Proposta** (Etapa 05).

**Bancos disponíveis para envio** (regra fixa — ver `00-convencoes-globais.md → Bancos parceiros`): por padrão do seed, apenas **Bradesco, Santander e Itaú** ficam ativos (`bancos_parceiros.ativo=true`, `flag_padrao=true`) e aparecem nos seletores. **Inter** e **Caixa** já vêm pré-cadastrados com `ativo=false` e só entram nos seletores quando o correspondente habilitá-los em `/admin/bancos` (após cadastrar credenciais e passar no teste de conectividade). Toda tela que lista bancos consome a view `vw_bancos_ativos` — nunca hardcode a lista.

## Fluxo lógico ponta a ponta
1. Usuário abre `/operacional/simulacoes/rapida` (menos campos) ou `/completa` (todos os campos + cônjuge + bancos).
2. Preenche formulário → validação Zod (client + server).
3. Server function `criarSimulacao` grava em `simulacoes` (status `rascunho`), gera `numero_simulacao` (`SIM-######` via trigger).
4. Server function `enviarHomeFin(simulacao_id)`:
   a. `POST /auth/token` (com cache de 55 min em `homefin_auth_cache`).
   b. `POST /oportunidade` — cria Oportunidade única (guarda `homefin_id_oportunidade`).
   c. Para cada banco selecionado: `POST /oportunidade/{id}/simulacao` (retorna `idSimulacao` HomeFin) e `POST /oportunidade/{id}/simulacao/{idSimulacao}/integracao` (dispara integração real com o banco escolhido).
   d. Se todos retornaram valores válidos → `simulacoes.status = 'simulada'`. Se parcial → `'parcialmente_simulada'`. Se nenhum → `'erro_banco'` com detalhe humanizado (via `bank-error-humanizer`).
5. Trigger `simulacao_sincronizar_esteira` avança cliente na esteira.
6. Usuário compara os retornos por banco na tela de detalhe (`/operacional/simulacoes/$id`) — colunas: banco, parcela, taxa, prazo máximo, valor máx financiável, IOF, sistema (SAC/PRICE), status, mensagem do banco.
7. PDF gerado sob demanda (`/simulacoes/$id/pdf`) e armazenado em `simulacao-pdfs`.
8. Botão **"Promover a Proposta"** escolhe um `simulacao_bancos` e chama a server function `criarProposta({simulacao_id, banco_id})` da Etapa 05 (não criar função nova nesta etapa).

## Paridade com o site público de simulação Agilliza (`simular.homefin.com.br/financiamento/agilliza`)

O formulário interno **deve reproduzir 1:1** a experiência do site público de simulação (marca Agilliza), com a mesma ordem, mesmos rótulos e mesmos widgets, acrescido dos blocos que só existem no CRM (cônjuge, composição de renda, bancos, LGPD/SCR, escopo). Layout de referência: **duas colunas** — coluna esquerda cinza-claro com hero/marca Agilliza (logo + frase "Trabalhamos com os maiores bancos do mercado…"), coluna direita com o wizard/form. Em telas < md colapsa para uma coluna. **Nunca** exibir nome do provedor de integração em qualquer texto renderizado — a URL do site é referência técnica, não aparece como label na UI.

### `/operacional/simulacoes/nova` — wizard inicial (idêntico ao público)
Passo único, mesmos campos e mesma ordem do site público:

1. **Produto** (Select) — `Financiamento Imobiliário | Home Equity`.
2. **Valor do imóvel que deseja financiar** * — máscara `R$ 0,00`, tooltip `?`.
3. **Valor da entrada** * — máscara `R$ 0,00`, tooltip `?`.
4. **Valor do crédito que precisa** * — máscara `R$ 0,00`, tooltip `?`. Calculado automaticamente = `valor_imovel - valor_entrada`, mas editável (se editado, recalcula entrada).
5. **Você já possui o imóvel escolhido?** — radio inline: `Sim, já tenho um imóvel escolhido` / `Não, ainda estou pesquisando`. Grava em `simulacoes.possui_imovel_escolhido BOOL`.
6. **Informe sua data de nascimento** * — input `dd/mm/aaaa`, tooltip `?`.
7. **Em quantos anos irá financiar** * — input numérico com sufixo "anos", placeholder `0 anos`, tooltip `?`. Convertido para `prazo` (meses = anos × 12) no submit.

Rodapé com dois botões grandes, azul-marinho (`brand`), largura ~50/50:
- **SIMULAÇÃO RÁPIDA** → cálculo local (lib atual `simulacao-rapida.ts`), sem chamada ao provedor de integração, sem OTP. Abre resultado imediato.
- **SIMULAÇÃO PERSONALIZADA** → abre **modal de verificação por e-mail** (OTP servido pelo provedor de integração — rótulos na UI dizem apenas "Verificação por e-mail" / "Código de verificação") e, após validado, expande para o formulário completo.

### Modal `Solicitar Simulação Personalizada` (OTP e-mail — idêntico ao público)
Título: **"Solicitar Simulação Personalizada"** com botão `×`.
- **E-mail** * — input.
- **Código de verificação** — input (habilita após "Enviar código").
- Botões: `Cancelar` / `Enviar código` / `Validar código`.
- Fluxo: `Enviar código` chama server fn `enviarOtpHomeFin({ email })` → endpoint HomeFin de verificação de e-mail (usar o método que a coleção Postman documenta para gerar o token de e-mail). Guarda em `homefin_email_otp(email, token_hash, expires_at, tentativas)`. `Validar código` chama `validarOtpHomeFin({ email, codigo })` → marca `simulacoes.email_verificado_em`, `email_verificado_por='homefin_otp'`. Só após validado o modal fecha e o formulário Personalizada é revelado.
- Rate limit: 5 tentativas / 15 min por e-mail; código expira em 10 min; reenvio libera após 60s.

### `/operacional/simulacoes/rapida`
Ao clicar `Simulação Rápida` no wizard, mostra na mesma tela (abaixo do wizard ou em drawer) o comparativo local **restrito aos bancos retornados por `vw_bancos_ativos`** (por padrão do seed: Bradesco, Santander, Itaú — se o correspondente habilitar Inter/Caixa em `/admin/bancos`, entram automaticamente) e botão "Baixar PDF" (`baixarPdfSimulacaoRapida`). Persiste em `simulacoes` com `tipo_simulacao='simplificada'` **apenas** se o usuário clicar "Salvar no CRM" (opcional).

### `/operacional/simulacoes/completa` (Simulação Personalizada)
Só é acessível após OTP validado (ou a partir do CRM, pulando OTP quando o cliente já tem `email_verificado_em`). Ordem e rótulos **iguais ao modal do site público**, na mesma sequência:

**Bloco 1 — Operação/Imóvel** (grid 2 colunas):
- **Operação** * (Select "Selecione") — filtrado por Produto.
- **Tipo de Imóvel** * (Select "Selecione") — AP/CS/GA/TE/TC.
- **Uso do Imóvel** * (Select "Selecione") — R/C.
- **Situação do Imóvel** * (Select "Selecione") — N (Novo) / U (Usado).
- **UF** * (Select "Selecione").
- Divider.
- **Valor do Imóvel (R$)** * — pré-preenchido do wizard.
- **Valor de Entrada (R$)** * — pré-preenchido do wizard.
- **Prazo (meses)** * — pré-preenchido (anos × 12), editável.
- **Utiliza FGTS?** * (Select "Selecione") — S/N.
- **Sistema de Amortização** * (Select "Selecione / SAC / PRICE") — grava `S`/`P`.
- Divider.

**Bloco 2 — Titular** (grid 2 colunas, mesma ordem do público):
- **Nome** *
- **CPF/CNPJ** *
- **Renda Total (R$)** *
- **Data de Nascimento** * — pré-preenchida do wizard.
- **Estado Civil** * (Select "Selecione").
- **E-mail** * — pré-preenchido do OTP, readonly.
- **Celular** *

**Bloco 3 — Cônjuge / Composição de renda** (**só CRM, não existe no público**):
Aparece quando `estado_civil ∈ {CA, UE}` OU `compoe_renda=true`. Mesmos campos do bloco Titular para o cônjuge/coobrigado.

**Bloco 4 — Bancos** (**só CRM**): multi-select alimentado pela view `vw_bancos_ativos` (equivalente a `SELECT * FROM bancos_parceiros WHERE ativo=true ORDER BY ordem, nome`). Default marcado = registros com `flag_padrao=true` (no seed: Bradesco, Santander, Itaú). Bancos com `ativo=false` (Inter, Caixa no seed) **não aparecem** aqui — só passam a aparecer depois de habilitados em `/admin/bancos`. Se `vw_bancos_ativos` retornar vazio, mostrar empty state "Nenhum banco habilitado — abra Configurações → Bancos para ativar" e bloquear o envio.

**Bloco 5 — Consentimentos** (**só CRM, obrigatório**): 2 checkboxes LGPD + SCR/Bacen.

Botão final único: **"Enviar solicitação"** (mesmo rótulo do site público) — dispara `criarSimulacao` + `enviarHomeFin`.

### `/operacional/simulacoes/$id` — detalhe
- Header: `SIM-######`, cliente, produto, status, criado em, responsável.
- Card "Dados enviados" (colapsável).
- **Tabela de retornos por banco** (uma linha por `simulacao_bancos`): banco, situação, valor parcela, taxa aa, prazo máx, valor máx financiável, sistema, indexador, IOF, mensagem. Botões visíveis ao usuário: **"Reenviar ao banco"**, **"Ver payload"** (só para papéis com permissão de auditoria), **"Escolher e criar Proposta"**. Nenhum rótulo pode conter o nome do provedor de integração.
- Aba "Histórico" (`simulacao_historico`).
- Aba "Documentos" (opcional).
- Botão "Gerar PDF", "Duplicar simulação", "Editar".

### `/operacional/simulacoes/minhas`, `/gerais`, `/consultar`
- **Minhas**: escopo `proprios`. **Gerais**: escopo `todos` (checado por RLS).
- **Consultar**: busca por número, cliente, documento, período, status.
- Colunas: número, cliente, produto, valor, prazo, banco escolhido, status, criado.

### `/operacional/simulacoes/$id/editar`
Reabre o form completo pré-preenchido; ao salvar, se já tinha ido para HomeFin, força `reenviarHomeFin` (nova versão). Pula OTP (e-mail já verificado).

## Estrutura de dados
### `simulacoes` (58 colunas)
Campos-chave a garantir:
- `id`, `numero_simulacao`, `tipo_simulacao` ('simplificada'|'completa'), `status` enum: rascunho, enviando, simulada, parcialmente_simulada, erro_banco, expirada, cancelada, promovida.
- Cliente: `cliente_id`, `cpf_cnpj`, `nome_cliente`, `email`, `celular`, `data_nascimento`, `renda_total`, `estado_civil`, `possui_conjuge`, `compoe_renda`, `nome_conjuge`, `cpf_conjuge`, `data_nascimento_conjuge`, `email_conjuge`, `celular_conjuge`, `renda_conjuge`, `estado_civil_conjuge`.
- Operação: `produto`, `id_operacao_homefin`, `tipo_imovel`, `uso_imovel`, `situacao_imovel` ('N'|'U'), `uf`, `cep_imovel`, `valor_imovel`, `valor_entrada`, `valor_financiamento`, `prazo` (meses), `prazo_anos` (INT, snapshot do wizard), `possui_imovel_escolhido` BOOL, `utiliza_fgts`, `fg_financiar_despesas`, `percentual_despesas`, `sistema_amortizacao` ('S'|'P').
- Verificação e-mail (paridade site público): `email_verificado_em` TIMESTAMPTZ, `email_verificado_por` TEXT (`'homefin_otp' | 'crm'`).
- LGPD/SCR: `consentimento_lgpd` BOOL NOT NULL DEFAULT false, `consentimento_scr` BOOL NOT NULL DEFAULT false, `consentimento_ip`, `consentimento_em`.
- HomeFin: `homefin_id_oportunidade`, `codigo_oportunidade_homefin`, `ultimo_envio_em`, `ultimo_erro`.
- Escopo: `usuario_criador_id`, `usuario_responsavel_id`, `analista_id`, `comercial_id`, `parceiro_id`.

### `homefin_email_otp` (nova — verificação de e-mail do site público)
- `id`, `email` CITEXT, `token_hash` TEXT (hash do código de 6 dígitos), `expires_at`, `tentativas` INT DEFAULT 0, `used_at`, `ip`, `created_at`.
- Índice único parcial em `(email)` WHERE `used_at IS NULL AND expires_at > now()`.
- RLS: apenas server functions (service role) leem/gravam.

### `simulacao_bancos` (uma linha por banco por simulação)
- `simulacao_id`, `banco_id` FK `homefin_bancos`, `homefin_id_banco`, `codigo_banco`, `nome_banco`, `selecionado` BOOL, `flag_simulacao` ('S'/'N').
- Retornos: `homefin_id_simulacao_banco`, `valor_parcela`, `taxa_juros_ano`, `prazo_pagamento_max`, `valor_financiamento_max`, `valor_parcela_max`, `codigo_indexador`, `valor_iof`, `sistema_amortizacao_banco`.
- Status: `status_banco` ('aguardando'|'simulada'|'erro'|'expirada'), `mensagem_banco`, `raw_request` JSONB, `raw_response` JSONB, `simulado_em`.

### `simulacao_participantes`
Comprador adicional / vendedor para Home Equity, com todos os campos do participante HomeFin (ver mapeamento abaixo).

### `simulacao_historico`, `simulacao_pdfs`, `simulacao_envolvidos`

### `homefin_operacoes`, `homefin_bancos` (cache dos domínios HomeFin, refresh diário)

## API HomeFin — endpoints usados e mapeamento

Base URL: `process.env.HOMEFIN_BASE_URL`. Auth: `HOMEFIN_SECRET_ID` + `HOMEFIN_SECRET_KEY`.

### 1) `POST /auth/token`
Body: `{ secretId, secretKey }`. Retorna `{ token, expiresIn, idRegional, idParceiro, idUsuarioParceiro }`.
**Cache** em `homefin_auth_cache` por `expiresIn - 5 min`. Todo request subsequente usa `Authorization: Bearer <token>`.

### 2) `GET /dominios/operacoes` e `GET /dominios/bancos`
Refresh diário via job. Grava em `homefin_operacoes` e `homefin_bancos`.
- Operação 1 (`idOperacao=1`) = **Financiamento Imobiliário** → `produto_sistema='financiamento_imobiliario'`.
- Operação 2 (`idOperacao=2`) = **Home Equity** → `produto_sistema='home_equity'`.

### 3) `POST /oportunidade` — cria Oportunidade (uma por simulação)

**Mapeamento tela → payload** (fields do `CreateOpportunityRequest`):

| Campo HomeFin | Origem no sistema | Regra |
|---|---|---|
| `operacao.idOperacao` | `simulacoes.id_operacao_homefin` | string, do domínio |
| `regional.idRegional` | do `/auth/token` | injetado no servidor |
| `parceiro.idParceiro` | do `/auth/token` | injetado |
| `usuarioParceiro.idUsuarioParceiro` | do `/auth/token` (ou `profiles.homefin_usuario_id` se mapeado) | fallback ao geral |
| `tipoImovel.id` | `simulacoes.tipo_imovel` | AP/CS/GA/TE/TC |
| `usoImovel.id` | `simulacoes.uso_imovel` | R (Residencial) / C (Comercial) |
| `uf.codigo` | `simulacoes.uf` | 2 letras |
| `valorImovel` | `simulacoes.valor_imovel` | número, 2 casas |
| `valorFinanciamento` | `simulacoes.valor_financiamento` | número |
| `prazo` | `simulacoes.prazo` | meses (60..420) |
| `utilizaFgtsSimulacao` | `simulacoes.utiliza_fgts` | "S"/"N" |
| `bancos[]` | `simulacao_bancos WHERE selecionado=true` | `{idBanco, codigoBanco, nomeBanco, flagSimulacao:'S'}` |
| `cpfCnpj` | `simulacoes.cpf_cnpj` | só dígitos |
| `nome` | `simulacoes.nome_cliente` | |
| `rendaTotal` | `simulacoes.renda_total` | número |
| `codigoSistemaAmortizacaoBanco.id` | `simulacoes.sistema_amortizacao` | "S"/"P" |
| `dataNascimento` | `simulacoes.data_nascimento` | yyyy-MM-dd |
| `email` | `simulacoes.email` | |
| `celular` | `simulacoes.celular` | só dígitos, com DDD |
| `estadoCivil` | `simulacoes.estado_civil` | CA/S/VI/DI/SL/UE |
| `regimeCasamento` | derivado se casado | CP/CU/PA/SC/SO |
| `conjuge.*` | `nome_conjuge, cpf_conjuge, ...` | omitir bloco se `possui_conjuge=false` |
| `endereco.*` (opcional) | `cep_imovel` + campos derivados via ViaCEP | só se completa |

Resposta: `{ idOportunidade, codigoOportunidade, ... }` → gravar em `simulacoes.homefin_id_oportunidade` e `codigo_oportunidade_homefin`.

### 4) `POST /oportunidade/{idOportunidade}/simulacao` (uma vez por banco)

Body (`CreateSimulationRequest`):
- `valorImovel`, `valorFinanciamento`, `prazo`, `codigoSistemaAmortizacaoBanco.id`, `banco.idBanco`, `fgAutorizacaoDados: true` (obrigatório — vem do `consentimento_scr`).
- Opcionais no primeiro envio: `codigoOportunidadeBanco`, `valorParcelaBanco`, `taxaJurosAnoBanco`, `codigoIndexadorBanco`, `valorIofBanco`, `valorFinanciamentoBancoMax`, `valorParcelaBancoMax`, `prazoPagamentoBancoMax`.

Resposta: `{ idSimulacao }` → gravar em `simulacao_bancos.homefin_id_simulacao_banco`.

### 5) `POST /oportunidade/{id}/simulacao/{idSimulacao}/integracao`
Dispara a integração real com o banco escolhido. Assíncrono. Retorna `202 Accepted` com `{ situacao }`.
Sistema deve fazer **polling** de `GET /oportunidade/{id}` a cada 30s por até 10 min. Não há webhook HomeFin — não usar `HOMEFIN_WEBHOOK_SECRET`.


Ao receber retorno, o job atualiza `simulacao_bancos` com `valor_parcela`, `taxa_juros_ano`, `prazo_pagamento_max`, `valor_financiamento_max`, `valor_parcela_max`, `codigo_indexador`, `valor_iof`, `status_banco='simulada'`. Se erro, `status_banco='erro'` + `mensagem_banco` humanizada.

### 6) `PUT /oportunidade/{id}/simulacao/{idSimulacao}` — atualização
Usado em “Editar simulação”: `UpdateSimulationRequest` inclui `valorDespesasFinanciadas`, `valorTotalFinanciamento`, `fgFinanciarDespesas`. Só chamado quando o usuário altera algo após retorno inicial.

### 7) `POST /oportunidade/{id}/participante`
Chamado para cada `simulacao_participantes` extra (comprador coobrigatório, vendedor no home equity). Payload = `CreateParticipantRequest` (campos completos: `tipoQualificacao` CO/VD, `tipoPessoa` F/J, doc, mãe, sexo, estado civil, regime, RG, órgão, UF, profissão, empresa, renda, banco/agência/conta, contato, endereço).

## Server functions (contratos)

```ts
enviarOtpHomeFin({ email }) → { ok, expires_at }             // paridade site público
validarOtpHomeFin({ email, codigo }) → { ok, verificado_em }  // paridade site público
criarSimulacao({ modo, dados }) → { id, numero_simulacao }    // modo: 'simplificada'|'completa'; se 'completa', exige email_verificado_em
enviarHomeFin({ simulacao_id }) → { oportunidade_id, bancos: [{banco_id, idSimulacaoHomefin, status}] }
reenviarHomeFin({ simulacao_id }) → idem (valida consentimentos + bancos preenchidos antes)
obterSimulacao({ id }) → { simulacao, bancos, participantes, historico }
listarSimulacoes({ filtros, page }) → paginado, respeita escopo
listarBancosHomeFin() → cache
listarOperacoesHomeFin() → cache
duplicarSimulacao({ id }) → nova rascunho preservando LGPD/SCR/consentimentos + operacionais
gerarPdfSimulacao({ id, banco_id? }) → { pdf_url }
criarProposta({ simulacao_id, banco_id }) → { proposta_id } (definida na Etapa 05 — reutilizar, não duplicar)
```

Toda function protegida com `requireSupabaseAuth` + verifica `usuario_tem_acesso_simulacao`.

## Regras de negócio críticas
1. **Consentimento obrigatório**: `enviarHomeFin` rejeita se `consentimento_lgpd=false` OU `consentimento_scr=false`. Grava `consentimento_ip` do request.
2. **Duplicar** preserva LGPD/SCR e campos operacionais; renova `numero_simulacao`, zera retornos de banco e status.
3. **Reenviar** valida: `id_operacao_homefin` presente, ≥ 1 banco selecionado, todos os consentimentos.
4. **Idempotência**: se `homefin_id_oportunidade` já existe, usar `PUT` ao invés de novo `POST /oportunidade`.
5. **Escopo**: `listarSimulacoes` aplica `usuario_escopo_dados(uid,'operacional.simulacoes')`.
6. **Bancos**: se usuário não selecionou nenhum, usar `flag_padrao=true` do `homefin_bancos`.
7. **Timeout**: request HomeFin tem timeout 30s; se falhar, marca `status='erro_banco'` + `ultimo_erro` e permite reenvio.
8. **Logs**: gravar `proposta_logs_homefin` (ou `simulacao_logs_homefin` se criado) com endpoint, método, status HTTP, request mascarado (`mask_pii_jsonb`), response.
9. **Bank error humanizer**: mapear códigos comuns (`RENDA_INSUFICIENTE`, `DOC_INVALIDO`, `LIMITE_EXCEDIDO`, `IDADE_MAX_EXCEDIDA`) para mensagens em português.

## Regras de UI
- Overlay `Consultando...` mostra progresso banco-a-banco (via realtime em `simulacao_bancos` ou polling).
- Após retorno, ordenar bancos por menor parcela (o “melhor” fica destacado).
- Botão “Escolher e criar Proposta” só habilita em `simulacao_bancos` com `status='simulada'`.
- Mobile: form completo em stepper (5 passos) para não virar scroll infinito.

## Definition of Done
- Fluxo completo simulação → HomeFin → retorno de 3 bancos → PDF → promover para proposta funciona ponta a ponta.
- Cache `/auth/token` reusa por 55 min (verificar em `homefin_auth_cache`).
- Duplicar preserva consentimentos.
- Reenviar bloqueia sem consentimento.
- Analista com escopo `proprios` não lista simulação de outro.
- PII mascarada em `simulacao_logs_homefin`.
- Testes: 1) fluxo feliz, 2) banco retorna erro parcial (2 sim, 1 falha) → `parcialmente_simulada`, 3) reenvio sem operação → 400 amigável, 4) mobile 375px: form completo navegável.

---

## Anexo — Modal "Solicitar Simulação Personalizada" (paridade 1:1 com o portal Agilliza)

Referência visual: telas do portal `agilliza.net.br` (modal "Solicitar Simulação Personalizada") — usar exatamente os mesmos rótulos, ordem e agrupamento. O modal é a versão consumida também dentro do CRM em `/operacional/simulacoes/completa` (mesmo componente `SimulacaoForm modo="completa"`, apenas embrulhado em `<Dialog>` quando aberto sobre outra tela, ou em página cheia quando acessado pelo menu).

### Cabeçalho
- Título: **"Solicitar Simulação Personalizada"** (cor `text-primary`, `text-lg font-semibold`).
- Botão `×` de fechar no canto superior direito.

### Bloco 1 — Dados do Imóvel / Operação (grid 2 colunas em `md:`, 1 coluna no mobile, mesma ordem do portal)

| # | Rótulo | Campo | Tipo | Origem/Regras |
|---|--------|-------|------|---------------|
| 1 | Operação * | `operacao` | Select | `financiamento_imobiliario` \| `home_equity` \| `portabilidade` \| `imovel_na_planta` — placeholder "Selecione" |
| 2 | Tipo de Imóvel * | `tipo_imovel` | Select | `residencial` \| `comercial` |
| 3 | Uso do Imóvel * | `uso_imovel` | Select | `residencial_proprio` \| `residencial_familiar` \| `veraneio` \| `comercial` |
| 4 | Situação do Imóvel * | `situacao_imovel` | Select | `pronto` \| `em_construcao` \| `na_planta` \| `terreno` \| `reforma` |
| 5 | UF * | `uf` | Select | UFs BR (AC..TO), placeholder "Selecione" |

Divisor horizontal fino (`border-t border-border/60`).

### Bloco 2 — Valores e Condições (grid 2 colunas)

| # | Rótulo | Campo | Tipo | Regras |
|---|--------|-------|------|--------|
| 6 | Valor do Imóvel (R$) * | `valor_imovel` | Currency BR | placeholder `Ex: 500.000,00`, máscara `R$ 0,00` |
| 7 | Valor de Entrada (R$) * | `valor_entrada` | Currency BR | placeholder `Ex: 400.000,00`, validação: `< valor_imovel` |
| 8 | Prazo (meses) * | `prazo` | Number | placeholder `Ex: 360`, range 60–420 |
| 9 | Utiliza FGTS? * | `utiliza_fgts` | Select | `sim` \| `nao` — placeholder "Selecione" (borda azul quando focado, como no portal) |
| 10 | Sistema de Amortização * | `sistema_amortizacao` | Select | `SAC` (default) \| `PRICE` |

Divisor horizontal.

### Bloco 3 — Dados do Cliente (mesma ordem do portal, com **busca no CRM**)

O primeiro campo **Nome** é um **combobox com autocomplete** ligado à tabela `clientes` do CRM. Comportamento:
- Ao digitar 3+ caracteres, dispara `buscarClientesCRM({ q })` (server function) → retorna `[{ id, nome, cpf_cnpj, email, celular, data_nascimento, estado_civil, renda_total }]` respeitando RLS do usuário.
- Ao selecionar um resultado, **auto-preenche** todos os campos deste bloco a partir do cliente escolhido e trava `cliente_id`. Um chip "Vinculado ao CRM · Ver ficha" aparece à direita do campo Nome.
- Se o usuário digitar um nome novo (sem selecionar) e enviar, o backend cria um cliente novo no CRM automaticamente (`clientes.create_from_simulacao=true`) e vincula à simulação.

| # | Rótulo | Campo | Tipo | Regras |
|---|--------|-------|------|--------|
| 11 | Nome * | `nome_cliente` | **Combobox CRM** | full width; autocomplete conforme acima |
| 12 | CPF/CNPJ * | `cpf_cnpj` | Text com máscara | placeholder "Apenas números"; máscara automática 11 dígitos = CPF, 14 = CNPJ; validação de dígito verificador |
| 13 | Renda Total (R$) * | `renda_total` | Currency BR | placeholder `Ex: 9.500,00` |
| 14 | Data de Nascimento * | `data_nascimento` | Date | `dd/mm/aaaa`; validação: idade 18–80 na data de contratação estimada |
| 15 | Estado Civil * | `estado_civil` | Select | `solteiro` \| `casado` \| `uniao_estavel` \| `divorciado` \| `viuvo` — placeholder "Selecione" |
| 16 | E-mail * | `email` | Email | valida formato, lowercase |
| 17 | Celular * | `telefone_celular` | Phone BR | máscara `(11) 99999-9999` |

> **Todos os 17 campos são obrigatórios (`*`)**, mesma marcação vermelha do portal. Validação Zod client + server; foco automático no primeiro campo inválido.

### Rodapé
- Botão único **"Enviar solicitação"** (`bg-primary` / roxo-azulado conforme portal, `rounded-full`, canto inferior direito).
- Ao clicar: `criarSimulacao({...campos, cliente_id?})` → grava `simulacoes` (status `rascunho`) e, em seguida, chama `enviarHomeFin(id)` conforme fluxo já descrito. Fecha o modal e navega para `/operacional/simulacoes/$id` com o `ConsultandoOverlay` em cima.

### Regras de vínculo cliente ↔ simulação
- `simulacoes.cliente_id` **é obrigatório** após o submit (nunca fica nulo). Se o usuário não escolheu cliente do CRM, o backend cria (`insert_cliente_from_simulacao`) preenchendo `nome`, `documento`, `email`, `telefone_celular`, `data_nascimento`, `estado_civil`, `renda_total_declarada` e roda `crm_seed_cliente_pipeline` (etapa `cadastro_basico`).
- Se o CPF/CNPJ digitado já existir em `clientes`, o backend **não duplica**: reaproveita o cliente existente e apenas atualiza campos vazios (never overwrite).
- A simulação sempre respeita permissão do usuário sobre aquele cliente (`usuario_tem_acesso_cliente`).

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

- **Modal "Solicitar Simulação Personalizada"**
  - Fundo: `bg-card text-card-foreground border border-border shadow-lg` (light) / `shadow-2xl` (dark).
  - Título "Solicitar Simulação Personalizada": `text-primary text-lg font-semibold`.
  - Asterisco de obrigatório: `text-destructive`.
  - Divisor entre blocos: `border-t border-border/60`.
  - Input em foco: `ring-2 ring-ring` (borda vira `border-primary` no light; `border-primary` no dark também — `--primary` diferente mas continua da família azul).
  - Botão **"Enviar solicitação"**: `variant="default"` (azul primário). Nunca variante destrutiva.
- **Tela de comparativo de bancos** (`/operacional/simulacoes/$id`)
  - Cada linha do banco é um card `bg-card border border-border rounded-lg`.
  - Selo do banco: fundo `bg-muted` com o logo colorido do banco (SVG oficial, não repintar).
  - Melhor parcela do comparativo: badge `tone="success"` "Melhor taxa" ao lado do valor.
  - Banco com erro: badge `tone="danger"` com mensagem humanizada; card mantém `bg-card` (não pintar de vermelho).
  - Coluna de taxa/parcela: `tabular-nums text-right`.
- **Overlay "Consultando bancos"** (`ConsultandoOverlay`): fundo `bg-background/80 backdrop-blur-sm`; card central `bg-card border border-border`; spinner em `text-primary`.
- **PDF da simulação** (`simulacao-pdf.ts`): cabeçalho azul `#000F9F`, texto grafite `#0B0B0F`, linhas divisórias `#E5E7EB`, tom "melhor" verde `#10A37F`. Mesmo hex do tema light — o PDF não segue o modo do usuário.
