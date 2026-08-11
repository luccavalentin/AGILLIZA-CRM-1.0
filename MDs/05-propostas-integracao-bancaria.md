# Etapa 05 — Propostas + Integração Bancária (APROFUNDADA)

> **Marca branca**: nenhum texto visível ao usuário pode conter "HomeFin", "Lovable" ou nome de fornecedor de infra. Ver regra em `00-convencoes-globais.md → Marca branca / Nomenclatura`. A ficha da proposta segue o **layout de "Oportunidade"** descrito abaixo — o modelo é do sistema Agilliza, não é atribuído a nenhum fornecedor externo em rótulos, tooltips ou textos exibidos.

> Requer Etapa 04.

## Dependências e Produtos

**Depende de:** 00, 00b, **01** (RLS), **02** (shell), **03** (clientes, documentos, pipeline, "Puxar do CRM"), **04** (`simulacoes`, `simulacao_bancos`, `logs_integracao`, seed bancos, cliente API HomeFin), **10** (credenciais bancárias em runtime).
**Produz (consumido por 06, 07, 08, 09, 10):**

- Tabelas: `propostas` (com `homefin_id_oportunidade`, `banco_id`, `simulacao_id` nullable p/ cadastro manual), `proposta_bancos` (vínculo N bancos), `proposta_documentos` (bucket `documentos-proposta`), `proposta_status_historico`.
- Server fns: `criarProposta({simulacao_id?, banco_id, cliente_id?})` (aceita origem simulação OU cadastro manual sem simulação prévia), `enviarPropostaBanco`, `anexarDocumentoProposta`, `mudarStatusProposta`.
- Evento `proposta.status = 'contrato_emitido'` — dispara trigger de comissão na **Etapa 06** e move card para etapa final do pipeline da **Etapa 03**.
- Handler webhook `/api/public/webhook/homefin/proposta` — Etapa 10 monitora, Etapa 07 gera tarefas/demandas de pendência, Etapa 09 notifica o cliente.

## Fontes autoritativas da HomeFin (pasta `Logos e a API/APIS/`)

Usar os mesmos arquivos da Etapa 04: swagger (`4 - swagger-output 29012026.json`), PDFs de documentação e fluxograma, e a coleção Postman (`5 - API Homefin.postman_collection.json`). **Todo endpoint de proposta, upload de documento e status deve corresponder exatamente ao swagger** — não inventar rotas, não presumir campos, não escrever tipos à mão. Cabeçalhos de PDFs de proposta/contrato usam a logo em `Logos e a API/Logo PNG/`.

## Objetivo do módulo

Transformar uma simulação escolhida em **Proposta** formal enviada ao banco via HomeFin, coletar toda a documentação exigida, acompanhar o status através das etapas do banco (análise de crédito → aprovação → engenharia/vistoria → jurídico → contrato → assinatura), registrar follow-ups internos e externos, e finalizar com contrato emitido pronto para financeiro/comissão (Etapa 06).

## Fluxo lógico ponta a ponta

1. Em uma simulação com `simulacao_bancos.status='simulada'`, usuário clica **“Promover a Proposta”** para o banco X.
2. Server function `criarProposta({simulacao_id, banco_id})`:
   a. Cria linha em `propostas` (status `rascunho`) com `numero_proposta` (`PRO-######`), copiando snapshot da simulação + banco escolhido.
   b. Copia `homefin_id_oportunidade` da simulação.
   c. Registra em `proposta_historico` com `tipo_evento='criada'`.
   d. Trigger `cliente_app_bootstrap_proposta` cria `cliente_app_processos` + seed de etapas do App Cliente.
3. Usuário completa o cadastro (dados que faltam, cônjuge, participantes, endereço completo do imóvel).
4. Usuário anexa documentos obrigatórios em **“Documentos”**.
5. Botão **“Enviar ao banco”** → `enviarPropostaHomeFin`:
   a. `POST /oportunidade/{idOportunidade}/incluir-proposta-integracao` com `{ idSimulacao }`.
   b. Loop de documentos: `POST /documento/{id}/upload` (multipart) para cada doc obrigatório, depois `POST /oportunidade/{id}/incluir-documentos-integracao` com `{ idSimulacao }`.
   c. Grava `propostas.enviada_em`, `status='enviada_banco'`, `proposta_historico.tipo_evento='enviada_ao_banco'`.
   d. Trigger `proposta_sincronizar_esteira` empurra cliente para `banco_remessa_1`.
