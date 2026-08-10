# Etapa 03 — CRM: Clientes, Esteira (Pipeline), Documentos, Interações

> Requer Etapas 01 e 02.

## Dependências e Produtos

**Depende de:** 00, 00b, **01** (papéis/RLS/`correspondente_id`), **02** (shell + notificações).
**Produz (consumido por 04, 05, 06, 07, 08, 09, 10):**

- Tabelas: `clientes` (PF/PJ), `pipeline_stages` (12 etapas fixas semeadas), `cliente_pipeline` (posição atual), `documentos` (bucket `documentos-cliente`), `interacoes` (log manual).
- Server fns: `criarCliente`, `atualizarCliente`, `moverEtapa`, `anexarDocumento`, `registrarInteracao`.
- Ação **"Puxar do CRM"** (seletor de cliente + documentos) — reutilizada por Etapa 04 (nova simulação) e Etapa 05 (nova proposta, upload de docs da proposta).
- Enum de etapas do pipeline — Etapas 04/05 escrevem nele (`simulada`, `em_proposta`, `contrato_emitido`), Etapa 08 lê para KPIs, Etapa 09 exibe no App Cliente.

## Objetivo

Cadastrar clientes (PF e PJ), organizar seu progresso em uma **esteira de 12 etapas fixas**, armazenar documentos, registrar todo contato feito manualmente pelo time (ligação, reunião presencial, mensagem enviada por fora, follow-up), e cruzar automaticamente cliente ↔ simulações ↔ propostas ↔ demandas ↔ tarefas. **O sistema não envia mensagens, e-mails, SMS ou WhatsApp** — os registros de interação são apenas anotações do que o operador fez fora do sistema.

## 🔑 O CRM é a ÚNICA porta de entrada do Cliente Final no sistema

Não existe autocadastro de cliente em nenhuma tela pública (ver Etapa 01 → "Quem cria cada tipo de acesso"). Todo cliente que vai conseguir logar em `/portal` **precisa ter sido cadastrado aqui no CRM** e ter o **"Acesso ao Portal do Cliente" habilitado** na própria ficha. Sem isso, `validarAcessoCliente` (Etapa 01/09) responde "Cliente não encontrado".

Regras obrigatórias no formulário de cliente (`/crm/clientes/novo` e `/crm/clientes/$id`):

- Card **"Acesso ao Portal do Cliente"** no topo da aba "Dados" com:
  - Toggle **"Habilitar acesso ao Portal do Cliente"** (default `false`).
  - Campos usados como credenciais (já obrigatórios do cadastro): CPF/CNPJ + data de nascimento/abertura. **Nunca cria senha para o cliente** — o login é sempre por documento + data.
  - Ao habilitar, gera linha em `cliente_portal_acessos (cliente_id UNIQUE, tipo_pessoa, documento_hash, data_referencia, ativo=true, habilitado_por, habilitado_em)` e marca `clientes.portal_acesso_ativo = true`.
  - Botão **"Revogar acesso"** quando ativo — grava `ativo=false` e `revogado_em/por`; login em `/portal` passa a falhar imediatamente.
  - Log obrigatório em `admin_audit_logs` (`acao='cliente.portal.habilitar'` / `'cliente.portal.revogar'`) e em `cliente_historico`.
- Quem pode habilitar/revogar: correspondente e gestor autorizado (matriz `crm.clientes.portal:manage`). Comercial/corretor/analista **não** habilitam Portal de cliente por padrão — só cadastram o cliente; a habilitação de acesso é decisão do correspondente/gestor.
- Aba **"Documentos"** e todo o resto do CRM funcionam mesmo sem acesso habilitado — o toggle só controla o login em `/portal`.

Reflexo em outras etapas: Etapa 09 (App/Portal do Cliente) só mostra dados de `clientes` cujo `portal_acesso_ativo = true`; Etapa 08 (relatórios) tem KPI "Clientes com portal ativo"; Etapa 10 (Configurações → Pessoas) **não** cadastra cliente — cliente é sempre pelo CRM.

