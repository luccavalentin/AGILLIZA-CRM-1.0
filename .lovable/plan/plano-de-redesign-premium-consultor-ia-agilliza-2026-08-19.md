# Plano de Redesign Premium: Consultor IA Agilliza

Redesign completo da interface do Consultor IA para uma experiência workspace premium, moderna e sofisticada, mantendo 100% das funcionalidades e lógica de negócio atuais.

## Alterações Visuais e UX

### 1. Estrutura Workspace Integrada
- Substituição do layout atual baseado em cards e grids por um **workspace unificado** com três áreas principais:
  - **Sidebar Lateral (Esquerda)**: Histórico de conversas refinado, com busca integrada, agrupamento temporal (Hoje, Ontem, etc.) e ações de gestão (excluir/renomear) via hover. Sidebar será recolhível.
  - **Área Central de Chat**: Foco absoluto na leitura e interação. Layout de largura controlada para legibilidade ideal.
  - **Painel de Contexto (Direita - Opcional/Contextual)**: Exibição de metadados da conversa, fontes citadas e arquivos relacionados, abrindo apenas quando houver conteúdo relevante.

### 2. Identidade Visual Agilliza Premium
- Aplicação estrita da paleta Agilliza: Azul profundo (`#000F9F`), Off-white e cinzas frios.
- Uso estratégico do azul para estados ativos e CTAs principais.
- Tipografia com hierarquia clara (14px a 24px) e pesos variados (400, 500, 600).
- Remoção de gradientes pesados, sombras fortes e bordas excessivas.

### 3. Experiência de Conversa (Chat UI)
- **Mensagens do Usuário**: Alinhadas à direita em blocos discretos com fundo sutil, sem balões coloridos saturados.
- **Respostas da IA**: Formatação tipo documento inteligente, com suporte a markdown rico (tabelas, listas, títulos) e tipografia generosa.
- **Ações Contextuais**: Botões de feedback (útil/não útil) e cópia pequenos e discretos abaixo das respostas.
- **Composer Moderno**: Campo de texto auto-expansível na parte inferior, centralizado, com suporte a anexos e botão de envio compacto e elegante.

### 4. Estados e Fluxos
- **Estado Inicial**: Dashboard de boas-vindas sofisticado com 4 sugestões de prompt minimalistas.
- **IA Processando**: Animação de pulsação sutil ou micro-interações de status ("Analisando...", "Consultando base...").
- **Responsividade**: Adaptação para mobile via drawers para histórico e contexto, mantendo o foco no chat.

## Detalhes Técnicos
- **Componentização**: Criação de sub-componentes especializados (`ConsultorSidebar`, `ConsultorChat`, `ConsultorMessage`, `ConsultorComposer`) para melhor manutenção.
- **Preservação**: Nenhuma alteração em `consultor-ia.server.ts`, `consultor-ia.functions.ts` ou rotas de API. O redesign será puramente em `crm.consultor-ia.tsx` e novos sub-componentes visuais.
- **Tecnologias**: Uso intensivo de Tailwind CSS v4, Lucide React para ícones finos e componentes shadcn (Sheet, ScrollArea, Dialog).
