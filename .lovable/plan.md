# Reestruturação de Acessos (Papéis + Tipos de Pessoa)

Tela única `/admin/pessoas` com três abas: **Pessoas**, **Papéis** e **Tipos de Pessoa**. Papel guarda a matriz de permissões (como hoje); Tipo de Pessoa vira cadastro editável; login continua por pessoa.

## 1. Banco de dados (migração)

**Nova tabela `tipos_pessoa`** (o "target" que marca o usuário, editável por correspondente):
- `nome`, `descricao`, `acesso_tipo` (`sistema` = Interno Correspondente | `portal_parceiro` = Parceiro), `login_padrao` (bool, sugestão), `ativo`, `is_padrao`, `correspondente_id`.
- GRANTs para `authenticated`/`service_role`; RLS por `correspondente_id` (gerenciável por quem tem `pode_gerenciar_pessoas`).
- Seed dos três atuais (Usuário/Interno, Imobiliária, Corretor) por correspondente.

**Escopo Personalizado**:
- Adicionar valor `personalizado` ao enum `escopo_dados`.
- Nova tabela `permission_escopo_alvos` para guardar, por `permissions.id`, os alvos escolhidos: `alvo_tipo` (`usuario` | `papel` | `tipo_pessoa`) + `alvo_id`/`alvo_valor`.
- Atualizar `usuario_escopo_dados` e as funções `usuario_tem_acesso_*` para, quando o escopo for `personalizado`, liberar registros cujos donos estejam nos alvos (por usuário, por papel ou por tipo de pessoa).

**Profiles**: `tipo_pessoa` passa a referenciar `tipos_pessoa` (mantém coluna texto por compatibilidade, resolvida pelo nome/slug).

## 2. Server functions

- `tipos-pessoa.functions.ts`: `listarTiposPessoa`, `criarTipoPessoa`, `atualizarTipoPessoa`, `excluirTipoPessoa` (bloqueia exclusão se houver pessoas vinculadas; exige `pode_gerenciar_pessoas`).
- `regras-modulos.functions.ts`: estender `salvarPermissoes` para persistir alvos do escopo `personalizado`; `listarNiveisAcesso` retorna os alvos.
- `pessoas.functions.ts`: campo `tipo_pessoa` passa a aceitar id de `tipos_pessoa`; login por pessoa (com login → e-mail obrigatório, senha provisória = e-mail; sem login → e-mail opcional) permanece.

## 3. UI (`/admin/pessoas`)

- Abas: **Pessoas** (lista atual) · **Papéis** (painel de regras/matriz existente, renomeado) · **Tipos de Pessoa** (novo CRUD: nome, tipo de acesso Parceiro/Interno, login padrão, ativo).
- No formulário de pessoa, o seletor de Tipo de Pessoa passa a ler de `tipos_pessoa`.
- Na matriz de permissões, ao escolher escopo **Personalizado**, abrir seletor de alvos (usuários, papéis e/ou tipos de pessoa).

## Notas técnicas

- Alteração de enum e de funções `SECURITY DEFINER` em uma única migração; funções recriadas com `CREATE OR REPLACE`.
- Exclusão de papel/tipo protegida por verificação de vínculos.
- Tudo respeita RLS por `correspondente_id` e `pode_gerenciar_pessoas`.