6. Sistema entra em **polling/webhook** para atualizar status: `em_analise_credito` → `credito_aprovado`/`credito_recusado` → `aguardando_documentos` (se pedirem complementares — vai para `banco_remessa_2`) → `engenharia_vistoria` → `analise_juridica` → `contrato_emitido`.
7. A cada mudança de status vinda do banco, o webhook `/api/public/homefin/callback` grava `proposta_historico` + dispara notificação para responsável e cliente.
8. Ao `contrato_emitido`, dispara: notificação, atualização da esteira, criação automática de conta-a-receber (comissão — Etapa 06).
9. Usuário pode registrar `proposta_followups` internos (visíveis só ao time) ou externos (`POST /oportunidade/{id}/follow-up` na HomeFin).
10. Cancelamento: `cancelarProposta({motivo})` → `status='cancelada'` + registra motivo em histórico. Se já enviada, tenta `PUT` na HomeFin com `tipoSituacao='C'`.

## Telas

### `/operacional/propostas/enviar` (originar) — **Nova Oportunidade**

Título: **"Nova Oportunidade"**. A tela tem **dois modos de entrada explícitos**, exibidos como `RadioGroup` grande no topo (dentro de um `Card` de destaque), com descrição em uma linha para o usuário leigo entender qual escolher:

- **A) Converter uma simulação existente em proposta** (default, recomendado):
  - Combobox de busca em `simulacoes` por número, cliente, CPF ou banco — mostra apenas simulações com `simulacao_bancos.status='simulada'` (retorno positivo do banco) que **ainda não viraram proposta**.
  - Ao selecionar, **todos os campos abaixo são pré-preenchidos automaticamente** (dados do cliente, imóvel, financiamento). O bloco de Bancos já vem com o(s) banco(s) simulado(s) ligados e valores prontos.
  - Frase de apoio (`text-sm text-muted-foreground`): _"Encontrou a simulação? Escolha o banco vencedor e clique em Enviar Proposta — o sistema aproveita tudo o que já foi digitado."_

- **B) Cadastrar proposta manualmente (sem simulação prévia)**:
  - Formulário em branco. Usado quando o cliente chega com o banco já definido ou vem migrado de outro sistema.
  - **Sub-atalho**: dentro do bloco `INFORMAÇÕES DO CLIENTE`, botão pequeno **"Puxar do CRM"** abre combobox de `clientes` — ao selecionar, importa dados pessoais, endereço, dados profissionais e imóveis. O operador só completa o que faltar.
  - Frase de apoio: _"Não existe simulação? Preencha os dados manualmente ou reaproveite um cliente já cadastrado no CRM."_

Independente do modo, o formulário segue o **layout de 3 colunas padrão do sistema** (identidade Agilliza) + tabela de bancos embaixo + botão **"ENVIAR PROPOSTA"** (azul-marinho, canto inferior direito). Nenhum texto, tooltip ou rótulo pode citar o provedor de integração bancária.

#### Coluna 1 — **DADOS DA OPERAÇÃO**

- `Operação` — select alimentado pela view `vw_operacoes_ativas` (cache dos produtos do provedor de integração — Aquisição, Home Equity, Portabilidade, etc.). Placeholder "Escolha a Operação".
- `Regional` — texto, default **"AGILLIZA CRED"** (readonly conforme sessão/parceiro).
- `Parceiro` — texto, default **"AGILLIZA CRED"** (readonly conforme sessão/parceiro).
- `Usuário Parceiro` — select do usuário responsável do parceiro. Placeholder "Escolha o Usuário Parceiro".
- `Consultor` — texto livre (nome do consultor comercial).
- `Analista` — texto livre (nome do analista de crédito interno).

#### Coluna 2 — **INFORMAÇÕES DO CLIENTE**

