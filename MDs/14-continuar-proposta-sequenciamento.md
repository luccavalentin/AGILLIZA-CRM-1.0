# Prompt — "Continuar proposta" (sequenciamento pós-aprovação)

> Cole este prompt inteiro no agente de código. Ele descreve O QUE construir, ONDE no código
> e QUAIS regras de integração (HomeFin) respeitar. Siga `MDs/00-convencoes-globais-v2.md`
> e `MDs/05-propostas-integracao-bancaria-v2.md`.

---

## Objetivo

Criar o fluxo **"Continuar proposta"** no menu "⋯" da lista de propostas
(`src/components/propostas/lista-page/menu-acoes-proposta.tsx`). É um assistente em etapas
para seguir a proposta **depois da aprovação de crédito**: conferir/editar todos os dados,
anexar e enviar documentos (CRM + HomeFin + banco) e avançar nas etapas seguintes.

Tudo o que for gravado nesse fluxo precisa ficar **sincronizado nos três lugares**:
**CRM (Supabase)** ⇄ **HomeFin** ⇄ **Banco** (quando a API permitir).

---

## 1. Quando o fluxo aparece (regra de elegibilidade)

- Mostrar o item **"Continuar proposta"** no menu "⋯" **somente** quando:
  - `propostas.status` ∈ `credito_aprovado`, `credito_condicionado`, **ou** uma etapa posterior
    ativa (`aguardando_documentos`, `engenharia_vistoria`, `analise_juridica`); **e**
  - existe ao menos uma linha em `proposta_bancos` com `status_banco` ∈ `aprovada/aprovado/condicionado`.
- Em qualquer outro status (rascunho, em análise, **crédito recusado**, erro de envio, cancelada,
  contrato emitido) o item **não aparece**.
- O fluxo trabalha **apenas com o banco que aprovou** (linha aprovada/condicionada de `proposta_bancos`).
- Revalidar a elegibilidade **no servidor** (não confiar só na UI) — ver `src/lib/propostas/state-machine.ts`.
- Liberar edição em `credito_aprovado` e `credito_condicionado` (hoje `STATUS_EDITAVEIS` só tem
  `rascunho` e `aguardando_documentos`).

Outros itens do menu "⋯" (mesma regra de status):
- **Abrir proposta** (sempre)
- **Continuar proposta** (regra acima)
- **Baixar carta de análise** (já existe)
- **Sincronizar com o banco** → `sincronizarProposta`
- **Cancelar proposta** → `cancelarProposta` (pede motivo)
- **Excluir proposta** → `excluirProposta` (só se cancelada ou nunca enviada)

---

## 2. Estrutura da tela

Abrir em **Sheet lateral largo (desktop)** / **tela cheia (mobile)**, com:

**Cabeçalho fixo**
- Cliente, CPF, nº da proposta, logo do banco aprovado.
- Resumo da aprovação: valor aprovado, parcela, taxa a.a., prazo, amortização (dados de `proposta_bancos`).
- Se `credito_condicionado`: **alerta amarelo** com as condições do banco (`retornoIntegracao` /
  mensagem gravada) e uma lista de condições para marcar como resolvidas.

**Stepper**
```
① Conferência de dados → ② Documentos → ③ Engenharia/Vistoria → ④ Análise jurídica → ⑤ Contrato
```
- Etapas ③–⑤ usam as transições já existentes (`moverStatusProposta`).
- Não permitir pular etapas; permitir voltar para ① e ② a qualquer momento.

---

## 3. Etapa ① — Conferência de dados ("Gravar e avançar")

Formulário **completo e pré-preenchido**, em seções colapsáveis, reaproveitando os componentes
de `src/components/crm/cliente-form/*`:

| Seção | Campos |
|---|---|
| Comprador | nome, CPF, nascimento, sexo, estado civil, regime de casamento, nome da mãe, e-mail, celular |
| Identidade | tipo (RG/CNH), número, órgão expedidor, UF, data de expedição |
| Profissão/Renda | profissão, empresa, renda |
| Cônjuge (se houver) | mesmos campos + renda + compõe renda |
| Endereço | CEP (busca automática), logradouro, número, complemento, bairro, município, UF |
| **Dados bancários** | banco, **agência**, **conta**, **dígito** |
| Vendedor(es) + cônjuge | dados pessoais, documento, endereço, dados bancários |
| Imóvel | tipo, uso, situação (novo/usado), endereço, contato e telefone da avaliação |
| Valores | valor do imóvel, valor financiado, prazo, amortização, FGTS, financiar despesas |

