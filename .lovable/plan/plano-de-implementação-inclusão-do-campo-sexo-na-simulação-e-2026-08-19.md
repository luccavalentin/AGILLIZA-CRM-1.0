# Plano de Implementação - Inclusão do Campo Sexo na Simulação e Integração

Implementação dos campos de sexo para titular e cônjuge no fluxo de simulação, garantindo a obrigatoriedade antes do envio e a correta transmissão para a API via endpoint de participante.

## Alterações Técnicas

### 1. Esquemas e Validação
- **`src/lib/simulacao/schemas.ts`**:
    - Adicionar `sexo: z.enum(["M", "F"])` ao `completaSchema`.
    - Adicionar `sexo_conjuge: z.enum(["M", "F"]).optional().nullable()` ao `completaSchema`.
- **`src/lib/simulacao/campos-obrigatorios.ts`**:
    - Incluir `sexo` na validação de `validarCamposSimulacao`.
- **`src/lib/simulacao/rotulos-campos.ts`**:
    - Mapear `sexo` -> "Sexo do titular" e `sexo_conjuge` -> "Sexo do cônjuge".

### 2. Interface do Usuário (UI)
- **`src/components/simulacao/nova/use-wizard-simulacao.ts`**:
    - Adicionar `sexo` (string vazia inicial) ao `WizardState`.
- **`src/components/simulacao/nova/formulario-simulacao.tsx`**:
    - Inserir campo `Select` para "Sexo" (Masculino/Feminino) imediatamente antes de "Estado Civil" (embora no wizard reduzido não tenha estado civil, a instrução pede antes dele na etapa de dados do cliente). *Nota: O wizard reduzido tem Data de Nascimento, mas não Estado Civil. Vou adicionar Sexo após Data de Nascimento.*
- **Página de Simulação Completa/Detalhe**:
    - Localizar e editar o formulário de simulação completa (provavelmente em `src/routes/_authenticated/operacional.simulacoes_.completa.tsx` ou componente importado) para incluir os campos de sexo para titular e cônjuge seguindo a ordem: Nascimento -> Sexo -> Estado Civil -> Renda.

### 3. Persistência e Integração (Server-side)
- **`src/lib/simulacao/simulacoes.functions.ts`**:
    - Atualizar `upsertClienteCRM` para gravar `sexo` e `conjuge_sexo` na tabela `clientes`.
    - Garantir que a criação da simulação (`criarSimulacao`) persista esses campos na tabela `simulacoes`.
- **`src/lib/simulacao/enviar.server.ts`**:
    - **IMPORTANTE**: Não incluir sexo no `POST /oportunidade`.
    - Na função de envio (ou onde o participante é atualizado), garantir que `tipoSexo` e `tipoSexoConjuge` sejam enviados no payload do participante (POST/PUT `/participante`).

## Verificação
- Cadastrar cliente casado.
- Realizar simulação preenchendo o sexo de ambos.
- Validar via logs de banco se os campos `tipoSexo` e `tipoSexoConjuge` foram enviados nas chamadas de participante.
- Confirmar que não houve duplicidade de clientes.
