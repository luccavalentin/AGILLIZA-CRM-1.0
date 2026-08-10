# Etapa 03 — CRM 2.0: Clientes, Esteira 12 Etapas, Documentos, Chat, Scan IA, Parceiros

> Requer 01, 02.

## 1. O que o CRM produz

**Tabelas** (todas com RLS + soft delete):

- `clientes` (81 col.) — PF/PJ, numero_cliente `CLI-######`, portal_acesso_ativo bool, snapshot de renda/data/UF, ...
- `cliente_enderecos`, `cliente_imoveis`, `cliente_vendedores` (43 col. para composição de renda/vendedor), `cliente_parceiros` (vínculo com corretor/imobiliária), `cliente_documentos`, `cliente_documento_pastas`, `cliente_interacoes`, `cliente_historico`, `cliente_portal_acessos`.
- `pipeline_stages` — 12 etapas fixas semeadas.
- `cliente_pipeline` (posição atual) + `cliente_pipeline_historico`.
- `crm_chat_meta`, `crm_chat_participantes`, `crm_chat_etiquetas`, `crm_chat_cliente_etiquetas`.
- `scan_ia_leituras`, `scan_ia_campos_extraidos`, `scan_ia_auditoria`.

**Server fns** em `src/lib/crm/`:

- `clientes.functions.ts`: `criarCliente`, `atualizarCliente`, `buscarClientesCRM`, `listarClientes` (com escopo), `habilitarPortalCliente`, `revogarPortalCliente`.
- `documento-pastas.functions.ts`, `documentos-gerais.functions.ts`, `documento.ts` — gerenciador de arquivos hierárquico.
- `chat-cliente.functions.ts` — mensagens com cliente (`{numero_proposta}` templated).
- `chat-gestao.functions.ts` — chat operacional entre operadores por cliente.
- `parceiros.functions.ts` — CRUD parceiros.
- `scan-ia.functions.ts` — OCR direto Gemini/OpenAI, extração de CPF/RG/renda/nascimento.
- `ficha-pdf.ts` — PDF da ficha do cliente.

## 2. Esteira — 12 etapas fixas

Semeadas em migração:

| #   | Código                  | Nome interno                  | Mensagem padrão ao cliente                    |
| --- | ----------------------- | ----------------------------- | --------------------------------------------- |
| 1   | `cadastro_basico`       | Cadastro Básico               | Seu cadastro inicial foi recebido.            |
| 2   | `simulacao`             | Simulação                     | Estamos realizando/atualizando sua simulação. |
| 3   | `aprovacao`             | Aprovação                     | Sua proposta está em análise para aprovação.  |
| 4   | `cadastro_completo`     | Cadastro Completo             | Seu cadastro foi atualizado e está completo.  |
| 5   | `documentacao_completa` | Documentação Completa         | Sua documentação foi recebida.                |
| 6   | `formularios_1`         | Formulários — 1ª fase         | Iniciamos a primeira fase de formulários.     |
| 7   | `formularios_2`         | Formulários — 2ª fase         | Segunda fase em andamento.                    |
| 8   | `banco_remessa_1`       | Enviado ao Banco — 1ª remessa | Documentação enviada ao banco.                |
| 9   | `banco_remessa_2`       | Enviado ao Banco — 2ª remessa | Nova remessa complementar.                    |
| 10  | `vistoria_agendada`     | Vistoria Agendada             | Vistoria do imóvel agendada.                  |
| 11  | `analise_juridica`      | Análise Jurídica              | Em análise jurídica.                          |
| 12  | `contrato_emitido`      | Contrato Emitido              | Contrato emitido.                             |

**Função `cliente_pipeline_avancar_para(cliente_id, codigo, acao, obs?)`** — só avança (nunca retrocede). Grava linha em `cliente_pipeline_historico` com `enviar_ao_cliente=true` para consumo pelo App Cliente (Etapa 09).

**Triggers automáticos**:

