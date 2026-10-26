import type { PassoTour, RoteiroTour } from "./tipos";

/*
 * Tour guiado do Agilliza Correspondente: o roteiro de CADA tela do menu da equipe
 * (`navInterno`/`navParceiro` em src/components/app-shell/nav-config.ts) e do portal do
 * cliente (`cliente.*`), num registro só. O teste src/lib/tour/tour.test.ts falha se um item
 * novo do menu aparecer sem roteiro.
 *
 * Chave = caminho da tela sem a barra inicial, com `/` trocado por `.` (ver `chaveDaTela`):
 * `/operacional/propostas/kanban` → `operacional.propostas.kanban`.
 * Texto curto e útil: o que a pessoa faz ali, não como o sistema foi feito. Âncoras: as
 * estáveis de tipos.ts (`titulo`, `acoes`, `abas`, `busca`, `filtro-base`, `metrica`, `tabela`,
 * `menu`, `ajuda`…) ou as específicas `data-tour="<tela>-<parte>"` marcadas na tela.
 * Passo cuja âncora não está na tela aparece no centro (o tour nunca quebra).
 * Nunca escrever o nome da integração bancária: o identificador aparece como "ID" ("ID H.").
 *
 * Mudou a tela de verdade? Suba a `versao` do roteiro: quem já viu vê de novo.
 */

/** Passo final comum: onde rever o tour. */
const REVER: PassoTour = {
  alvo: "ajuda",
  titulo: "Quer ver de novo?",
  texto: "O botão de ajuda no topo abre o tour desta tela quando você quiser.",
};

