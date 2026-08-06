# Etapa 04 — Simulações + Integração Bancária 2.0

> Requer 01–03. Marca branca: nenhum texto na UI cita "HomeFin"/"Lovable". Ver `00-v2 §2`.

## 1. Produto do módulo

**Duas telas + duas modalidades**:
- **Simulação rápida** (`/operacional/simulacoes/nova`) — cálculo local (SAC/PRICE) sem API. PDF sai imediato. Persiste em `simulacoes` só se usuário clicar "Salvar no CRM".
- **Simulação completa/personalizada** (`/operacional/simulacoes/completa`) — envia à Integração Bancária (Bradesco/Santander/Itaú por padrão). Verificação por e-mail (OTP servido pela integração — rótulo neutro "Verificação por e-mail").

**Tabelas**:
- `simulacoes` (62 col.) — snapshot completo, `homefin_id_oportunidade`, `numero_simulacao SIM-######`, `tipo_simulacao ('simplificada'|'completa')`, `status ('rascunho'|'enviando'|'simulada'|'parcialmente_simulada'|'erro_banco'|'expirada'|'cancelada'|'promovida')`.
- `simulacao_bancos` (24 col.) — uma linha por banco por simulação, com `valor_parcela`, `taxa_juros_ano`, `prazo_pagamento_max`, `valor_financiamento_max`, `valor_iof`, `sistema_amortizacao_banco`, `status_banco`, `mensagem_banco`.
- `simulacao_participantes` — comprador adicional / vendedor / composição de renda com todos os campos da API.
- `simulacao_historico`, `simulacao_pdfs`, `simulacao_envolvidos`, `simulacao_logs_homefin`.
- `homefin_operacoes`, `homefin_bancos`, `homefin_auth_cache`, `homefin_email_otp`.

## 2. Fontes autoritativas

- `Logos e a API/APIS/4 - swagger-output 29012026.json` — contrato OpenAPI. Gerar tipos em `src/integrations/homefin/types.ts` (**existe**). Nunca `any`.
- `2 - Documentacao API Homefin.pdf` — regras funcionais.
- `5 - API Homefin.postman_collection.json` — para validar payload no Postman antes de codar.

## 3. Fluxo ponta a ponta

1. `/operacional/simulacoes/nova` — wizard curto (paridade com site público Agilliza): Produto, Valor do imóvel, Entrada, Crédito, "Já tem imóvel?", Data nasc., Prazo em anos.
2. Dois botões grandes lado a lado:
   - **SIMULAÇÃO RÁPIDA** → cálculo local em `src/lib/simulacao/simulacao-rapida.ts` (SAC/PRICE, taxas médias dos bancos ativos). Mostra comparativo, gera PDF (`baixarPdfSimulacaoRapida`).
   - **SIMULAÇÃO PERSONALIZADA** → abre modal OTP (`homefin_email_otp` guarda hash + expires_at). Após validado, revela form completo em 5 blocos.
3. Blocos do form completo (`/operacional/simulacoes/completa`):
   - **Operação/Imóvel**: Operação, Tipo Imóvel (AP/CS/GA/TE/TC), Uso (R/C), Situação (N/U), UF, Valor, Entrada, Prazo, FGTS, Sistema (S/P), **CEP do imóvel** (obrigatório para Santander HE).
   - **Titular**: Nome, CPF/CNPJ, Renda Total, Data nasc., Estado Civil, E-mail (readonly do OTP), Celular. **Auto-preenche renda PRICE se renda total ≥ mínima calculada**.
   - **Cônjuge / Composição de renda** (condicional): mesmos campos.
   - **Bancos**: multi-select alimentado por `vw_bancos_ativos`. Default `flag_padrao=true`.
   - **Consentimentos LGPD + SCR** (obrigatório).
4. Server fn `criarSimulacao` → grava `simulacoes` com `status='rascunho'`, gera `numero_simulacao`.
5. Server fn `enviarSimulacao` (`src/lib/simulacao/enviar.server.ts`):
   - `POST /auth/token` (cache 55min em `homefin_auth_cache`).
   - `POST /oportunidade` — cria a Oportunidade única.
   - Para cada banco: `POST /oportunidade/{id}/simulacao` + `POST /.../integracao`.
   - **Santander Home Equity** usa rota operacional **Somahome** (`idOperacao=6`, `idBanco=96`), situação `U`, endereço completo (ViaCEP), Mãe/Sexo/Profissão do participante (fn `garantirDadosParticipantesSimulacao`).
   - Envio sequencial (não paralelo) para evitar rate-limit e permitir reenvio isolado por banco.
   - **Trava anti-duplicidade** libera envios/reenvios quando `bancoIds` é fornecido (por banco).
