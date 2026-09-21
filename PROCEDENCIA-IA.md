# Procedência: este sistema foi construído com inteligência artificial

Registro público de como o Agilliza CRM foi escrito, para quem audita, contrata,
integra ou assume a manutenção deste código. Atualize sempre que a forma de
trabalho mudar.

Última verificação: **21/09/2026** (commit `02d05afd`).

## Declaração

Praticamente todo o código deste repositório foi escrito por agentes de
inteligência artificial, sob direção, revisão e aprovação humana de
**Lucca Valentin Santana**, responsável pelo produto. Nenhuma linha entra em
produção sem passar por `tsc`, ESLint, a suíte de testes e o `git push` feito
pelo responsável.

## Como conferir você mesmo

A procedência está no próprio histórico do Git, não só neste arquivo.

```bash
# Commits assinados por IA (trailer Co-Authored-By)
git log --grep="Co-Authored-By: Claude" --oneline | wc -l

# Total de commits
git rev-list --count HEAD

# Quem tocou um arquivo específico
git log --follow --format="%h %ad %s" --date=short -- src/lib/propostas/enviar.server.ts
```

## Números da última verificação

| Medida | Valor |
| --- | --- |
| Commits no histórico | 198 |
| Commits com co-autoria de IA declarada | 188 (95%) |
| Commits sem o trailer | 10 — merges, reverts e o import inicial |
| Arquivos em `src/` tocados por commits de IA | 364 de 850 |
| Período | 20/08/2026 a 21/09/2026 |

Os 10 commits sem trailer não são trabalho humano manual: são merges de
branches cujos commits têm o trailer, reverts automáticos e o import inicial do
workspace gerado no Lovable.

## Ferramentas de IA usadas

| Ferramenta | Papel | Rastro no repositório |
| --- | --- | --- |
| **Lovable** | Andaime inicial do projeto (template TanStack Start) e primeiras telas | `.lovable/` (plano, QA por etapa, `project.json` com o template `tanstack_start_ts_current`) |
| **Claude (Anthropic), via Claude Code** | Implementação, correções, testes, migrações e integrações bancárias | Trailer `Co-Authored-By: Claude …` em cada commit; `AGENTS.md`; `.claude/` |

## Marcas dentro do produto

- **HTML**: a página serve `<meta name="generator">` e `<meta name="ai-generated">`
  (ver `src/routes/__root.tsx`). Qualquer pessoa vê com "exibir código-fonte".
- **Arquivo público**: `/ai.txt` na raiz do site, no mesmo espírito de
  `robots.txt`, para leitura automatizada.
- **Código**: `src/lib/procedencia.ts` concentra a declaração usada pelas duas
  marcas acima.

## Revisão humana

- O responsável aprova cada mudança antes do push; o deploy sai do `main`.
- Regras de negócio sensíveis (integração bancária, documentos, comissões)
  têm teste automatizado — 316 testes na última verificação.
- Decisões de produto que a IA não pode tomar sozinha ficam registradas nos
  comentários do código e nas mensagens de commit, com o motivo e a data.