- `Nome` — texto.
- `CPF/CNPJ` — máscara automática PF/PJ.
- `Data de Nascimento` — date.
- `E-mail` — email.
- `Celular` — máscara `(00) 00000-0000`.
- `Estado Civil` — select (Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), União Estável, Separado(a)). Placeholder "Selecione o Estado Civil".
- `Renda` — money (R$).
- `Utilizará o FGTS?` — **toggle switch** (bool).
- `Haverá Composição de Renda?` — **toggle switch** (bool). Se true, revela sub-bloco de participantes na tab Participantes.

#### Coluna 3 — **INFORMAÇÕES DO FINANCIAMENTO**

- `Tipo do Imóvel` — select (Residencial, Comercial, Terreno, Rural). Placeholder "Selecione o Tipo do Imóvel".
- `Utilização do Imóvel` — select (Moradia, Investimento, Uso Próprio Comercial). Placeholder "Selecione o Uso do Imóvel".
- `Situação do Imóvel` — select (Novo, Usado, Em Construção, Na Planta). Placeholder "Selecione a situação do Imóvel".
- `UF do Imóvel` — select 27 UFs. Placeholder "Selecione a UF do Imóvel".
- `Valor do Imóvel` — money (R$).
- `Valor do Financiamento` — money (R$).
- `Gostaria de Financiar as Despesas Cartorárias?` — **toggle switch** (bool).
- `Prazo de Pagamento (em meses)` — number (60–420).
- `Sistema de Amortização` — select (SAC, PRICE, SACRE). Placeholder "Selecione o Sistema de Amortização".

#### Bloco inferior — **Bancos para envio simultâneo**

Tabela com uma linha por banco parceiro (`bancos_parceiros` ativos). Colunas: `Banco` · `Simular?` (toggle) · `Número da Proposta` (opcional, se já existe) · `Agência` · `Conta Corrente` · `Digito`.

- Se veio via **modo A**, os bancos da simulação já vêm com toggle **ligado**.
- Usuário pode ligar/desligar bancos e informar os dados bancários da proposta (quando exigidos pelo banco).
- Validação: pelo menos 1 banco com toggle ativo antes de enviar.

#### Botão **"ENVIAR PROPOSTA"** (rodapé direito, `bg-primary` navy)

Ao clicar: valida → dispara `enviarProposta` (uma chamada por banco ligado) → mostra `ConsultandoOverlay` → modal de resultado consolidado (idêntico ao já existente na tela de envio atual) com sucesso/erro por banco. Redireciona para a ficha da proposta principal.

##### Campos persistidos adicionais em `propostas`

- `regional_nome`, `parceiro_nome`, `usuario_parceiro_id`, `consultor_nome`, `analista_nome`
- `utiliza_fgts` (bool), `compoe_renda` (bool)
- `financia_despesas_cartorarias` (bool)
- Dados bancários por proposta: `numero_proposta_banco`, `agencia`, `conta_corrente`, `digito_conta` (na tabela `propostas`, já um por proposta/banco).

### `/operacional/propostas/$id` — detalhe (**layout Oportunidade — padrão do sistema**)

A ficha da proposta é a **tela central do módulo**. É a mesma UX que o operador espera de um sistema de correspondente bancário: header identificador + stepper do ciclo → tabs por assunto. Nenhum rótulo cita provedor externo.

#### Header (linha 1) — identificação e KPIs

- **Título grande**: `Oportunidade {codigo_oportunidade_banco || numero_proposta}` (ex.: "Oportunidade 0000018850") + ícone de temperatura/urgência (`🌡️` colorido conforme SLA).
- **Subtítulo**: `{Operação} — {Situação} há {N} dias` (ex.: "Aquisição · Ativa há 1 dias").
- **Faixa de KPIs à direita** (labels pequenos acima, valor em negrito): `Banco Escolhido` · `Inclusão` (data) · `R$ Financiado` · `Emissão Prevista` · `Situação` (badge colorido).

#### Header (linha 2) — **Stepper de pipeline** (obrigatório, horizontal, componente `PipelineStepper`)