6. Trigger `simulacao_sincronizar_esteira` → CRM avança cliente.
7. `/operacional/simulacoes/$id` — detalhe:
   - Header com número, cliente, produto, status, criado.
   - **Tabela de retornos** por banco (comparativo): banco (logo + chip), situação, parcela, taxa aa, prazo máx, valor máx, IOF, sistema, indexador, mensagem.
   - Botões: **Reenviar** (por banco), Ver payload (só com permissão auditoria), **Promover a Proposta** (abre modal escolhendo banco vencedor).
   - Aba Histórico, aba Documentos.
   - Botão "Duplicar simulação" (edição vira nova simulação, mantém CRM).
   - Botão "Baixar PDF detalhada".
   - **Renda necessária** (bloco inferior) — SAC 30%, PRICE 15%, calculada por `src/lib/simulacao/renda.ts` e via API quando disponível.

## 4. Regras de negócio consolidadas (§4 do 00-v2)

- **Terreno**: LTV≤70%, prazo≤240m, **só Bradesco**.
- **Comercial**: LTV≤70%, prazo≤240m, todos ativos.
- **Home Equity**: LTV≤70% (entrada 30% sugerida), prazo≤240m (trava automática ao selecionar HE), **não Itaú**.
- **Prazo por idade**: proponente mais velho manda; helpers em `src/lib/propostas/prazo.ts` (usado também na Simulação).
- **PRICE obrigatória**: ao selecionar PRICE, campo "Renda PRICE" recebe foco + auto-scroll. Simulação bloqueada se vazio. Se renda total já é ≥ mínima → auto-preenche.
- **Bancos por produto**: filtro reativo em `SecaoBancos` (`src/components/simulacao/completa/`) — banco não elegível some da lista.

## 5. API HomeFin (endpoints usados)

- `POST /auth/token` — Bearer para tudo. Cache local.
- `GET /dominios/operacoes` e `GET /dominios/bancos` — refresh diário via job. Populam `homefin_operacoes` e `homefin_bancos` para os selects.
- `POST /oportunidade` — cria Oportunidade única por simulação.
- `POST /oportunidade/{id}/simulacao` — uma por banco.
- `POST /oportunidade/{id}/simulacao/{idSim}/integracao` — dispara integração real.
- `PUT /oportunidade/{id}/simulacao/{idSim}` — atualiza simulação existente (edição).
- `GET /oportunidade/{id}` — polling do status (a integração **não** tem webhook).

Todo request loga em `simulacao_logs_homefin` (com `mask_pii_jsonb` no payload).

## 6. Verificação por e-mail (OTP)

- `homefin_email_otp(email CITEXT, token_hash TEXT, expires_at, tentativas INT DEFAULT 0, used_at, ip, created_at)`.
- Índice único parcial em `(email)` WHERE `used_at IS NULL AND expires_at > now()`.
- Rate-limit: 5 tentativas / e-mail / 15 min; reenvio libera após 60s; código expira em 10 min.
- Server fns `enviarOtpHomeFin` e `validarOtpHomeFin` chamam o endpoint da integração. Rótulos na UI: "Enviar código", "Validar código", "Código de verificação".
- Ao validar → grava `simulacoes.email_verificado_em`. Simulações subsequentes do mesmo e-mail (dentro de X dias) pulam OTP.

## 7. PDF de simulação

`src/lib/simulacao/simulacao-pdf.ts` (jsPDF, portrait):
- Cabeçalho Agilliza + logo dos bancos comparados.
- Comparativo (tabela dos bancos, ordenado pelo menor parcela).
- Bloco "Renda necessária" abaixo do comparativo.
- Marca d'água diagonal cinza claro.
- Rodapé com data + operador.
- Nome do arquivo: `SIM-000123_2026-07-20.pdf`.

## 8. Aparência e componentes

- Grid de 3 bancos por linha em telas ≥lg; empilha em `<lg`.
- Logo do banco via `<BancoLogo>` de `src/components/bancos/banco-logo.tsx`.
- Chip de status via `<BancoChip>` com tone success/warning/danger/info.
- Empty state se `vw_bancos_ativos` retornar vazio: "Nenhum banco habilitado — abra Configurações → Bancos".
- Datepicker sem autocomplete de navegador via `src/components/common/date-input.tsx`.
- Combobox de banco/UF/tipo com pesquisa via `ComboSelect`.

## 9. Definition of Done

- Simulação rápida gera PDF em < 2s sem chamar API.
- Simulação completa envia sequencialmente para bancos selecionados e retorna comparativo real da sandbox.
- Reenvio por banco funciona (não bloqueado pela trava de duplicidade).
- Santander HE: com CEP + Mãe/Sexo/Profissão preenchidos, retorna valores válidos.
- Terreno só permite Bradesco (bancos filtrados na UI).
- HE seleciona → prazo trava em 240m automaticamente.
- Renda PRICE: campo autoscroll + foco ao selecionar PRICE; preenchido se renda ≥ mínima.
- PDF em portrait com marca d'água; nenhum texto cita HomeFin/Lovable.
- Duplicar simulação preserva LGPD/SCR + todos os campos.
- Testes E2E: analista `proprios` só vê próprias simulações; envio ao banco fora do horário sandbox trata timeout amigável.