## O que o módulo faz

1. **Cadastro do cliente** (PF/PJ) com dados pessoais, contato, endereço, dados profissionais, imóveis de interesse, vínculos (parceiro, corretor).
2. **Esteira automática (pipeline)**: ao criar cliente, entra em `cadastro_basico`. Eventos do sistema (endereço registrado, simulação criada, banco retornou parcela, proposta enviada, crédito aprovado, contrato emitido) **empurram** o cliente para a próxima etapa via `cliente_pipeline_avancar_para(...)` — nunca retrocede.
3. **Documentos do cliente** organizados em pastas (RG, CPF, comprovantes de renda, IR, extratos, matrícula do imóvel, IPTU). Cada documento tem versão, aprovação, expiração.
4. **Interações** (ligações, WhatsApp, e-mail, reuniões) — registro manual do canal usado pelo operador, data, responsável, resultado e observação. Não há disparo automático nem integração com telefonia/mensageria.
5. **File explorer** por cliente na aba “Documentos”.
6. **Follow-up App Cliente**: fila de clientes com esteira parada por >X dias.

## Esteira — 12 etapas fixas (tabela `pipeline_stages`, já semeada)

| Ordem | Código                  | Nome exibido ao interno       | Mensagem padrão ao cliente                                        |
| ----- | ----------------------- | ----------------------------- | ----------------------------------------------------------------- |
| 1     | `cadastro_basico`       | Cadastro Básico               | Seu cadastro inicial foi recebido. Em breve daremos continuidade. |
| 2     | `simulacao`             | Simulação                     | Estamos realizando/atualizando sua simulação de crédito.          |
| 3     | `aprovacao`             | Aprovação                     | Sua proposta está em análise para aprovação.                      |
| 4     | `cadastro_completo`     | Cadastro Completo             | Seu cadastro foi atualizado e está completo.                      |
| 5     | `documentacao_completa` | Documentação Completa         | Sua documentação foi recebida e está completa.                    |
| 6     | `formularios_1`         | Formulários — 1ª fase         | Iniciamos a primeira fase de formulários.                         |
| 7     | `formularios_2`         | Formulários — 2ª fase         | A segunda fase de formulários está em andamento.                  |
| 8     | `banco_remessa_1`       | Enviado ao Banco — 1ª remessa | Documentação enviada ao banco (1ª remessa).                       |
| 9     | `banco_remessa_2`       | Enviado ao Banco — 2ª remessa | Nova remessa enviada com informações complementares.              |
| 10    | `vistoria_agendada`     | Vistoria Agendada             | A vistoria do imóvel foi agendada.                                |
| 11    | `analise_juridica`      | Análise Jurídica              | Seu processo está em análise jurídica.                            |
| 12    | `contrato_emitido`      | Contrato Emitido              | Contrato emitido.                                                 |

**Comportamento**: a função `cliente_pipeline_avancar_para(cliente_id, codigo_destino, acao, obs?)` só avança se `ordem_destino > ordem_atual`. Nunca retrocede. Cada avanço grava linha em `cliente_pipeline_historico` com `enviar_ao_cliente=true` e a mensagem padrão da etapa; o job de notificações do App Cliente (Etapa 09) lê essa linha.

**Triggers que empurram automaticamente**:

- `crm_seed_cliente_pipeline` — ao INSERT em `clientes`, entra em `cadastro_basico`.
- `cliente_endereco_sincronizar_esteira` — ao INSERT/UPDATE de `cliente_enderecos` com CEP válido, avança para `cadastro_completo`.
- `simulacao_sincronizar_esteira` — ao criar simulação: `simulacao`; ao virar `simulada` ou `parcialmente_simulada`: `aprovacao`.
- `simulacao_banco_sincronizar_esteira` — ao banco retornar parcela: `aprovacao`.
- `proposta_sincronizar_esteira` — ao enviar ao banco: `banco_remessa_1`; ao `credito_aprovado`: `vistoria_agendada`; ao `contrato_emitido`: `contrato_emitido`.

