# Plano de Melhoria Visual do Overlay e Correção da Composição de Renda com Terceiros

## 1. Redesign do Overlay de Processamento
Elevar a qualidade visual do componente `ConsultandoOverlay` para um padrão premium financeiro.

### Alterações em `src/components/simulacao/consultando-overlay.tsx`:
- **Remover Estética Tech Genérica**: Eliminar animação de digitação ("A G I L L I Z A"), cursor piscante, sombras pesadas e efeitos de glow/ping excessivos.
- **Identidade Estática**: Substituir a animação pela logomarca Agilliza de forma estática e discreta.
- **Tipografia e Cores**:
  - Título: 22–24px, peso 600–650, tracking levemente negativo, azul-marinho profundo.
  - Percentual: peso 650–700, azul-marinho profundo.
  - Textos Auxiliares: 13–14px, peso 400–500, cinza sofisticado.
  - Fundo: Muito claro/branco com sombra difusa e discreta.
- **Progressão**: Manter a lógica funcional de carregamento gradual, mas com visual mais limpo e profissional.

## 2. Correção da Composição de Renda com Terceiros
Garantir que os participantes adicionais sejam persistidos e enviados corretamente para a API HomeFin.

### Sincronização de Dados e Persistência:
- **Schemas (`src/lib/simulacao/schemas.ts`)**: Adicionar o campo `participantes` ao `completaSchema` para que não seja eliminado pelo `safeParse`. Definir a estrutura do participante (Nome, CPF, Nascimento, Renda, Sexo, Estado Civil, Vínculo, Compoe Renda).
- **Hooks (`src/lib/simulacao/use-simulacao-completa.ts`)**: Assegurar que o estado `participantes` seja passado corretamente para as funções de envio.
- **Funções de Banco (`src/lib/simulacao/simulacoes.functions.ts`)**: Ajustar `criarSimulacao` para processar a lista de participantes, salvando em `simulacao_participantes`.

### Integração Bancária (`src/lib/simulacao/enviar.server.ts`):
- **Cálculo de Renda**: Somar `rendaTotal` apenas dos participantes (incluindo cônjuge) que possuem `compoe_renda = true`.
- **Cadastro na HomeFin**: 
  - Antes da simulação bancária, realizar `POST /oportunidade/{id}/participante` para cada terceiro.
  - Mapear todos os campos obrigatórios (tipoQualificacao, tipoPessoa, cpfCnpj, dataNascimento, nomeMae, tipoSexo, tipoEstadoCivil, renda, email, celular, cep, endereço, etc.).
  - Salvar o `idParticipante` retornado no campo `homefin_id_participante` da tabela `simulacao_participantes`.
- **Logs e Auditoria**: Registrar de forma segura o payload mascarado e o ID retornado pela HomeFin para comprovação.

### Interface do Formulário (`src/components/simulacao/completa/secao-composicao-renda.tsx`):
- Expandir a seção para incluir campos obrigatórios da API que hoje faltam (ex: Nome da Mãe, Endereço completo, e-mail/celular do terceiro) caso sejam marcados como composição.

## Detalhes Técnicos
- Utilização de `supabaseAdmin` no servidor para operações em `simulacao_participantes`.
- Validação rigorosa dos tipos de enum da HomeFin (ex: `tipoEstadoCivil`).
- Preservação da lógica de concorrência e travas já implementadas.
