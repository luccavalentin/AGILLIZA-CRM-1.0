## Objetivo

Reduzir `src/lib/simulacao/use-simulacao-completa.ts` (1246 linhas) sem alterar **nenhum comportamento**. O hook orquestra todo o fluxo da simulação completa (formulário, regras de LTV/prazo, restrições por produto, envio síncrono ou "SAC+PRICE"), então qualquer refatoração agressiva pode quebrar o envio para o banco.

Adoto uma abordagem **puramente aditiva e conservadora**: extrair apenas o que é puro/sem closure. O hook principal continua sendo a fonte da verdade e apenas re-exporta/consome os módulos.

## Etapas (ordem = risco crescente)

**Fase 1 — Zero risco (constantes e tipos puros):**
- Novo `src/lib/simulacao/use-simulacao-completa/state.ts`:
  - `Form`, `Banco`, `OpcoesHook` (tipos)
  - `EMAIL_PADRAO`, `ESTADO_INICIAL` (constantes)
- Novo `src/lib/simulacao/use-simulacao-completa/bancos-helpers.ts`:
  - `aceitaPrice(b)` — função pura já isolada

**Fase 2 — Baixo risco (regras puras derivadas de `f`):**
- Em `bancos-helpers.ts` extrair `calcularRestricaoEspecial(f)` (linhas 241-263) — depende só de `f`, hoje já é `useMemo` puro. O hook passa a chamar `useMemo(() => calcularRestricaoEspecial(f), [f...])`.
- Extrair `criarAceitaBanco(operacoes, isHomeEquity, restricao, tipoImovel)` retornando `{ aceita, motivo }` — encapsula `aceitaBancoNaOperacao` + `mensagemBancoIncompativel`.

**Fase 3 (opcional, só se F1+F2 ficarem verdes):**
- Extrair as funções de "recálculo cruzado" (`aplicarPorEntrada`, `aplicarPorFinanciamento`, `aplicarPorParcela`, `aplicarJogadaNumeros`) para `calculos.ts` recebendo `f` e retornando um patch parcial de `Form`. O hook só faz `set` do resultado.

**Não vou mexer** (alto risco de quebrar envio):
- `enviar`, `enviarAmbos`, `executarEnvio` (linhas 867-1182) — dependem de ~20 closures do hook. Refatorar isso exige testes E2E que não temos.
- `useEffect` de duplicação/origem, sincronização de LTV, atualização de prazo por idade.
- `return { ... }` final — a superfície pública fica **idêntica**.

## Validação

Após cada fase:
1. `bunx tsgo` — zero erros novos.
2. Conferir que a assinatura de retorno do hook não mudou (mesmas chaves).
3. `wc -l` no arquivo principal para medir ganho.

Meta realista: **1246 → ~1000 linhas** (-20%) só com F1+F2. F3 pode chegar a ~800 se der certo.

## Se algo quebrar

Reverto imediatamente a fase problemática (arquivos novos são autocontidos e o `use-simulacao-completa.ts` fica intacto até o `import` ser trocado). Nada é fundido em uma etapa que impeça rollback.
