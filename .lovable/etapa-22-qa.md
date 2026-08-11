# Etapa 22 — QA Arquivos (Documentos Gerais)

## Escopo auditado

- `arquivos_nos` (tabela hierárquica única para pastas e arquivos) + bucket `arquivos` no Storage.
- Server fns em `src/lib/documentos/arquivos.functions.ts`.
- UI em `src/components/documentos/gerenciador-arquivos.tsx` + subcomponentes (`no-card`, `trilha-navegacao`, `mover-dialog`, `dialogos-arquivo`).
- Rota `/documentos` (correspondente e parceiro compartilham a MESMA tela; escopo via RLS).

## Correções aplicadas nesta etapa

1. **`renomearNo`** — passa a rejeitar duplicidade de nome no mesmo nível/tipo (`Já existe um item com esse nome neste local.`).
2. **`moverNo`** — valida que o destino existe, pertence ao correspondente e é do tipo `pasta` (não arquivo), além do check já existente contra ciclos.

## Checklist QA

### Pastas / subpastas

- [ ] Criar pasta na raiz e em subnível — `criarPasta` é idempotente (retorna id existente se nome já existe).
- [ ] Nomes com até 200 chars; sem barras/emoji quebram trilha.
- [ ] Hierarquia até 50 níveis (limite dos loops de caminho/BFS).

### Upload

- [ ] Upload direto ao Storage com `storage_path` sob `<correspondente_id>/...` (RLS do bucket cobre isolamento).
- [ ] `registrarArquivo` cria o nó após o upload confirmar.
- [ ] **Gap**: não há validação server-side de MIME/`content_type` nem `tamanho` máximo — hoje é apenas convenção do cliente.

### Download / visualização

- [ ] `urlArquivo` gera signed URL de 300s (5min); `download=true` força attachment com nome original.
- [ ] Preview inline no navegador para PDF/imagens (usa a mesma signed URL sem `download`).
- [ ] URLs assinadas expiram; ao expirar, botão gera nova.

### Renomear / mover / cópia

- [ ] Renomear pasta ou arquivo com validação de duplicidade (nova regra).
- [ ] Mover: bloqueia mover para si mesmo, para descendente e para um arquivo (nova regra).
- [ ] **Gap: cópia** não implementada — hoje o usuário precisa baixar e reenviar.

### Exclusão / recuperação

- [ ] Excluir pasta remove recursivamente todos os descendentes e objetos do storage (batches de 100 no `storage.remove`).
- [ ] BFS paginado (>1000 filhos por nível) — sem órfãos.
- [ ] **Gap: exclusão é destrutiva** (hard delete). Não há lixeira / soft-delete / restauração — documentar como backlog.

### Busca / filtros

- [ ] `pesquisarArquivos` — ilike sobre `nome`, limite 200, montagem de caminho no servidor.
- [ ] Escopado ao `correspondente_id` do usuário.
- [ ] **Gap**: sem filtro por tipo/tamanho/data/autor no server (só client-side, se houver).

### Compartilhamento

- [ ] Compartilhamento externo = enviar signed URL manualmente (link expira em 5min).
- [ ] **Gap**: não há gestão de shares persistentes com prazo customizável nem revogação por token.

### Vínculos

- [ ] Documentos de cliente ficam em `cliente_documentos` (tabela separada, escopo próprio) — este módulo é "Documentos Gerais" do correspondente.
- [ ] **Gap**: não há vínculo de nó de "Documentos Gerais" com cliente/proposta/processo/usuário (por design). Documentos por cliente já vivem em CRM > Documentos.

### Versionamento

- [ ] **Gap**: sem versionamento. Reenvio com mesmo nome sobrescreve o `storage_path` no bucket ou cria duplicata — não há histórico de versões.

### Permissões

- [ ] RLS `arquivos_nos` isola por `correspondente_id`.
- [ ] Todas as server fns verificam `correspondenteDoUsuario` e adicionam filtro `eq("correspondente_id", corr)` em UPDATE/DELETE.
- [ ] Bucket `arquivos` privado (signed URLs); RLS de `storage.objects` restringe leitura ao dono.
- [ ] Parceiro: mesma tela, mesmas ações — dados visíveis limitados pelo escopo do correspondente e pelas policies. Sem tela paralela.

### Auditoria

- [ ] `criado_por` gravado em cada nó; `criado_por_nome` resolvido no `listarNos`.
- [ ] **Gap**: sem log dedicado de rename/move/delete/download em `admin_audit_logs` para o módulo. Backlog.

### Segurança / URLs

- [ ] Signed URLs de 5 min — janela curta o suficiente para uso e vazamento contido.
- [ ] `storage_path` NUNCA é retornado ao cliente; só o nome + id do nó.
- [ ] URLs de download não expõem `correspondente_id` explicitamente (opaco no bucket key).
- [ ] `urlArquivo` só emite link se o nó pertence ao correspondente do usuário logado.

### Limites de armazenamento / tipos / tamanho

- [ ] **Gap**: nenhum limite de armazenamento por correspondente aplicado — sem cota.
- [ ] **Gap**: nenhum whitelist de MIME no server. Adicionar em `registrarArquivo` (accept-list) + limite de tamanho é backlog crítico.
- [ ] **Gap**: sem verificação antivírus.

### Correspondente ↔ Parceiro

- [ ] Ambos abrem `src/routes/_authenticated/documentos.tsx` com o mesmo componente `GerenciadorArquivos`.
- [ ] Nenhuma feature exclusiva por portal. Diferenças = pastas visíveis por RLS (parceiro vê `correspondente_id` compartilhado, mas em geral não há vínculo específico — módulo "geral" do correspondente).

## Gaps priorizados (backlog)

1. **Whitelist de MIME + tamanho máximo** no `registrarArquivo` (segurança).
2. **Cota de armazenamento** por correspondente (limites configuráveis).
3. **Soft-delete + lixeira** com prazo de retenção antes do purge.
4. **Cópia** de nós (pasta e arquivo) com replicação no storage.
5. **Versionamento** — sufixo `-v2` automático ou histórico dedicado.
6. **Auditoria** dedicada de rename/move/delete/download.
7. **Compartilhamento persistente** com token revogável (share links com prazo customizável).
8. **Filtros avançados** de busca (tipo, tamanho, data, autor).
