# Financeiro da matriz — diagnóstico e plano (C45a, 26/10/2026)

Pedido do dono: refatorar por completo contas a pagar e a receber do Agilliza Correspondente, que é a matriz do
ecossistema (contratos, licenças dos assinantes, repasses, comissões), **sem** Asaas, webhook, cobrança por API ou
movimento automático de dinheiro. Este documento foi escrito **antes** do código, a partir do banco fiel local
(`a5_eco_modelo`: Supabase simulado + 261 migrações do Agilliza + 297 do Agilliza Tech) e da leitura das telas.

## 1. O que existe hoje

### 1.1 Banco do Agilliza (esquema `public`)

| Objeto | Origem | O que faz de verdade | Problemas encontrados |
|---|---|---|---|
| `financial_payables` / `financial_receivables` | 20260703222646 (+ parcelas, `origem_tipo/origem_ref`) | Contas a pagar/receber com `valor_pago`, `status` (`aberta/parcial/paga/atrasada/cancelada/estornada`), recorrência, comprovante (`comprovante_path`), `comissao_id` | A baixa grava `valor_pago` direto na linha (sem livro de pagamentos: 2 baixas parciais viram 1 número); RLS `FOR ALL` por **papel** (`usuario_pode_financeiro`): quem tem o papel e só "Ver" na matriz edita/baixa pela API; nada impede baixar duas vezes em paralelo; RH (folha e adiantamento) grava aqui direto. |
| `comissoes` + `comissao_regras` | idem | Comissão **do banco** por proposta: `calcular_comissao_proposta` roda no gatilho `contrato_emitido`, aplica a regra do banco (percentual/fixo, faixa, produto, banco, vigência) e cria **automaticamente** uma conta a receber "aberta" (banco → correspondente) e uma conta a pagar ao parceiro (`split_parceiro`) | Mistura previsão com conta a receber; não há valor informado pelo banco, recebido, divergência nem contestação; a conta a pagar do parceiro duplica a comissão do parceiro do outro fluxo; o portal do parceiro soma `split_parceiro` como "comissão pendente". |
| `comissao_regras_usuario` + `comissoes_usuario` | 20260716201016, 20260730*, 20260731134703 | Comissão por usuário (corretor, parceiro, analista…) por gatilho de etapa; cada lançamento cria uma conta a pagar | **`sincronizar_comissoes_usuario_regra` recalcula o histórico quando a regra muda** (proibido pelo dono); `excluir_regra_comissao_usuario` **apaga** lançamentos e contas a pagar; gera comissão até na simulação (`on_simulacao_comissoes_usuario`); um só papel (não há originou/atendeu/participou); estados só `a_pagar/paga/cancelada`; sem parcial, comprovante, aprovação. |
| `financial_categories`, `financial_cost_centers`, `financial_payment_methods` | idem | Cadastros por correspondente | Reaproveitáveis como estão. |
| `financial_audit_logs`, `financial_payable_history` | idem | Logs livres | Qualquer usuário do correspondente **insere** log com o conteúdo que quiser (política `fin_audit_ins`); sem antes/depois nem motivo. |
| `fluxo_caixa` | idem | Diário que a baixa antiga gravava (entrada/saída realizada) e que o fluxo de caixa lia | Duplicava o `valor_pago`; a recorrência "mensal/anual" das contas era só um rótulo (nenhuma ocorrência seguinte era gerada). Substituída pelo livro `fin_baixas`; fica congelada, só leitura. |
| Bucket `financeiro-comprovantes` | 20261019230000 | Comprovantes em `<correspondente>/<arquivo>` | Política por papel, sem separar módulo. |
| Permissões | `regras-modulos.functions.ts` + `usuario_tem_permissao` | Módulos `financeiro.painel`, `contas_pagar` (ver/criar/editar/baixar), `contas_receber` (idem), `comissoes` ("Repasses": ver/editar), `fluxo_caixa` | Não há "editar regras", "aprovar", "confirmar recebimento", "conciliar" separados. |

Máquina de estados das propostas (`proposta_status`): `rascunho → enviada_banco → em_analise_credito → credito_aprovado/condicionado/recusado → aguardando_documentos → engenharia_vistoria → analise_juridica → contrato_emitido → registrado` (+ `cancelada`, `erro_envio` e etapas legadas). Nenhum estado financeiro deriva dela além dos gatilhos acima.

### 1.2 Telas e código do Agilliza