Sequência fixa de 6 etapas (segue exatamente o modelo do banco):
`Simulação` → `Crédito` → `Engenharia` → `Análise Jurídica` → `Contrato Emitido` → `Registro`.

- Cada nó: círculo com número/ícone, label abaixo. Estados: `concluida` (preenchido `bg-primary`), `atual` (anel `ring-2 ring-primary` + `bg-primary/10`), `aguardando` (`bg-muted text-muted-foreground`).
- Linha conectora entre nós: `bg-primary` para trechos concluídos, `bg-border` para os pendentes.
- Abaixo do stepper, texto vermelho pequeno: `Detalhe Status: {detalhe_status_atual}` (ex.: "Simulação Solicitada"). Vem do último `proposta_historico`.

O mapeamento de `propostas.status` → etapa do stepper está em `src/components/propostas/pipeline-map.ts`:

- `rascunho`, `enviada_banco` → Simulação
- `em_analise_credito`, `credito_aprovado`, `credito_recusado`, `aguardando_documentos` → Crédito
- `engenharia_vistoria` → Engenharia
- `analise_juridica` → Análise Jurídica
- `contrato_emitido` → Contrato Emitido
- `registrado` → Registro

#### Barra de tabs (obrigatória, na ordem exata, componente `Tabs` do shadcn com `variant='underline'`)

`RESUMO` · `COMPRADORES` · `VENDEDORES` · `IQ` · `IMÓVEL` · `DOCUMENTOS` · `ATIVIDADES` · `FUP`.

Tabs com setas laterais (`ChevronLeft`/`ChevronRight`) para overflow em mobile. Tab ativa: `border-b-2 border-primary text-primary font-semibold`, demais `text-muted-foreground uppercase tracking-wide text-xs`.

##### 1) **RESUMO** — visão executiva

Grid de 3 colunas em desktop, campos readonly com aparência de input desabilitado (`bg-muted/40`):

- **Operação**, **Regional**, **Parceiro**
- **Usuário Parceiro**, **Consultor**, **Analista**

Abaixo, tabela **Bancos/Simulações vinculadas** com toolbar (`Colunas` · `Filtros` · `Exportar` · `Selecionar Banco` · `Editar` · `Novo Banco/Simulação` · `Incluir Proposta Via API`). A lista de bancos disponíveis (no modal de "Novo Banco/Simulação" e no seletor de `Selecionar Banco`) vem **sempre** da view `vw_bancos_ativos` — no seed padrão apenas **Bradesco, Santander e Itaú** aparecem; **Inter** e **Caixa** só entram depois de habilitados em `/admin/bancos`.

| Banco | Banco Escolhido | Valor Imóvel | Situação | R$ Financiamento | Valor Parcela | Prazo Pagamento | Taxa Juros Ano | Valor IOF | Sistema Amortização | Indexador |

- `Situação` é um **badge inline** (`Completar Dados` em `warning`, `Aprovada` em `success`, `Recusada` em `destructive`, etc.).
- Clique em `Selecionar Banco` marca o banco vencedor (grava `banco_id` da proposta e destaca a linha em `bg-accent/40`).
- `Novo Banco/Simulação` abre um **modal de Simulação no padrão do sistema** (2 colunas: `DADOS DA SIMULAÇÃO` à esquerda, `RESULTADO DA SIMULAÇÃO` à direita), com toggle "Financiar Despesas Cartorárias" e, no rodapé, um bloco `DADOS DA RESPOSTA DO BANCO` (readonly, preenchido após retorno da API). No caso do Bradesco, adicionar bloco final `AUTORIZAÇÃO` com toggle de consentimento SCR (obrigatório antes de enviar).

##### 2) **COMPRADORES** — participantes tipo "CO"

Toolbar: `Colunas` · `Filtros` · `Exportar` · `Incluir Pessoa Física` · `Incluir Pessoa Jurídica` · `Editar` · `Excluir`.

Tabela: `CPF/CNPJ` · `Nome` · `Tipo` (Pessoa Física / Pessoa Jurídica) · `Celular` · `Email`.