export const ROTEIROS: Record<string, RoteiroTour> = {
  // ---- Visão Geral: Painel geral
  "visao-geral.painel": {
    versao: 1,
    titulo: "Painel geral",
    passos: [
      {
        alvo: "menu",
        titulo: "Bem-vindo ao Agilliza",
        texto:
          "Pelo menu lateral você chega a tudo: clientes, simulações, propostas, relatórios e a administração da conta.",
      },
      {
        alvo: "busca-global",
        titulo: "Ache qualquer coisa",
        texto:
          "A busca do topo (Ctrl K) encontra clientes, propostas e telas sem precisar navegar pelo menu.",
      },
      {
        alvo: "notificacoes",
        titulo: "Seus avisos",
        texto:
          "O sino junta os avisos do dia: mudanças nas propostas, mensagens e pendências que pedem sua atenção.",
      },
      {
        alvo: "painel-filtros",
        titulo: "Escolha o que ver",
        texto:
          "Filtre a produção por visão (Minha ou Geral), base, assinante, usuário e período. A escolha fica no link e é lembrada.",
      },
      {
        alvo: "painel-indicadores",
        titulo: "Números do período",
        texto:
          "Simulações, propostas, crédito aprovado, contratos e valor financiado, comparados ao período anterior. Toque num número para ver a lista.",
      },
      {
        alvo: "painel-evolucao",
        titulo: "Evolução e conversão",
        texto:
          "O gráfico mostra a produção dia a dia (ou mês a mês) e o funil indica quanto de cada etapa chegou à seguinte.",
      },
      REVER,
    ],
  },

  // ---- Visão Geral: Agilliza News
  news: {
    versao: 1,
    titulo: "Agilliza News",
    passos: [
      {
        alvo: "titulo",
        titulo: "Notícias para a equipe",
        texto:
          "Mercado, crédito, regras novas e comunicados da Agilliza publicados para todo o ecossistema ou só para a equipe.",
      },
      {
        alvo: "news-lista",
        titulo: "Leia cada publicação",
        texto:
          "Abra um item para ler o texto completo ao lado. Os fixados aparecem com um alfinete; os de fora abrem o site da fonte.",
      },
    ],
  },

  // ---- CRM: Consultar clientes
  "crm.clientes": {
    versao: 1,
    titulo: "Consultar clientes",
    passos: [
      {
        alvo: "titulo",
        titulo: "Sua carteira de clientes",
        texto:
          "Aqui ficam todos os clientes do seu ecossistema, com etapa, responsável e acesso ao portal.",
      },
      {
        alvo: "filtro-base",
        titulo: "Qual base você quer ver",
        texto:
          "Troque entre a sua base, os assinantes (todos ou um) e as contas vinculadas para consultar a carteira de cada um.",
      },
      {
        alvo: "clientes-novo",
        titulo: "Cadastre um cliente",
        texto:
          "Abre o formulário de novo cliente, com vínculos de atendimento, dados pessoais, endereço e dados bancários.",
      },
      {
        alvo: "clientes-indicadores",
        titulo: "Atalhos por situação",
        texto:
          "Total, app ativo, em andamento e cadastro completo. Toque num cartão para filtrar a lista; toque de novo para voltar ao total.",
      },
      {
        alvo: "clientes-filtros",
        titulo: "Busca e filtros",
        texto:
          "Busque por nome, código, documento ou e-mail e filtre por etapa, responsável, portal e status. Minhas/Gerais escolhe a carteira.",
      },
      {
        alvo: "tabela",
        titulo: "Abra a ficha",
        texto:
          "Toque no cliente para abrir a ficha completa. Na coluna Ações você pode excluir o cadastro, com confirmação.",
      },
      REVER,
    ],
  },

  // ---- CRM: Novo cliente
  "crm.clientes.novo": {
    versao: 1,
    titulo: "Novo cliente",
    passos: [
      {
        alvo: "titulo",
        titulo: "Cadastro de cliente",
        texto:
          "Preencha os dados do cliente. Campos com * são obrigatórios; o resto pode ser completado depois na ficha.",
      },
      {
        alvo: "cliente-novo-formulario",
        titulo: "Vínculos e dados",
        texto:
          "Escolha quem atende o cliente, depois preencha dados básicos, endereço (o CEP completa sozinho), FGTS e dados bancários.",
      },
      {
        alvo: "cliente-novo-dicas",
        titulo: "Dicas de preenchimento",
        texto:
          "Um lembrete do que cada bloco pede. O acesso ao portal do cliente é liberado depois de salvar, sem criar senha.",
      },
      {
        titulo: "Salve no fim",
        texto:
          "Use Salvar cliente no fim do formulário. Se o CPF ou CNPJ já existir, o sistema avisa e deixa abrir ou atualizar o cadastro.",
      },
    ],
  },

  // ---- CRM: Documentos de clientes
  "crm.documentos": {
    versao: 1,
    titulo: "Documentos de clientes",
    passos: [
      {
        alvo: "titulo",
        titulo: "Pastas de cada cliente",
        texto:
          "Cada cliente tem as pastas padrão: comprador, participantes, vendedor, imóvel, renda, banco e proposta e contratos.",
      },
      {
        alvo: "documentos-clientes-lista",
        titulo: "Escolha o cliente",
        texto:
          "Busque pelo cliente ou pelo nome do arquivo. Abra o cliente para ver as pastas e quantos arquivos há em cada uma.",
      },
      {
        alvo: "documentos-clientes-pastas",
        titulo: "Arquivos da pasta",
        texto:
          "Envie vários arquivos de uma vez, veja a prévia, baixe ou mova. Arrastar um arquivo para outra pasta também move.",
      },
      {
        titulo: "Ficha e cadastro à mão",
        texto:
          "Com o cliente aberto, os botões Ficha e Cadastro mostram os dados dele sem sair da tela de documentos.",
      },
    ],
  },

  // ---- CRM: Consulta Ficha Cliente
  "crm.ficha-bureau": {
    versao: 1,
    titulo: "Consulta Ficha Cliente",
    passos: [
      {
        alvo: "titulo",
        titulo: "Ficha no bureau de crédito",
        texto:
          "Consulte score, restrições e protestos do titular antes de enviar a proposta. Cada consulta fica registrada (LGPD).",
      },
      {
        alvo: "ficha-nova-consulta",
        titulo: "Nova consulta em 3 passos",
        texto:
          "Escolha um cliente do CRM ou digite CPF/CNPJ, informe a finalidade e a base legal, confirme a autorização e toque em Consultar agora.",
      },
      {
        alvo: "ficha-resultado",
        titulo: "Resultado ao lado",
        texto:
          "Chega em segundos: medidor de score, apontamentos e o detalhe de cada restrição. Dali você abre a ficha do cliente ou faz nova consulta.",
      },
      {
        alvo: "ficha-indicadores",
        titulo: "Números do mês",
        texto:
          "Consultas no mês, score médio dos titulares e se o bureau está ativo para a sua conta.",
      },
      {
        alvo: "ficha-historico",
        titulo: "Histórico de consultas",
        texto:
          "Todas as consultas feitas, inclusive as não concluídas. Abra uma linha para ver o relatório completo e imprimir.",
      },
      REVER,
    ],
  },

  // ---- CRM: Chat
  "crm.chat": {
    versao: 1,
    titulo: "Chat",
    passos: [
      {
        titulo: "Conversas num lugar só",
        texto:
          "Fale com a equipe, clientes, parceiros e assinantes. Envie texto, fotos, vídeos, documentos e áudio, e crie grupos.",
      },
      {
        alvo: "busca",
        titulo: "Pesquise",
        texto: "Encontre uma conversa ou uma mensagem antiga digitando o nome ou parte do texto.",
      },
      {
        alvo: "abas",
        titulo: "Todas, não lidas e pedidos",
        texto:
          "Em Pedidos chegam as mensagens de quem não é da sua base e achou você pelo @. Aceite para conversar; recusar não avisa.",
      },
      {
        titulo: "Nova conversa e ajustes",
        texto:
          "Nova conversa abre um contato ou grupo. A engrenagem ajusta seu @, a privacidade, os avisos e os bloqueados.",
      },
    ],
  },

  // ---- CRM: Scan IA (leitura de documentos)
  "crm.scan-ia": {
    versao: 1,
    titulo: "Leitura de documentos",
    passos: [
      {
        alvo: "titulo",
        titulo: "Documentos lidos pela IA",
        texto:
          "Envie os documentos do cliente: a IA lê, o sistema confere CPF, datas, UF e órgão emissor, e você cria ou completa o cadastro.",
      },
      {
        alvo: "scan-ia-tipo",
        titulo: "Tipo do documento",
        texto:
          "Opcional. Deixe em branco para a IA identificar sozinha; você confirma o tipo na revisão.",
      },
      {
        alvo: "scan-ia-envio",
        titulo: "Envie vários de uma vez",
        texto:
          "Arraste ou escolha até 12 arquivos (PDF, JPG ou PNG de até 10 MB). No fim, Conferir e cadastrar o cliente junta tudo num cadastro.",
      },
      {
        alvo: "scan-ia-leituras",
        titulo: "Leituras recentes",
        texto:
          "Acompanhe o status de cada leitura. Revise os campos, abra o lote, reprocesse se deu erro ou exclua a leitura.",
      },
      {
        alvo: "scan-ia-consultor",
        titulo: "Consultor IA",
        texto:
          "Atalho para o assistente de crédito imobiliário, para tirar dúvidas sobre o caso do cliente.",
      },
      REVER,
    ],
  },

  // ---- CRM: Consultor IA
  "crm.consultor-ia": {
    versao: 1,
    titulo: "Consultor IA",
    passos: [
      {
        alvo: "titulo",
        titulo: "Especialista em crédito",
        texto:
          "Tire dúvidas de financiamento imobiliário. As contas (parcela, renda, custos) são feitas pelo sistema, não pela IA.",
      },
      {
        alvo: "consultor-ia-sugestoes",
        titulo: "Comece por uma sugestão",
        texto:
          "SAC x PRICE, capacidade pela renda, FGTS e documentação: toque numa sugestão para perguntar na hora.",
      },
      {
        alvo: "consultor-ia-pergunta",
        titulo: "Faça sua pergunta",
        texto:
          "Escreva aqui e envie. A resposta mostra as fontes da base; você pode marcar se foi útil e gerar um FAQ/e-book.",
      },
      {
        alvo: "consultor-ia-calculadora",
        titulo: "Calculadora",
        texto:
          "Calcule parcela (SAC/PRICE), renda necessária e custos da operação, e leve o resultado como pergunta ao Consultor.",
      },
      {
        alvo: "consultor-ia-historico",
        titulo: "Histórico de conversas",
        texto:
          "Suas conversas ficam guardadas: busque, retome, comece uma nova ou exclua. Só você vê as suas conversas.",
      },
      REVER,
    ],
  },

  // ---- CRM: Base de Conhecimento
  "admin.consultor-ia-base": {
    versao: 1,
    titulo: "Base de Conhecimento",
    passos: [
      {
        alvo: "titulo",
        titulo: "Conhecimento da equipe",
        texto:
          "Artigos de crédito imobiliário com versões e rascunho. O que está publicado orienta o Consultor IA e pode ir para a News.",
      },
      {
        alvo: "base-acoes",
        titulo: "Criar e exportar",
        texto:
          "Escreva um novo artigo, ajuste os parâmetros de cálculo do Consultor ou baixe em PDF a coletânea do resultado atual.",
      },
      {
        alvo: "busca",
        titulo: "Pesquise e ordene",
        texto:
          "Busque por assunto (FGTS, portabilidade, ITBI…) e ordene por relevância, data ou ordem alfabética.",
      },
      {
        alvo: "base-situacao",
        titulo: "Filtre pela situação",
        texto: "Veja todos, só os publicados, os rascunhos ou os que estão na Agilliza News.",
      },
      {
        alvo: "base-categorias",
        titulo: "Categorias e etiquetas",
        texto:
          "Filtre por categoria ou combine etiquetas. Quem pode editar também cria categorias novas aqui.",
      },
      {
        alvo: "base-artigos",
        titulo: "Abra um artigo",
        texto:
          "Toque no artigo para ler. Dali você edita, vê as versões, baixa em PDF, publica na News ou exclui.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Indicadores
  "operacional.painel": {
    versao: 1,
    titulo: "Indicadores",
    passos: [
      {
        alvo: "titulo",
        titulo: "Execução da operação",
        texto:
          "Um resumo de como andam simulações, propostas, demandas e tarefas. Os números se atualizam sozinhos quando algo muda.",
      },
      {
        alvo: "painel-operacional-periodo",
        titulo: "Escolha o período",
        texto:
          "Hoje, últimos dias, este mês, mês anterior, este ano ou um período personalizado. Ao lado, troque entre a sua visão e a geral, quando tiver acesso.",
      },
      {
        alvo: "painel-operacional-indicadores",
        titulo: "Números do período",
        texto: "Os principais indicadores da operação. Toque em um deles para ver o detalhamento.",
      },
      {
        alvo: "painel-operacional-graficos",
        titulo: "Gráficos, ranking e alertas",
        texto:
          "Evolução no tempo, funil da simulação ao contrato, ranking e atividades e alertas. Abra cada quadro para ver os detalhes.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Consultar simulações
  "operacional.simulacoes": {
    versao: 1,
    titulo: "Consultar simulações",
    passos: [
      {
        alvo: "simulacoes-novas",
        titulo: "Comece uma simulação",
        texto:
          "A rápida estima as parcelas na hora. A completa envia os dados aos bancos parceiros e traz a resposta de cada um.",
      },
      {
        alvo: "filtro-base",
        titulo: "De quem ver as simulações",
        texto:
          "Troque entre a sua base, os assinantes e os vinculados. A tela passa a mostrar as simulações dessa base.",
      },
      {
        alvo: "simulacoes-indicadores",
        titulo: "Números do topo",
        texto:
          "Oportunidades simuladas, volume simulado, bancos cotados e prazo médio. Toque em um número para ver os detalhes.",
      },
      {
        alvo: "simulacoes-filtros",
        titulo: "Busca e filtros",
        texto:
          "Ache por número, cliente ou documento. Filtre por Todas ou Minhas, responsável e período, e ligue “Ver excluídas” para restaurar uma simulação.",
      },
      {
        alvo: "tabela",
        titulo: "Ações de cada simulação",
        texto:
          "No menu da linha: visualizar, enviar proposta, editar, baixar PDF comparativo ou detalhado, duplicar e encaminhar por e-mail ou WhatsApp.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Simulação completa
  "operacional.simulacoes.completa": {
    versao: 1,
    titulo: "Simulação completa",
    passos: [
      {
        alvo: "titulo",
        titulo: "Consulta real aos bancos",
        texto:
          "Preencha os dados do cliente e do imóvel para enviar a simulação aos bancos parceiros e receber as condições de cada um.",
      },
      {
        alvo: "simulacao-destino",
        titulo: "Onde simular",
        texto:
          "Se você atende assinantes, escolha se a simulação fica só na sua base ou também na carteira de um assinante.",
      },
      {
        alvo: "simulacao-completa-titular",
        titulo: "Titular e renda",
        texto:
          "Pessoa física ou jurídica, nome, documento e renda. Você pode puxar um cliente do CRM e, abaixo, incluir cônjuge e outras pessoas na renda.",
      },
      {
        alvo: "simulacao-completa-bancos",
        titulo: "Escolha os bancos",
        texto:
          "Marque as instituições que vão receber a consulta. Com SAC e PRICE juntos, escolha os bancos de cada sistema.",
      },
      {
        alvo: "simulacao-completa-gerar",
        titulo: "Gerar a simulação",
        texto:
          "Confira os consentimentos e gere. A resposta de cada banco aparece logo abaixo, nesta mesma tela.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Simulação rápida
  "operacional.simulacoes.nova": {
    versao: 1,
    titulo: "Simulação rápida",
    passos: [
      {
        alvo: "titulo",
        titulo: "Estimativa na hora",
        texto:
          "Compare as parcelas entre os bancos parceiros em segundos, pelas taxas médias praticadas, sem enviar nada ao banco.",
      },
      {
        alvo: "simulacao-rapida-cliente",
        titulo: "Vincule um cliente",
        texto: "Opcional: escolha um cliente já cadastrado no CRM para trazer os dados dele.",
      },
      {
        alvo: "simulacao-rapida-formulario",
        titulo: "Dados da simulação",
        texto:
          "Produto, sistema de amortização (SAC, PRICE ou os dois), valores do imóvel e da entrada, prazo e renda. Os campos com * são obrigatórios.",
      },
      {
        alvo: "simulacao-rapida-simular",
        titulo: "Simule e compare",
        texto:
          "O comparativo dos bancos aparece com parcela, taxa e renda mínima. Baixe o PDF comparativo ou o de um banco só.",
      },
    ],
  },

  // ---- Operacional: Consultar propostas
  "operacional.propostas": {
    versao: 1,
    titulo: "Consultar propostas",
    passos: [
      {
        alvo: "propostas-botoes",
        titulo: "Propostas enviadas ao banco",
        texto:
          "Aqui fica cada oportunidade já enviada. Use estes botões para ver tudo no Kanban ou começar uma nova proposta.",
      },
      {
        alvo: "filtro-base",
        titulo: "De quem ver as propostas",
        texto:
          "Troque entre a sua base, os assinantes e os vinculados. Quando aparecer “esperando analista”, toque para ver as propostas de assinantes que aguardam.",
      },
      {
        alvo: "propostas-status",
        titulo: "Situação em cartões",
        texto:
          "Todas, enviadas, aprovadas, recusadas e canceladas, com quantidade e volume. Toque em um cartão para filtrar a lista.",
      },
      {
        alvo: "propostas-filtros",
        titulo: "Busca e filtros",
        texto:
          "Gerais ou Minhas, busca por número, cliente ou documento, usuário, período, corretor, imobiliária e comercial. “Excluídas” mostra as apagadas.",
      },
      {
        alvo: "tabela",
        titulo: "A lista de propostas",
        texto:
          "Cada linha traz o ID H., o número no banco, os bancos e a situação da documentação. Pelo menu, veja os comentários ou baixe a carta de análise.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Nova proposta
  "operacional.propostas.enviar": {
    versao: 1,
    titulo: "Nova proposta",
    passos: [
      {
        alvo: "titulo",
        titulo: "Envie uma proposta ao banco",
        texto: "Parta de uma simulação já feita ou origine uma proposta do zero.",
      },
      {
        alvo: "nova-proposta-gerar",
        titulo: "Gerar nova proposta",
        texto:
          "Abre o formulário completo: você preenche e envia direto ao banco, e a proposta é criada automaticamente.",
      },
      {
        alvo: "abas",
        titulo: "Propostas ou simulações",
        texto:
          "Na aba Simulações, cada banco já simulado vira um botão: toque nele para criar a proposta daquele banco.",
      },
      {
        alvo: "nova-proposta-filtros",
        titulo: "Filtros",
        texto:
          "Gerais ou Minhas, busca por número, cliente ou documento e período. A tela abre no mês atual.",
      },
      {
        alvo: "tabela",
        titulo: "Abra a proposta",
        texto: "Toque em uma linha para abrir a proposta ou a simulação e continuar o trabalho.",
      },
    ],
  },

  // ---- Operacional: Kanban de propostas
  "operacional.propostas.kanban": {
    versao: 1,
    titulo: "Kanban de propostas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Propostas em colunas",
        texto:
          "Cada coluna é uma etapa. Arraste o cartão só entre as etapas permitidas; o mais parado aparece primeiro.",
      },
      {
        alvo: "propostas-kanban-filtros",
        titulo: "Filtros do quadro",
        texto:
          "Meu kanban ou Todas, busca por cliente, CPF/CNPJ ou número, banco, corretor, comercial, imobiliária e período. Dá para ocultar as colunas vazias.",
      },
      {
        alvo: "propostas-kanban-indicadores",
        titulo: "O que pede atenção",
        texto: "Em andamento, volume em andamento, perto do prazo e paradas além do prazo.",
      },
      {
        alvo: "propostas-kanban-colunas",
        titulo: "Cartões e ações rápidas",
        texto:
          "O cartão mostra há quantos dias está parado. Pelo menu dele, abra, continue, mova de etapa ou cancele. “Ver todas” abre a coluna inteira com busca.",
      },
      {
        alvo: "propostas-kanban-prazos",
        titulo: "Prazos por etapa",
        texto:
          "Em Prazos ficam os dias na etapa até o cartão ficar amarelo (alerta) e vermelho (crítico). Lista volta para a consulta.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Consultar tarefas
  "operacional.tarefas": {
    versao: 1,
    titulo: "Consultar tarefas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Sua agenda de tarefas",
        texto:
          "O que precisa ser feito e quando. Marque a tarefa para concluir e toque nela para ver os detalhes. No topo, baixe em PDF ou crie uma nova.",
      },
      {
        alvo: "tarefas-visoes",
        titulo: "Lista, Kanban ou Calendário",
        texto: "Veja as mesmas tarefas como agenda, em colunas por etapa ou no calendário.",
      },
      {
        alvo: "tarefas-indicadores",
        titulo: "Atrasadas, hoje e semana",
        texto:
          "Atrasadas, para hoje, próximos 7 dias e concluídas na semana. Toque em um número para ir direto a esse grupo.",
      },
      {
        alvo: "tarefas-frase",
        titulo: "Crie escrevendo",
        texto:
          "Escreva como fala, por exemplo “ligar para Maria amanhã às 10h”, e pressione Enter: o tipo e a data são entendidos sozinhos.",
      },
      {
        alvo: "tarefas-filtros",
        titulo: "Busca e filtros",
        texto:
          "Busque pelo texto e filtre por responsável (só minhas ou toda a equipe), tipo e prioridade.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Calendário
  "operacional.tarefas.calendario": {
    versao: 1,
    titulo: "Calendário",
    passos: [
      {
        alvo: "titulo",
        titulo: "Tarefas no calendário",
        texto: "Cada tarefa aparece no dia do prazo. Toque nela para abrir os detalhes.",
      },
      {
        alvo: "abas",
        titulo: "Minhas ou gerais",
        texto: "Veja só as suas tarefas ou as de toda a equipe.",
      },
      {
        alvo: "calendario-navegacao",
        titulo: "Navegue no tempo",
        texto:
          "Avance, volte, vá para hoje e aproxime ou afaste a visão entre dia, semana, mês e ano.",
      },
      {
        alvo: "calendario-grade",
        titulo: "Dias e feriados",
        texto:
          "Os feriados aparecem no próprio dia, com os facultativos indicados. Na visão de ano, toque num mês para abri-lo.",
      },
    ],
  },

  // ---- Operacional: Kanban de tarefas
  "operacional.tarefas.kanban": {
    versao: 1,
    titulo: "Kanban de tarefas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Tarefas por etapa",
        texto:
          "Aberta, em andamento, concluída e cancelada. Arraste o cartão para mudar a etapa; só as mudanças permitidas são aceitas.",
      },
      {
        alvo: "tarefas-kanban-controles",
        titulo: "Filtrar e ordenar",
        texto:
          "Minhas ou Gerais, busca por título, código ou responsável, prioridade, responsável e ordem: recentes, prazo ou prioridade.",
      },
      {
        alvo: "tarefas-kanban-colunas",
        titulo: "Os cartões",
        texto:
          "Cada cartão mostra prioridade, tipo, cliente, responsável e prazo, em vermelho quando vencido. Toque para abrir; “+ Adicionar tarefa” fica na coluna Aberta.",
      },
      {
        alvo: "tarefas-visoes",
        titulo: "Trocar de visão",
        texto: "Volte para a lista ou abra o calendário.",
      },
    ],
  },

  // ---- Operacional: Central de demandas
  "operacional.demandas": {
    versao: 1,
    titulo: "Central de demandas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Demandas com dono e prazo",
        texto:
          "Consultas, simulações, propostas e documentação delegadas na fila justa, cada uma com responsável, prazo e conversa.",
      },
      {
        alvo: "acoes",
        titulo: "Pegar a próxima",
        texto:
          "“Pegar a próxima” puxa a demanda sem responsável da sua fila. Ao lado, troque para o Kanban ou crie uma nova demanda.",
      },
      {
        alvo: "demandas-indicadores",
        titulo: "Prazos à vista",
        texto:
          "Minhas abertas, sem responsável, atrasadas, vencem em 4h, aguardando solicitante e concluídas hoje. Toque em Atrasadas ou Vencem em 4h para filtrar.",
      },
      {
        alvo: "demandas-abas",
        titulo: "Minhas, fila e equipe",
        texto:
          "Troque entre Minhas, Sem responsável, Equipe e Que pedi. “Filas e prazos” organiza a distribuição. Marque Encerradas para ver os últimos 30 dias.",
      },
      {
        alvo: "demandas-filtros",
        titulo: "Buscar e assumir",
        texto:
          "Busque por número, título, cliente, conta ou proposta e filtre por tipo, origem e prioridade. Demanda sem dono traz o botão Assumir.",
      },
      REVER,
    ],
  },

  // ---- Operacional: Kanban de demandas
  "operacional.demandas.kanban": {
    versao: 1,
    titulo: "Kanban de demandas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Demandas por situação",
        texto:
          "Arraste o cartão entre as colunas. A coluna que não aceita a demanda fica apagada enquanto você arrasta.",
      },
      {
        alvo: "abas",
        titulo: "Minhas, fila e equipe",
        texto: "Escolha entre Minhas, Sem responsável, Equipe e Que pedi.",
      },
      {
        alvo: "demandas-filtros",
        titulo: "Busca e filtros",
        texto:
          "Busque por número, título, cliente, conta ou proposta e filtre por tipo, origem e prioridade.",
      },
      {
        alvo: "demandas-kanban-colunas",
        titulo: "Mover e assumir",
        texto:
          "Levar para Em andamento uma demanda sem dono faz você assumi-la. Para cancelar, o motivo é pedido. As encerradas ficam visíveis por 7 dias.",
      },
    ],
  },

  // ---- Operacional: Servidor de e-mail
  "operacional.codigos": {
    versao: 1,
    titulo: "Servidor de e-mail",
    passos: [
      {
        alvo: "titulo",
        titulo: "Códigos dos bancos na hora",
        texto:
          "Mostra as caixas de e-mail que o Agilliza vigia e o que chega nelas, como os códigos de acesso dos portais dos bancos.",
      },
      {
        alvo: "codigos-nova-caixa",
        titulo: "Cadastre uma caixa",
        texto:
          "Cadastre o e-mail que recebe os códigos dos bancos. O Agilliza só lê: não envia nada.",
      },
      {
        alvo: "codigos-caixas",
        titulo: "Situação de cada caixa",
        texto:
          "O ponto colorido mostra se a caixa está conectada. Edite, pause, teste a conexão ou remova a caixa.",
      },
      {
        alvo: "codigos-mensagens",
        titulo: "Mensagens capturadas",
        texto:
          "Chegam com som e aviso. Filtre por caixa, 24 horas ou 7 dias e só com código, e copie o código com um toque.",
      },
    ],
  },

  // ===================== Grupo: documentos =====================
  // Entradas para o objeto de roteiros (sem import; usa a constante REVER do registro).

  // ---- Documentos diversos: Arquivos
  documentos: {
    versao: 1,
    titulo: "Arquivos",
    passos: [
      {
        alvo: "titulo",
        titulo: "Os arquivos do escritório",
        texto:
          "Aqui ficam os documentos do escritório, organizados em pastas, com versões e lixeira.",
      },
      {
        alvo: "arquivos-visoes",
        titulo: "Atalhos de navegação",
        texto:
          "Alterne entre Meus arquivos, Favoritos, Compartilhados comigo, Recentes e Lixeira. O que vai para a lixeira pode ser restaurado.",
      },
      {
        alvo: "arquivos-barra",
        titulo: "Caminho, busca e envio",
        texto:
          "Veja em que pasta você está, busque por nome ou etiqueta, troque entre grade e lista e use Novo para criar pasta, enviar arquivos ou uma pasta inteira.",
      },
      {
        alvo: "arquivos-conteudo",
        titulo: "Arraste e solte",
        texto:
          "Arraste arquivos do computador para cá e eles vão para a pasta aberta. Arrastar um item sobre uma pasta, ou sobre o caminho, move o item.",
      },
      {
        titulo: "O menu de cada item",
        texto:
          "Em cada arquivo ou pasta você baixa, favorita, renomeia, move, vê detalhes, etiquetas e versões, compartilha com permissões ou manda para a lixeira, conforme seu acesso.",
      },
      REVER,
    ],
  },

  // ---- Documentos diversos: Formulários (o menu abre direto no Itaú)
  formularios: {
    versao: 1,
    titulo: "Formulários",
    passos: [
      {
        alvo: "titulo",
        titulo: "Formulários dos bancos",
        texto:
          "Os modelos de formulário em PDF de cada banco, sempre à mão para abrir e usar com o cliente.",
      },
      {
        alvo: "formularios-categorias",
        titulo: "Escolha o banco ou a categoria",
        texto:
          "Passe entre Itaú, Bradesco, Santander, Inter, Diversos e DPS. O número ao lado mostra quantos formulários cada um tem.",
      },
      REVER,
    ],
  },

  // ---- Formulários: Itaú
  "formularios.itau": {
    versao: 1,
    titulo: "Formulários Itaú",
    passos: [
      {
        alvo: "titulo",
        titulo: "Formulários do Itaú",
        texto: "Os modelos de formulário em PDF do Itaú, prontos para abrir e usar com o cliente.",
      },
      {
        alvo: "formularios-categorias",
        titulo: "Troque de banco ou categoria",
        texto:
          "Passe entre Itaú, Bradesco, Santander, Inter, Diversos e DPS. O número ao lado mostra quantos formulários cada um tem.",
      },
      {
        alvo: "busca",
        titulo: "Busque pelo nome",
        texto:
          "Digite parte do nome ou da descrição para achar o formulário certo nesta categoria.",
      },
      {
        alvo: "formularios-lista",
        titulo: "Abra o PDF",
        texto:
          "Ver abre o formulário em outra aba. Quem tem permissão também edita o nome, troca o arquivo ou exclui.",
      },
      {
        alvo: "formularios-enviar",
        titulo: "Envie um modelo novo",
        texto:
          "Com permissão de envio, adicione um PDF com nome e descrição. Ele entra na lista desta categoria.",
      },
      REVER,
    ],
  },

  // ---- Formulários: Bradesco
  "formularios.bradesco": {
    versao: 1,
    titulo: "Formulários Bradesco",
    passos: [
      {
        alvo: "titulo",
        titulo: "Formulários do Bradesco",
        texto:
          "Os modelos de formulário em PDF do Bradesco, prontos para abrir e usar com o cliente.",
      },
      {
        alvo: "formularios-categorias",
        titulo: "Troque de banco ou categoria",
        texto:
          "Passe entre Itaú, Bradesco, Santander, Inter, Diversos e DPS. O número ao lado mostra quantos formulários cada um tem.",
      },
      {
        alvo: "busca",
        titulo: "Busque pelo nome",
        texto:
          "Digite parte do nome ou da descrição para achar o formulário certo nesta categoria.",
      },
      {
        alvo: "formularios-lista",
        titulo: "Abra o PDF",
        texto:
          "Ver abre o formulário em outra aba. Quem tem permissão também edita o nome, troca o arquivo ou exclui.",
      },
      {
        alvo: "formularios-enviar",
        titulo: "Envie um modelo novo",
        texto:
          "Com permissão de envio, adicione um PDF com nome e descrição. Ele entra na lista desta categoria.",
      },
      REVER,
    ],
  },

  // ---- Formulários: Santander
  "formularios.santander": {
    versao: 1,
    titulo: "Formulários Santander",
    passos: [
      {
        alvo: "titulo",
        titulo: "Formulários do Santander",
        texto:
          "Os modelos de formulário em PDF do Santander, prontos para abrir e usar com o cliente.",
      },
      {
        alvo: "formularios-categorias",
        titulo: "Troque de banco ou categoria",
        texto:
          "Passe entre Itaú, Bradesco, Santander, Inter, Diversos e DPS. O número ao lado mostra quantos formulários cada um tem.",
      },
      {
        alvo: "busca",
        titulo: "Busque pelo nome",
        texto:
          "Digite parte do nome ou da descrição para achar o formulário certo nesta categoria.",
      },
      {
        alvo: "formularios-lista",
        titulo: "Abra o PDF",
        texto:
          "Ver abre o formulário em outra aba. Quem tem permissão também edita o nome, troca o arquivo ou exclui.",
      },
      {
        alvo: "formularios-enviar",
        titulo: "Envie um modelo novo",
        texto:
          "Com permissão de envio, adicione um PDF com nome e descrição. Ele entra na lista desta categoria.",
      },
      REVER,
    ],
  },

  // ---- Formulários: Inter
  "formularios.inter": {
    versao: 1,
    titulo: "Formulários Inter",
    passos: [
      {
        alvo: "titulo",
        titulo: "Formulários do Inter",
        texto: "Os modelos de formulário em PDF do Inter, prontos para abrir e usar com o cliente.",
      },
      {
        alvo: "formularios-categorias",
        titulo: "Troque de banco ou categoria",
        texto:
          "Passe entre Itaú, Bradesco, Santander, Inter, Diversos e DPS. O número ao lado mostra quantos formulários cada um tem.",
      },
      {
        alvo: "busca",
        titulo: "Busque pelo nome",
        texto:
          "Digite parte do nome ou da descrição para achar o formulário certo nesta categoria.",
      },
      {
        alvo: "formularios-lista",
        titulo: "Abra o PDF",
        texto:
          "Ver abre o formulário em outra aba. Quem tem permissão também edita o nome, troca o arquivo ou exclui.",
      },
      {
        alvo: "formularios-enviar",
        titulo: "Envie um modelo novo",
        texto:
          "Com permissão de envio, adicione um PDF com nome e descrição. Ele entra na lista desta categoria.",
      },
      REVER,
    ],
  },

  // ---- Formulários: Diversos
  "formularios.diversos": {
    versao: 1,
    titulo: "Formulários diversos",
    passos: [
      {
        alvo: "titulo",
        titulo: "Formulários diversos",
        texto:
          "Os modelos de formulário em PDF da categoria Diversos, prontos para abrir e usar com o cliente.",
      },
      {
        alvo: "formularios-categorias",
        titulo: "Troque de banco ou categoria",
        texto:
          "Passe entre Itaú, Bradesco, Santander, Inter, Diversos e DPS. O número ao lado mostra quantos formulários cada um tem.",
      },
      {
        alvo: "busca",
        titulo: "Busque pelo nome",
        texto:
          "Digite parte do nome ou da descrição para achar o formulário certo nesta categoria.",
      },
      {
        alvo: "formularios-lista",
        titulo: "Abra o PDF",
        texto:
          "Ver abre o formulário em outra aba. Quem tem permissão também edita o nome, troca o arquivo ou exclui.",
      },
      {
        alvo: "formularios-enviar",
        titulo: "Envie um modelo novo",
        texto:
          "Com permissão de envio, adicione um PDF com nome e descrição. Ele entra na lista desta categoria.",
      },
      REVER,
    ],
  },

  // ---- Formulários: DPS
  "formularios.dps": {
    versao: 1,
    titulo: "DPS",
    passos: [
      {
        alvo: "titulo",
        titulo: "Declaração Pessoal de Saúde",
        texto: "Gere a DPS do proponente, marque as respostas na tela e imprima ou salve em PDF.",
      },
      {
        alvo: "formularios-dps-opcoes",
        titulo: "Duas formas de começar",
        texto:
          "Preencha em branco, direto na tela, ou puxe do CRM: busque o cliente por nome, CPF/CNPJ ou e-mail e a DPS já vem com os dados principais.",
      },
      {
        titulo: "Tudo editável antes de imprimir",
        texto:
          "No documento, todos os campos podem ser ajustados. Marque Sim ou Não em cada pergunta, use Limpar marcações se precisar e depois Imprimir / Salvar PDF.",
      },
      REVER,
    ],
  },

  // ---- Formulários: Papel Timbrado
  "formularios.papel-timbrado": {
    versao: 1,
    titulo: "Papel Timbrado",
    passos: [
      {
        alvo: "titulo",
        titulo: "Cartas com a marca Agilliza",
        texto:
          "Monte cartas e comunicados no papel timbrado da Agilliza e baixe prontos para enviar.",
      },
      {
        alvo: "papel-timbrado-modelos",
        titulo: "Escolha o modelo",
        texto:
          "São 10 variações, todas com marca d'água. Ao escolher um modelo, a visualização muda na hora.",
      },
      {
        alvo: "papel-timbrado-campos",
        titulo: "Preencha a carta",
        texto:
          "Cidade, data, destinatário, referência, saudação, mensagem, despedida, assinante e cargo. Uma linha em branco separa os parágrafos.",
      },
      {
        alvo: "papel-timbrado-previa",
        titulo: "Confira antes de baixar",
        texto:
          "A visualização mostra como a página vai ficar com o modelo escolhido e o texto que você escreveu.",
      },
      {
        alvo: "papel-timbrado-acoes",
        titulo: "Baixe em PDF ou Word",
        texto:
          "Baixar PDF e Baixar Word geram a carta preenchida; Baixar em branco gera só o papel; Limpar apaga os campos e mantém o modelo.",
      },
      REVER,
    ],
  },

  // ---- Formulários: Modelos com Designer de Apresentações
  "formularios.powerpoint": {
    versao: 1,
    titulo: "Modelos com Designer de Apresentações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Modelos de PowerPoint",
        texto:
          "Layouts de apresentação com a identidade visual da Agilliza, prontos para receber o seu conteúdo.",
      },
      {
        alvo: "powerpoint-modelos",
        titulo: "Escolha o layout",
        texto:
          "São 4 modelos. Ao escolher um, a capa em destaque e a ficha técnica mudam para ele.",
      },
      {
        alvo: "powerpoint-previa",
        titulo: "Prévia da capa",
        texto:
          "Veja a capa e alguns slides. Iniciar Download baixa o arquivo; Abrir Pré-visualização mostra a capa em outra aba.",
      },
      {
        alvo: "powerpoint-ficha",
        titulo: "Ficha técnica",
        texto:
          "Formato do arquivo (.pptx), tamanho e recursos inclusos. Baixar agora e Baixar Modelo, no topo, também iniciam o download.",
      },
      REVER,
    ],
  },

  // ---- Documentos diversos: Links
  links: {
    versao: 1,
    titulo: "Links",
    passos: [
      {
        alvo: "titulo",
        titulo: "Links úteis",
        texto:
          "Os endereços que a equipe usa todo dia, por categoria. Clique em um link para abri-lo em outra aba.",
      },
      {
        alvo: "links-indicadores",
        titulo: "A lista em números",
        texto:
          "Quantos links e categorias existem. Com permissão de edição, o cartão de categorias abre o cadastro delas.",
      },
      {
        alvo: "links-categorias",
        titulo: "Filtre por categoria",
        texto:
          "Toque numa categoria para ver só os links dela; toque de novo para voltar a ver todos.",
      },
      {
        alvo: "busca",
        titulo: "Busque qualquer link",
        texto: "Procure por título, descrição, categoria ou endereço.",
      },
      {
        alvo: "links-acoes",
        titulo: "Cadastre e organize",
        texto:
          "Novo link adiciona endereço, título, descrição e categoria; Categorias ajusta nome, ícone e cor. Editar e excluir ficam em cada link, conforme sua permissão.",
      },
      REVER,
    ],
  },

  // ---- Documentos diversos: Controle de Matrículas
  matriculas: {
    versao: 1,
    titulo: "Controle de Matrículas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Pedidos de matrícula",
        texto:
          "Quem pediu, o analista que puxa, o crédito usado e quanto cada solicitante deve à Agilliza, num lugar só.",
      },
      {
        alvo: "matriculas-indicadores",
        titulo: "Resumo do momento",
        texto:
          "Saldo de crédito, pedidos em aberto, valor a receber e recebido. O saldo fica em alerta quando zera ou fica negativo.",
      },
      {
        alvo: "matriculas-pix",
        titulo: "Pix para pagar a Agilliza",
        texto:
          "Quem pediu a matrícula paga por esta chave; Copiar chave facilita mandar ao solicitante. Quem administra troca a chave em Configurar.",
      },
      {
        alvo: "abas",
        titulo: "Pedidos, A receber e Recargas",
        texto:
          "Pedidos é a fila de trabalho; A receber soma o que cada solicitante deve; Recargas registra o crédito colocado, com comprovante.",
      },
      {
        alvo: "matriculas-filtros",
        titulo: "Filtre e trabalhe a fila",
        texto:
          "Filtre por Em aberto, Aguardando recarga, A receber, Concluídas ou Canceladas. Em cada pedido: assumir, marcar sem saldo, concluir com o arquivo e marcar paga.",
      },
      {
        alvo: "matriculas-novo-pedido",
        titulo: "Registre um pedido",
        texto:
          "Novo pedido pede quem solicitou, cartório, cidade, número da matrícula ou endereço do imóvel. Lançamento manual registra uma matrícula já puxada.",
      },
    ],
  },

  // ---- Checklists: Todos os checklists
  checklists: {
    versao: 1,
    titulo: "Todos os checklists",
    passos: [
      {
        alvo: "titulo",
        titulo: "Checklists prontos",
        texto: "Listas de documentos para conferir com o cliente e enviar por WhatsApp ou e-mail.",
      },
      {
        alvo: "checklists-abertura",
        titulo: "Abertura de conta",
        texto:
          "O mínimo que cada banco pede para abrir a conta do cliente. Escolha o banco para abrir a lista.",
      },
      {
        alvo: "checklists-proposta",
        titulo: "Sequenciar a proposta",
        texto:
          "O dossiê para dar andamento à proposta de financiamento, igual para todos os bancos.",
      },
      {
        alvo: "checklists-por-banco",
        titulo: "Checklist completo por banco",
        texto:
          "A lista da esteira de crédito de cada banco, que você ajusta, compartilha e baixa em PDF.",
      },
      {
        titulo: "Conferência na hora",
        texto:
          "O que você marca nas listas serve para conferir na hora e não fica gravado: some ao sair da tela.",
      },
      REVER,
    ],
  },

  // ---- Checklists: Docs para abertura de conta — Bradesco
  "checklists.abertura-bradesco": {
    versao: 1,
    titulo: "Abertura de conta Bradesco",
    passos: [
      {
        alvo: "titulo",
        titulo: "Abertura de conta no Bradesco",
        texto: "Os documentos que o Bradesco pede para abrir a conta do cliente.",
      },
      {
        alvo: "checklist-copiar",
        titulo: "Mande para o cliente",
        texto: "Copiar para o cliente copia a lista pronta: é só colar no WhatsApp ou no e-mail.",
      },
      {
        alvo: "checklist-progresso",
        titulo: "Confira item a item",
        texto:
          "Marque cada documento conforme o cliente entrega; a barra mostra quantos já foram conferidos. As marcações não ficam salvas.",
      },
    ],
  },

  // ---- Checklists: Docs para abertura de conta — Itaú
  "checklists.abertura-itau": {
    versao: 1,
    titulo: "Abertura de conta Itaú",
    passos: [
      {
        alvo: "titulo",
        titulo: "Abertura de conta no Itaú",
        texto: "Os documentos que o Itaú pede para abrir a conta do cliente.",
      },
      {
        alvo: "checklist-copiar",
        titulo: "Mande para o cliente",
        texto: "Copiar para o cliente copia a lista pronta: é só colar no WhatsApp ou no e-mail.",
      },
      {
        alvo: "checklist-progresso",
        titulo: "Confira item a item",
        texto:
          "Marque cada documento conforme o cliente entrega; a barra mostra quantos já foram conferidos. As marcações não ficam salvas.",
      },
    ],
  },

  // ---- Checklists: Docs para abertura de conta — Santander
  "checklists.abertura-santander": {
    versao: 1,
    titulo: "Abertura de conta Santander",
    passos: [
      {
        alvo: "titulo",
        titulo: "Abertura de conta no Santander",
        texto: "Os documentos que o Santander pede para abrir a conta do cliente.",
      },
      {
        alvo: "checklist-copiar",
        titulo: "Mande para o cliente",
        texto: "Copiar para o cliente copia a lista pronta: é só colar no WhatsApp ou no e-mail.",
      },
      {
        alvo: "checklist-progresso",
        titulo: "Confira item a item",
        texto:
          "Marque cada documento conforme o cliente entrega; a barra mostra quantos já foram conferidos. As marcações não ficam salvas.",
      },
    ],
  },

  // ---- Checklists: Docs para abertura de conta — Inter
  "checklists.abertura-inter": {
    versao: 1,
    titulo: "Abertura de conta Inter",
    passos: [
      {
        alvo: "titulo",
        titulo: "Abertura de conta no Inter",
        texto: "Os documentos que o Inter pede para abrir a conta do cliente.",
      },
      {
        alvo: "checklist-copiar",
        titulo: "Mande para o cliente",
        texto: "Copiar para o cliente copia a lista pronta: é só colar no WhatsApp ou no e-mail.",
      },
      {
        alvo: "checklist-progresso",
        titulo: "Confira item a item",
        texto:
          "Marque cada documento conforme o cliente entrega; a barra mostra quantos já foram conferidos. As marcações não ficam salvas.",
      },
    ],
  },

  // ---- Checklists: Docs para sequenciar proposta
  "checklists.seguir-proposta": {
    versao: 1,
    titulo: "Docs para sequenciar proposta",
    passos: [
      {
        alvo: "titulo",
        titulo: "Dossiê da proposta",
        texto:
          "Tudo o que é preciso para dar andamento à proposta: comprador, imóvel, vistoria, FGTS, interveniente quitante e vendedores.",
      },
      {
        titulo: "Blocos que dependem do caso",
        texto:
          "Alguns blocos só valem em certas situações, como imóvel em condomínio, uso de FGTS ou interveniente quitante. O aviso aparece no topo do bloco.",
      },
      {
        alvo: "checklist-copiar",
        titulo: "Mande para o cliente",
        texto:
          "Copiar para o cliente copia a lista pronta, separada por blocos: é só colar no WhatsApp ou no e-mail.",
      },
      {
        alvo: "checklist-progresso",
        titulo: "Confira item a item",
        texto:
          "Marque cada documento conforme o cliente entrega; a barra mostra quantos já foram conferidos. As marcações não ficam salvas.",
      },
    ],
  },

  // ---- Checklists: Checklist de documentos por banco (?banco=itau etc.)
  "formularios.checklist": {
    versao: 1,
    titulo: "Checklist de documentos por banco",
    passos: [
      {
        alvo: "titulo",
        titulo: "Checklist por banco",
        texto:
          "A lista completa de documentos da esteira de crédito de cada banco, para ajustar e mandar ao cliente.",
      },
      {
        alvo: "abas",
        titulo: "Escolha o banco",
        texto:
          "Itaú, Bradesco, Santander, Inter ou Caixa. Cada banco guarda as suas marcações enquanto você está na tela.",
      },
      {
        alvo: "checklist-bancos-lista",
        titulo: "Marque o que vai",
        texto:
          "Desmarque o que não se aplica, alterne Obrigatório ou Opcional e use o lápis para editar ou a lixeira para tirar um item. Vale só para este envio.",
      },
      {
        alvo: "checklist-bancos-acoes",
        titulo: "Envie ou baixe",
        texto:
          "Marcar todos, Item para incluir um documento, Compartilhar por WhatsApp, e-mail ou PDF, e Baixar PDF com o que está marcado.",
      },
      REVER,
    ],
  },

  // ---- Marketing: Automações (modelo do Postei, 26/10/2026)
  automacoes: {
    versao: 2,
    titulo: "Automações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Automações de marketing",
        texto:
          "Agende posts, vídeos e stories nas redes da AgillizaTech, todas de uma vez: no dia e na hora, o sistema publica sozinho.",
      },
      {
        titulo: "Calendário, Posts e Novo post",
        texto:
          "No calendário você vê e arrasta os posts entre os dias. Em Posts, filtra por rede e situação. Em Novo post, escreve, escolhe a mídia e vê a prévia de cada rede.",
      },
      {
        titulo: "Mídia, Relatórios e Redes",
        texto:
          "A Mídia guarda fotos e vídeos. Os Relatórios mostram seguidores, alcance e o resultado de cada post. Em Redes você conecta as contas pelo site oficial de cada rede.",
      },
    ],
  },
  "automacoes.posts": {
    versao: 1,
    titulo: "Posts",
    passos: [
      {
        alvo: "filtros",
        titulo: "Ache qualquer post",
        texto:
          "Filtre por situação (agendados, publicados, com falha, rascunhos), por rede e por período, ou busque na legenda.",
      },
      {
        titulo: "Ações do post",
        texto:
          "No menu de cada linha: publicar agora, tentar de novo as redes que falharam, duplicar ou cancelar. Abra o post para ver cada rede e o histórico.",
      },
    ],
  },
  "automacoes.novo": {
    versao: 1,
    titulo: "Novo post",
    passos: [
      {
        alvo: "titulo",
        titulo: "Escreva uma vez, publique em todas",
        texto:
          "Escolha as redes e o formato em cada uma (feed, carrossel, Reels, Stories, vídeo, Shorts). A legenda pode ser diferente por rede.",
      },
      {
        titulo: "Prévia e regras de cada rede",
        texto:
          "A prévia mostra como o post fica em cada rede, e o aviso amarelo diz o que ajustar antes de agendar. Use os horários recomendados ou publique agora.",
      },
    ],
  },
  "automacoes.midia": {
    versao: 1,
    titulo: "Mídia",
    passos: [
      {
        alvo: "filtros",
        titulo: "Biblioteca de fotos e vídeos",
        texto:
          "Envie fotos (até 5 MB) e vídeos (até 60 MB) uma vez e use em quantos posts quiser. As fotos dos imóveis também aparecem aqui.",
      },
      {
        titulo: "Arraste para enviar",
        texto:
          "Solte os arquivos sobre a lista para enviar. Arquivo que está num post ainda na fila não pode ser apagado.",
      },
    ],
  },
  "automacoes.relatorios": {
    versao: 1,
    titulo: "Relatórios",
    passos: [
      {
        alvo: "indicadores",
        titulo: "Resultado das redes",
        texto:
          "Alcance, visualizações, curtidas, comentários, compartilhamentos, salvos, cliques e leads, com os números oficiais de cada rede.",
      },
      {
        titulo: "Contas e publicação",
        texto:
          "Seguidores e crescimento de cada conta, os dias e horários com mais publicações e o resultado de cada post. Exporte em PDF para enviar.",
      },
    ],
  },
  "automacoes.redes": {
    versao: 1,
    titulo: "Redes",
    passos: [
      {
        titulo: "Conecte as redes da AgillizaTech",
        texto:
          "A conexão é feita no site oficial de cada rede e você escolhe quais contas usar. Nenhuma senha passa pelo Agilliza.",
      },
      {
        titulo: "Chaves e endereços de retorno",
        texto:
          "As chaves dos apps ficam em Chaves dos provedores; o endereço de retorno de cada rede está nesta tela, pronto para copiar.",
      },
    ],
  },

  // ---- Diversos: Pedidos de Compras
  "admin.compras.pedidos": {
    versao: 1,
    titulo: "Pedidos de Compras",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seus pedidos de compra",
        texto:
          "Peça o que a operação precisa e acompanhe a decisão da gestão. Aqui aparecem só os pedidos que você fez.",
      },
      {
        alvo: "acoes",
        titulo: "Novo pedido",
        texto:
          "Descreva o que precisa, o valor estimado, a categoria e, se quiser, a justificativa. O pedido vai para a Aprovação de compras.",
      },
      {
        alvo: "compras-pedidos-indicadores",
        titulo: "Seus números",
        texto:
          "Total, aguardando, aprovados e recusados, com os valores. Clique num cartão para filtrar a lista.",
      },
      {
        alvo: "abas",
        titulo: "Filtre pela situação",
        texto:
          "Todos, Aguardando, Aprovados ou Recusados. A busca ao lado acha por descrição, categoria ou número.",
      },
      {
        alvo: "compras-pedidos-lista",
        titulo: "O histórico de cada pedido",
        texto:
          "Cada cartão mostra valor, situação, quem decidiu, quando e o motivo. Editar e excluir só enquanto o pedido está aguardando.",
      },
      REVER,
    ],
  },

  // ---- Diversos: Aprovação de Compras
  "admin.compras.aprovacoes": {
    versao: 1,
    titulo: "Aprovação de Compras",
    passos: [
      {
        alvo: "titulo",
        titulo: "Decida os pedidos da equipe",
        texto:
          "Aprove, com observação se quiser, ou recuse com o motivo. A decisão fica no histórico do pedido.",
      },
      {
        alvo: "compras-aprovacoes-indicadores",
        titulo: "A fila em números",
        texto:
          "Quantos aguardam decisão e desde quando, o valor em jogo, aprovados e recusados. Clique num cartão para filtrar.",
      },
      {
        alvo: "abas",
        titulo: "Filtre pela situação",
        texto:
          "Em Aguardando, o pedido mais antigo vem primeiro. Troque para Aprovados, Recusados ou Todos; a busca acha por solicitante, descrição ou número.",
      },
      {
        alvo: "compras-aprovacoes-lista",
        titulo: "Aprovar ou recusar",
        texto:
          "Em cada pedido aguardando, Aprovar aceita uma observação opcional e Recusar exige o motivo. Os botões aparecem para quem pode decidir.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Painel
  "financeiro.painel": {
    versao: 1,
    titulo: "Painel",
    passos: [
      {
        alvo: "titulo",
        titulo: "O financeiro da matriz numa tela",
        texto:
          "Veja o que os bancos devem, o que entrou e o que sai para assinantes, corretores, parceiros e fornecedores, sempre com previsto e realizado separados.",
      },
      {
        alvo: "financeiro-painel-filtros",
        titulo: "Período, banco e produto",
        texto:
          "Escolha as datas ou um atalho (Este mês, 90 dias, Próx. 90, Ano) e filtre por banco e produto. O painel inteiro se ajusta.",
      },
      {
        alvo: "financeiro-painel-naturezas",
        titulo: "Um cartão para cada natureza",
        texto:
          "Comissões dos bancos, outras receitas, repasses, corretores e parceiros e despesas: quanto já entrou ou saiu e quanto falta. Toque no cartão para abrir a tela dele.",
      },
      {
        alvo: "financeiro-painel-grafico",
        titulo: "Previsto x realizado, mês a mês",
        texto:
          "As barras mostram entradas e saídas realizadas; as linhas tracejadas, o que ainda está previsto.",
      },
      {
        alvo: "financeiro-painel-alertas",
        titulo: "O que pede atenção",
        texto:
          "Contratos sem previsão, comissões vencidas ou com diferença, despesas vencidas, boletos e extrato a conferir. Cada alerta leva direto à lista de origem.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Comissões dos bancos
  "financeiro.comissoes-bancos": {
    versao: 1,
    titulo: "Comissões dos bancos",
    passos: [
      {
        alvo: "titulo",
        titulo: "O que cada banco deve",
        texto:
          "A previsão nasce sozinha quando o contrato é emitido ou registrado. Aqui você acompanha o previsto, o valor informado pelo banco e o que foi recebido.",
      },
      {
        alvo: "metrica",
        titulo: "Os números do período",
        texto:
          "Previsto, informado pelo banco, recebido, a receber e divergentes/contestadas. O indicador de divergentes já filtra a lista para você.",
      },
      {
        alvo: "financeiro-periodo",
        titulo: "Período e busca",
        texto:
          "Ajuste o período da previsão e, no campo ao lado, procure por cliente, banco ou contrato.",
      },
      {
        alvo: "financeiro-situacoes",
        titulo: "Filtre pela situação",
        texto: "Previstas, a receber, parciais, divergentes, contestadas, recebidas ou canceladas.",
      },
      {
        alvo: "tabela",
        titulo: "Cada comissão e suas ações",
        texto:
          "Abra a linha para ver o detalhe e a trilha. Pelo menu: registrar recebimento, informar o valor do banco, corrigir a previsão, contestar ou cancelar.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Exportar, gerar e lançar",
        texto:
          "Exporte a lista (PDF, Excel, Word, CSV ou impressão). Conforme o seu acesso, gere as previsões que faltam ou lance uma comissão avulsa.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Repasses aos assinantes
  "financeiro.repasses": {
    versao: 1,
    titulo: "Repasses aos assinantes",
    passos: [
      {
        alvo: "titulo",
        titulo: "Repasse às contas assinantes",
        texto:
          "O que a matriz repassa a corretores e imobiliárias assinantes pelas propostas enviadas. Nasce no registro do contrato, é aprovado e pago com comprovante.",
      },
      {
        alvo: "metrica",
        titulo: "Situação em números",
        texto:
          "Previsto, aguardando o banco, aprovado a pagar, pago e cancelado. Toque num indicador para filtrar a lista.",
      },
      {
        alvo: "financeiro-repasses-regras",
        titulo: "Regras do repasse",
        texto:
          "O percentual padrão vale para todas as contas; uma conta pode ter percentual próprio. Regra nova vale dali em diante e não recalcula repasse já nascido.",
      },
      {
        alvo: "financeiro-situacoes",
        titulo: "Filtros e aprovação em lote",
        texto:
          "Filtre pela situação. Marque vários repasses na lista para aprovar todos para pagamento de uma vez.",
      },
      {
        alvo: "tabela",
        titulo: "Ações de cada repasse",
        texto:
          "Ver pagamentos e histórico, confirmar a base quando o banco pagar, aprovar, registrar pagamento, ajustar o valor ou cancelar.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Exportar e ver licenças",
        texto: "Exporte a lista em PDF, Excel, Word ou CSV, ou abra as licenças por assinante.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Corretores e parceiros
  "financeiro.comissoes-corretores": {
    versao: 1,
    titulo: "Corretores e parceiros",
    passos: [
      {
        alvo: "titulo",
        titulo: "Comissões de corretores e parceiros",
        texto:
          "Fluxo próprio, separado do repasse aos assinantes: cada pessoa recebe pela regra dela ou do papel (originou, atendeu, participou).",
      },
      {
        alvo: "metrica",
        titulo: "Indicadores",
        texto:
          "Previstas, aguardando o banco, aprovadas a pagar, pagas e contestadas. Alguns indicadores filtram a lista ao toque.",
      },
      {
        alvo: "financeiro-corretores-filtros",
        titulo: "Período, pessoa, papel e busca",
        texto:
          "Filtre pelo vencimento, por pessoa ou por papel, ou procure por pessoa, proposta ou banco.",
      },
      {
        alvo: "financeiro-situacoes",
        titulo: "Situações e aprovação em lote",
        texto:
          "Filtre pela situação. Marque várias comissões na lista para aprovar todas para pagamento de uma vez.",
      },
      {
        alvo: "tabela",
        titulo: "Ações de cada comissão",
        texto:
          "Ver detalhe e trilha, abrir o demonstrativo da pessoa, aprovar, registrar pagamento, ajustar, contestar ou resolver uma contestação.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Participantes e lançamentos",
        texto:
          "Defina quem originou, atendeu ou participou de uma proposta e gere as previsões, lance uma comissão avulsa ou exporte a lista.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Contas a pagar
  "financeiro.contas-a-pagar": {
    versao: 1,
    titulo: "Contas a pagar",
    passos: [
      {
        alvo: "titulo",
        titulo: "Despesas da operação",
        texto:
          "Contas com fornecedor, categoria e centro de custo. Comissões dos bancos e repasses ficam nas telas próprias.",
      },
      {
        alvo: "metrica",
        titulo: "Em aberto, vencidas e mais",
        texto:
          "Em aberto, vencidas, pago no período, recorrentes e rascunhos de boleto. Toque num indicador para filtrar a lista.",
      },
      {
        alvo: "financeiro-contas-filtros",
        titulo: "Filtros",
        texto:
          "Período de vencimento, categoria, fornecedor e busca por número ou descrição. Logo abaixo, escolha a situação da conta.",
      },
      {
        alvo: "tabela",
        titulo: "Ações de cada conta",
        texto:
          "Registrar pagamento (pode ser parcial, com comprovante), anexar documento, editar, cancelar e ver a trilha. Rascunho de boleto abre para conferir.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Ler boleto e nova despesa",
        texto:
          "Ler boleto aceita PDF, foto ou linha digitável e cria um rascunho para você conferir. Nova despesa pode ser única, mensal, anual ou parcelada.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Contas a receber
  "financeiro.contas-a-receber": {
    versao: 1,
    titulo: "Contas a receber",
    passos: [
      {
        alvo: "titulo",
        titulo: "Outras receitas",
        texto:
          "Receitas avulsas do correspondente, como serviços. Comissões dos bancos e licenças dos assinantes têm telas próprias.",
      },
      {
        alvo: "metrica",
        titulo: "Em aberto, vencidas e recebidas",
        texto: "Os totais do período. Toque num indicador para filtrar a lista.",
      },
      {
        alvo: "financeiro-contas-filtros",
        titulo: "Filtros",
        texto:
          "Período de vencimento, categoria e busca por número ou descrição. Logo abaixo, escolha a situação da conta.",
      },
      {
        alvo: "tabela",
        titulo: "Ações de cada conta",
        texto:
          "Registrar recebimento (pode ser parcial, com comprovante), anexar documento, editar, cancelar e ver a trilha.",
      },
      {
        alvo: "financeiro-contas-matriculas",
        titulo: "Matrículas pedidas por terceiros",
        texto:
          "Quanto cada solicitante deve de matrículas. Abra o nome para ver cada matrícula e registrar o recebimento.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Nova receita e exportar",
        texto: "Lance uma receita avulsa, exporte a lista ou abra as licenças dos assinantes.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Licenças dos assinantes
  "financeiro.assinantes": {
    versao: 1,
    titulo: "Licenças dos assinantes",
    passos: [
      {
        alvo: "titulo",
        titulo: "Licenças e repasses por assinante",
        texto:
          "Para cada conta assinante: receita de licença, inadimplência, receita avulsa e repasse, lidos do Agilliza Tech.",
      },
      {
        alvo: "financeiro-periodo",
        titulo: "Período e busca",
        texto: "Escolha o período e, no campo ao lado, procure a conta pelo nome.",
      },
      {
        alvo: "metrica",
        titulo: "Totais do período",
        texto:
          "Licenças recebidas, a vencer, inadimplência, receita avulsa e contas ativas ou em teste.",
      },
      {
        alvo: "financeiro-assinantes-grafico",
        titulo: "Mês a mês",
        texto: "Licença paga, receita avulsa e repasse pago aos assinantes em cada mês.",
      },
      {
        alvo: "tabela",
        titulo: "Cada conta",
        texto:
          "Situação da licença, valores e contratos registrados. Pelo menu, abra a licença da conta ou os repasses.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Exportar e repasses",
        texto: "Exporte o quadro em PDF, Excel, Word ou CSV, ou vá para Repasses aos assinantes.",
      },
    ],
  },

  // ---- Financeiro: Conciliação
  "financeiro.conciliacao": {
    versao: 1,
    titulo: "Conciliação",
    passos: [
      {
        alvo: "titulo",
        titulo: "Conciliação bancária",
        texto:
          "Importe o extrato e o sistema sugere a qual lançamento cada movimentação corresponde. Nada muda até você confirmar.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Importar extrato",
        texto:
          "Escolha a conta bancária e o arquivo OFX (recomendado) ou CSV do internet banking. O mesmo arquivo ou movimentação não entra duas vezes.",
      },
      {
        alvo: "metrica",
        titulo: "Andamento",
        texto: "Extratos importados, movimentações pendentes e conciliadas.",
      },
      {
        alvo: "financeiro-conciliacao-extratos",
        titulo: "Extratos importados",
        texto:
          "Escolha o extrato para trabalhar. Cada um mostra a conta, o período, as pendentes e as conciliadas.",
      },
      {
        alvo: "financeiro-conciliacao-movimentacoes",
        titulo: "Confirme as sugestões",
        texto:
          "Em cada movimentação, confirme ou rejeite a sugestão, ou deixe de fora (ex.: tarifa). Uma conciliação pode ser desfeita, com motivo.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Fluxo de caixa
  "financeiro.fluxo-de-caixa": {
    versao: 1,
    titulo: "Fluxo de caixa",
    passos: [
      {
        alvo: "titulo",
        titulo: "Realizado e previsto",
        texto:
          "Realizado é o que já foi recebido ou pago; previsto é o que está em aberto pela data esperada. Cada natureza aparece separada.",
      },
      {
        alvo: "financeiro-periodo",
        titulo: "Período",
        texto: "Escolha as datas ou use os atalhos Este mês, 90 dias, Próx. 90 e Ano.",
      },
      {
        alvo: "metrica",
        titulo: "Resultado do período",
        texto:
          "Entradas e saídas realizadas, o resultado realizado e o resultado contando os previstos.",
      },
      {
        alvo: "financeiro-fluxo-meses",
        titulo: "Mês a mês",
        texto: "Cada mês com o saldo acumulado e o realizado x previsto de cada natureza.",
      },
      {
        alvo: "financeiro-fluxo-movimentos",
        titulo: "Movimentos realizados",
        texto:
          "Cada recebimento e pagamento, com a conta e se já foi conciliado, e o atalho para abrir o lançamento de origem.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Exportar",
        texto: "Exporte os movimentos realizados em PDF, Excel, Word ou CSV, ou imprima.",
      },
      REVER,
    ],
  },

  // ---- Financeiro: Relatórios
  "financeiro.relatorios": {
    versao: 1,
    titulo: "Relatórios",
    passos: [
      {
        alvo: "titulo",
        titulo: "Relatórios financeiros",
        texto:
          "Um relatório para cada natureza, com filtros e o caminho de cada linha até o lançamento de origem.",
      },
      {
        alvo: "financeiro-situacoes",
        titulo: "Escolha o relatório",
        texto:
          "Comissões dos bancos, contrato sem previsão, previsões vencidas, diferenças, corretores e parceiros, despesas, outras receitas e movimentos — os liberados ao seu perfil.",
      },
      {
        alvo: "financeiro-relatorios-filtros",
        titulo: "Filtros",
        texto: "Período e, conforme o relatório, banco, pessoa, fornecedor ou categoria.",
      },
      {
        alvo: "tabela",
        titulo: "O resultado",
        texto: "As linhas do relatório, cada uma com o atalho para abrir o lançamento de origem.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Exportar",
        texto: "Gere o relatório escolhido em PDF, Excel, Word ou CSV, ou imprima.",
      },
    ],
  },

  // ---- Financeiro: Regras e configurações
  "financeiro.configuracoes": {
    versao: 1,
    titulo: "Regras e configurações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Regras, cadastros e parâmetros",
        texto:
          "Cada lançamento guarda a regra que usou: mudar uma regra aqui vale para os próximos e não recalcula o que já existe.",
      },
      {
        alvo: "abas",
        titulo: "Quatro abas",
        texto:
          "Bancos, Corretores e parceiros, Cadastros (categorias, centros de custo, formas de pagamento, contas bancárias, fornecedores) e Parâmetros.",
      },
      {
        alvo: "financeiro-config-regras-banco",
        titulo: "Comissão de cada banco",
        texto:
          "Percentual ou valor fixo por banco, produto, faixa de valor e vigência. A regra mais específica vence; dá para editar ou encerrar.",
      },
      {
        titulo: "Parâmetros do financeiro",
        texto:
          "Na aba Parâmetros: quando nasce a previsão do banco, prazos de recebimento e vencimento, tolerância de diferença e janela da conciliação.",
      },
      {
        alvo: "financeiro-config-repasse",
        titulo: "E o repasse?",
        texto: "O percentual do repasse aos assinantes é definido na tela Repasses aos assinantes.",
      },
    ],
  },

  // ---- Financeiro: Auditoria
  "financeiro.auditoria": {
    versao: 1,
    titulo: "Auditoria",
    passos: [
      {
        alvo: "titulo",
        titulo: "Tudo o que aconteceu no financeiro",
        texto:
          "Quem criou, editou, aprovou, recebeu, pagou, conciliou, ajustou ou cancelou, com antes e depois e o motivo. Ninguém altera essa trilha.",
      },
      {
        alvo: "financeiro-auditoria-filtros",
        titulo: "Filtros",
        texto:
          "Escolha o período, onde aconteceu (ex.: contas a pagar, conciliações) e o tipo de ação.",
      },
      {
        alvo: "financeiro-auditoria-trilha",
        titulo: "A trilha",
        texto:
          "Cada registro mostra a ação, quando, quem fez, o motivo e um resumo de antes e depois.",
      },
      {
        alvo: "financeiro-acoes",
        titulo: "Exportar",
        texto: "Exporte os registros em PDF, Excel, Word ou CSV, ou imprima.",
      },
    ],
  },

  // ---- Financeiro: Minhas comissões
  "financeiro.minhas-comissoes": {
    versao: 1,
    titulo: "Minhas comissões",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seu demonstrativo",
        texto:
          "Suas comissões com a base, o percentual gravado no lançamento, a situação e os pagamentos.",
      },
      {
        alvo: "metrica",
        titulo: "Seus totais",
        texto: "Quanto está previsto, quanto está a pagar e quanto já foi pago.",
      },
      {
        alvo: "financeiro-demonstrativo-lista",
        titulo: "Cada comissão",
        texto:
          "Proposta, banco, papel, cálculo, vencimento e as datas dos pagamentos. Discorda de um valor? Fale com o financeiro do correspondente.",
      },
      {
        alvo: "financeiro-demonstrativo-exportar",
        titulo: "Exportar",
        texto: "Baixe o seu demonstrativo em PDF, Excel, Word ou CSV, ou imprima.",
      },
    ],
  },

  // ---- Gestão de Pessoas e RH: Painel
  rh: {
    versao: 1,
    titulo: "Painel",
    passos: [
      {
        alvo: "titulo",
        titulo: "Painel de Gestão de Pessoas",
        texto:
          "Um retrato do quadro: movimentação, ausências, férias, documentos e o custo da folha, com a hora da última atualização.",
      },
      {
        alvo: "rh-painel-acoes",
        titulo: "Atalhos do dia a dia",
        texto: "Abra a folha do mês ou comece a admissão de um novo colaborador direto daqui.",
      },
      {
        alvo: "rh-painel-quadro",
        titulo: "Quadro e movimentação",
        texto:
          "Headcount, admissões e desligamentos do mês e o turnover de 12 meses. Toque num cartão para ver os colaboradores.",
      },
      {
        alvo: "rh-painel-ausencias",
        titulo: "Ausências, férias e documentos",
        texto:
          "Absenteísmo, férias vencidas, documentos vencendo e admissões com documento pendente. Cada cartão leva à tela onde você resolve.",
      },
      {
        alvo: "rh-painel-movimentacao",
        titulo: "Doze meses de movimentação",
        texto:
          "Admissões e desligamentos mês a mês e o quadro por departamento. Logo abaixo, aniversariantes do mês e experiências que terminam em 30 dias.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Pessoas e RH: Colaboradores
  "rh.funcionarios": {
    versao: 1,
    titulo: "Colaboradores",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seus colaboradores",
        texto:
          "Todos os funcionários com número, cargo, departamento, status, data de admissão e salário atual.",
      },
      {
        alvo: "rh-colaboradores-filtros",
        titulo: "Busque e filtre",
        texto:
          "Procure por nome, CPF ou número, filtre por status (ativos, em experiência, afastados, em férias) e marque “Incluir desligados” para ver o histórico.",
      },
      {
        alvo: "tabela",
        titulo: "Abra a ficha",
        texto:
          "Toque na linha para abrir a ficha completa. O lápis edita; a lixeira exclui o funcionário de vez, com tudo o que é só dele.",
      },
      {
        alvo: "rh-colaboradores-admitir",
        titulo: "Admitir alguém novo",
        texto:
          "Começa a admissão guiada: dados pessoais, endereço, contrato e cargo, remuneração e banco e revisão.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Pessoas e RH: Admissão
  "rh.funcionarios.novo": {
    versao: 1,
    titulo: "Admissão",
    passos: [
      {
        alvo: "titulo",
        titulo: "Admissão guiada",
        texto: "Cadastre um novo colaborador em etapas, sem pular nada do que a admissão pede.",
      },
      {
        alvo: "rh-admissao-vinculo",
        titulo: "Ligue a um usuário do sistema",
        texto:
          "Se a pessoa já tem acesso ao sistema, escolha o usuário: os campos vazios recebem nome, CPF, telefone e e-mail dele.",
      },
      {
        alvo: "rh-admissao-etapas",
        titulo: "As etapas da admissão",
        texto:
          "Dados pessoais, endereço, contrato e cargo, remuneração e banco (para quem altera salários) e revisão. Toque numa etapa já feita para voltar a ela.",
      },
      {
        alvo: "rh-admissao-navegacao",
        titulo: "Avance e conclua",
        texto:
          "“Próximo” confere nome, CPF e data de admissão. Na revisão, “Concluir admissão” cria a ficha, o checklist de documentos e o primeiro período de férias.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Pessoas e RH: Folha mensal
  "rh.folha": {
    versao: 1,
    titulo: "Folha mensal",
    passos: [
      {
        alvo: "titulo",
        titulo: "A folha do mês",
        texto:
          "Tudo da competência num lugar: lançamentos, faltas e atestados, prévia, fechamento e holerites.",
      },
      {
        alvo: "rh-folha-competencia",
        titulo: "Escolha a competência",
        texto:
          "Use as setas para ir ao mês anterior ou ao próximo. Logo abaixo do mês aparece se ela está aberta, fechada ou ainda não iniciada.",
      },
      {
        alvo: "rh-folha-passos",
        titulo: "O caminho da folha",
        texto:
          "Lançar, conferir a prévia, fechar e publicar os holerites. Os passos ficam marcados quando a competência é fechada.",
      },
      {
        alvo: "abas",
        titulo: "Uma aba para cada passo",
        texto:
          "Lançamentos (horas extras, comissões, descontos e adiantamentos), Faltas e atestados, Prévia e fechamento e Holerites, gerados e publicados no Meu RH.",
      },
      {
        titulo: "Competência fechada fica travada",
        texto:
          "Depois de fechar, lançamentos, faltas e adiantamentos do mês não mudam. Para corrigir, reabra em Prévia e fechamento, informando o motivo.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Pessoas e RH: Férias
  "rh.ferias": {
    versao: 1,
    titulo: "Férias",
    passos: [
      {
        alvo: "titulo",
        titulo: "Férias pela CLT",
        texto:
          "Os períodos aquisitivos saem sozinhos da data de admissão. Aqui você acompanha saldos e vencimentos e programa as férias.",
      },
      {
        alvo: "rh-ferias-resumo",
        titulo: "Onde agir primeiro",
        texto:
          "Férias vencidas (risco de pagamento em dobro), as que vencem em 90 dias, o saldo de dias e a provisão. Toque num cartão para filtrar a lista.",
      },
      {
        alvo: "rh-ferias-filtros",
        titulo: "Busque e filtre",
        texto:
          "Procure por nome, cargo ou departamento e filtre vencidas, a vencer ou com saldo. Toque na pessoa para ver cada período e programar o que tem saldo.",
      },
      {
        alvo: "abas",
        titulo: "Controle CLT e Programações",
        texto:
          "No Controle CLT ficam os saldos de cada pessoa. Em Programações, as férias marcadas: edite ou cancele (o registro fica no histórico).",
      },
      {
        alvo: "rh-ferias-programar",
        titulo: "Programar férias",
        texto:
          "Escolha o funcionário, o período aquisitivo, as datas de gozo, o abono e se adianta o 13º. Aprovar depende da sua permissão.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Pessoas e RH: Relatórios
  "rh.relatorios": {
    versao: 1,
    titulo: "Relatórios",
    passos: [
      {
        alvo: "titulo",
        titulo: "Relatórios de pessoas",
        texto:
          "Quadro e férias prontos para conferir e exportar. Salário e provisão só aparecem para quem vê salários.",
      },
      {
        alvo: "rh-relatorios-indicadores",
        titulo: "Números do RH",
        texto:
          "Headcount, turnover de 12 meses, absenteísmo do mês e férias vencidas, que ficam em destaque quando há pendência.",
      },
      {
        alvo: "rh-relatorios-tipo",
        titulo: "Quadro ou férias",
        texto:
          "Alterne entre o quadro de colaboradores (com os desligados) e o controle de férias CLT. A tabela abaixo muda junto.",
      },
      {
        alvo: "rh-relatorios-exportar",
        titulo: "Exporte em CSV, Excel ou PDF",
        texto:
          "O arquivo traz todas as linhas, mesmo quando a tela mostra só as 200 primeiras. Os botões aparecem para quem pode exportar.",
      },
      {
        alvo: "rh-relatorios-atalhos",
        titulo: "Atalhos",
        texto: "Vá direto para a folha mensal, as férias ou os documentos.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Pessoas e RH: Configurações
  "rh.configuracoes": {
    versao: 1,
    titulo: "Configurações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Configurações do RH",
        texto:
          "As bases que o RH usa no dia a dia: cargos, departamentos, benefícios, tabelas da folha e as regras CLT aplicadas.",
      },
      {
        alvo: "abas",
        titulo: "Cinco áreas",
        texto:
          "Cargos, Departamentos, Benefícios (catálogo e quem recebe cada um), Tabelas da folha (INSS e IRRF por vigência) e Regras CLT, para consulta.",
      },
      {
        alvo: "rh-config-novo",
        titulo: "Cargos e departamentos",
        texto:
          "Crie um item novo, edite o nome (e o CBO do cargo) ou desative: ele sai das opções sem apagar o histórico.",
      },
      {
        titulo: "Tabelas da folha",
        texto:
          "INSS, IRRF, salário mínimo e os demais valores valem por vigência. Quando a lei mudar, crie uma nova vigência a partir da atual.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Pessoas e RH: Meu RH
  "rh.meu": {
    versao: 1,
    titulo: "Meu RH",
    passos: [
      {
        alvo: "titulo",
        titulo: "Meu RH",
        texto:
          "Sua área de colaborador: holerites, férias e seus dados, só os seus. Se aparecer que não há ficha, peça ao RH para ligá-la ao seu acesso.",
      },
      {
        alvo: "meu-rh-indicadores",
        titulo: "Seu resumo",
        texto:
          "Sua situação, a data de admissão, os dias de férias disponíveis e quantos holerites já foram publicados.",
      },
      {
        alvo: "meu-rh-holerites",
        titulo: "Meus holerites",
        texto:
          "Veja ou baixe o holerite de cada mês. Eles chegam aqui quando a folha é fechada e publicada.",
      },
      {
        alvo: "meu-rh-ferias",
        titulo: "Minhas férias",
        texto:
          "Seus períodos aquisitivos com saldo e as férias já programadas. Perto do vencimento, aparece um aviso para combinar as datas com o RH.",
      },
      {
        alvo: "meu-rh-dados",
        titulo: "Meus dados",
        texto:
          "Matrícula, contrato, jornada e e-mail corporativo. Se algo estiver errado, peça a correção ao RH.",
      },
      REVER,
    ],
  },

  // ---- Relatórios gerenciais: Gerencial
  "relatorios.gerencial": {
    versao: 1,
    titulo: "Relatório gerencial",
    passos: [
      {
        alvo: "titulo",
        titulo: "Relatório gerencial",
        texto:
          "Do primeiro cálculo ao contrato registrado, comparado ao período anterior. A barra logo abaixo leva aos outros relatórios gerenciais.",
      },
      {
        alvo: "relatorios-filtros",
        titulo: "Filtre o recorte",
        texto:
          "Abrangência, base (Sua base, Assinantes ou Vinculados), período, visão Geral ou Minha, banco e responsável. O filtro fica no link da página.",
      },
      {
        alvo: "relatorios-gerencial-indicadores",
        titulo: "Indicadores do período",
        texto:
          "Simulações, propostas, crédito aprovado, contratos emitidos e registrados e valor financiado. Toque num número para abrir a lista de origem.",
      },
      {
        alvo: "relatorios-gerencial-paineis",
        titulo: "Funil, rankings e licenças",
        texto:
          "Funil por etapa, conversão e tempo por etapa, mês a mês, origem da produção, rankings de contas, usuários e bancos e a receita das licenças.",
      },
      {
        alvo: "acoes",
        titulo: "Exportar",
        texto:
          "Gere a produção por conta em PDF, Excel, Word ou CSV, ou imprima, já com o filtro aplicado.",
      },
      REVER,
    ],
  },

  // ---- Relatórios gerenciais: Operacional
  "relatorios.operacional": {
    versao: 1,
    titulo: "Relatórios operacionais",
    passos: [
      {
        alvo: "titulo",
        titulo: "Relatórios operacionais",
        texto:
          "O SLA das propostas até o envio ao banco, demandas e tarefas por responsável e onde a operação está parada.",
      },
      {
        alvo: "relatorios-filtros",
        titulo: "Mesmo filtro dos relatórios",
        texto:
          "Período, visão, banco e responsável. O SLA é o da equipe do Agilliza; os gargalos valem para o recorte inteiro.",
      },
      {
        alvo: "relatorios-operacional-indicadores",
        titulo: "SLA em números",
        texto:
          "Propostas enviadas, enviadas em até 24 h, demandas e tarefas no prazo e o que está vencido ou atrasado. Os de demandas e tarefas abrem a lista.",
      },
      {
        alvo: "relatorios-operacional-paineis",
        titulo: "Gargalos e responsáveis",
        texto:
          "Etapas com propostas paradas há mais tempo e SLA vencido, o resumo de demandas e tarefas e o SLA de cada responsável.",
      },
      {
        alvo: "acoes",
        titulo: "Exportar",
        texto: "Leve o SLA por responsável para PDF, Excel, Word ou CSV, ou imprima.",
      },
      REVER,
    ],
  },

  // ---- Relatórios gerenciais: Financeiro
  "relatorios.financeiros": {
    versao: 1,
    titulo: "Relatório financeiro",
    passos: [
      {
        alvo: "titulo",
        titulo: "Relatório financeiro",
        texto:
          "Leitura do Financeiro da matriz no período: comissões dos bancos, da equipe e dos parceiros, contas, fluxo e receita das licenças.",
      },
      {
        alvo: "relatorios-filtros",
        titulo: "Só o período",
        texto: "Aqui o filtro é apenas o período: o financeiro é o da matriz, sem recorte de base.",
      },
      {
        alvo: "relatorios-financeiro-indicadores",
        titulo: "Indicadores com atalho",
        texto:
          "Comissões dos bancos, da equipe, contas a receber e a pagar e o MRR das licenças, conforme sua permissão. Cada número abre a tela do Financeiro.",
      },
      {
        alvo: "relatorios-financeiro-paineis",
        titulo: "Fluxo e detalhes",
        texto:
          "Fluxo previsto x realizado por mês, comissão por banco, comissões por pessoa e despesas por categoria. Para baixar ou conciliar, use o Financeiro.",
      },
      {
        alvo: "acoes",
        titulo: "Exportar",
        texto:
          "Exporte o fluxo previsto x realizado por mês e natureza em PDF, Excel, Word ou CSV.",
      },
      REVER,
    ],
  },

  // ---- Relatórios gerenciais: Produção e Comissões
  "relatorios.comerciais": {
    versao: 1,
    titulo: "Produção e Comissões (Comercial)",
    passos: [
      {
        alvo: "titulo",
        titulo: "Produção e comissões",
        texto:
          "Quem produz no ecossistema (usuários, parceiros, assinantes e bancos) e quanto isso gera de comissão.",
      },
      {
        alvo: "relatorios-filtros",
        titulo: "Filtre o recorte",
        texto:
          "Abrangência, base, período, visão, banco e responsável: os mesmos filtros dos outros relatórios gerenciais.",
      },
      {
        alvo: "relatorios-comercial-indicadores",
        titulo: "Resultado do período",
        texto:
          "Propostas, contratos, valor financiado e conversão. Com permissão, aparecem também a comissão da equipe e parceiros e a dos assinantes.",
      },
      {
        alvo: "tabela",
        titulo: "Produção por quem produz",
        texto:
          "Agrupe por Usuários, Parceiros, Assinantes ou Bancos no seletor do quadro. O número de propostas abre a lista; a Comissão aparece com permissão.",
      },
      {
        alvo: "acoes",
        titulo: "Exportar",
        texto: "Exporte o agrupamento que está na tela em PDF, Excel, Word ou CSV, ou imprima.",
      },
      REVER,
    ],
  },

  // ---- Relatórios gerenciais: Personalizados
  "relatorios.personalizados": {
    versao: 1,
    titulo: "Relatórios personalizados",
    passos: [
      {
        alvo: "titulo",
        titulo: "Monte o seu relatório",
        texto:
          "Escolha as métricas, como agrupar e o filtro. Salve com um nome para abrir de novo quando quiser.",
      },
      {
        alvo: "relatorios-personalizados-metricas",
        titulo: "Escolha as métricas",
        texto:
          "Toque para ligar ou desligar até 8 métricas. A primeira ordena a tabela e vai para o gráfico.",
      },
      {
        alvo: "relatorios-personalizados-salvar",
        titulo: "Agrupe e salve",
        texto:
          "Agrupe por mês, origem, conta, banco, responsável ou parceiro. Dê um nome e salve: ele vai para Meus relatórios, só seu, com o filtro de quando salvou.",
      },
      {
        alvo: "relatorios-filtros",
        titulo: "Filtro do relatório",
        texto:
          "Abaixo do construtor fica o mesmo filtro dos outros relatórios: período, base, visão, banco e responsável.",
      },
      {
        alvo: "relatorios-personalizados-resultado",
        titulo: "Tabela, gráfico e exportação",
        texto:
          "O resultado aparece em tabela e gráfico. O botão Exportar, no topo, gera PDF, Excel, Word ou CSV.",
      },
      REVER,
    ],
  },

  // =====================================================================
  // Grupo: Gestão de sistemas (gestão dos assinantes do Agilliza Tech)
  // Âncoras genéricas do kit da gestão: "indicadores" (faixa de indicadores)
  // e "filtros" (barra de filtros). Específicas: "plataforma-<tela>-<parte>".
  // =====================================================================

  // ---- Gestão de sistemas: Licenças e assinaturas
  "plataforma.licencas": {
    versao: 1,
    titulo: "Licenças e assinaturas",
    passos: [
      {
        alvo: "abas",
        titulo: "Assinantes e vinculados",
        texto:
          "Em Assinantes ficam as contas pagas do Agilliza Tech. Em Vinculados ao correspondente, os corretores e parceiros da Sua base, que usam o portal sem mensalidade.",
      },
      {
        alvo: "indicadores",
        titulo: "Números do filtro",
        texto:
          "Licenças, ativas, em teste, bloqueadas e a receita mensal. Toque em Ativas ou Em teste para filtrar a lista por essa situação.",
      },
      {
        alvo: "plataforma-licencas-filtros",
        titulo: "Tipo, plano e carteira",
        texto:
          "Combine tipo de conta, plano e carteira com a busca por nome, site ou e-mail. Os chips de situação logo abaixo refinam a lista; Limpar filtros zera tudo.",
      },
      {
        alvo: "plataforma-licencas-lista",
        titulo: "Abra a licença",
        texto:
          "Toque numa conta para ver Resumo, Cobrança, Pessoas e Ações. O menu de três pontos leva direto a situação, teste grátis, plano, desconto, créditos ou carteira.",
      },
      {
        alvo: "plataforma-licencas-nova",
        titulo: "Criar uma licença",
        texto:
          "Nova licença cria a conta em quatro passos: conta, plano e modalidade, desconto, carteira e motivo. A própria pessoa recebe o e-mail para criar a senha.",
      },
      REVER,
    ],
  },

  // ---- Gestão de sistemas: Carteiras
  "plataforma.carteiras": {
    versao: 1,
    titulo: "Carteiras",
    passos: [
      {
        alvo: "titulo",
        titulo: "Contas agrupadas em carteiras",
        texto:
          "Cada carteira reúne contas do Agilliza Tech com uma pessoa responsável, para acompanhar a produção de cada grupo.",
      },
      {
        alvo: "indicadores",
        titulo: "Visão das carteiras",
        texto:
          "Carteiras ativas, contas em carteira, contas sem carteira (ninguém responde por elas) e a receita mensal somada.",
      },
      {
        alvo: "plataforma-carteiras-lista",
        titulo: "Escolha a carteira",
        texto:
          "Alterne entre Ativas e Arquivadas e toque numa carteira. Cada linha mostra o responsável, o número de contas e o valor por mês.",
      },
      {
        alvo: "plataforma-carteiras-detalhe",
        titulo: "Produção e contas",
        texto:
          "Veja simulações, propostas, contratos e registrados no período escolhido. Edite, arquive, adicione contas ou tire uma conta da carteira.",
      },
      {
        alvo: "acoes",
        titulo: "Nova carteira",
        texto:
          "Crie a carteira com nome, responsável (analista do Agilliza) e descrição; depois adicione as contas.",
      },
    ],
  },

  // ---- Gestão de sistemas: Receita e cobrança
  "plataforma.receita": {
    versao: 1,
    titulo: "Receita e cobrança",
    passos: [
      {
        alvo: "indicadores",
        titulo: "Receita num relance",
        texto:
          "Receita recorrente, contas pagantes, recebido no mês, a receber e vencido. Toque em A receber ou Vencido para abrir as faturas já filtradas.",
      },
      {
        alvo: "plataforma-receita-grafico",
        titulo: "Evolução da receita",
        texto:
          "O gráfico mostra a receita recorrente dos últimos 12 meses. Ao lado, o movimento do mês: novas, expansão, reativações, contração e cancelamentos.",
      },
      {
        alvo: "abas",
        titulo: "Faturas, assinaturas, cancelamentos",
        texto:
          "Em Faturas, filtre, busque, dê baixa no pagamento ou cancele. Em Assinaturas, veja e cancele as vigentes; em Cancelamentos, quem saiu e por quê.",
      },
      {
        alvo: "acoes",
        titulo: "Assinatura e fatura avulsa",
        texto:
          "Nova assinatura liga conta, plano, ciclo e valor. Fatura avulsa cobra algo pontual, como um treinamento, com descrição, valor e vencimento.",
      },
      {
        titulo: "Cobrança automática",
        texto:
          "Com a chave do Asaas em Chaves dos provedores, cada fatura é cobrada e baixada sozinha. Sem ela, a baixa é feita aqui.",
      },
      REVER,
    ],
  },

  // ---- Gestão de sistemas: Comissões dos assinantes
  "plataforma.comissoes": {
    versao: 1,
    titulo: "Comissões dos assinantes",
    passos: [
      {
        alvo: "plataforma-comissoes-regra",
        titulo: "Quando a comissão nasce",
        texto:
          "Quem envia a proposta recebe um percentual do valor financiado. A comissão só existe a partir do registro do contrato em cartório.",
      },
      {
        alvo: "indicadores",
        titulo: "A pagar e pagas",
        texto:
          "Toque em A pagar ou Pagas para filtrar a lista. O percentual padrão mostra quantas contas têm percentual próprio.",
      },
      {
        alvo: "filtros",
        titulo: "Situação, datas e busca",
        texto:
          "Escolha a situação, o período do registro em cartório e busque pela conta ou pela proposta.",
      },
      {
        alvo: "plataforma-comissoes-lista",
        titulo: "Dar baixa ou cancelar",
        texto:
          "Dar baixa marca a comissão como paga e Voltar para a pagar desfaz. O X cancela a comissão, com o motivo registrado.",
      },
      {
        alvo: "acoes",
        titulo: "Percentuais",
        texto: "Ajuste o percentual padrão para todas as contas e o percentual próprio de algumas.",
      },
    ],
  },

  // ---- Gestão de sistemas: Planos, preços e créditos
  "plataforma.planos": {
    versao: 1,
    titulo: "Planos, preços e créditos",
    passos: [
      {
        alvo: "indicadores",
        titulo: "Resumo do catálogo",
        texto:
          "Planos à venda, assinaturas ativas, pacotes de crédito e operações cobradas. Os dois últimos abrem a aba correspondente.",
      },
      {
        alvo: "abas",
        titulo: "Quatro partes do catálogo",
        texto:
          "Planos, Pacotes de crédito, Custo por operação (créditos que cada uso consome; 0 é grátis) e Prazos de suporte por plano.",
      },
      {
        alvo: "plataforma-planos-cartoes",
        titulo: "Cartão de cada plano",
        texto:
          "Filtre pelo público e toque no plano para editar preços, venda, limites e recursos. Cartão tracejado está fora da venda.",
      },
      {
        alvo: "acoes",
        titulo: "Novo plano",
        texto:
          "Cadastre nome, público, dias de acesso e descrição. Plano à venda e com dias de acesso aparece na página de vendas.",
      },
    ],
  },

  // ---- Gestão de sistemas: Monitoramento e incidentes
  "plataforma.monitoramento": {
    versao: 1,
    titulo: "Monitoramento e incidentes",
    passos: [
      {
        alvo: "plataforma-monitoramento-situacao",
        titulo: "Situação geral ao vivo",
        texto:
          "Diz se tudo opera normalmente ou quantas áreas pedem atenção, com incidentes abertos, críticos e rotinas com erro. Atualiza a cada 30 segundos.",
      },
      {
        alvo: "plataforma-monitoramento-servicos",
        titulo: "Banco, tarefas e integrações",
        texto:
          "Quatro painéis: banco de dados, processador de tarefas, integrações e incidentes, cada um com o seu sinal de saúde.",
      },
      {
        alvo: "plataforma-monitoramento-incidentes",
        titulo: "Linha do tempo dos incidentes",
        texto:
          "Filtre por Abertos, Em tratamento ou Resolvidos. Em Tratar, anote o que foi feito e use Assumir, Resolver ou Reabrir.",
      },
      {
        alvo: "plataforma-monitoramento-rotinas",
        titulo: "Rotinas automáticas",
        texto:
          "Cada rotina mostra a última execução. As que deram erro vêm primeiro, com a mensagem do erro.",
      },
      {
        alvo: "acoes",
        titulo: "Atualizar agora",
        texto: "O painel se atualiza sozinho; o botão Atualizar lê tudo de novo na hora.",
      },
      REVER,
    ],
  },

  // ---- Gestão de sistemas: Consultas pagas
  "plataforma.consultas": {
    versao: 1,
    titulo: "Consultas pagas",
    passos: [
      {
        alvo: "filtros",
        titulo: "Escolha o período",
        texto:
          "Este mês, 30 ou 90 dias, ou datas livres. Todos os números da tela seguem o período escolhido.",
      },
      {
        alvo: "plataforma-consultas-resultado",
        titulo: "Do bruto à margem",
        texto:
          "Receita bruta menos o custo da APIFull e as taxas do pagamento dá a margem de contribuição. Margem não é lucro líquido.",
      },
      {
        alvo: "indicadores",
        titulo: "Pedidos, falhas e estornos",
        texto:
          "Toque em Falhas ou Em reconciliação para ver só esses pedidos na lista mais abaixo.",
      },
      {
        alvo: "plataforma-consultas-preco",
        titulo: "Preço de venda e custo",
        texto:
          "Defina o preço por consulta e ligue ou desligue a venda; vale para pedidos novos. Ao lado, registre o custo da APIFull com a origem do valor.",
      },
      {
        alvo: "plataforma-consultas-pedidos",
        titulo: "Pedidos das licenças",
        texto:
          "Filtre pela situação nos chips ou em Outras situações e acompanhe cada compra de consulta, do pagamento à entrega.",
      },
      REVER,
    ],
  },

  // ---- Gestão de sistemas: Suporte aos assinantes
  "plataforma.suporte": {
    versao: 1,
    titulo: "Suporte aos assinantes",
    passos: [
      {
        alvo: "abas",
        titulo: "Central, métricas e base",
        texto:
          "Central é a fila de chamados das contas. Métricas mostra tempos e prazos; Base de conhecimento guarda artigos que aparecem na ajuda do Agilliza Tech.",
      },
      {
        alvo: "indicadores",
        titulo: "Recortes da fila",
        texto:
          "Em aberto, Fora do prazo, Sem atendente e Avaliação média: toque em um para filtrar a fila por ele.",
      },
      {
        alvo: "filtros",
        titulo: "Busca e filtros",
        texto:
          "Busque por assunto, código ou conta e filtre por prioridade e conta. Os chips logo abaixo filtram pela situação do chamado.",
      },
      {
        alvo: "plataforma-suporte-atender",
        titulo: "Atender o próximo",
        texto:
          "Meus mostra os chamados com você. Atender o próximo abre o chamado sem atendente mais urgente da fila.",
      },
      {
        alvo: "plataforma-suporte-fila",
        titulo: "Fila e conversa",
        texto:
          "Toque num chamado para ver prazo, situação, prioridade e atendente e conversar com a conta, com anexos e notas internas.",
      },
      REVER,
    ],
  },

  // ---- Gestão de sistemas: Agilliza News
  "plataforma.news": {
    versao: 1,
    titulo: "Agilliza News",
    passos: [
      {
        alvo: "plataforma-news-indicadores",
        titulo: "Painel da News",
        texto:
          "Notícias na fila para curar, itens no ar, situação do coletor de RSS e indicadores do Banco Central.",
      },
      {
        alvo: "abas",
        titulo: "Cinco abas",
        texto:
          "Fila, Publicar (matéria escrita aqui ou link com prévia), No ar, Métricas de cada item e Fontes e coletor.",
      },
      {
        alvo: "plataforma-news-fila",
        titulo: "Curar antes de publicar",
        texto:
          "O que chega das fontes só vai ao ar com título e resumo próprios. Em cada notícia: Curar, Aprovar, Publicar, Destacar ou Ocultar.",
      },
      {
        alvo: "acoes",
        titulo: "Atualizar",
        texto:
          "A tela se atualiza sozinha a cada minuto; o botão Atualizar lê tudo de novo na hora.",
      },
    ],
  },

  // ---- Gestão de sistemas: Marketplace de especialistas
  "plataforma.marketplace": {
    versao: 1,
    titulo: "Marketplace de especialistas",
    passos: [
      {
        alvo: "indicadores",
        titulo: "O que pede decisão",
        texto:
          "Aguardando decisão, no ar agora, avaliações em revisão e receita mensal. Toque nos de pendência para ir direto à aba certa.",
      },
      {
        alvo: "abas",
        titulo: "Da moderação às métricas",
        texto: "Moderação, Avaliações, Anunciantes, Histórico de decisões e Métricas por período.",
      },
      {
        alvo: "plataforma-marketplace-moderacao",
        titulo: "Aprovar ou não aprovar",
        texto:
          "Cada pedido é um cartão com registro, plano e conferência. Aprove, não aprove (o motivo vai ao especialista) ou suspenda quem já está no ar.",
      },
      {
        titulo: "Avaliações e anunciantes",
        texto:
          "Em Avaliações, publique ou remova da vitrine sem apagar o registro. Em Anunciantes, veja quem apareceu, clicou e entrou em contato.",
      },
    ],
  },

  // ---- Gestão de sistemas: Gestão de Parceiros e Anúncios
  "plataforma.parceiros-anuncios": {
    versao: 1,
    titulo: "Gestão de Parceiros e Anúncios",
    passos: [
      {
        alvo: "titulo",
        titulo: "ImobMatch gerido pela equipe",
        texto:
          "Revise endereços repetidos, julgue denúncias, modere a Comunidade e o chat e confira CRECI. Toda decisão fica registrada e quem publicou é avisado.",
      },
      {
        alvo: "plataforma-parceiros-area",
        titulo: "Duas áreas",
        texto:
          "Alterne entre Anúncios e parceiros e Banners patrocinados: patrocinadores, fila de criativos, pacotes e preços, campanhas no ar e métricas.",
      },
      {
        alvo: "plataforma-parceiros-resumo",
        titulo: "O que espera decisão",
        texto:
          "Em revisão, denúncias a julgar, CRECI a conferir e anúncios no ar. Toque em um para abrir a aba correspondente.",
      },
      {
        alvo: "plataforma-parceiros-abas",
        titulo: "Abas de trabalho",
        texto:
          "Em revisão compara fichas do mesmo endereço; Denúncias, Comunidade e Chat pedem decisão com motivo; em Moderados dá para desfazer.",
      },
    ],
  },

  // ---- Gestão de sistemas: Auditoria e LGPD
  "plataforma.auditoria": {
    versao: 1,
    titulo: "Auditoria e LGPD",
    passos: [
      {
        alvo: "abas",
        titulo: "Auditoria e LGPD",
        texto:
          "Auditoria mostra quem mudou o quê, quando e em qual conta; o registro não pode ser alterado. LGPD reúne pedidos de titulares, termos e consentimentos.",
      },
      {
        alvo: "indicadores",
        titulo: "Resumo dos registros",
        texto: "Registros, alterações, pessoas envolvidas e tabelas tocadas no período escolhido.",
      },
      {
        alvo: "plataforma-auditoria-filtros",
        titulo: "Combine os filtros",
        texto:
          "Busque por tabela ou id e filtre por ação, tabela, pessoa, conta e período, de 24 horas a 90 dias. Limpar volta ao início.",
      },
      {
        alvo: "plataforma-auditoria-registros",
        titulo: "Registros e painéis",
        texto:
          "Toque num registro para ver o que mudou. Ao lado, tabelas mais tocadas, quem mais mexeu e ações também filtram com um toque.",
      },
      {
        titulo: "Prazo da LGPD",
        texto:
          "Na aba LGPD, cada pedido de titular tem prazo legal de 15 dias. Acompanhe os que estão em aberto e fora do prazo e registre a resposta.",
      },
    ],
  },

  // =====================================================================
  // Grupo: Gestão de Tecnologia
  // Âncoras do cabeçalho comum: "tecnologia-secoes" e "tecnologia-tema-atalhos".
  // =====================================================================

  // ---- Gestão de Tecnologia: Visão geral ao vivo
  tecnologia: {
    versao: 1,
    titulo: "Visão geral ao vivo",
    passos: [
      {
        alvo: "tecnologia-secoes",
        titulo: "Seções da Tecnologia",
        texto:
          "Visão geral, Operação, Servidor, Erros dos usuários, Logs, Usuários ativos e Alertas: cada seção mostra uma parte da saúde dos sistemas.",
      },
      {
        alvo: "tecnologia-tema-atalhos",
        titulo: "Tema e atalhos",
        texto:
          "Troque entre tema escuro e claro e use os atalhos para Incidentes, Filas, Licenças e Auditoria.",
      },
      {
        alvo: "tecnologia-visao-saude",
        titulo: "Saúde em selos",
        texto:
          "Agilliza, Agilliza Tech, worker, disco, containers, backup e saldo da APIFull, cada um com o seu sinal de saúde.",
      },
      {
        alvo: "tecnologia-visao-indicadores",
        titulo: "Indicadores ao vivo",
        texto:
          "Usuários online, requisições por minuto, erros novos, incidentes abertos e licenças ativas. A leitura se repete a cada 12 segundos.",
      },
      {
        alvo: "tecnologia-visao-graficos",
        titulo: "Tráfego, acessos e online",
        texto:
          "Escolha a janela (1h a 7d) do gráfico de acessos e latência; cada cartão abre em tela cheia. Ao lado, quem está online por perfil e estado.",
      },
      REVER,
    ],
  },

  // ---- Gestão de Tecnologia: Operação
  "tecnologia.operacao": {
    versao: 1,
    titulo: "Operação",
    passos: [
      {
        alvo: "tecnologia-operacao-janela",
        titulo: "Escolha a janela",
        texto:
          "1 hora, 6 horas, 24 horas ou 7 dias. O selo Ao vivo mostra a última leitura e atualiza na hora com um toque.",
      },
      {
        alvo: "tecnologia-operacao-indicadores",
        titulo: "Números da janela",
        texto:
          "Requisições (com a variação sobre o período anterior), taxa de falha, p95, licenças com uso, chamadas a provedores e fila de mensagens.",
      },
      {
        alvo: "tecnologia-operacao-graficos",
        titulo: "Gráficos da operação",
        texto:
          "Tráfego, latência (p50 e p95), fila e rotinas e provedores ao longo da janela escolhida.",
      },
      {
        alvo: "tecnologia-operacao-ranking",
        titulo: "Por onde começar",
        texto:
          "Rotas mais lentas e licenças com mais erro na janela, para saber onde está o problema.",
      },
    ],
  },

  // ---- Gestão de Tecnologia: Servidor
  "tecnologia.servidor": {
    versao: 1,
    titulo: "Servidor",
    passos: [
      {
        alvo: "tecnologia-servidor-janela",
        titulo: "24 horas ou 7 dias",
        texto: "Escolha a janela dos gráficos. As leituras vêm do coletor da VPS e do worker.",
      },
      {
        alvo: "tecnologia-servidor-indicadores",
        titulo: "Saúde da máquina",
        texto: "Disco mais cheio, memória, carga, containers, último backup e certificado HTTPS.",
      },
      {
        alvo: "tecnologia-servidor-graficos",
        titulo: "Gráficos e banco",
        texto:
          "Disco e memória com os limites de alerta, carga da CPU, banco de dados e worker com o saldo da APIFull.",
      },
      {
        titulo: "Containers e discos",
        texto:
          "Mais abaixo, cada container com o seu estado (rodando ou parado) e o uso de cada disco da máquina.",
      },
    ],
  },

  // ---- Gestão de Tecnologia: Erros dos usuários
  "tecnologia.erros": {
    versao: 1,
    titulo: "Erros dos usuários",
    passos: [
      {
        alvo: "tecnologia-erros-indicadores",
        titulo: "Grupos de erro",
        texto:
          "Grupos em aberto, novos em 24 horas, ocorrências e a divisão entre os dois sistemas. Dados pessoais são removidos antes de gravar.",
      },
      {
        alvo: "tecnologia-erros-filtros",
        titulo: "Busca e filtros",
        texto:
          "Busque por erro, rota ou navegador e filtre por sistema, origem, situação e ordem (mais recentes ou mais frequentes).",
      },
      {
        alvo: "tecnologia-erros-lista",
        titulo: "Cada erro agrupado",
        texto:
          "Veja ocorrências, tendência e onde aconteceu. Detalhes mostra a pilha; Resolver fecha o grupo, que reabre sozinho se o erro voltar.",
      },
    ],
  },

  // ---- Gestão de Tecnologia: Logs
  "tecnologia.logs": {
    versao: 1,
    titulo: "Logs",
    passos: [
      {
        alvo: "tecnologia-logs-busca",
        titulo: "Busque nos logs",
        texto: "Procure por erro, rota ou rotina. No celular, o botão Filtros abre as opções.",
      },
      {
        alvo: "tecnologia-logs-filtros",
        titulo: "Filtros",
        texto:
          "Escolha as fontes (requisições, provedores, rotinas), o período de 1 hora a 14 dias, só erros e avisos, a conta, a rota e o código.",
      },
      {
        alvo: "tecnologia-logs-lista",
        titulo: "Linha do tempo",
        texto:
          "Cada registro mostra quando, fonte, rota, código, duração e conta. A lista traz os 300 mais recentes.",
      },
    ],
  },

  // ---- Gestão de Tecnologia: Usuários ativos
  "tecnologia.usuarios": {
    versao: 1,
    titulo: "Usuários ativos",
    passos: [
      {
        alvo: "tecnologia-usuarios-recorte",
        titulo: "Agora, 24 horas ou 30 dias",
        texto: "O recorte muda o mapa e os perfis. Os números vêm das sessões do Agilliza Tech.",
      },
      {
        alvo: "tecnologia-usuarios-indicadores",
        titulo: "Quantos estão usando",
        texto: "Online agora (últimos 5 minutos), ativos em 24 horas e ativos em 30 dias.",
      },
      {
        alvo: "tecnologia-usuarios-mapa",
        titulo: "Por estado e perfil",
        texto:
          "Mapa pela UF do CRECI da conta, divisão por perfil e a tendência de pessoas por dia em 30 dias.",
      },
      {
        titulo: "Quem está online",
        texto:
          "No fim da tela, a lista de quem usou nos últimos 5 minutos, para quem tem permissão de ver as licenças.",
      },
    ],
  },

  // ---- Gestão de Tecnologia: Alertas
  "tecnologia.alertas": {
    versao: 1,
    titulo: "Alertas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Limites que abrem incidentes",
        texto:
          "Quando um sinal passa do limite, o incidente abre sozinho e se resolve quando o sinal volta ao normal.",
      },
      {
        alvo: "tecnologia-alertas-painel",
        titulo: "Ajuste os limites",
        texto:
          "Mude os valores por grupo (aplicação, banco, fila, servidor, fornecedores) e salve; valem na próxima avaliação. Ao lado, o histórico de incidentes.",
      },
      {
        titulo: "Tratar os incidentes",
        texto:
          "O link Tratar, no histórico, leva ao Monitoramento e incidentes. Sem permissão de edição, os limites ficam só para leitura.",
      },
    ],
  },

  // =====================================================================
  // Grupo: Configurações gerais, Conta, Portal do Parceiro e Portal do Cliente
  // =====================================================================

  // ---- Configurações gerais: Visão geral (hub)
  admin: {
    versao: 1,
    titulo: "Visão geral",
    passos: [
      {
        alvo: "titulo",
        titulo: "Tudo o que configura o sistema",
        texto:
          "Aqui ficam reunidas as áreas de configuração: pessoas e permissões, parâmetros, bancos, integrações, Agilliza Tech e segurança.",
      },
      {
        alvo: "configuracoes-areas",
        titulo: "Áreas agrupadas por assunto",
        texto: "Cada cartão abre uma área. Você só vê as áreas liberadas no seu papel de acesso.",
      },
      {
        titulo: "Pode alterar ou só consultar",
        texto:
          "O selo no pé de cada cartão avisa se você pode alterar aquela área ou se tem acesso só para consulta.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Pessoas e permissões
  "admin.pessoas": {
    versao: 1,
    titulo: "Pessoas e permissões",
    passos: [
      {
        alvo: "titulo",
        titulo: "Equipe e parceiros",
        texto:
          "Cadastre quem usa o sistema, a equipe interna e os parceiros, e defina o que cada um pode fazer.",
      },
      {
        alvo: "acoes",
        titulo: "Cadastrar uma pessoa",
        texto:
          "Nova pessoa abre o cadastro aqui mesmo. Com login, a senha provisória é o próprio e-mail, trocada no primeiro acesso.",
      },
      {
        alvo: "abas",
        titulo: "Pessoas, papéis e tipos",
        texto:
          "Em Papéis e permissões você define o que cada papel vê e altera, organizado como o menu. Em Tipos de pessoa ficam as categorias de cadastro.",
      },
      {
        alvo: "busca",
        titulo: "Encontre alguém rápido",
        texto:
          "Busque por nome ou e-mail e filtre entre Todos, Equipe interna e Parceiros. Os indicadores Pessoas e Parceiros também filtram ao tocar.",
      },
      {
        alvo: "pessoas-lista",
        titulo: "Ações de cada pessoa",
        texto:
          "No menu de cada linha: editar dados, redefinir senha, bloquear ou desbloquear o acesso, habilitar login ou excluir.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Parâmetros
  "admin.parametros": {
    versao: 1,
    titulo: "Parâmetros",
    passos: [
      {
        alvo: "titulo",
        titulo: "Dados da sua empresa",
        texto:
          "Os dados que aparecem para clientes, parceiros e bancos: identificação, endereço, contatos e as políticas exibidas no portal.",
      },
      {
        alvo: "abas",
        titulo: "Empresa, Contatos e Políticas",
        texto:
          "Empresa traz razão social, CNPJ e endereço (o CEP completa o endereço sozinho). Contatos tem os canais oficiais. Políticas, os textos de LGPD e privacidade.",
      },
      {
        alvo: "parametros-cadastro",
        titulo: "Quanto falta preencher",
        texto:
          "Mostra a porcentagem do cadastro já preenchida. Toque num item que falta para ir direto ao campo.",
      },
      {
        alvo: "parametros-salvar",
        titulo: "Salvar as alterações",
        texto: "A barra avisa quando há alterações não salvas. Use Salvar parâmetros para gravar.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Bancos
  "admin.bancos": {
    versao: 1,
    titulo: "Bancos",
    passos: [
      {
        alvo: "titulo",
        titulo: "Bancos parceiros",
        texto:
          "Os bancos com que o correspondente opera. Aqui você ativa cada banco, define o padrão e configura o acesso à integração.",
      },
      {
        alvo: "tabela",
        titulo: "Situação de cada banco",
        texto:
          "A lista mostra código, produtos, credencial e se o banco é o padrão. A chave na coluna Ativo liga ou desliga o banco.",
      },
      {
        titulo: "Configurar banco inativo",
        texto:
          "Banco aguardando homologação tem o botão Configurar: agência padrão, código de parceiro, banco padrão e as credenciais da integração.",
      },
      {
        titulo: "Via integração bancária",
        texto:
          'Quando aparece "via integração bancária", o banco não tem credencial própria e o envio usa a integração central, cadastrada em Chaves dos provedores.',
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Notificações
  "admin.notificacoes": {
    versao: 1,
    titulo: "Notificações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Central de avisos",
        texto:
          "Todos os seus avisos do sistema num lugar só. Ao tocar num aviso, ele fica como lido e abre a tela relacionada.",
      },
      {
        alvo: "abas",
        titulo: "Avisos e configurações",
        texto:
          "A aba Notificações lista os seus avisos. Em Configurações você escolhe quais alertas recebe e quais tocam som.",
      },
      {
        alvo: "notificacoes-acoes",
        titulo: "Organize a caixa",
        texto:
          "Marque todas como lidas de uma vez ou limpe a lista. Limpar apaga todos os seus avisos e não dá para desfazer.",
      },
      {
        alvo: "notificacoes-lista",
        titulo: "Não lidas primeiro",
        texto:
          "As não lidas ficam em destaque no topo, separadas das lidas. Arraste um aviso para a esquerda para apagá-lo.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: APIs de IA
  "admin.apis-ia": {
    versao: 1,
    titulo: "APIs de IA",
    passos: [
      {
        alvo: "titulo",
        titulo: "A IA do Scan IA",
        texto:
          "Configure o provedor de inteligência artificial, Google Gemini ou ChatGPT, usado pelo Scan IA para extrair dados dos documentos.",
      },
      {
        alvo: "apis-ia-provedor",
        titulo: "Provedor, modelo e chave",
        texto:
          "Ligue ou desligue a integração e escolha o provedor e o modelo. Ao trocar o provedor, o modelo e o endereço sugeridos são preenchidos sozinhos.",
      },
      {
        titulo: "Chave guardada com segurança",
        texto:
          "A chave da API fica só no servidor e nunca é mostrada de novo. Deixe o campo em branco para manter a chave atual.",
      },
      {
        alvo: "apis-ia-testar",
        titulo: "Teste antes de salvar",
        texto:
          "Testar conexão confere se a chave e o modelo funcionam e mostra o resultado no topo. Salvar configuração grava tudo.",
      },
      {
        alvo: "apis-ia-prompt",
        titulo: "Temperatura e instruções",
        texto:
          "Temperatura baixa deixa a leitura mais precisa e previsível. O prompt diz ao Scan IA o que extrair dos documentos.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Chaves dos provedores
  "plataforma.provedores": {
    versao: 1,
    titulo: "Chaves dos provedores",
    passos: [
      {
        alvo: "titulo",
        titulo: "Credenciais das integrações",
        texto:
          "As chaves da integração bancária, dos birôs de crédito, da cobrança e do e-mail. Ficam cifradas e só os últimos caracteres aparecem.",
      },
      {
        alvo: "indicadores",
        titulo: "Números do topo",
        texto:
          "O ambiente em uso (produção ou homologação) e quantos provedores estão ligados, configurados e sem chave. Cada ambiente guarda as próprias chaves.",
      },
      {
        alvo: "provedores-aviso",
        titulo: "Nenhuma chave à mostra",
        texto:
          "Nenhuma tela devolve o valor de uma chave. Guardar, ligar e apagar ficam na auditoria, com quem fez e quando.",
      },
      {
        alvo: "provedores-cartoes",
        titulo: "Um cartão por provedor",
        texto:
          "Configure ou troque a chave, ligue ou desligue o provedor e apague a credencial. Essas ações são só para administradores.",
      },
      {
        titulo: "Cobrança automática",
        texto: "Com o Asaas ligado, as faturas dos assinantes são cobradas e baixadas sozinhas.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Integrações e filas
  "plataforma.integracoes": {
    versao: 1,
    titulo: "Integrações e filas",
    passos: [
      {
        alvo: "titulo",
        titulo: "Saúde das integrações",
        texto:
          "Mensagens na fila, mensagens que falharam, rotinas automáticas e chamadas aos provedores. A tela se atualiza a cada 30 segundos.",
      },
      {
        alvo: "acoes",
        titulo: "Atalhos do topo",
        texto:
          "Atualizar busca os dados na hora. Chaves dos provedores leva ao cadastro das credenciais.",
      },
      {
        alvo: "indicadores",
        titulo: "Indicadores que filtram",
        texto:
          "Na fila, Com erro, Mortas e Rotinas com falha: toque num indicador para ver só aqueles itens.",
      },
      {
        alvo: "abas",
        titulo: "Quatro visões",
        texto:
          "Filas, Chamadas aos provedores (7 dias e últimas 24 horas), Rotinas agendadas, que podem ser ligadas ou desligadas, e Integrações de crédito.",
      },
      {
        alvo: "integracoes-filas",
        titulo: "Mensagens e reprocessamento",
        texto:
          "Filtre por situação ou por faixa. Mensagens mortas, que esgotaram as tentativas, podem ser marcadas e devolvidas à fila com Reprocessar.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Configurações do Agilliza Tech
  "plataforma.configuracoes": {
    versao: 1,
    titulo: "Configurações do Agilliza Tech",
    passos: [
      {
        alvo: "titulo",
        titulo: "Regras de toda a plataforma",
        texto:
          "Os números que valem para todas as contas de assinantes. Cada gravação entra na auditoria da plataforma.",
      },
      {
        alvo: "abas",
        titulo: "Bancos, parâmetros e recursos",
        texto:
          "Bancos e taxas, Parâmetros (com busca), Produtos de crédito e Recursos, que podem valer para todas as contas ou só para uma.",
      },
      {
        alvo: "agilliza-tech-bancos",
        titulo: "Taxas de cada banco",
        texto:
          "Toque num banco para ver e editar as taxas usadas em toda simulação. Alterar aqui muda o resultado de todas as contas.",
      },
      {
        titulo: "Taxa proposta",
        texto:
          "Banco com taxa nova esperando aprovação ganha o selo Taxa proposta. Abra o banco para comparar com a atual e usar Aprovar e aplicar.",
      },
      {
        alvo: "acoes",
        titulo: "Atualizar",
        texto: "Recarrega as configurações para você ver a última versão gravada.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Auditoria e logs
  "admin.auditoria": {
    versao: 1,
    titulo: "Auditoria e logs",
    passos: [
      {
        alvo: "titulo",
        titulo: "Quem fez o quê",
        texto:
          "O histórico de ações e exportações feitas no sistema, com data, pessoa e o que mudou.",
      },
      {
        alvo: "auditoria-indicadores",
        titulo: "Resumo do período",
        texto:
          "Eventos no período, eventos de hoje, usuários envolvidos e a operação mais frequente, sempre de acordo com os filtros.",
      },
      {
        alvo: "auditoria-filtros",
        titulo: "Buscar, filtrar e exportar",
        texto:
          "Busque por ação, pessoa, tela ou IP. Em Filtros, escolha datas, usuário, tipo de operação e tela. Exportar baixa a lista em CSV.",
      },
      {
        alvo: "auditoria-linha-do-tempo",
        titulo: "Linha do tempo por dia",
        texto:
          "Os registros ficam agrupados por dia. Toque num registro para ver o detalhe, com o antes e o depois de cada campo.",
      },
      {
        alvo: "acoes",
        titulo: "Manutenção",
        texto: "O botão Manutenção abre a tela de manutenção da auditoria.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Exportações
  "relatorios.exportacoes": {
    versao: 1,
    titulo: "Exportações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Histórico de exportações",
        texto:
          "Todos os relatórios exportados ou impressos, com o formato, a quantidade de registros e a data.",
      },
      {
        alvo: "tabela",
        titulo: "Gerar de novo",
        texto:
          "Reexecutar abre o relatório com os mesmos filtros usados na exportação, para você gerar de novo.",
      },
      REVER,
    ],
  },

  // ---- Configurações gerais: Backup
  "admin.backup": {
    versao: 1,
    titulo: "Backup",
    passos: [
      {
        alvo: "titulo",
        titulo: "Cópias de segurança",
        texto:
          "Baixe todo o sistema para guardar fora dele: em planilha Excel legível, em arquivo SQL para restaurar o banco de dados ou os documentos em ZIP.",
      },
      {
        alvo: "acoes",
        titulo: "Três formas de baixar",
        texto:
          "Excel traz os dados sem códigos técnicos. SQL serve para restauração. ZIP junta todos os documentos e mostra o andamento enquanto compacta.",
      },
      {
        titulo: "Tempo de guarda",
        texto:
          "Quem tem permissão vê a engrenagem ao lado dos botões para definir por quantos dias os registros de backup ficam no histórico.",
      },
      {
        alvo: "backup-historico",
        titulo: "Histórico",
        texto:
          "Cada backup gerado aparece com situação, tabelas, tamanho e data. Os registros saem sozinhos depois do prazo de guarda.",
      },
      REVER,
    ],
  },

  // ---- Conta: Meus dados
  "conta.perfil": {
    versao: 1,
    titulo: "Meus dados",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seus dados de acesso",
        texto:
          "Nome, foto, telefone e o e-mail com que você entra no Agilliza. As abas logo abaixo levam a Segurança e Notificações.",
      },
      {
        alvo: "perfil-foto",
        titulo: "Foto e dados pessoais",
        texto:
          "Envie uma foto (JPG ou PNG, até 5 MB) e ajuste nome e telefone. O e-mail se troca na seção de baixo.",
      },
      {
        alvo: "perfil-email",
        titulo: "Trocar o e-mail de acesso",
        texto:
          "Informe o novo e-mail e use Alterar e-mail. Você recebe um link de confirmação no novo endereço.",
      },
      {
        alvo: "perfil-arroba-som",
        titulo: "Seu @ e o som do chat",
        texto:
          "Veja e troque o seu @, com que qualquer pessoa do ecossistema acha você no chat, e escolha o som das mensagens. A senha muda em Segurança.",
      },
      {
        alvo: "perfil-salvar",
        titulo: "Salvar alterações",
        texto:
          "A barra no rodapé avisa se há algo não salvo. Foto, nome e telefone só valem depois de Salvar alterações.",
      },
      REVER,
    ],
  },

  // ---- Conta: Segurança
  "conta.seguranca": {
    versao: 1,
    titulo: "Segurança",
    passos: [
      {
        alvo: "titulo",
        titulo: "Segurança da conta",
        texto: "Troque a sua senha e ligue o desbloqueio por biometria neste aparelho.",
      },
      {
        alvo: "seguranca-senha",
        titulo: "Alterar senha",
        texto:
          "Digite a senha atual e a nova duas vezes. A nova precisa ter 8 caracteres ou mais, com letras e números, e não pode ser o seu e-mail.",
      },
      {
        titulo: "Primeiro acesso",
        texto:
          "Se você entrou com a senha provisória, digite o seu e-mail em Senha atual e escolha uma senha sua. O sistema libera em seguida.",
      },
      {
        alvo: "seguranca-dicas",
        titulo: "Boas práticas",
        texto:
          "Dicas para uma senha forte. Depois de trocar, você pode ser desconectado nos outros aparelhos.",
      },
      {
        alvo: "seguranca-biometria",
        titulo: "Digital ou rosto",
        texto:
          "Peça digital, Face ID ou Windows Hello ao abrir o app. Vale só neste aparelho: ligue em cada um que você usa.",
      },
      REVER,
    ],
  },

  // ---- Conta: Notificações
  "conta.notificacoes": {
    versao: 1,
    titulo: "Notificações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seus alertas",
        texto:
          "Escolha quais alertas você recebe e quais tocam som. As preferências valem neste navegador.",
      },
      {
        alvo: "acoes",
        titulo: "Ver as notificações",
        texto: "Ver notificações abre a central com todos os seus avisos.",
      },
      {
        alvo: "notificacoes-mestra",
        titulo: "Liga e desliga geral",
        texto: "Desligue para silenciar todos os alertas de uma vez: menu piscando, sons e avisos.",
      },
      {
        alvo: "notificacoes-sistema",
        titulo: "Avisar fora do app",
        texto:
          "Mostra o aviso na tela do celular ou do computador mesmo com o app em segundo plano. Depois de ligar, dá para enviar um teste.",
      },
      {
        alvo: "notificacoes-por-tipo",
        titulo: "Cada tipo de aviso",
        texto:
          "Para cada tipo, escolha Exibir e Som. Ouvir o som toca o alerta para você conferir.",
      },
      REVER,
    ],
  },

  // ---- Portal do Parceiro: Início do parceiro
  "parceiro-inicio": {
    versao: 1,
    titulo: "Início do parceiro",
    passos: [
      {
        alvo: "titulo",
        titulo: "Sua carteira de parceria",
        texto:
          "O resumo da sua parceria com o correspondente: clientes, simulações, propostas e comissão.",
      },
      {
        alvo: "parceiro-portal-novo",
        titulo: "Portal novo",
        texto:
          "Os parceiros agora usam o Agilliza Tech. Se o seu acesso já estiver pronto, o botão leva ao portal novo; este continua funcionando.",
      },
      {
        alvo: "parceiro-resumo",
        titulo: "Sua carteira em números",
        texto: "Clientes vinculados a você, simulações, propostas e a comissão a receber.",
      },
      {
        alvo: "parceiro-comissao",
        titulo: "Como a comissão é calculada",
        texto:
          "Mostra o seu percentual padrão. A comissão é calculada sozinha quando sai o contrato de um cliente vinculado a você.",
      },
      REVER,
    ],
  },

  // ---- Portal do Cliente: Início
  "cliente.visao-geral": {
    versao: 1,
    titulo: "Início",
    passos: [
      {
        alvo: "cliente-inicio-andamento",
        titulo: "Como está a sua compra",
        texto:
          "Aqui você vê em que etapa está o seu financiamento e quanto do caminho já foi feito. Ao lado aparece quem cuida do seu caso, com o botão Falar.",
      },
      {
        alvo: "cliente-inicio-pendencias",
        titulo: "O que falta da sua parte",
        texto:
          "Quando faltar algum documento seu, ele aparece aqui. Envie direto pelo botão de cada um.",
      },
      {
        alvo: "cliente-inicio-atalhos",
        titulo: "Atalhos",
        texto:
          "Documentos, simulações, propostas e mensagens novas. Toque num atalho para abrir a página.",
      },
      {
        alvo: "cliente-inicio-jornada",
        titulo: "Sua jornada e sua proposta",
        texto:
          "Veja todas as etapas da compra e, quando o banco aprovar o seu crédito, a sua proposta com as condições.",
      },
      {
        alvo: "menu",
        titulo: "Menu do portal",
        texto:
          "Pelo menu você chega a todas as páginas: conversa com a equipe, proposta, simulações, documentos, perfil e privacidade.",
      },
      REVER,
    ],
  },

  // ---- Portal do Cliente: Chat com a equipe
  "cliente.chat": {
    versao: 1,
    titulo: "Chat com a equipe",
    passos: [
      {
        titulo: "Fale com a equipe",
        texto:
          "Converse com quem cuida do seu financiamento. Dá para mandar texto, fotos, vídeos, documentos e áudio, e o histórico fica guardado.",
      },
      {
        alvo: "busca",
        titulo: "Pesquisar",
        texto: "Encontre uma conversa ou uma mensagem antiga digitando aqui.",
      },
      {
        alvo: "abas",
        titulo: "Todas, Não lidas e Pedidos",
        texto:
          "Filtre as suas conversas. Em Pedidos aparecem pessoas que querem falar com você: você aceita ou recusa.",
      },
      {
        titulo: "Escrever e enviar",
        texto:
          "Abra uma conversa e escreva embaixo. Os botões ao lado anexam arquivos e gravam mensagem de voz.",
      },
      REVER,
    ],
  },

  // ---- Portal do Cliente: Minha proposta
  "cliente.acompanhar-minha-proposta": {
    versao: 1,
    titulo: "Minha proposta",
    passos: [
      {
        alvo: "titulo",
        titulo: "Acompanhe a sua proposta",
        texto:
          "Logo abaixo do título você vê a etapa em que a sua compra está agora e quanto do caminho já foi feito.",
      },
      {
        alvo: "cliente-proposta-cartoes",
        titulo: "Suas propostas",
        texto:
          "Cada proposta aprovada mostra o banco, o número (ID H.), o valor, a parcela, a taxa ao ano e o prazo.",
      },
      {
        alvo: "cliente-proposta-etapas",
        titulo: "Etapas e movimentações",
        texto:
          "Veja o que quer dizer cada etapa da compra e as últimas movimentações do seu processo, com data e hora.",
      },
      REVER,
    ],
  },

  // ---- Portal do Cliente: Minhas simulações
  "cliente.simulacoes": {
    versao: 1,
    titulo: "Minhas simulações",
    passos: [
      {
        alvo: "titulo",
        titulo: "Suas cotações",
        texto:
          "As cotações que os bancos deram para o seu financiamento aparecem aqui assim que a equipe simula.",
      },
      {
        alvo: "cliente-simulacoes-lista",
        titulo: "Cada simulação",
        texto:
          "Mostra a data, o número (ID), o valor do imóvel, a entrada, o valor financiado e o prazo.",
      },
      {
        alvo: "cliente-simulacoes-bancos",
        titulo: "Compare os bancos",
        texto:
          "Os bancos aparecem da menor parcela para a maior, com a taxa ao ano. O primeiro ganha o selo menor parcela.",
      },
      REVER,
    ],
  },

  // ---- Portal do Cliente: Meus documentos
  "cliente.documentos": {
    versao: 1,
    titulo: "Meus documentos",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seus documentos",
        texto:
          "Envie seus documentos pelo celular. Cada arquivo entra direto na pasta certa do seu processo.",
      },
      {
        alvo: "cliente-acao",
        titulo: "Enviar documento",
        texto:
          "Para mandar um documento novo, diga que documento é, escolha a pasta e o arquivo (PDF ou foto).",
      },
      {
        alvo: "cliente-documentos-pendentes",
        titulo: "O que falta com você",
        texto:
          "Documentos pendentes ou que a equipe pediu de novo. Use Enviar ou Reenviar em cada um.",
      },
      {
        alvo: "cliente-documentos-pastas",
        titulo: "Suas pastas",
        texto:
          "Os documentos entregues, por pasta, com a situação de cada um: em conferência, aprovado, enviar de novo ou vencido.",
      },
      REVER,
    ],
  },

  // ---- Portal do Cliente: Meu perfil
  "cliente.perfil": {
    versao: 1,
    titulo: "Meu perfil",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seu perfil",
        texto: "Seus dados, a aparência do portal e o som das mensagens.",
      },
      {
        alvo: "cliente-perfil-dados",
        titulo: "Seus dados",
        texto:
          "Seu nome e sua foto como estão no cadastro. Para corrigir algum dado, fale com a equipe pelo chat.",
      },
      {
        alvo: "cliente-perfil-aparencia",
        titulo: "Claro ou escuro",
        texto: "Escolha o tema claro, o escuro ou o mesmo do seu aparelho.",
      },
      {
        titulo: "Seu @ e o som",
        texto:
          "Mais abaixo você vê e troca o seu @, que outras pessoas usam para achar você no chat, e escolhe o som das mensagens novas.",
      },
      {
        alvo: "cliente-perfil-privacidade",
        titulo: "Privacidade",
        texto: "Abre a página dos seus direitos sobre os seus dados (LGPD).",
      },
      REVER,
    ],
  },

  // ---- Portal do Cliente: Privacidade
  "cliente.privacidade": {
    versao: 1,
    titulo: "Privacidade",
    passos: [
      {
        alvo: "titulo",
        titulo: "Seus dados, seus direitos",
        texto:
          "Tudo o que a lei de proteção de dados (LGPD) garante a você sobre os seus dados pessoais.",
      },
      {
        alvo: "cliente-privacidade-consentimento",
        titulo: "Consentimento e pedidos",
        texto:
          "Veja quando você aceitou o termo de uso dos seus dados e acompanhe os pedidos que já fez.",
      },
      {
        alvo: "cliente-privacidade-acoes",
        titulo: "O que você pode fazer",
        texto:
          "Baixar seus dados em PDF, pedir a portabilidade ou a exclusão. Excluir os dados do aplicativo desativa o seu acesso e não dá para desfazer.",
      },
      REVER,
    ],
  },
};

/** O roteiro de uma tela (ou nada, se a tela ainda não tem tour). */
export function roteiroDe(chave: string | null): RoteiroTour | null {
  return chave ? (ROTEIROS[chave] ?? null) : null;
}