- `src/routes/_authenticated/financeiro.*.tsx`: painel, contas a pagar, contas a receber, fluxo de caixa,
  "Repasses" (`financeiro.comissoes.tsx`, que na verdade lista `comissoes` do banco), "Comissões (usuários)",
  configurações. `src/lib/financeiro/financeiro.functions.ts` (1.754 linhas, baixa gravando `valor_pago` direto),
  `comissoes-usuario.functions.ts`, `src/components/financeiro/**`.
- Dependentes de fora do módulo: RH (`folha.functions.ts`, `submodulos.functions.ts`) cria contas a pagar;
  relatórios (`reports.functions.ts`, `paineis.functions.ts`) leem `financial_*`, `comissoes`, `comissoes_usuario`;
  portal do parceiro lê `comissoes.split_parceiro`; backup exporta as tabelas.

### 1.3 Agilliza Tech (mesmo banco)

| Objeto | O que faz |
|---|---|
| `plataforma.comissoes_assinante` (0229/0242) | Comissão da conta assinante: **nasce só** quando a proposta que passou pela fila do Agilliza chega a `registrado` (gatilho `tg_proposta_registrada_comissao`, uma por proposta); base = financiado aprovado no Agilliza › pedido › aprovado do assinante › simulação; percentual congelado na linha; `a_pagar/paga/cancelada`; baixa só com `receita.editar`; 0242 impede a conta de marcar "registrado" sozinha. |
| `plataforma.configuracoes['comissao_assinante.percentual']` (0,25) e `comissao_assinante_por_conta` | Padrão e percentual próprio (prevalece). Sem vigência: mudar vale "a partir de agora" para as que ainda vão nascer (as nascidas já têm o percentual gravado). |
| `nucleo.faturas_plataforma`, `nucleo.assinaturas`, `receita.receitas_avulsas`, `relatorios.receita_plataforma` | Licenças e faturas da plataforma (`pendente/paga/vencida/cancelada/estornada`), receita avulsa (créditos de consulta, serviços). Lidas no Agilliza pela ponte (`comPlataforma`, módulos `saas.*`). |
| `financeiro.*` (esquema do Agilliza Tech) | Financeiro **da imobiliária/corretor** (T54/T55, frente t6). Fica isolado: este módulo não lê nem escreve lá. |
| `plataforma.abrir_contexto_agilliza` + `permissoes_dos_modulos_agilliza` | Ponte: a pessoa do Agilliza abre o contexto do operador-espelho; admin/correspondente/gestor = super_admin; demais recebem só as permissões dos módulos que podem ver/editar. |

## 2. Desenho (decisões)

Três fluxos separados + operação do correspondente, cada um com tabela, regras, estados e relatório próprios; o
painel junta **sem misturar naturezas**. Toda receita/obrigação aponta para a origem (proposta, contrato, pessoa,
conta assinante, fornecedor). Cada cálculo grava a cópia da regra usada (`origem_calculo`/`regra_snapshot`): mudar a
regra **não recalcula** lançamentos já nascidos. Previsão, informado, recebido, aprovado e pago são colunas/estados
diferentes. Nada move dinheiro sozinho: recebimento e pagamento só por ação de quem tem a permissão ou por
conciliação confirmada por pessoa.

| Fluxo | Fonte de verdade | Reaproveita | Novo |
|---|---|---|---|
| Comissões recebidas dos bancos | `public.comissoes` (estendida) | regra do banco (`comissao_regras`), gatilho de contrato | `situacao` (previsto, a_receber, parcial, recebido, divergente, contestado, cancelado), valor informado pelo banco, recebido (somado do livro de baixas), previsão de recebimento, contrato, cliente, `origem_calculo`, motivos, lançamento manual |
| Repasse aos assinantes | `plataforma.comissoes_assinante` (estendida — **não** há tabela paralela no Agilliza) | gatilho do registro (0229/0242), percentual padrão/por conta | `plataforma.repasse_regras` (padrão ou por conta, percentual, base `valor_financiado/valor_contrato/comissao_recebida`, gatilho, vigência); estados `a_pagar` (previsto), `aguardando_base`, `aprovada`, `parcial`, `paga`, `cancelada`; ajuste justificado; histórico `comissoes_assinante_eventos` |
| Comissões de corretores e parceiros | `public.comissoes_usuario` + `comissao_regras_usuario` (estendidas) | regras por pessoa, gatilho de etapa | percentual **ou** fixo, base (financiado, contrato, comissão do banco), produto/banco/operação, papel (originou/atendeu/participou), participantes por proposta (`fin_proposta_participantes`), estados prevista → aguardando confirmação → aprovada → parcial → paga (+ contestada, ajustada, cancelada), soma ≤ comissão do banco, vencimento, demonstrativo |
| Contas a pagar (despesas) | `public.financial_payables` (estendida) | categorias, centros, formas, recorrência | fornecedor cadastrado (`fin_fornecedores`), boleto (linha digitável/código validados FEBRABAN, beneficiário, documento), rascunho revisável, duplicatas, `natureza` |
| Outras receitas | `public.financial_receivables` (estendida) | idem | `natureza`, origem (ex.: matrícula pedida por terceiro — ponto de integração `fin_receita_de_origem`), licenças lidas do Agilliza Tech |
| Livro de baixas | `public.fin_baixas` (novo) | — | **Todo** recebimento/pagamento efetivo de qualquer fluxo (inclusive repasse, gravado pela função do Agilliza Tech), parcial, estorno com motivo, comprovante |
| Conciliação | `fin_extratos`, `fin_extrato_linhas`, `fin_conciliacoes`, `fin_sugestoes_rejeitadas` (novos) | — | OFX/CSV, sugestões (valor, data ±N dias, descrição, documento), confirmar/rejeitar, índice único impede conciliar 2×, desfazer com motivo |
| Auditoria e anexos | `fin_auditoria` (nova, só inclusão por gatilho), `fin_anexos` | bucket `financeiro-comprovantes` | antes/depois, ator, ação, motivo; anexos por módulo |