- **Botão "Incluir Pessoa Física" abre modal com dois modos** (radio no topo):
  - **A) Puxar do CRM** (default): combobox que busca em `clientes` por nome/CPF; ao selecionar, importa todos os campos e cria `proposta_envolvidos` já preenchido. Se o cliente tiver documentos aprovados na aba CRM → Documentos (comprovante de renda, RG, CPF, IR etc.), oferecer checkbox "Copiar documentos aprovados do CRM para esta proposta" (marca por default).
  - **B) Cadastro manual**: formulário completo com todos os campos do `CreateParticipantRequest` da HomeFin (ver seção API).
- Tudo persiste em `proposta_envolvidos` + POST/PUT HomeFin quando proposta já enviada.
- Linha vazia mostra "Nenhum comprador cadastrado" centralizado.

##### 3) **VENDEDORES** — participantes tipo "VD"

Mesma toolbar e tabela dos Compradores, também com os dois modos (CRM/manual). Usar quando o produto for Aquisição/Home Equity com vendedor identificado.

##### 4) **IQ** (Interveniente Quitante)

Card único `DADOS DO INTERVENIENTE QUITANTE`:

- `Nome` (input)
- `Comentário sobre o Processo` (textarea 2000 chars com contador `{n}/2000` no canto inferior direito).
- Botão **SALVAR** (`variant="default"`, canto inferior direito, `bg-primary`).

Serve para casos de portabilidade / quitação de dívida anterior.

##### 5) **IMÓVEL** — grid 2 colunas

- **Coluna esquerda — DADOS DO IMÓVEL**: `Tipo do Imóvel` (Casa/Apartamento/Terreno/Sala Comercial/Rural), `Utilização do Imóvel` (Residencial/Comercial), `CEP` (ViaCEP autofill), `Endereço`, `Número`, `Complemento`, `Bairro`, `Cidade`, `UF`.
- **Coluna direita — DADOS DA AVALIAÇÃO**: `Nome Contato` (contato do imóvel para vistoria), `Telefone Contato`.

Botão **"Puxar do cadastro do cliente"** no topo da coluna esquerda: abre lista de `cliente_imoveis` do comprador principal e importa endereço + tipo/utilização com um clique.

##### 6) **DOCUMENTOS** — checklist do banco

Toolbar: `Colunas` · `Filtros` · `Exportar` · **`Adicionar Documento`** · `Indexar/Analisar Documento` · `Detalhes` · **`Enviar Para {Banco}`** · `Atualizar`.

Tabela (colunas alinhadas ao contrato do provedor de integração, mas com rótulos neutros na UI):
| Participante | Tipo | Documento | Situação | Situação Integração |

- `Situação`: `Pendente` (`warning`), `Recebido` (`info`), `Aprovado` (`success`), `Reprovado` (`destructive`).
- `Situação Integração`: `N/A`, `Enviado`, `Aceito pelo Banco`, `Rejeitado`.
- **Dois modos de anexo** no botão "Adicionar Documento" (dropdown):
  - **Puxar do CRM**: modal lista documentos do cliente/vendedor por categoria (RG, CPF, Comprovante de Renda, IR, Extrato, Certidão, Matrícula, IPTU); checkboxes; clique importa arquivo do bucket `cliente-documentos` para `proposta-documentos` (cópia — o CRM mantém a versão original).
  - **Upload manual**: dropzone (drag-drop) + input file; PDF/JPG/PNG até 10 MB; após upload, escolher `Participante` e `Tipo` do documento.
- `Enviar Para {Banco}`: dispara `integrarDocumentos({ proposta_id })` — ver seção API.

##### 7) **ATIVIDADES** — máquina de estados operacional

Toolbar: `Colunas` · `Filtros` · `Exportar` · `Incluir Atividade` · `Em Andamento` · `Concluída` · `Detalhes`.

Tabela: `Etapa` · `Atividade` · `Situação` (badge) · `SLA (dias)` · `Início` (data/hora) · `Previsão de Conclusão` · `Conclusão`.