- INSERT em `clientes` → `cadastro_basico`.
- INSERT/UPDATE em `cliente_enderecos` com CEP válido → `cadastro_completo`.
- INSERT em `simulacoes` → `simulacao`; simulação `simulada`/`parcialmente_simulada` → `aprovacao`.
- Retorno positivo do banco → `aprovacao`.
- Proposta enviada ao banco → `banco_remessa_1`.
- `credito_aprovado` → `vistoria_agendada`.
- `contrato_emitido` → `contrato_emitido`.

## 3. Rotas ativas do CRM

- `/crm/clientes` — lista com filtros (etapa, responsável, período, origem, UF, com/sem proposta ativa) + busca global debounced.
- `/crm/clientes/novo` — form completo em abas (Resumo, Dados, Imóveis, Documentos, Simulações, Propostas, Interações, Histórico, Demandas/Tarefas).
- `/crm/clientes/$id` — ficha completa, com botão **"Nova simulação personalizada"** que abre modal já vinculado.
- `/crm/painel` — kanban visual das 12 etapas com cards de clientes; **drag & drop desabilitado** (esteira é automática); clique no card abre a ficha. Contrato emitido tem data e há "pasta de arquivados" para clientes com status terminal >30 dias.
- `/crm/chat` — layout 3 colunas estilo Instagram/WhatsApp:
  - Coluna 1: lista de conversas com filtros (etiquetas coloridas, SLA de atualização, lembretes).
  - Coluna 2: thread com mensagens do cliente + operador; multi-usuário; templates com `{numero_proposta}`.
  - Coluna 3: painel do cliente (dados, interações, arquivos, propostas).
- `/crm/documentos` — file explorer global (gerenciador hierárquico de pastas), pesquisa + filtros.
- `/crm/parceiros` — CRUD parceiros (imobiliária/corretor) com % comissão, CRECI, logo.
- `/crm/scan-ia` — upload doc → OCR → extração; auditoria em `scan_ia_auditoria`.
- `/crm/scan-ia/$id` — detalhe da leitura com campos extraídos editáveis.

## 4. Ficha do cliente — aba "Documentos"

Pastas fixas por parte (comprador/cônjuge/vendedor/imóvel/outros) com categorias:

**Comprador/Titular**: RG, CPF, Comprovante Estado Civil, Comprovante de Renda (últimos 3), IR completo, Extrato bancário (últimos 3), CTPS, Certidão nasc./cas., Foto 3x4.
**Cônjuge / Composição**: mesmos tipos.
**Vendedor** (PF ou PJ): RG/CPF ou Contrato Social + CNPJ, Certidões, Comprovante residência.
**Imóvel**: Matrícula ≤30d, IPTU, Habite-se, Planta, Contrato compra e venda, Laudo.
**Outros**: procurações, laudos técnicos, livres.

Cada arquivo tem: `categoria`, `tipo_documento` (enum), `versao`, `status (pendente|recebido|aprovado|reprovado|expirado)`, `expira_em`, `aprovado_por/em`. Bucket privado `cliente-documentos`. Signed URL 5min. Whitelist de mimetypes (PDF/JPG/PNG/DOCX), tamanho máx 10MB, validação server-side.

## 5. Portal do Cliente — habilitação

Card **"Acesso ao Portal do Cliente"** no topo da aba Dados:

- Toggle "Habilitar" (default false). Ao ligar:
  - Cria/atualiza `cliente_portal_acessos(cliente_id UNIQUE, tipo_pessoa, documento_hash, data_referencia, ativo=true, habilitado_por, habilitado_em)`.
  - Marca `clientes.portal_acesso_ativo=true`.
  - Log em `admin_audit_logs` (`cliente.portal.habilitar`) + `cliente_historico`.
- Botão "Revogar" quando ativo → `ativo=false` + `revogado_em/por`.
- Permissão `crm.clientes.portal:manage` (só correspondente/gestor autorizado).

## 6. Chat CRM (2.0) — gestão

- **Etiquetas** por cliente (`crm_chat_cliente_etiquetas`) com cores via classes `.chat-tag-*` em `styles.css` (7 cores fixas).
- **Filtros**: por etiqueta, responsável, sem responsável, sem resposta há X dias, aguardando cliente.
- **SLA de atualização** e **lembrete** em `crm_chat_meta(cliente_id, sla_atualizacao_horas, lembrar_em, ultimo_lembrete_em)`.
- **Multi-usuário**: cada mensagem tem `remetente_id`; participantes lidos via `crm_chat_participantes`.
- **Realtime** com debounce em `realtime-debounce.ts`.
- **Som + piscar** ao receber mensagem (§7 da Etapa 02).
- **Templates com `{numero_proposta}`** — server fn substitui variáveis pelo dado da última proposta ativa do cliente antes de enviar.

