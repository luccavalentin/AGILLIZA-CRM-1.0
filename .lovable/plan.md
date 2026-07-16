
## O que muda

Hoje o sistema já calcula uma comissão única por proposta (`comissoes` + trigger `on_proposta_contrato_emitido`) e gera 1 Receber (banco → correspondente) + 1 Pagar (repasse ao parceiro). Isso continua funcionando como "Repasse".

Vou criar acima disso uma camada de **Comissões por usuário**, muito parecida com Repasses, mas com N destinatários por contrato, cada um com sua % configurada por aba (Corretor, Imobiliária, Analista, Comercial Agilliza etc.).

## Modelo de dados

Duas tabelas novas + reaproveitar `financial_payables` (mesma tela de Contas a Pagar, filtrada por "Comissão").

### `comissao_regras_usuario` (regra por usuário)
Configuração persistente, editável em `/financeiro/comissoes/regras`.

- `usuario_id` (FK profiles) — o comissionado
- `tipo_vinculo` — enum: `corretor` | `imobiliaria` | `parceiro` | `comercial_agilliza` | `analista` | `outro` (só rótulo/aba)
- `gatilho` — enum: `contrato_emitido` (default) | `credito_aprovado` | `assinatura_contrato` | `registro_imovel` | `manual`
- `base_calculo` — enum: `valor_contrato` | `percentual_repasse`
- `percentual` — numeric — quando `valor_contrato` = % do valor financiado; quando `percentual_repasse` = % em cima do repasse do correspondente (não do bruto do banco)
- `banco_nome` — text NULL (regra por banco; NULL = todos)
- `produto` — text NULL (financiamento, home_equity etc.; NULL = todos)
- `vigencia_inicio`, `vigencia_fim`, `ativo`
- `observacao`

RLS: leitura/escrita apenas para `usuario_pode_financeiro`, escopo `correspondente_do_usuario`.

### `comissoes_usuario` (uma linha por (proposta × usuário))
Uma comissão gerada por proposta+destinatário. Distinta de `comissoes` (que é a comissão-mãe do correspondente).

- `proposta_id`, `usuario_id`, `regra_id`
- `gatilho`, `base_calculo`, `percentual`
- `valor_base` (valor cheio do contrato OU repasse do correspondente conforme base)
- `valor_comissao`
- `status` — `a_pagar` | `paga` | `cancelada`
- `payable_id` (FK financial_payables — mesma tabela do Repasse)
- `banco_nome`, `produto`, `numero_proposta` (denormalizados p/ relatório)

RLS igual à `comissoes`.

## Cálculo

Função `calcular_comissoes_usuario_proposta(_prop_id uuid)`:

1. Só roda quando `propostas.status = 'contrato_emitido'` (por enquanto; o campo `gatilho` cobre extensões futuras).
2. Para cada regra ativa cujo `gatilho`+`banco`+`produto` casa, calcula:
   - `valor_contrato`: `percentual * valor_financiamento / 100`
   - `percentual_repasse`: pega `comissoes.valor_bruto` (repasse do correspondente pelo banco naquele contrato) e faz `percentual * valor_bruto / 100`
3. Insere em `comissoes_usuario` (evita duplicidade por (proposta_id, usuario_id, regra_id)).
4. Cria linha em `financial_payables` com descrição "Comissão contrato PRO-xxxx — {nome usuário}", `parceiro_id = usuario_id`, `vencimento = hoje+35d`, categoria "Comissão".
5. Registra em `financial_audit_logs`.

Trigger `on_proposta_contrato_emitido` ganha uma chamada extra: depois de `calcular_comissao_proposta` (que garante que `comissoes.valor_bruto` já existe = base do repasse), chama `calcular_comissoes_usuario_proposta`.

Também exponho server fn `recalcularComissoesProposta` para o financeiro re-rodar manualmente após editar regras.

## UI — `/financeiro/comissoes`

Duas rotas, com abas no header:

### `/financeiro/comissoes/lancamentos`
Lista de `comissoes_usuario` (visual idêntico à tela de Repasses):
- Filtros: usuário, banco, status, período, gatilho.
- Colunas: nº proposta, cliente, banco, usuário comissionado, tipo vínculo, base, %, valor, status, vencimento.
- Ação: "Marcar paga" (integra com `financial_payables.status`), "Recalcular", "Cancelar".
- Botão "Exportar XLSX/PDF" (reaproveita `report-exports`).

### `/financeiro/comissoes/regras`
CRUD de `comissao_regras_usuario` com **abas por `tipo_vinculo`** (Corretores | Imobiliárias | Analistas | Comercial Agilliza | Parceiros | Outros). Cada aba lista os usuários com regras + botão "Nova regra".

Form da regra (Dialog):
- Usuário (ComboSelect com filtro pelo tipo/aba)
- Tipo de vínculo (pré-preenchido pela aba)
- Gatilho (select)
- Base de cálculo (radio: "Valor do contrato" | "% do repasse do correspondente")
- Percentual (0-100)
- Banco (opcional — todos por default)
- Produto (opcional)
- Vigência início/fim
- Ativo (switch)

Ao trocar "Base" para "% do repasse", mostra dica: "O cálculo usa o repasse que o correspondente recebeu do banco (valor bruto de `comissoes`). Ex.: repasse R$ 10.000 × 20% = R$ 2.000 para este usuário."

## Menu

Em `/financeiro`, adicionar sub-item "Comissões" ao lado de "Repasses" (Contas a Pagar já existe). Guard: `can_view_financial` / `usuario_pode_financeiro`.

## Detalhes técnicos

- Migração cria as 2 tabelas + enums + trigger + função de cálculo, com GRANT authenticated/service_role e RLS por correspondente.
- Server fns em `src/lib/financeiro/comissoes-usuario.functions.ts` (listar, criar/editar regra, listar regras, recalcular, marcar paga/cancelada).
- Componentes: `src/components/financeiro/comissoes-usuario/` (`lancamentos-tabela.tsx`, `regras-abas.tsx`, `regra-form.tsx`).
- Rotas `src/routes/_authenticated/financeiro.comissoes.lancamentos.tsx` e `.regras.tsx`.
- Zero mock, tudo Supabase + realtime nas mudanças de status.

## Fora de escopo (não faço agora)

- Mudar o repasse-mãe existente (`comissoes` + trigger atual) — segue como está.
- Cronograma de pagamento parcelado da comissão (fica como 1 payable único; pode ser evoluído depois).
- Aprovações multi-nível antes de virar payable.

Confirma que sigo com essa modelagem?