Cada atividade é uma linha do plano operacional (ex.: "Simulação Solicitada", "Simulação Enviada ao Banco", "Em Análise de Crédito", "Crédito Condicionado", "Crédito Aprovado", "Envio de Documentos", "Análise Documentos"). Situações: `Não Iniciada` (`muted`), `Em Andamento` (`info`), `Concluída` (`success`), `Atrasada` (`destructive`).

Seed automático ao criar a proposta a partir de `sla_configuracoes` do banco escolhido.

##### 8) **FUP** (Follow-Up)

Grid 2 colunas:

- **Esquerda — INCLUIR COMENTÁRIO**: select `Tipo` (Interno/Externo), input `Título`, textarea `Comentário` (4000 chars com contador), botão **INCLUIR COMENTÁRIO** (`bg-primary`).
- **Direita — HISTÓRICO DE COMENTÁRIOS**: timeline com botão `Ordem ↑/↓` (mais recente/mais antigo). Cada item: avatar, autor, tipo (chip), data, título negrito, corpo. Se `Externo`, dispara `POST /oportunidade/{id}/follow-up` na HomeFin.

#### Botões de ação (topo direito da tela, acima do stepper)

Enviar ao banco (rascunho); Reenviar (erro/aguardando doc); Solicitar alteração; Cancelar (motivo `.trim()` obrigatório); Baixar PDF; Duplicar.

### `/operacional/propostas/kanban`

Colunas = status enum. Cards arrastáveis apenas entre transições permitidas (ver máquina de estados). Drag persiste via `moverStatusProposta({ id, novo_status, motivo? })`.

### `/operacional/propostas/minhas`, `/gerais`, `/consultar`

Listagens (mesmas convenções da Etapa 04).

## Estrutura de dados

### `propostas` (67 colunas — usar as existentes)

Grupos:

- **Identidade**: `id`, `numero_proposta`, `status`, `simulacao_id`, `cliente_id`, `banco_id`, `nome_banco`, `produto`.
- **Snapshot cliente/imóvel** (mesmos campos da simulação — dados congelados no momento da criação).
- **HomeFin**: `homefin_id_oportunidade`, `homefin_id_simulacao`, `codigo_oportunidade_homefin`, `enviada_em`, `contrato_emitido_em`.
- **Retorno do banco**: `valor_parcela_aprovado`, `taxa_juros_ano_aprovado`, `prazo_aprovado`, `valor_financiamento_aprovado`, `sistema_amortizacao_aprovado`, `codigo_indexador_aprovado`, `valor_iof_aprovado`.
- **Escopo/pessoas**: `usuario_criador_id`, `usuario_responsavel_id`, `analista_id`, `comercial_id`, `parceiro_id`.
- **Financeiro**: `valor_comissao_calculada`, `comissao_status`, `regra_comissao_id`.
- **Consentimento e auditoria**: `consentimento_lgpd`, `consentimento_scr`, `ip_consentimento`.

### `proposta_documentos`

`proposta_id`, `simulacao_id?`, `homefin_id_oportunidade`, `homefin_id_simulacao`, `homefin_id_documento`, `nome_documento`, `tipo_documento` (RG/CPF/COMP_RENDA/IR/EXT_BANC/MATRICULA/IPTU/CERT_NASC/CERT_CAS/etc.), `parte` (comprador1, comprador2, vendedor, imóvel), `arquivo_url`, `storage_path`, `mime_type`, `tamanho_bytes`, `status` (pendente/enviado/aprovado/reprovado/expirado), `obrigatorio`, `versao`, `enviado_em`, `enviado_por`, `integrado_em`, `erro_integracao`, `request_payload`, `response_payload`.

### `proposta_envolvidos`, `proposta_followups`, `proposta_historico`, `proposta_logs_homefin`, `proposta_pdfs`

## Máquina de estados (transições permitidas)

```
rascunho ──enviar──► enviada_banco ──callback──► em_analise_credito
    │                    │                            │
    │                    │                            ├─► credito_aprovado ──► aguardando_documentos (opc.) ──► engenharia_vistoria ──► analise_juridica ──► contrato_emitido
    │                    │                            └─► credito_recusado (terminal)
    │                    └─────► erro_envio (recuperável → reenviar)
    └──cancelar (qualquer)──► cancelada (terminal, motivo obrigatório)
```

