
# Arquivos (estilo Google Drive) + Backup de Documentos

Duas entregas: (1) transformar a tela **Arquivos** num gerenciador de pastas e arquivos com upload de arquivos e de pastas inteiras; (2) adicionar em **Backup** a opção de baixar todos os documentos do sistema, separados por pastas, renomeados e compactados.

## 1. Arquivos — gerenciador tipo Drive

### Banco de dados (migração)
- Tabela `arquivos_nos` (árvore de pastas e arquivos):
  - `correspondente_id`, `parent_id` (auto-referência, null = raiz), `tipo` ('pasta' | 'arquivo'), `nome`, `storage_path` (só arquivo), `content_type`, `tamanho`, `criado_por`, timestamps.
  - GRANT para authenticated/service_role, RLS por correspondente do usuário (mesma lógica das demais tabelas — `correspondente_id = correspondente_do_usuario(auth.uid())`).
- Bucket privado de storage `arquivos` + políticas em `storage.objects` (authenticated no bucket).

### Backend (`src/lib/documentos/arquivos.functions.ts`)
- `listarNos(parent_id?)` — lista pastas/arquivos de um nível.
- `criarPasta(parent_id, nome)`.
- `registrarArquivo(parent_id, nome, storage_path, content_type, tamanho)` — registro após upload ao bucket.
- `renomearNo(id, nome)`, `moverNo(id, novo_parent_id)`, `excluirNo(id)` (exclui recursivo pastas + arquivos do storage).
- `urlArquivo(id)` — signed URL para abrir/baixar.
- `caminhoNo(id)` — breadcrumb (lista de ancestrais).

### UI (`src/routes/_authenticated/documentos.tsx` + componentes)
- Barra superior: breadcrumb navegável, busca, botões **Nova pasta**, **Enviar arquivos**, **Enviar pasta** (`<input webkitdirectory>` — recria a árvore de subpastas no upload).
- Grade/lista de itens com ícone de pasta/arquivo, tamanho, data; duplo clique/entrar em pasta.
- Ações por item (menu): abrir, baixar, renomear, mover, excluir.
- Arrastar-e-soltar arquivos na área para upload no nível atual.
- Estados vazios reais, responsivo mobile-first, tokens semânticos.
- A visão atual (lista de documentos de clientes somente-leitura) vira uma aba/atalho secundário "Documentos de clientes" para não perder a função existente.

## 2. Backup de Documentos (ZIP organizado)

### Backend (`src/lib/admin/backup-documentos.functions.ts`)
- `montarInventarioDocumentos()` — server fn autenticada que percorre, no escopo do correspondente, e devolve uma lista de `{ pasta, nomeArquivo, signedUrl }`:
  - **Clientes/<Nome do Cliente>/** ← `cliente_documentos` (bucket `cliente-documentos`)
  - **Propostas/<Nº proposta>/** ← `proposta_documentos` (bucket `documentos-proposta`)
  - **Tarefas/<Nº>/** ← `tarefa-anexos`; **Demandas/<Nº>/** ← `demanda-anexos`
  - **Financeiro/** ← `financeiro-comprovantes`
  - **Formulários/<Banco>/** ← `formularios-bancarios`
  - **Arquivos/<caminho de pastas>/** ← novo módulo `arquivos_nos`
  - Nomes saneados e sem colisão (sufixo numérico), signed URLs curtas.

### Cliente (compactação no navegador)
- Botão **Baixar documentos (ZIP)** na tela de Backup.
- Usa `jszip` (client) para baixar cada URL, montar a árvore de pastas conforme o `pasta` do inventário e gerar um único `.zip` (`documentos-backup-AAAA-MM-DD.zip`), salvo via `file-saver`/blob. Feito no cliente para não estourar memória do runtime serverless.
- Barra de progresso (baixados/total) e tratamento de falhas por arquivo (continua e lista os que falharam).

## Detalhes técnicos
- Novo pacote: `jszip` (bun add). Download/zip roda no browser.
- Upload de arquivos/pastas: client faz `supabase.storage.from('arquivos').upload(path)` e depois chama `registrarArquivo`; caminho no storage = `${correspondente_id}/${uuid}-${nome}`.
- Exclusão recursiva: server fn resolve descendentes e remove objetos do storage em lote.
- Todas as server fns com `requireSupabaseAuth` e escopo por correspondente; nada de dado mockado.
- Marca branca preservada (sem citar provedores externos na UI).

## Fora de escopo
- Compartilhamento/permissões por arquivo entre usuários (só escopo por correspondente).
- Versionamento de arquivos.
