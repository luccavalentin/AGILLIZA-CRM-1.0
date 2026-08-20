# Etapa 12 — Revisão Final: Comunicação entre Módulos, Revisão de Sistema e Testes de QA

## Escopo desta revisão

1. **Revisão de Comunicação** — todo objeto criado por uma etapa está sendo realmente consumido pelas etapas seguintes.
2. **Revisão de Sistema** — build, tipos, RLS, seeds, marca branca, ausência de integrações proibidas, políticas de segurança, performance mínima.
3. **Testes automatizados de QA** — execução do roteiro 11 em modo checklist.

---

## Parte A — Revisão de Comunicação entre Módulos

### A.1 Fundação → todas as etapas
- [ ] `public.has_role(uuid, app_role)` existe e é usada em todas as policies RLS.
- [ ] Toda tabela de negócio tem coluna `correspondente_id`.

### A.2 Shell (02) ↔ demais etapas
- [ ] O layout `_authenticated` renderiza `<Outlet />`.

### A.3 CRM (03) ↔ Simulações/Propostas/App Cliente
- [ ] Ação "Puxar do CRM" funciona corretamente.

### A.7 Comunicação **PROIBIDA** (checar ausência)
- [ ] Nenhum código referencia provedores externos de comunicação (Twilio, SendGrid, etc).
- [ ] Nenhum texto visível ao usuário contém nomes de provedores de infraestrutura ou ferramentas de desenvolvimento.

---

## Parte B — Revisão de Sistema

### B.4 Marca branca e design
- [ ] Nenhuma logo/ícone gerado por IA. 
- [ ] Tokens de cor semânticos em `src/styles.css`.
- [ ] `<title>`, `og:*`, `twitter:*` reais em cada rota.

---

## Relatório final (formato de saída)

```
# Relatório de Revisão Final

## Parte A — Comunicação entre Módulos
- A.1 Fundação: ✔/✖
- A.2 Shell: ✔/✖
- A.3 CRM: ✔/✖
- A.7 Comunicação proibida: ✔/✖

## Parte B — Sistema
- Build & tipos: ✔/✖
- Banco & RLS: ✔/✖
- Marca branca & design: ✔/✖

## Veredito
[ ] APTO para publicação
```