Transições feitas via `moverStatusProposta`. Máquina implementada no server; UI só oferece botões válidos.

## API HomeFin — endpoints usados

### 1) `POST /oportunidade/{id}/incluir-proposta-integracao`

Body: `CreateProposalRequest = { idSimulacao }`. Retorna `{ situacao }`.
Regra: `idSimulacao` = `simulacao_bancos.homefin_id_simulacao_banco` do banco escolhido (não da `simulacoes.id` local).

### 2) `POST /documento/{id}/upload` (multipart/form-data)

- Path `{id}` = `homefin_id_documento` obtido do checklist do banco (via domínio ou primeiro `POST` que retorna a lista).
- Form fields: `file` (binary), `idOportunidade`, `idSimulacao`, `idParte` (comprador/vendedor), `tipoDocumento`.
- Aceita PDF, JPG, PNG até 10 MB. Rejeita > 10 MB com erro amigável.
- Resposta: `{ idDocumentoUpload }` — gravar em `proposta_documentos.homefin_id_documento` e marcar `status='enviado'`.

### 3) `POST /oportunidade/{id}/incluir-documentos-integracao`

Body: `SendDocumentsRequest = { idSimulacao }`. Chama após ter feito upload de todos os obrigatórios. HomeFin retorna `SituacaoIntegracaoDocumento` por documento.

### 4) `POST /oportunidade/{id}/participante` e `PUT /oportunidade/{id}/participante/{idParticipante}`

Payload `CreateParticipantRequest` — usar todos os campos (`tipoSituacao`, `nomeParticipante`, `tipoQualificacao` CO/VD, `tipoPessoa` F/J, `cpfCnpj`, `dataNascimento`, `nomeMae`, `tipoSexo`, `tipoEstadoCivil`, `tipoRegimeCasamento`, `tipoDocumentoIdentidade`, `numeroDocumento`, `dataExpedicao`, `orgaoExpedidor`, `ufExpedicao`, `nomeProfissao`, `nomeEmpresaProfissao`, `renda`, `idBanco`, `codigoAgencia`, `codigoContaCorrente`, `digitoContaCorrente`, `email`, `celular`, `cep`, `logradouro`, `numeroLogradouro`, `complementoLogradouro`, `bairro`, `municipio`, `uf`).

### 5) `GET /oportunidade/{id}` — polling

A cada callback ou a cada 5 min (worker job), busca situação atualizada. Mapeia `Opportunity.tipoSituacao` (A/T/C) + campos `codigoOportunidadeBanco`, `valorFinanciamentoBanco`, `valorParcelaBanco`, `prazoPagamentoBanco`, `taxaJurosAnoBanco` para atualizar snapshot da proposta.

### 6) `POST /oportunidade/{id}/follow-up`

Body `FollowUpRequest = { idOportunidade, tipoFup: 'I'|'E', titulo, comentario }`. Grava resposta em `proposta_followups`.

## Server functions (contratos)

```ts
criarProposta({ simulacao_id, banco_id }) → { proposta_id, numero_proposta }
obterProposta({ id }) → { proposta, envolvidos, documentos, followups, historico, comissao }
listarPropostas({ filtros, escopo, page }) → paginado
atualizarDadosProposta({ id, patch }) → só se status ∈ { rascunho, aguardando_documentos }
adicionarEnvolvido({ proposta_id, dados }) → grava local + POST HomeFin se já enviada
atualizarEnvolvido({ proposta_id, envolvido_id, patch }) → local + PUT HomeFin
uploadDocumento({ proposta_id, parte, tipo, file }) → grava storage + insert proposta_documentos
integrarDocumentos({ proposta_id }) → chama /documento/upload por cada + /incluir-documentos-integracao
enviarPropostaHomeFin({ proposta_id }) → cria proposta no banco via HomeFin
reenviarHomeFin({ proposta_id }) → repete
moverStatusProposta({ proposta_id, novo_status, motivo? }) → valida máquina de estados
cancelarProposta({ proposta_id, motivo }) → motivo.trim() obrigatório
adicionarFollowup({ proposta_id, tipo, titulo, comentario, data_previsao?, responsavel_id? })
gerarPdfProposta({ proposta_id })
```