## Telas

### `/crm/clientes` — lista

Colunas: número, nome, documento (mascarado se sem permissão `pii:view`), telefone, e-mail, etapa atual (badge colorido), última atualização, responsável.
Filtros: etapa, responsável, período de cadastro, origem (parceiro / direto), estado, com/sem proposta ativa.
Ações em lote: exportar CSV/XLSX, transferir responsável, arquivar.
Botão “Novo cliente” → `/crm/clientes/novo`.

### `/crm/clientes/novo` e `/crm/clientes/$id`

Detalhe em **tabs**:

1. **Resumo** — cards: dados pessoais, etapa atual (com timeline visual das 12), responsável, último contato, KPIs (nº simulações, propostas, tarefas abertas).
2. **Dados** — formulário completo (PF: nome, CPF, RG, data nasc, mãe, estado civil, regime, cônjuge; PJ: razão, CNPJ, IE, sócios; contato; endereço; profissional).
3. **Imóveis** — CRUD de `cliente_imoveis` (tipo, uso, endereço, valor).
4. **Documentos (repositório mestre do cliente)** — file explorer com pastas fixas por **categoria/parte**, para que qualquer proposta futura reaproveite os arquivos com um clique (ver Etapa 05 → tab Documentos → "Puxar do CRM"):
   - **Comprador / Titular**: RG, CPF, Comprovante de Estado Civil, Comprovante de Renda (últimos 3), IR completo, Extrato bancário (últimos 3), Carteira Profissional, Certidão de Nascimento/Casamento.
   - **Cônjuge / Composição de Renda**: mesmos tipos acima, quando aplicável.
   - **Vendedor** (PF ou PJ): RG/CPF ou Contrato Social + CNPJ, Certidões negativas, Comprovante de residência.
   - **Imóvel**: Matrícula atualizada (≤ 30 dias), IPTU do ano, Habite-se, Planta, Contrato de compra e venda, Laudo de avaliação anterior (se houver).
   - **Outros**: procurações, laudos técnicos, documentos livres.

   Cada arquivo tem: `categoria` (comprador/conjuge/vendedor/imovel/outros), `tipo_documento` (enum), `versao` (auto-incrementa ao substituir), `status` (`pendente`/`recebido`/`aprovado`/`reprovado`/`expirado`), `expira_em` (opcional — gera tarefa 15 dias antes), `aprovado_por`, `aprovado_em`. Upload por dropzone (PDF/JPG/PNG até 10 MB); botões inline para aprovar/reprovar/substituir/baixar (signed URL 5 min). Bucket: `cliente-documentos` (privado).

5. **Simulações** — lista de `simulacoes` do cliente (link para detalhe/edição).
6. **Propostas** — lista de `propostas` (por `cliente_id` OU por `documento` para migrados).
7. **Interações** — timeline de `cliente_interacoes` + botão “Registrar contato”.
8. **Histórico** — `cliente_historico` unificado (etapa mudou, doc anexado, tarefa criada etc.).
9. **Demandas / Tarefas** — abertas relacionadas.

### `/crm/painel`

Kanban visual das 12 etapas com cards de clientes. Drag & drop **desabilitado** (esteira é automática); clique no card abre o detalhe. Filtros: responsável, período.

### `/crm/pendencias`, `/crm/consultar`, `/crm/documentos`, `/crm/historico`, `/crm/follow-up-app-cliente`, `/crm/app-habilitados`