### 2.1 Permissões (servidor **e** banco)

Matriz nova (o banco confere em toda função e política com `fin_pode(modulo, acao)`, que usa
`usuario_tem_permissao`; só perfil interno ativo do mesmo correspondente):

| Módulo | Ações |
|---|---|
| `financeiro.painel` | ver, exportar |
| `financeiro.comissoes_bancos` | ver, lançar (`create`), editar (contestar/cancelar/corrigir), editar regras, confirmar recebimento (`receber`) |
| `financeiro.repasses` | ver, editar regras, aprovar, registrar pagamento (`pagar`), editar (ajustar/cancelar) |
| `financeiro.comissoes` (corretores e parceiros) | ver, lançar, editar regras, aprovar, registrar pagamento, editar |
| `financeiro.contas_pagar` | ver, lançar, editar, registrar pagamento (`baixar`) |
| `financeiro.contas_receber` | ver, lançar, editar, confirmar recebimento (`baixar`) |
| `financeiro.conciliacao` | ver, importar extrato (`create`), conciliar |
| `financeiro.fluxo_caixa` | ver, exportar |
| `financeiro.regras` | ver, editar (categorias, centros de custo, formas, contas bancárias, fornecedores, parâmetros) |
| `financeiro.auditoria` | ver |

Migração dos níveis existentes: quem tinha `financeiro.comissoes` ver/editar recebe ver/editar nos três fluxos;
quem baixava contas recebe conciliar; quem via o painel vê auditoria e cadastros. Nos repasses (Agilliza Tech), a
função do banco confere `public.usuario_tem_permissao` da pessoa do Agilliza dona do operador-espelho; operador
nativo da plataforma precisa de `receita.ler`/`receita.editar`.

RLS: tabelas novas com SELECT por permissão e **sem** INSERT/UPDATE/DELETE direto (só funções `SECURITY DEFINER`).
Tabelas reaproveitadas: `comissoes`, `comissoes_usuario` e as regras perdem a escrita direta; `financial_payables`/
`receivables` passam a exigir a permissão da matriz (com exceção estreita para as contas geradas pelo RH, que é outra
frente) e ganham guarda no banco: pagamento, situação, natureza e rascunho só mudam pelas funções; conta com
pagamento não se apaga.

### 2.2 Ordem de implementação e migrações

1. Agilliza `20261027050001_financeiro_matriz_base.sql`: `fin_pode`, parâmetros, contas bancárias, fornecedores,
   anexos, auditoria, livro de baixas, guarda das contas, colunas novas, permissões e migração dos dados legados.
2. Agilliza `20261027050002_financeiro_matriz_fluxos.sql`: comissões dos bancos, participantes e regras, contas a
   pagar/receber (boleto, rascunho, duplicatas), funções de pagamento/recebimento e estorno.
3. Agilliza `20261027050003_financeiro_matriz_conciliacao_painel.sql`: extratos, sugestões, conciliação, painel,
   relatórios, demonstrativo.
4. Agilliza Tech `0327_repasse_assinantes_regras_e_pagamentos.sql`: regras com vigência, estados, eventos, funções
   de aprovar/ajustar/cancelar/pagar (no livro `public.fin_baixas`), compatibilidade das funções da 0229.