**Regras de edição**
- Campos **livres**: agência, conta, dígito, contato, endereço, dados complementares.
- Campos **sensíveis** (valor do imóvel, valor financiado, prazo, renda, participantes): permitir, mas
  exibir aviso "Alterar este campo pode levar o banco a reanalisar o crédito" e pedir confirmação.
- Validar CPF, CEP, e-mail, celular, datas e formatos antes de gravar.

**Botão "Gravar e avançar"**
1. Calcular o **diff** entre o valor original e o editado.
2. Sem diff → apenas avança para ②.
3. Com diff → nova server function `salvarConferenciaProposta`:
   - grava no **CRM**: cadastro do cliente (`atualizarCliente`, `salvarEndereco`, `salvarVendedor`),
     envolvidos (`atualizarEnvolvido`) e proposta (`atualizarDadosProposta`);
   - envia à **HomeFin** apenas o que mudou:
     - participantes → `PUT /oportunidade/{idOportunidade}/participante/{idParticipante}`
       (inclui `codigoAgencia`, `codigoContaCorrente`, `digitoContaCorrente`);
     - valores → `PUT /oportunidade/{id}` **somente com** `valorImovel`, `valorFinanciamento`, `prazo`
       (qualquer outro campo gera HTTP 500 — ver comentário em `enviar.server.ts`);
   - registrar em `proposta_historico` (o que mudou, antes/depois, usuário) e o log em `proposta_logs_homefin`;
   - marcar a proposta como **"dados alterados desde o último envio ao banco"**.
4. Falha na HomeFin → **não avança**, mostra o erro sanitizado (`sanitizarMensagemErro`) junto ao
   bloco que falhou e oferece "Tentar novamente". O CRM continua gravado.
5. Se campos sensíveis mudaram, mostrar o botão **"Sincronizar com o banco"**, que reenvia via
   `enviarPropostaHomeFin` (`incluir-proposta-integracao`) com aviso de reanálise.

---

## 4. Etapa ② — Documentos (checklist por seção)

Reaproveitar `src/components/crm/documentos-checklist/*` (`secao-comprador`, `secao-vendedor`,
`secao-imovel`, `doc-item`, `use-checklist-state`) — o **mesmo checklist do CRM**.

**Layout**
```
▸ COMPRADOR              4/6  [☐ selecionar seção]   [Enviar seção]
   ☐ RG/CNH           arquivo.pdf  ● Enviado ao banco     [👁] [🗑] [⬆ Enviar]
   ☐ Comprov. renda   renda.pdf    ○ Salvo no CRM         [👁] [🗑] [⬆ Enviar]
   ☐ Imposto de renda —            ◌ Pendente             [📎 Anexar]
▸ CÔNJUGE DO COMPRADOR
▸ VENDEDOR
▸ CÔNJUGE DO VENDEDOR
▸ IMÓVEL
▸ OUTROS
```
Rodapé fixo: **[Salvar]** · **[Enviar selecionados (n)]** · **[Enviar pacote completo]**.

**Anexar + Salvar**
- Aceitar PDF, PNG ou JPEG até **5 MB** (validar no cliente e no servidor).
- Ao salvar: storage do Supabase + `cliente_documentos` via `anexarDocumento`, com a `categoria`
  correta (`comprador`, `conjuge`, `vendedor`, `vendedor_conjuge`, `imovel`, `outros`).
- O documento aparece **imediatamente** no checklist do CRM (mesma fonte de dados).
- Upload feito pela tela do CRM também aparece aqui (invalidar as queries dos dois lados).

**Enviar individual (⬆ na linha)**
- Usa `enviarDocumentoAnexadoAoBanco` / `enviarDocumentosBancoImpl` com `documentoIds: [id]`.

**Enviar selecionados / seção / pacote completo**
- `enviarDocumentosBancoImpl({ documentoIds })` com a lista marcada.
- Sequência obrigatória (swagger HomeFin):
  1. `GET /oportunidade/{id}/documentos` → casar cada documento com o `idDocumento` da vaga
     (`documentos-vagas.ts`: dono pela categoria, nunca na vaga de outro participante);
  2. `POST /documento/{idDocumento}/upload` (multipart: `arquivo` + `documentoAprovado=false`,
     conforme orientação da HomeFin) para cada arquivo → guardar o `idArquivo` retornado;
  3. `POST /oportunidade/{id}/incluir-documentos-integracao` com `{ idSimulacao }` **uma única vez**
     no final do lote (nunca em paralelo: a HomeFin devolve 400 INT-007 em chamada concorrente).
- Travar os botões de envio enquanto o lote roda (um envio por oportunidade por vez).
- Ao terminar, abrir o **resumo do lote** (usar a resposta `SendDocumentsResponse`):
  enviados (`sucesso`), com erro (`erro[].erroIntegracao`), ignorados (`ignorados[].descricaoMotivo`)
  e `etapasChecklistIndisponiveis`.

