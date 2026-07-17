# Etapa 23 — QA: Documentos › Formulários

## Escopo real do módulo
O menu **Documentos › Formulários** é um **repositório de modelos de formulários bancários em PDF**, organizado por categoria (Itaú, Bradesco, Santander, Inter, Diversos, DPS). **Não** é um *form builder* dinâmico (não há campos, regras condicionais, versões, respostas nem assinaturas — esses recursos, quando pertinentes, vivem em outros módulos: dossiê da proposta, formulários bancários da própria API do banco, checklist de documentos por cliente).

Este checklist audita o que efetivamente existe e lista os itens do escopo teórico como **N/A — fora do escopo** ou **backlog**, para evitar retrabalho.

## Correções aplicadas nesta etapa
- **Whitelist server-side** (`criarFormulario` / `atualizarFormulario`) — recusa qualquer `content_type` diferente de `application/pdf` e qualquer arquivo acima de **25 MB**, mesmo se o front for burlado.
- **Duplicidade** — bloqueia dois formulários com o mesmo **nome + banco** (case-insensitive), tanto na criação quanto na edição.
- Substituição de arquivo continua removendo o antigo do bucket após o `UPDATE` bem-sucedido.

## Checklist

### Criação / Edição / Exclusão / Duplicação
- [x] Upload de PDF por categoria (Itaú/Bradesco/Santander/Inter/Diversos/DPS).
- [x] Server valida MIME `application/pdf` e tamanho ≤ 25 MB.
- [x] Nome único por banco (case-insensitive).
- [x] Edição de nome, descrição e substituição do arquivo (com remoção do antigo).
- [x] Exclusão remove linha + arquivo físico do bucket.
- [ ] **Duplicar** (clonar registro apontando para o mesmo PDF) — backlog.

### Publicação / Desativação / Versões
- [ ] Publicação/rascunho — **N/A**: todo registro visível é considerado publicado.
- [ ] Versionamento com histórico — **backlog** (hoje a substituição descarta o PDF antigo).
- [ ] Auditoria dedicada de alterações — **backlog**.

### Campos, tipos de campos, obrigatoriedade, regras condicionais, validações, seções, ordenação, salvamento parcial, envio, respostas, anexos, assinaturas
- **N/A — fora do escopo deste módulo.** São modelos estáticos em PDF. Fluxos de preenchimento/assinatura acontecem no envio ao banco (proposta) ou no upload de documentos assinados via **CRM › Documentos** e **Portal do Cliente**.

### Exportação
- [x] Download individual via URL assinada (10 min) em `urlFormulario`.
- [ ] Exportação em lote (ZIP) — **backlog**.

### Permissões
- [x] Tabela `formularios_bancarios` com RLS ligada e `GRANT` para `authenticated`.
- [x] Bucket `formularios-bancarios` restrito a `authenticated`.
- [x] Parceiros e Correspondentes veem a **mesma tela** (mesmo componente, mesmas rotas); a diferença fica no menu, controlado pelo `nav-config`. Sem exposição de rota extra.
- [ ] Escopo por papel (ex.: parceiro só-leitura) — **backlog**: hoje qualquer autenticado pode criar/editar/excluir.

### Vinculação com cliente / proposta / usuário
- **N/A** — modelos são globais por banco. A vinculação de PDFs preenchidos a um cliente/proposta acontece em `cliente_documentos` e `proposta_documentos` (auditados nas Etapas 15 e 18).

### Segurança / URLs
- [x] URL de download é sempre **signed URL** de 10 minutos (nunca link público).
- [x] `content_type` e `tamanho` gravados no servidor (não são copiados cegamente do cliente porque também são revalidados).
- [x] Nome de arquivo sanitizado no upload (`replace(/[^\w.\-]/g, "_")` + UUID como prefixo).

### Auditoria
- [ ] Auditoria dedicada (`admin_audit_logs` para criar/editar/excluir formulário) — **backlog**.
- [x] Rastro implícito por `criado_por` + `updated_at`.

## Paridade Correspondente ↔ Parceiro
- [x] Rota única (`/formularios/$banco`) usada pelos dois shells.
- [x] Cabeçalho `OpHero`, KPIs `OpStat` e lista de cards idênticos.
- [x] Mesmos filtros por banco (tabs) e mesmo diálogo de upload/edição.

## Gaps priorizados (backlog)
1. Auditoria dedicada de criar/editar/excluir formulário.
2. Versionamento (manter PDF anterior + histórico ao substituir).
3. Escopo de permissão granular por papel (parceiro só-leitura).
4. Duplicar registro.
5. Exportação em lote (ZIP por banco).
