# Documentação Técnica e Memorial Descritivo — Agilliza

## ✨ Memorial Descritivo: A Revolução do Crédito Imobiliário White Label

O **Agilliza** não é apenas um software; é uma infraestrutura completa de alta performance desenhada para escalar correspondentes bancários ao próximo nível. Em um mercado onde a agilidade define quem ganha o contrato, o Agilliza elimina a burocracia através de uma experiência digital fluida, segura e totalmente personalizável.

### Por que o Agilliza é Diferente?

1.  **Onboarding Inteligente com IA**: Diga adeus ao preenchimento manual. Nossa IA processa documentos instantaneamente, extraindo dados críticos e validando a ficha do cliente em segundos.
2.  **Motor de Simulação Multi-Banco**: Compare SAC e PRICE nos maiores bancos do país (Itaú, Santander, Bradesco) em uma única tela. Resultados reais, taxas atualizadas e transparência total para o seu cliente.
3.  **Ecossistema 360°**: Gestão completa de propostas, timeline interativa de 12 etapas para o cliente final, e um portal exclusivo para parceiros imobiliários.
4.  **Backoffice de Elite**: Controle financeiro rigoroso, gestão de comissões automatizada, RH completo e ferramentas de produtividade (Kanban/SLA) integradas.
5.  **Segurança de Nível Bancário**: Arquitetura baseada em Row Level Security (RLS) e execução em Edge Computing, garantindo que os dados estejam sempre protegidos e a aplicação sempre rápida, em qualquer lugar do mundo.

---

## 1. Visão Geral

O Agilliza é um ecossistema **White Label** para correspondentes bancários, focado em Financiamento Imobiliário e Home Equity. Ele integra o ciclo completo de crédito, desde a prospecção no CRM até o desembolso, com integração direta a instituições financeiras (Bradesco, Santander, Itaú) via provedor de API (HomeFin).

### Canais de Acesso (PWAs)
O sistema é composto por três portais que coexistem no mesmo repositório, todos instaláveis como PWA:
1.  **Interno (`/*`)**: Operação completa (CRM, Propostas, Financeiro, RH).
2.  **Parceiro (`/parceiro/*`)**: Visão limitada para imobiliárias e corretores (integrada ao shell interno com filtros de escopo).
3.  **Cliente (`/portal/*`)**: Acompanhamento de propostas, timeline 12 etapas, chat e upload de documentos.

---

## 2. Stack Tecnológica
- **Frontend/SSR**: TanStack Start v1 (React 19 + Vite 7).
- **Runtime**: Cloudflare Workers (Edge).
- **Banco de Dados**: Supabase (PostgreSQL).
- **Autenticação**: Supabase Auth (JWT).
- **Estilo**: Tailwind CSS v4 + shadcn/ui.
- **Integração Bancária**: API HomeFin (polling/REST).
- **IA/OCR**: Gemini API / OpenAI (extração de documentos).

---

## 3. Arquitetura de Módulos

### 3.1 CRM (Clientes e Esteira)
- Gestão de Clientes PF/PJ.
- Esteira de crédito em 12 etapas configuráveis.
- **Pastas de Documentos**: Organização por tipo e status.
- **Scan IA**: Processamento automático de documentos para preenchimento de ficha.

### 3.2 Operacional (Simulações e Propostas)
- **Simulação Rápida**: Cálculo local (SAC/PRICE) para resposta imediata.
- **Simulação Completa**: Integração real com bancos via API.
- **Propostas**: Acompanhamento de status, timeline por banco e histórico de logs.
- **Gestão de Tarefas**: Kanban de demandas e tarefas internas com controle de SLA.

### 3.3 Financeiro
- Gestão de Contas a Pagar e Receber.
- **Comissões**: Controle de recebimento (banco → correspondente) e repasse (correspondente → equipe/parceiro).
- Fluxo de caixa e centros de custo.

### 3.4 RH
- Ficha funcional completa, gestão de benefícios, férias e folha de pagamento.

---

## 4. Regras de Negócio Críticas

### 4.1 Segurança e Permissões
- **RLS (Row Level Security)**: Ativo em 100% das tabelas.
- **User Roles**: Armazenados em tabela separada (`user_roles`) para evitar escalação de privilégios.
- **Escopo de Dados**: Filtros automáticos baseados no perfil (`todos`, `equipe`, `proprios`).

### 4.2 Simulação Bancária
- **Lock de Concorrência**: Proteção atômica para evitar duplicidade de oportunidades/envios.
- **Isolamento de Erro**: Cada banco é processado em `try/catch` isolado; falha em um não interrompe o lote.
- **Renda Mínima**: Cálculo padronizado (30% SAC / 15% PRICE) com margem de segurança.

---

## 5. Estrutura de Dados (Principais Tabelas)
- `profiles`: Dados básicos de usuários e configurações de tema.
- `user_roles`: Vinculação de papéis (`admin`, `correspondente`, `gestor`, etc).
- `clientes`: Cadastro central de proponentes.
- `simulacoes`: Registro de cálculos e parâmetros enviados aos bancos.
- `simulacao_bancos`: Resultados individuais retornados por cada instituição.
- `propostas`: Processos de crédito ativos vinculados a oportunidades.
- `notificacoes`: Sistema de alertas in-app com realtime.

---

## 6. Padronização Visual
- **Cor Primária**: Azul Agilliza (`#000F9F`).
- **Tipografia**: Inter Variable (corpo) e Números Tabulares.
- **White Label**: Proibição estrita de termos de infraestrutura ou ferramentas de desenvolvimento na interface do usuário.
