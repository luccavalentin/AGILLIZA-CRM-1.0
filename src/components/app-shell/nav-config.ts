import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Cable,
  LifeBuoy,
  Newspaper,
  Store,
  Handshake,
  ScrollText,
  KeySquare,
  Tags,
  CircleDollarSign,
  KeyRound,
  LayoutDashboard,
  Users,
  KanbanSquare,
  Calculator,
  FileText,
  FileSignature,
  ListChecks,
  FolderOpen,
  Wallet,
  BarChart3,
  UserCog,
  SlidersHorizontal,
  Bell,
  ShieldCheck,
  ScanLine,
  FileSearch,
  FolderTree,
  DatabaseBackup,
  UserRound,
  Lock,
  LineChart,
  ArrowUpCircle,
  ArrowDownCircle,
  Inbox,
  CalendarDays,
  Gauge,
  Building2,
  ShoppingCart,
  MessagesSquare,
  Landmark,
  Cpu,
  ClipboardList,
  FileCheck2,
  Link as LinkIcon,
  Percent,
  Bot,
  BookOpen,
  Presentation,
  Workflow,
  HandCoins,
  Radar,
  Server,
  Bug,
  TerminalSquare,
  MapPinned,
  BellRing,
  Waves,
} from "lucide-react";

/** Permissão exigida por um item (chave = `${modulo}:view`). */
export interface NavPerm {
  modulo: string;
  /** Módulos legados equivalentes (mantêm acesso após desmembramentos). */
  equivalentes?: string[];
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  /** Parâmetros de busca (query string) opcionais para o destino. */
  search?: Record<string, string>;
  /** Parâmetros de rota (ex.: `/checklists/$id`). */
  params?: Record<string, string>;
  children?: NavItem[];
  badge?: string;
  /** Novidade anunciada: selo "Em breve" piscando ao lado do rótulo. */
  emBreve?: boolean;
  /** Ausente = item sempre visível (ex.: Visão Geral). */
  perm?: NavPerm;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Módulos das áreas de Configurações gerais: o hub `/admin` abre para quem vê qualquer um
 * deles (cada cartão do hub confere o seu). Mesma lista da rota `admin.index.tsx`.
 */
export const MODULOS_CONFIGURACOES_GERAIS = [
  "admin.pessoas",
  "admin.parametros",
  "admin.integracoes",
  "admin.notificacoes",
  "admin.auditoria",
  "admin.backup",
  "saas.provedores",
  "saas.integracoes",
  "saas.configuracoes",
  "relatorios.geral",
];

/**
 * Navegação do shell interno (usuários do correspondente).
 *
 * Ordem pedida pelo dono (26/10/2026): Visão geral › CRM › Operacional, depois
 * documentos e checklists, marketing, financeiro, Diversos antes de Gestão de
 * pessoas e RH, relatórios, Gestão de sistemas (os assinantes do Agilliza Tech),
 * Gestão de tecnologia, Configurações gerais e Conta. Cada bloco é de um módulo:
 * quem mexe num módulo mexe só no bloco dele.
 */
export const navInterno: NavGroup[] = [
  {
    id: "visao-geral",
    label: "Visão Geral",
    items: [{ label: "Painel geral", icon: Gauge, to: "/visao-geral/painel" }],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      {
        label: "Clientes",
        icon: Users,
        to: "/crm/clientes",
        perm: { modulo: "crm.clientes" },
        children: [
          {
            label: "Consultar clientes",
            icon: Users,
            to: "/crm/clientes",
            perm: { modulo: "crm.clientes" },
          },
          {
            label: "Novo cliente",
            icon: UserRound,
            to: "/crm/clientes/novo",
            perm: { modulo: "crm.clientes" },
          },
          {
            label: "Documentos de clientes",
            icon: FolderTree,
            to: "/crm/documentos",
            perm: { modulo: "crm.clientes" },
          },
        ],
      },
      {
        // Consulta a bureau de crédito (SPC/Serasa). Fica no CRM porque é
        // decisão sobre a pessoa, e não sobre uma proposta já aberta.
        label: "Consulta Ficha Cliente",
        icon: FileSearch,
        to: "/crm/ficha-bureau",
        perm: { modulo: "crm.clientes" },
      },
      {
        // Chat único do ecossistema (o mesmo dos assinantes): clientes,
        // parceiros, assinantes e qualquer pessoa achada pelo @.
        label: "Chat",
        icon: MessagesSquare,
        to: "/crm/chat",
        perm: { modulo: "crm.chat" },
      },
      {
        label: "Scan IA",
        icon: ScanLine,
        to: "/crm/scan-ia",
        // O grupo abre para quem vê a leitura de documentos ou o Consultor IA.
        perm: { modulo: "crm.clientes", equivalentes: ["crm.scan_ia"] },
        children: [
          {
            label: "Leitura de documentos",
            icon: ScanLine,
            to: "/crm/scan-ia",
            perm: { modulo: "crm.scan_ia", equivalentes: ["crm.clientes"] },
          },
          {
            label: "Consultor IA",
            icon: Bot,
            to: "/crm/consultor-ia",
            perm: { modulo: "crm.clientes" },
          },
          {
            label: "Base de Conhecimento",
            icon: BookOpen,
            to: "/admin/consultor-ia-base",
            // Mesma regra da rota (admin.parametros): sem isso o item aparecia
            // para quem só vê clientes e o clique voltava para o início.
            perm: { modulo: "admin.parametros" },
          },
        ],
      },
    ],
  },
  {
    id: "operacional",
    label: "Operacional",
    items: [
      {
        label: "Indicadores",
        icon: Gauge,
        to: "/operacional/painel",
        perm: { modulo: "operacional.propostas" },
      },
      {
        label: "Simulações",
        icon: Calculator,
        to: "/operacional/simulacoes",
        perm: { modulo: "operacional.simulacoes" },
        children: [
          {
            label: "Consultar simulações",
            icon: Calculator,
            to: "/operacional/simulacoes",
            perm: { modulo: "operacional.simulacoes" },
          },
          {
            label: "Simulação completa",
            icon: FileText,
            to: "/operacional/simulacoes/completa",
            perm: { modulo: "operacional.simulacoes" },
          },
          {
            label: "Simulação rápida",
            icon: Gauge,
            to: "/operacional/simulacoes/nova",
            perm: { modulo: "operacional.simulacoes" },
          },
        ],
      },
      {
        label: "Propostas",
        icon: FileText,
        to: "/operacional/propostas",
        perm: { modulo: "operacional.propostas" },
        children: [
          {
            label: "Consultar propostas",
            icon: FileText,
            to: "/operacional/propostas",
            perm: { modulo: "operacional.propostas" },
          },
          {
            label: "Nova proposta",
            icon: FileSignature,
            to: "/operacional/propostas/enviar",
            perm: { modulo: "operacional.propostas" },
          },
          {
            label: "Kanban",
            icon: KanbanSquare,
            to: "/operacional/propostas/kanban",
            perm: { modulo: "operacional.propostas" },
          },
        ],
      },
      {
        label: "Tarefas",
        icon: ListChecks,
        to: "/operacional/tarefas",
        perm: { modulo: "operacional.tarefas" },
        children: [
          {
            label: "Consultar tarefas",
            icon: ListChecks,
            to: "/operacional/tarefas",
            perm: { modulo: "operacional.tarefas" },
          },
          {
            label: "Calendário",
            icon: CalendarDays,
            to: "/operacional/tarefas/calendario",
            perm: { modulo: "operacional.tarefas" },
          },
          {
            label: "Kanban",
            icon: KanbanSquare,
            to: "/operacional/tarefas/kanban",
            perm: { modulo: "operacional.tarefas" },
          },
        ],
      },
      {
        // Central de demandas: quem cuida de cada conta de assinante, a fila
        // justa dos vinculados e o que foi delegado a quem.
        label: "Demandas",
        icon: Inbox,
        to: "/operacional/demandas",
        perm: { modulo: "operacional.demandas" },
        children: [
          {
            label: "Central de demandas",
            icon: Inbox,
            to: "/operacional/demandas",
            perm: { modulo: "operacional.demandas" },
          },
          {
            label: "Kanban",
            icon: KanbanSquare,
            to: "/operacional/demandas/kanban",
            perm: { modulo: "operacional.demandas" },
          },
        ],
      },
      {
        // Caixas de e-mail vigiadas (códigos que os bancos mandam, avisos), com
        // filtro de palavras. Substitui o antigo "Códigos de acesso".
        label: "Servidor de e-mail",
        icon: Inbox,
        to: "/operacional/codigos",
        perm: { modulo: "operacional.codigos" },
      },
    ],
  },
  {
    id: "documentos",
    label: "Documentos diversos",
    items: [
      {
        label: "Arquivos",
        icon: FolderOpen,
        to: "/documentos",
        perm: { modulo: "documentos.arquivos" },
      },
      {
        label: "Formulários",
        icon: FileText,
        to: "/formularios",
        perm: { modulo: "documentos.formularios" },
        children: [
          {
            label: "Itaú",
            icon: Landmark,
            to: "/formularios/itau",
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Bradesco",
            icon: Landmark,
            to: "/formularios/bradesco",
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Santander",
            icon: Landmark,
            to: "/formularios/santander",
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Inter",
            icon: Landmark,
            to: "/formularios/inter",
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Diversos",
            icon: FolderOpen,
            to: "/formularios/diversos",
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "DPS",
            icon: FileSignature,
            to: "/formularios/dps",
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Papel Timbrado",
            icon: FileText,
            to: "/formularios/papel-timbrado",
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Modelos com Designer de Apresentações",
            icon: Presentation,
            to: "/formularios/powerpoint",
            perm: { modulo: "documentos.formularios" },
          },
        ],
      },
      {
        label: "Links",
        icon: LinkIcon,
        to: "/links",
        perm: { modulo: "documentos.links" },
      },
      {
        label: "Controle de Matrículas",
        icon: ClipboardList,
        to: "/matriculas",
        perm: { modulo: "documentos.matriculas" },
      },
    ],
  },
  {
    // Checklists em grupo próprio: material de apoio usado ANTES de existir
    // proposta. Cada banco aparece com a logo oficial no menu e nas telas.
    id: "checklists",
    label: "Checklists",
    items: [
      {
        label: "Todos os checklists",
        icon: ClipboardList,
        to: "/checklists",
        perm: { modulo: "documentos.formularios" },
      },
      {
        label: "Docs para abertura de conta",
        icon: Landmark,
        to: "/checklists",
        perm: { modulo: "documentos.formularios" },
        children: [
          {
            label: "Bradesco",
            icon: Landmark,
            to: "/checklists/$id",
            params: { id: "abertura-bradesco" },
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Itaú",
            icon: Landmark,
            to: "/checklists/$id",
            params: { id: "abertura-itau" },
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Santander",
            icon: Landmark,
            to: "/checklists/$id",
            params: { id: "abertura-santander" },
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Inter",
            icon: Landmark,
            to: "/checklists/$id",
            params: { id: "abertura-inter" },
            perm: { modulo: "documentos.formularios" },
          },
        ],
      },
      {
        label: "Docs para sequenciar proposta",
        icon: FileCheck2,
        to: "/checklists/$id",
        params: { id: "seguir-proposta" },
        perm: { modulo: "documentos.formularios" },
      },
      {
        label: "Checklist de documentos por banco",
        icon: ListChecks,
        to: "/formularios/checklist",
        perm: { modulo: "documentos.formularios" },
        children: [
          {
            label: "Itaú",
            icon: Landmark,
            to: "/formularios/checklist",
            search: { banco: "itau" },
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Bradesco",
            icon: Landmark,
            to: "/formularios/checklist",
            search: { banco: "bradesco" },
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Santander",
            icon: Landmark,
            to: "/formularios/checklist",
            search: { banco: "santander" },
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Inter",
            icon: Landmark,
            to: "/formularios/checklist",
            search: { banco: "inter" },
            perm: { modulo: "documentos.formularios" },
          },
          {
            label: "Caixa",
            icon: Landmark,
            to: "/formularios/checklist",
            search: { banco: "caixa" },
            perm: { modulo: "documentos.formularios" },
          },
        ],
      },
    ],
  },
  // Automações de marketing nas redes (pedido do dono, 21/10/2026): anunciada com "Em breve".
  {
    id: "marketing",
    label: "Marketing",
    items: [{ label: "Automações", icon: Workflow, to: "/automacoes", emBreve: true }],
  },
  {
    // Financeiro da matriz (frente a5, 26/10/2026): três fluxos separados — comissões dos
    // bancos, repasse aos assinantes, comissões de corretores e parceiros — mais as despesas
    // e receitas da operação, conciliação, painel consolidado (sem misturar naturezas),
    // relatórios, regras e auditoria. Endereços antigos redirecionam (comissoes →
    // comissoes-bancos; comissoes-usuario → comissoes-corretores).
    id: "financeiro",
    label: "Financeiro",
    items: [
      { label: "Painel", icon: LineChart, to: "/financeiro/painel", perm: { modulo: "financeiro.painel" } },
      {
        label: "Comissões dos bancos",
        icon: Landmark,
        to: "/financeiro/comissoes-bancos",
        perm: { modulo: "financeiro.comissoes_bancos", equivalentes: ["financeiro.comissoes"] },
      },
      { label: "Repasses aos assinantes", icon: Percent, to: "/financeiro/repasses", perm: { modulo: "financeiro.repasses" } },
      {
        label: "Corretores e parceiros",
        icon: HandCoins,
        to: "/financeiro/comissoes-corretores",
        perm: { modulo: "financeiro.comissoes" },
      },
      { label: "Contas a pagar", icon: ArrowUpCircle, to: "/financeiro/contas-a-pagar", perm: { modulo: "financeiro.contas_pagar" } },
      { label: "Contas a receber", icon: ArrowDownCircle, to: "/financeiro/contas-a-receber", perm: { modulo: "financeiro.contas_receber" } },
      { label: "Licenças dos assinantes", icon: Building2, to: "/financeiro/assinantes", perm: { modulo: "financeiro.repasses" } },
      { label: "Conciliação", icon: FileCheck2, to: "/financeiro/conciliacao", perm: { modulo: "financeiro.conciliacao" } },
      { label: "Fluxo de caixa", icon: Wallet, to: "/financeiro/fluxo-de-caixa", perm: { modulo: "financeiro.fluxo_caixa" } },
      { label: "Relatórios", icon: BarChart3, to: "/financeiro/relatorios", perm: { modulo: "financeiro.painel", equivalentes: ["financeiro.fluxo_caixa"] } },
      {
        label: "Regras e configurações",
        icon: SlidersHorizontal,
        to: "/financeiro/configuracoes",
        perm: { modulo: "financeiro.regras", equivalentes: ["financeiro.painel"] },
      },
      { label: "Auditoria", icon: ScrollText, to: "/financeiro/auditoria", perm: { modulo: "financeiro.auditoria" } },
      // Demonstrativo individual: cada pessoa vê só as próprias comissões (o banco confere).
      { label: "Minhas comissões", icon: UserRound, to: "/financeiro/minhas-comissoes" },
    ],
  },
  {
    id: "diversos",
    label: "Diversos",
    items: [
      {
        label: "Pedidos de Compras",
        icon: ShoppingCart,
        to: "/admin/compras/pedidos",
        perm: { modulo: "admin.compras.pedidos", equivalentes: ["admin.compras"] },
      },
      {
        label: "Aprovação de Compras",
        icon: ShoppingCart,
        to: "/admin/compras/aprovacoes",
        perm: { modulo: "admin.compras.aprovacoes", equivalentes: ["admin.compras"] },
      },
    ],
  },
  {
    id: "rh",
    label: "Gestão de Pessoas e RH",
    items: [
      {
        label: "Gestão de Pessoas e RH",
        icon: UserRound,
        to: "/rh",
        perm: { modulo: "rh.dashboard" },
        children: [
          // Cada filho usa o módulo que a própria rota exige: herdando o do pai,
          // quem só via o painel de RH enxergava telas que o devolviam ao início.
          { label: "Dashboard", icon: Gauge, to: "/rh" },
          {
            label: "Funcionários",
            icon: Users,
            to: "/rh/funcionarios",
            perm: { modulo: "rh.funcionarios" },
          },
          {
            label: "Novo funcionário",
            icon: UserRound,
            to: "/rh/funcionarios/novo",
            perm: { modulo: "rh.funcionarios" },
          },
          {
            label: "Holerites",
            icon: FileText,
            to: "/rh/holerites",
            perm: { modulo: "rh.holerites" },
          },
          {
            label: "Relatórios",
            icon: BarChart3,
            to: "/rh/relatorios",
            perm: { modulo: "rh.relatorios" },
          },
          {
            label: "Configurações",
            icon: SlidersHorizontal,
            to: "/rh/configuracoes",
            perm: { modulo: "rh.configuracoes" },
          },
        ],
      },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios gerenciais",
    items: [
      {
        label: "Relatórios gerenciais",
        icon: BarChart3,
        to: "/relatorios/gerencial",
        perm: { modulo: "relatorios.geral" },
        children: [
          {
            label: "Relatório gerencial",
            icon: LayoutDashboard,
            to: "/relatorios/gerencial",
          },
          {
            label: "Relatórios operacionais",
            icon: LayoutDashboard,
            to: "/relatorios/operacional",
            perm: { modulo: "relatorios.geral" },
          },
          {
            label: "Relatório financeiro",
            icon: Wallet,
            to: "/relatorios/financeiros",
            perm: { modulo: "relatorios.geral" },
          },
          {
            label: "Produção e Comissões (Comercial)",
            icon: Percent,
            to: "/relatorios/comerciais",
            perm: { modulo: "relatorios.geral" },
          },
          {
            label: "Relatórios personalizados",
            icon: SlidersHorizontal,
            to: "/relatorios/personalizados",
            perm: { modulo: "relatorios.geral" },
          },
        ],
      },
    ],
  },
  {
    // Gestão do Agilliza Tech (assinantes) feita pelo Agilliza — ponte 0175.
    id: "plataforma",
    label: "Gestão de sistemas",
    items: [
      {
        label: "Licenças e assinaturas",
        icon: KeyRound,
        to: "/plataforma/licencas",
        perm: { modulo: "saas.licencas" },
      },
      {
        // Carteiras de contas: grupos de licenças com um responsável.
        label: "Carteiras",
        icon: FolderTree,
        to: "/plataforma/carteiras",
        perm: { modulo: "saas.licencas" },
      },
      {
        label: "Receita e cobrança",
        icon: CircleDollarSign,
        to: "/plataforma/receita",
        perm: { modulo: "saas.receita" },
      },
      {
        // Comissão de quem envia proposta (0229): só existe depois do registro em cartório.
        label: "Comissões dos assinantes",
        icon: HandCoins,
        to: "/plataforma/comissoes",
        perm: { modulo: "saas.comissoes" },
      },
      {
        label: "Planos, preços e créditos",
        icon: Tags,
        to: "/plataforma/planos",
        perm: { modulo: "saas.planos" },
      },
      {
        label: "Monitoramento e incidentes",
        icon: Activity,
        to: "/plataforma/monitoramento",
        perm: { modulo: "saas.monitoramento" },
      },
      {
        label: "Consultas pagas",
        icon: FileSearch,
        to: "/plataforma/consultas",
        perm: { modulo: "saas.consultas" },
      },
      {
        label: "Suporte aos assinantes",
        icon: LifeBuoy,
        to: "/plataforma/suporte",
        perm: { modulo: "saas.suporte" },
      },
      {
        label: "Agilliza News",
        icon: Newspaper,
        to: "/plataforma/news",
        perm: { modulo: "saas.news" },
      },
      {
        label: "Marketplace de especialistas",
        icon: Store,
        to: "/plataforma/marketplace",
        perm: { modulo: "saas.marketplace" },
      },
      {
        // ImobMatch (0283): revisão, denúncias, moderação, CRECI, anunciantes, números e banners.
        label: "Gestão de Parceiros e Anúncios",
        icon: Handshake,
        to: "/plataforma/parceiros-anuncios",
        perm: { modulo: "saas.imobmatch", equivalentes: ["saas.patrocinados"] },
      },
      {
        // Auditoria da plataforma e LGPD numa aba só (pedido do dono, 26/10/2026).
        label: "Auditoria e LGPD",
        icon: ScrollText,
        to: "/plataforma/auditoria",
        perm: { modulo: "saas.auditoria", equivalentes: ["saas.lgpd"] },
      },
    ],
  },
  {
    // Centro de controle técnico do ecossistema (Agilliza + Agilliza Tech) — migração 0233.
    id: "tecnologia",
    label: "Gestão de Tecnologia",
    items: [
      {
        label: "Visão geral ao vivo",
        icon: Radar,
        to: "/tecnologia",
        perm: { modulo: "saas.tecnologia" },
        children: [
          {
            label: "Visão geral ao vivo",
            icon: Radar,
            to: "/tecnologia",
            perm: { modulo: "saas.tecnologia" },
          },
          {
            label: "Operação",
            icon: Waves,
            to: "/tecnologia/operacao",
            perm: { modulo: "saas.tecnologia" },
          },
          {
            label: "Servidor",
            icon: Server,
            to: "/tecnologia/servidor",
            perm: { modulo: "saas.tecnologia" },
          },
          {
            label: "Erros dos usuários",
            icon: Bug,
            to: "/tecnologia/erros",
            perm: { modulo: "saas.tecnologia" },
          },
          {
            label: "Logs",
            icon: TerminalSquare,
            to: "/tecnologia/logs",
            perm: { modulo: "saas.tecnologia" },
          },
          {
            label: "Usuários ativos",
            icon: MapPinned,
            to: "/tecnologia/usuarios",
            perm: { modulo: "saas.tecnologia" },
          },
          {
            label: "Alertas",
            icon: BellRing,
            to: "/tecnologia/alertas",
            perm: { modulo: "saas.tecnologia" },
          },
        ],
      },
    ],
  },
  {
    // Antiga "Administração": tudo que configura o ecossistema num lugar só,
    // inclusive Parâmetros, chaves dos provedores e integrações.
    id: "administracao",
    label: "Configurações gerais",
    items: [
      {
        label: "Configurações gerais",
        icon: SlidersHorizontal,
        to: "/admin",
        // O hub abre para quem vê qualquer uma das áreas dele.
        perm: { modulo: "admin.pessoas", equivalentes: MODULOS_CONFIGURACOES_GERAIS },
        children: [
          {
            label: "Visão geral",
            icon: LayoutDashboard,
            to: "/admin",
            perm: { modulo: "admin.pessoas", equivalentes: MODULOS_CONFIGURACOES_GERAIS },
          },
          {
            label: "Pessoas e permissões",
            icon: UserCog,
            to: "/admin/pessoas",
            perm: { modulo: "admin.pessoas" },
          },
          {
            label: "Parâmetros",
            icon: Building2,
            to: "/admin/parametros",
            perm: { modulo: "admin.parametros" },
          },
          {
            label: "Bancos",
            icon: Landmark,
            to: "/admin/bancos",
            perm: { modulo: "admin.integracoes" },
          },
          {
            label: "Notificações",
            icon: Bell,
            to: "/admin/notificacoes",
            perm: { modulo: "admin.notificacoes" },
          },
          {
            label: "APIs de IA",
            icon: Cpu,
            to: "/admin/apis-ia",
            perm: { modulo: "admin.integracoes" },
          },
          {
            label: "Chaves dos provedores",
            icon: KeySquare,
            to: "/plataforma/provedores",
            perm: { modulo: "saas.provedores" },
          },
          {
            label: "Integrações e filas",
            icon: Cable,
            to: "/plataforma/integracoes",
            perm: { modulo: "saas.integracoes" },
          },
          {
            label: "Configurações do Agilliza Tech",
            icon: SlidersHorizontal,
            to: "/plataforma/configuracoes",
            perm: { modulo: "saas.configuracoes" },
          },
          {
            label: "Auditoria e logs",
            icon: ShieldCheck,
            to: "/admin/auditoria",
            perm: { modulo: "admin.auditoria" },
          },
          {
            label: "Exportações",
            icon: FolderOpen,
            to: "/relatorios/exportacoes",
            perm: { modulo: "relatorios.geral" },
          },
          {
            label: "Backup",
            icon: DatabaseBackup,
            to: "/admin/backup",
            perm: { modulo: "admin.backup" },
          },
        ],
      },
    ],
  },
  {
    id: "conta",
    label: "Conta",
    items: [
      {
        label: "Meu perfil",
        icon: UserRound,
        to: "/conta/perfil",
        children: [
          { label: "Meus dados", icon: UserRound, to: "/conta/perfil" },
          { label: "Segurança", icon: Lock, to: "/conta/seguranca" },
          { label: "Notificações", icon: Bell, to: "/conta/notificacoes" },
        ],
      },
    ],
  },
];

/**
 * Navegação do Portal do Parceiro.
 * Reaproveita exatamente os mesmos módulos/telas do portal do correspondente
 * (`navInterno`), apenas trocando a Visão Geral pela tela "Início" do parceiro.
 * Cada item permanece guiado pela matriz de permissões (Regras & Módulos):
 * o correspondente decide o que o parceiro vê e com qual escopo.
 */
export const navParceiro: NavGroup[] = [
  {
    id: "parceiro-inicio",
    label: "Portal do Parceiro",
    items: [{ label: "Início", icon: Gauge, to: "/parceiro-inicio" }],
  },
  ...navInterno.filter((grupo) => grupo.id !== "visao-geral"),
];