## Regras de negócio críticas

1. **Snapshot congelado**: ao criar proposta, copiar todos os dados da simulação. Editar simulação depois NÃO altera a proposta.
2. **Documentos obrigatórios por banco**: cada banco tem checklist próprio; gravar `proposta_documentos` com `obrigatorio=true` para os do checklist. Bloquear envio se algum obrigatório está `pendente`.
3. **Envio idempotente**: se `enviada_em IS NOT NULL`, botão vira “Reenviar” e usa `PUT` quando aplicável.
4. **Cancelamento**: motivo `.trim().length >= 5` obrigatório; grava em histórico e propaga à HomeFin.
5. **Comissão** calculada automaticamente no `contrato_emitido` via `comissao_regras` (Etapa 06).
6. **PII masking** em `proposta_logs_homefin`.
7. **Storage**: buckets privados; sempre signed URL de curta duração (max 5 min) na UI.
8. **Escopo**: `usuario_tem_acesso_proposta(uid, id)` na função helper (já existe).
9. **Alerta de vencimento**: documentos com `expira_em` gera tarefa 15 dias antes.
10. **Duplicação de proposta**: só admin, para casos de reenvio total (nova PRO-###### mantendo cliente).

## Regras de UI

- Barra de progresso topo mostrando `x/y documentos obrigatórios enviados`.
- Badge de status colorido consistente com kanban.
- Toast + entrada no histórico a cada mudança de status.
- Confirmação em dialog para cancelar/reenviar.
- Ao subir doc >10MB, erro claro antes do upload.

## Definition of Done

- Promover simulação → proposta → completar dados → subir docs → enviar → banco aprovar → contrato emitido: fluxo ponta a ponta.
- Cancelamento propaga à HomeFin.
- Documento >10MB rejeitado com mensagem clara.
- Máquina de estados impede transições inválidas (teste server + UI).
- App Cliente (Etapa 09) recebe notificação a cada mudança relevante.
- Comissão criada ao contrato emitido.
- PII mascarada em todos os logs.
- Testes E2E: fluxo feliz completo; envio sem doc obrigatório → bloqueio; cancelamento com motivo curto → erro; reenvio após erro do banco → sucesso.

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

- **Formulário `/operacional/propostas/enviar`**
  - Grid de 3 colunas em desktop, cada bloco em `bg-card border border-border rounded-lg p-6`.
  - Título do bloco: `text-sm font-semibold uppercase tracking-wide text-muted-foreground`.
  - Toggles (FGTS, Composição de renda, Cartorárias): `Switch` do shadcn — ativo em `bg-primary`, inativo em `bg-input`.
  - Tabela de bancos: cabeçalho `bg-muted text-muted-foreground`; linha ativa (`Simular? = true`) `bg-accent/40`; linha desativada `opacity-60`.
- **Botão "ENVIAR PROPOSTA"**: fixo no canto inferior direito, `variant="default"` azul primário, `size="lg"`. Nunca vermelho.
- **Status da proposta** (`<StatusBadge>` de `src/components/propostas/status.ts`)
  - `rascunho` → tone `muted`.
  - `enviada_banco`, `em_analise_credito`, `aguardando_documentos` → tone `info`.
  - `credito_aprovado`, `contrato_emitido` → tone `success`.
  - `pendencia_documentos`, `aguardando_vistoria` → tone `warning`.
  - `credito_recusado`, `cancelada`, `erro_envio` → tone `danger`.
- **Kanban de propostas** (`/operacional/propostas/kanban`): coluna com barra fina de 3px no topo na cor do tone daquele status; card interno `bg-card`. Não pintar o card inteiro.
- **Timeline da ficha da proposta**: evento de crédito aprovado em `text-success`; evento de recusa em `text-destructive`; envio ao banco em `text-primary`; observação neutra em `text-muted-foreground`.
- **Modal de resultado do envio**: sucesso → ícone `CheckCircle2` `text-success h-14 w-14`; erro → ícone `XCircle` `text-destructive h-14 w-14`.