## 7. Cadastro do Cliente — campos consumidos por Simulação/Proposta

Para "Puxar do CRM" funcionar em Simulação Personalizada (Etapa 04) e Proposta manual (Etapa 05), o form de cliente exige:

| Campo                 | Coluna                            | Obrigatório    |
| --------------------- | --------------------------------- | -------------- |
| Nome completo         | `clientes.nome`                   | Sim            |
| CPF/CNPJ              | `clientes.documento` (só dígitos) | Sim, com DV    |
| Data nasc./abertura   | `clientes.data_nascimento`        | Sim (18–80 PF) |
| Estado civil          | `clientes.estado_civil`           | Sim            |
| E-mail                | `clientes.email`                  | Sim            |
| Celular               | `clientes.telefone_celular`       | Sim            |
| Renda total declarada | `clientes.renda_total_declarada`  | Sim            |
| UF de interesse       | `clientes.uf_interesse`           | Opcional       |

`buscarClientesCRM({q})` retorna até 10 resultados casando por nome/doc/e-mail, respeitando `usuario_tem_acesso_cliente`.

## 8. Ficha do cliente em PDF (2.0)

`src/lib/crm/ficha-pdf.ts` (jsPDF, portrait):

- Cabeçalho azul `#000F9F` com logo Agilliza + dados do ecossistema (razão social, CNPJ do parametros_globais).
- Foto do cliente (se houver) + dados pessoais, endereço, dados profissionais.
- Documentos entregues por pasta.
- Timeline da esteira (12 etapas com data de cada mudança).
- Últimas simulações e propostas.
- Marca d'água diagonal cinza claro "AGILLIZA — CONFIDENCIAL".
- Rodapé: data emissão + usuário emissor + `pág X/N`.

## 9. Permissões e escopos

Módulo `crm.clientes` — `view/create/edit/delete/export/pii:view/portal:manage`.
Escopo `todos|equipe|proprios|personalizado`. `proprios` inclui vínculos de `cliente_parceiros`.
`usuario_tem_acesso_cliente(uid, cliente_id)` centraliza a checagem — usada em RLS e server fns.

## 10. Aparência

- Cards de cliente na lista: `bg-card border border-border rounded-lg`, nome em `text-foreground`, doc mascarado em `text-muted-foreground text-sm` se sem `pii:view`.
- Status via `<StatusBadge>` (nunca cor inline).
- Timeline de etapas: concluída `success`, atual `primary` com pulse, próxima `accent`, futura `muted`. **Sem cadeados** (v2 — removidos).
- Botão "Nova simulação personalizada" no topo: `variant="default"`.
- Botão "Excluir cliente" (só correspondente/admin): `variant="destructive"`.
- Chat CRM: layout 3 colunas em `lg+`, colapsa em drawer sobre `<lg`.
- Etiquetas de chat: classes `.chat-tag-{cor}` em `styles.css`.

## 11. Definition of Done

- Criar cliente → esteira em `cadastro_basico`.
- Preencher endereço com CEP → avança para `cadastro_completo`.
- Habilitar Portal do Cliente → login em `/portal` funciona; revogar → login falha imediatamente.
- Documentos aprovados no CRM ficam disponíveis para "Puxar do CRM" na Proposta.
- Kanban do painel mostra data de contrato emitido e "Arquivados" separados.
- Scan IA: upload PDF → OCR (Gemini) → campos extraídos gravados; auditoria completa.
- Chat CRM: etiqueta cria → aparece no filtro; SLA vencido → aparece badge no card.
- PDF da ficha sai portrait com marca d'água, sem citar HomeFin/Lovable.
- RLS: comercial com escopo `proprios` não vê clientes de outros; parceiro só vê os vinculados via `cliente_parceiros`.