5. Agilliza Tech `0328_financeiro_matriz_assinantes.sql`: licenças, inadimplência e repasse por assinante (C45k).
6. Testes pgTAP 716 (repasses), 717 (fluxos do Agilliza), 718 (conciliação, painel, isolamento, C45j).
7. Telas, menu, redirecionamentos e remoção do código morto.

### 2.3 Migração dos dados (sem perder nem duplicar)

- `comissoes` → mesma linha ganha `situacao` (`a_receber` vira `previsto`/`a_receber`/`parcial` conforme a conta a
  receber ligada; `recebida/paga_parceiro/encerrada` → `recebido`) e `origem_calculo` com a regra ligada. O que já
  foi baixado na conta a receber ligada vira baixa no livro (`origem = migracao`); a conta a receber ligada passa a
  `natureza = 'comissao_banco'` e sai das listas e somas de "outras receitas" (era a mesma receita contada duas
  vezes).
- `comissoes_usuario` → mesma linha ganha `situacao` (`a_pagar` → `prevista`, `paga` → `paga`, `cancelada` →
  `cancelada`), `regra_snapshot` com os dados gravados e `valor_pago`; o pago na conta a pagar ligada vira baixa no
  livro e a conta ligada passa a `natureza = 'comissao_participante'` (fora das despesas).
- Split do parceiro em `comissoes` com conta a pagar: vira lançamento de participante (papel "originou") com a
  conta ligada marcada como `comissao_participante`; as já pagas levam a baixa.
- Contas a pagar/receber operacionais: o `valor_pago` vira baixa no livro; o número continua igual (agora somado).
- Repasses: `comissoes_assinante.a_pagar/paga/cancelada` continuam válidos; a paga recebe um pagamento no livro com
  o valor total na data `paga_em`; o percentual padrão e os próprios viram regras com vigência desde o primeiro dia.

### 2.4 O que fica de fora (e por quê)

- Asaas, webhooks, cobrança por API, Pix automático: proibido (C45j). Nenhuma função nova usa `net.*`/`http`.
- Financeiro de imobiliária/corretor (`financeiro.*` do Agilliza Tech, T54/T55): isolado, outra frente.
- OCR de imagem: não há biblioteca instalada; imagem de boleto usa o leitor de código de barras do navegador
  (`BarcodeDetector`) quando existir e, senão, pede a linha digitada/colada, com aviso.

## 3. Junções com outras frentes (registradas na implementação)

- **a2 (Gestão de sistemas › Comissões dos assinantes)**: as funções da 0229 continuam com a mesma assinatura
  (`comissoes_assinantes`, `config_comissao_assinante`, `definir_comissao_assinante`, `atualizar_comissao_assinante`),
  agora por cima do fluxo novo. Para a tela redesenhada, use as da 0327: `repasses_listar(jsonb)`,
  `repasse_detalhe(uuid)`, `repasse_regras_listar()`, `repasse_regra_definir(tenant, percentual, base, inicio, motivo)`,
  `repasse_aprovar(uuid[])`, `repasse_confirmar_base(uuid)`, `repasse_ajustar(uuid, valor, motivo)`,
  `repasse_cancelar(uuid, motivo)`, `repasse_registrar_pagamento(...)`, `repasse_estornar_pagamento(baixa, motivo)` e
  `financeiro_matriz_assinantes(de, ate, busca)`. Abrir uma licença direto: `/plataforma/licencas?conta=<tenant_id>`
  (o financeiro já manda esse parâmetro).
- **a4 (matrículas pedidas por terceiros)**: leitura da visão `public.matriculas_a_receber` e de
  `public.matricula_solicitacoes` por `fin_matriculas_a_receber()` / `fin_matriculas_do_solicitante(chave)` (só leitura;
  o pagamento continua na tela de Matrículas, sem conta a receber paralela). Sem a migração da a4, devolve
  `disponivel = false`. Outra origem de receita que precise de conta a receber própria usa
  `fin_receita_de_origem(origem_tipo, origem_ref, ...)` (idempotente por origem).
- **a3 (contrato registrado)**: a data `public.propostas.contrato_registrado_em` (lida por `to_jsonb`, sem depender da
  coluna) é a data do gatilho da previsão do banco (vigência da regra e previsão de recebimento) quando o gatilho é
  "registrado" e a data da vigência das regras de corretores e parceiros (`fin_data_gatilho`: registro →
  `contrato_registrado_em`, contrato emitido → `contrato_emitido_em`, demais etapas → hoje); no Agilliza Tech, `operacional.propostas.registrado_em` (gravada pela 0316 antes do gatilho) é a data do
  repasse e escolhe a regra vigente naquele dia.
