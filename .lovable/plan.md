## Escopo

Reestruturar o módulo CRM (painel/esteira/ficha/lista/documentos) em componentes reutilizáveis, mantendo 100% do comportamento atual. Sem mudanças de lógica de negócio, RLS, queries, formatos de PDF ou telemetria.

Arquivos alvo (por tamanho e concentração de responsabilidades):

| Arquivo | Linhas | Ação |
|---|---|---|
| `routes/_authenticated/crm.painel.tsx` | 1608 | Explodir em `components/crm/painel/*` |
| `components/crm/documentos-gerais.tsx` | 1529 | Extrair para `components/crm/documentos-gerais/*` |
| `routes/_authenticated/crm.chat.tsx` | 1193 | Extrair para `components/crm/chat-gestao/*` |
| `components/crm/documentos-checklist.tsx` | 1132 | Extrair para `components/crm/documentos-checklist/*` |
| `components/crm/documentos-tab.tsx` | 1059 | Extrair para `components/crm/documentos-tab/*` |
| `routes/_authenticated/crm.clientes.tsx` | 784 | Extrair para `components/crm/lista-clientes/*` |
| `components/crm/vendedores-tab.tsx` | 687 | Extrair para `components/crm/vendedores-tab/*` |
| `routes/_authenticated/crm.clientes_.$id.tsx` | 659 | Extrair para `components/crm/ficha-cliente/*` |
| `components/crm/cliente-form.tsx` | 532 | Reduzir a wrapper — sub-seções já existem em `cliente-form/` |
| `components/crm/chat-cliente-tab.tsx` | 560 | Consolidar em `chat-cliente/` (subpasta já existe) |

## Padrão de reestruturação

Para cada tela grande:

```text
components/crm/<feature>/
  index.tsx            # composição e estado orquestrador
  types.ts             # tipos locais e contratos
  hooks/
    use-*.ts           # queries + estado (uma responsabilidade por hook)
  components/
    <bloco>.tsx        # apresentação pura, props tipadas
```

Regras:
- Cada componente extraído recebe props tipadas, sem acessar `useQuery` direto salvo quando é dono do dado.
- Hooks isolam `useServerFn` + `useQuery` + `useMutation` + realtime.
- Utilidades puras (formatação, filtros, mapeamentos de status) vão para `<feature>/utils.ts`.
- Rotas ficam com <60 linhas: `head()`, guards, e `<FeatureRoot/>`.
- Zero alteração em `src/lib/crm/*.functions.ts` (server functions permanecem).

## Ordem de execução

1. **Painel CRM** (`crm.painel.tsx`) — maior impacto. Extrair: `HeaderPainel`, `FiltrosPainel`, `ColunasEsteira`, `CardCliente`, `MenuAcoesCliente`, `PastaArquivados`, `ContratoEmitido`, hooks `use-painel-esteira`, `use-realtime-painel`.
2. **Ficha do cliente** (`crm.clientes_.$id.tsx`) — extrair `CabecalhoFicha`, `AbasFicha`, `AbaResumo`, `AbaSimulacoes`, `AbaPropostas`, hook `use-cliente-ficha`.
3. **Lista de clientes** (`crm.clientes.tsx`) — extrair `ToolbarClientes`, `TabelaClientes`, `FiltrosClientes`, hook `use-lista-clientes`.
4. **Chat CRM** (`crm.chat.tsx`) — extrair `ChatSidebar`, `ChatConversa`, `EtiquetasBar`, hook `use-chat-gestao`.
5. **Documentos** (3 arquivos) — extrair `PastaTree`, `ArquivoRow`, `ChecklistItem`, `UploadDropzone`, hooks `use-documentos-*`.
6. **Cliente form + chat-cliente-tab** — consolidar wrappers finos que apenas montam as subpastas já existentes.

## Garantias

- Nenhuma migração de banco.
- Nenhuma mudança em server functions, RLS, tokens de design.
- Sem alterar rotas públicas ou nomes de arquivos de rota (URLs preservadas).
- Após cada passo: build + typecheck limpos antes de seguir para o próximo.

## Fora de escopo

- Otimização de queries (foi entregue turno anterior).
- Refino visual/UX (foi entregue turno anterior).
- Refatoração de módulos fora do CRM.

## Entrega incremental

Dado o volume (~10k linhas afetadas), executo em turnos sequenciais nesta ordem: (1) Painel → (2) Ficha → (3) Lista → (4) Chat → (5) Documentos → (6) Wrappers finos. Ao fim de cada passo, sinalizo pronto para você validar antes do próximo — assim regressões ficam isoladas e reversíveis.