- **Pendências**: clientes com doc obrigatório faltando ou etapa parada > 5 dias úteis.
- **Consultar**: busca avançada (nome, doc, telefone, e-mail, número).
- **Documentos**: file explorer global (todos os clientes) com filtro por tipo.
- **Histórico**: log global de eventos (paginado, filtro por tipo de evento).
- **Follow-up App Cliente**: clientes com App habilitado mas sem interação nos últimos 14 dias.
- **App Habilitados**: lista de clientes com acesso ativo ao `/cliente/*`, com botão “Reenviar código” e “Revogar acesso”.

## Estrutura de dados (chave)

- `clientes`: id, tipo_pessoa (PF/PJ), numero_cliente (`CLI-######`), nome, documento (normalizado só dígitos), documento_secundario, data_nascimento, estado_civil, regime_casamento, mae, foto_url, origem, responsavel_id FK profiles, criador_id, ativo, created_at, updated_at.
- `cliente_contatos`, `cliente_enderecos`, `cliente_dados_profissionais`, `cliente_imoveis`, `cliente_vinculos`, `cliente_parceiros`, `cliente_documentos`, `cliente_pastas`, `cliente_pasta_arquivos`, `cliente_interacoes`, `cliente_historico`.
- `cliente_pipeline(cliente_id UNIQUE, stage_id, ultima_atualizacao_em)` + `cliente_pipeline_historico`.

## Permissões

Módulo `crm.clientes` — ações `view`, `create`, `edit`, `delete`, `export`, `pii:view`.
Escopo: `todos` (admin/gestor), `equipe` (imobiliária), `proprios` (corretor/comercial/analista).
Filtragem via função `usuario_tem_acesso_cliente(uid, cliente_id)` (já existe).

## Regras críticas

- Documento normalizado no `INSERT/UPDATE` por trigger `crm_normalize_documento` (remove tudo que não é dígito).
- Unicidade de documento por `tipo_pessoa` + `ativo=true`.
- Ao mudar responsável, registrar em histórico e reindexar acessos.
- Nunca exibir documento sem máscara para usuário sem `pii:view`.

## Definition of Done

- Criar cliente → automaticamente entra em `cadastro_basico`.
- Preencher endereço → avança para `cadastro_completo`.
- Criar simulação → avança para `simulacao`.
- Timeline visual mostra etapas concluídas (verde), atual (destaque), próximas (cinza).
- Cliente com App habilitado recebe mensagem padrão da etapa nova (Etapa 09).
- Testes: analista com `escopo=proprios` só vê seus clientes; tentar acessar `/crm/clientes/$id` de outro dono → 403.

---

## Ajuste — Cadastro do Cliente deve conter os campos consumidos pela Simulação Personalizada

Para que o modal **"Solicitar Simulação Personalizada"** (Etapa 04) consiga **puxar um cliente já existente** e auto-preencher todos os campos, o cadastro do cliente no CRM (`/crm/clientes/novo` e `/crm/clientes/$id`) precisa expor **exatamente** os mesmos atributos, com os mesmos rótulos e opções (paridade 1:1).

### Campos obrigatórios no formulário de Cliente (bloco "Dados básicos" — PF)

| Campo CRM                     | Coluna DB                                                                    | Tipo                                                             | Regras                                                               |
| ----------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Nome completo \*              | `clientes.nome`                                                              | text                                                             | full width                                                           |
| CPF/CNPJ \*                   | `clientes.documento`                                                         | text normalizado (só dígitos, trigger `crm_normalize_documento`) | 11 → PF, 14 → PJ, dígito verificador                                 |
| Data de nascimento \*         | `clientes.data_nascimento`                                                   | date                                                             | idade 18–80                                                          |
| Estado civil \*               | `clientes.estado_civil`                                                      | enum                                                             | `solteiro` \| `casado` \| `uniao_estavel` \| `divorciado` \| `viuvo` |
| E-mail \*                     | `clientes.email` (ou `cliente_contatos` principal)                           | email                                                            | lowercase                                                            |
| Celular \*                    | `clientes.telefone_celular` (ou `cliente_contatos` tipo `celular` principal) | phone BR                                                         | `(11) 99999-9999`                                                    |
| Renda total declarada (R$) \* | `clientes.renda_total_declarada`                                             | numeric(14,2)                                                    | usada como default de `simulacoes.renda_total`                       |
| UF de interesse               | `clientes.uf_interesse`                                                      | char(2)                                                          | pré-preenche o campo UF da simulação                                 |