**Status por documento** (gravar em `cliente_documentos` ou em tabela de vínculo):
`pendente` → `salvo_crm` → `na_homefin` (tem `idArquivo`) → `enviado_banco` | `erro_banco` (com mensagem).
Atualizar a partir de `GET /oportunidade/{id}/documentos` (`situacaoIntegracao`, `mensagemIntegracao`).

**Excluir arquivo**
- Remove do CRM (`excluirDocumento`) e, se já tiver `idArquivo`, chama `DELETE /documento/arquivo/{idArquivo}`.
- Pedir confirmação.

**Limites da API a deixar claros na UI**
- `incluir-documentos-integracao` só envia ao **Bradesco**. Para Itaú/Santander mostrar
  **"Enviado à HomeFin"** (não "Enviado ao banco").
- O lote do banco considera **todos** os documentos pendentes da oportunidade; um envio
  "individual" pode levar junto outro documento pendente — exibir isso no resumo.
- `documentoAprovado=false` é decisão fechada (orientação da HomeFin). Não alterar.

**Avançar para ③**: habilitado quando todos os documentos **obrigatórios** estiverem ao menos na HomeFin.
Usar `moverStatusProposta` → `aguardando_documentos` → `engenharia_vistoria`.

---

## 5. Cancelar e excluir

- **Cancelar**: dialog com motivo obrigatório → `cancelarProposta` (já chama
  `cancelarPropostaHomefinImpl`: `PUT /oportunidade/{id} { tipoSituacao: "C" }` só no último uso da
  oportunidade) + follow-up na HomeFin com o motivo. Se falhar → `cancelamento_pendente_banco = true`
  e mostrar selo "Cancelamento pendente no banco".
  ⚠️ Validar em homologação se o `PUT` com `tipoSituacao` é aceito (há comentário no código dizendo
  que esse PUT só aceita valorImovel/valorFinanciamento/prazo).
- **Excluir**: permitido só para proposta **cancelada** ou **nunca enviada**. Soft delete (`excluirProposta`).
  A API HomeFin **não tem exclusão**: excluir = cancelar na HomeFin + soft delete local.
  Exclusão definitiva só para admin (`excluirPropostaDefinitivamente`).

---

## 6. Requisitos técnicos

- TanStack Start `createServerFn` + `useServerFn` + React Query; invalidar `obterProposta`,
  `listarPropostas` e as queries de documentos do cliente depois de cada gravação.
- Toda chamada à HomeFin passa por `chamarIntegracao` / `enviarArquivoIntegracao` (token, log, erros).
- Permissões: respeitar `permissions.functions.ts` e o escopo do correspondente.
- Auditoria: `proposta_historico` para cada gravação, envio, cancelamento e exclusão.
- Responsivo (desktop e mobile), tokens de cor de `MDs/00b-tons-cores-design-tokens-v2.md`.
- Estados de carregamento, vazio e erro em todas as seções; nunca deixar um botão travado sem feedback.

## 7. Testes

- Unitários: elegibilidade do menu (aprovada/condicionada sim; recusada/cancelada não); diff da
  conferência; escolha dos payloads de PUT; categorias → vaga do documento; montagem do resumo do lote.
- Integração (mock HomeFin): Gravar e avançar com e sem diff; falha no PUT não avança;
  pacote com sucesso/erro/ignorados; envio concorrente bloqueado; exclusão de arquivo remove nos dois lados.

## 8. Critérios de aceite

- [ ] "Continuar proposta" só aparece para crédito aprovado/condicionado (e etapas seguintes).
- [ ] Etapa ① mostra **todos** os dados do cadastro, inclusive agência/conta, e "Gravar e avançar" grava no CRM e na HomeFin.
- [ ] Etapa ② mostra o checklist separado em Comprador / Cônjuge / Vendedor / Cônjuge do vendedor / Imóvel / Outros.
- [ ] Upload fica salvo no CRM e aparece no checklist do cliente.
- [ ] É possível enviar 1 documento, uma seção ou o pacote completo; os documentos chegam na HomeFin (e no Bradesco).
- [ ] Resumo do envio lista enviados, erros e ignorados com o motivo.
- [ ] Cancelar/Excluir sincronizam com a HomeFin conforme as regras acima.

## Pendências para confirmar com a HomeFin

1. Os PUTs de participante/oportunidade refletem no banco após a proposta enviada, ou é preciso reenviar?
2. `PUT /oportunidade {tipoSituacao:"C"}` cancela de fato e comunica o banco?
3. Há previsão de envio de documentos para Itaú e Santander?