Se as colunas `estado_civil`, `data_nascimento`, `renda_total_declarada`, `telefone_celular`, `uf_interesse` ainda não existirem em `clientes`, criar via migração. Todas nullable **exceto quando o formulário de cliente exigir** — mas o cadastro **do próprio CRM** passa a exigir esses 8 campos como obrigatórios no submit (validação Zod), porque a simulação personalizada depende deles.

### Busca do cliente pela Simulação

Server function `buscarClientesCRM({ q })` (usada pelo combobox "Nome" da simulação):

- `q` casa por `ilike` em `nome`, `documento` (dígitos) e `email`.
- Retorna até 10 resultados com `{ id, nome, documento, email, telefone_celular, data_nascimento, estado_civil, renda_total_declarada, uf_interesse }`.
- Respeita `usuario_tem_acesso_cliente(auth.uid(), cliente.id)` — parceiros veem apenas os próprios; internos veem todos conforme permissão.
- Ordena por `nome` asc, prioriza clientes com simulação/proposta ativa nos últimos 90 dias.

### Regras de sincronização inversa (Simulação → CRM)

- Ao criar simulação sem `cliente_id`, o backend cria/atualiza cliente e preenche as 8 colunas acima.
- Ao atualizar simulação, campos que estiverem vazios no cliente são **complementados** (nunca sobrescreve dado existente do CRM).
- Ao vincular simulação a cliente existente, se algum campo do cliente ainda for `NULL` e a simulação trouxer valor, `UPDATE` complementar; caso contrário, ignora.

### UI

- Na ficha do cliente (`/crm/clientes/$id`), aba **"Dados"** exibe os 8 campos agrupados em duas colunas, com badge "Vinculado à simulação SIM-XXXXXX" quando existir.
- Botão **"Nova simulação personalizada"** no topo da ficha abre o modal da Etapa 04 já com o `cliente_id` fixado e todos os campos pré-preenchidos.

---

## Aparência e tons (segue `00b-tons-cores-design-tokens.md`)

- **Cards de cliente na lista**: `bg-card border border-border rounded-lg`; nome em `text-foreground`, documento em `text-muted-foreground text-sm`. Sem sombra (só drawer/dialog tem sombra).
- **Status do cliente / do portal / do App**: sempre `<StatusBadge>`/`<PortalBadge>`. Nunca escrever cor no componente. Mapa oficial:
  - `ativo`, `contratado` → tone `success`.
  - `em_analise`, `em_simulacao`, `novo` → tone `info` (azul-névoa).
  - `pendente_documentos`, `aguardando_cliente` → tone `warning`.
  - `bloqueado`, `desistiu`, `recusado` → tone `danger`.
  - `rascunho`, `arquivado` → tone `muted`.
- **Esteira (`pipeline_stages`)**: cada etapa é um chip horizontal.
  - Etapa concluída: `bg-success/10 text-success border border-success/20` + ícone `Check`.
  - Etapa atual: `bg-primary text-primary-foreground` + pulse leve no ícone.
  - Próxima etapa: `bg-accent text-accent-foreground` (destaque suave).
  - Etapa futura: `bg-muted text-muted-foreground border border-border`.
  - No dark, as classes acima já usam tokens — não precisa de override.
- **Ficha do cliente**: tabs em `text-muted-foreground`; tab ativa em `text-primary` com underline `bg-primary`. Divisor entre blocos em `border-border`.
- **Botão "Nova simulação personalizada"** no topo da ficha: `variant="default"` (azul primário).
- **Botão "Excluir cliente"** (só admin/correspondente): `variant="destructive"`.
