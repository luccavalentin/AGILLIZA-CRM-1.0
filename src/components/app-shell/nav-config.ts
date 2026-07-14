import type { LucideIcon } from "lucide-react";
import {
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
  Timer,
  Landmark,
  Cpu,
  ClipboardList,
  Link as LinkIcon,
  Percent,
} from "lucide-react";

/** Permissão exigida por um item (chave = `${modulo}:view`). */
export interface NavPerm {
  modulo: string;
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  /** Parâmetros de busca (query string) opcionais para o destino. */
  search?: Record<string, string>;
  children?: NavItem[];
  badge?: string;
  /** Ausente = item sempre visível (ex.: Visão Geral). */
  perm?: NavPerm;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/** Navegação do shell interno (usuários do correspondente). */
export const navInterno: NavGroup[] = [
  {
    id: "visao-geral",
    label: "Visão Geral",
    items: [{ label: "Painel", icon: Gauge, to: "/visao-geral/painel" }],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { label: "Clientes", icon: Users, to: "/crm/clientes", perm: { modulo: "crm.clientes" } },
      { label: "Painel", icon: KanbanSquare, to: "/crm/painel", perm: { modulo: "crm.clientes" } },
      {
        label: "Chat e Follow-up Cliente",
        icon: MessagesSquare,
        to: "/crm/chat",
        perm: { modulo: "crm.clientes" },
      },
      { label: "Scan IA", icon: ScanLine, to: "/crm/scan-ia", perm: { modulo: "crm.scan_ia" } },
      {
        label: "Documentos Gerais",
        icon: FolderTree,
        to: "/crm/documentos",
        perm: { modulo: "crm.clientes" },
      },
    ],
  },
  {
    id: "operacional",
    label: "Operacional",
    items: [
      {
        label: "Painel",
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
        label: "Demandas",
        icon: Inbox,
        to: "/operacional/demandas",
        perm: { modulo: "operacional.demandas" },
        children: [
          {
            label: "Consultar demandas",
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
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
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
    id: "financeiro",
    label: "Financeiro",
    items: [
      {
        label: "Painel",
        icon: LineChart,
        to: "/financeiro/painel",
        perm: { modulo: "financeiro.painel" },
      },
      {
        label: "Contas a pagar",
        icon: ArrowUpCircle,
        to: "/financeiro/contas-a-pagar",
        perm: { modulo: "financeiro.contas_pagar" },
      },
      {
        label: "Contas a receber",
        icon: ArrowDownCircle,
        to: "/financeiro/contas-a-receber",
        perm: { modulo: "financeiro.contas_receber" },
      },
      {
        label: "Fluxo de caixa",
        icon: Wallet,
        to: "/financeiro/fluxo-de-caixa",
        perm: { modulo: "financeiro.fluxo_caixa" },
      },
      {
        label: "Configurações",
        icon: SlidersHorizontal,
        to: "/financeiro/configuracoes",
        perm: { modulo: "financeiro.painel" },
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
          { label: "Relatório gerencial", icon: LayoutDashboard, to: "/relatorios/gerencial" },
        ],

      },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      {
        label: "Administração",

        icon: SlidersHorizontal,
        to: "/admin/pessoas",
        perm: { modulo: "admin.pessoas" },
        children: [
          {
            label: "Pessoas",
            icon: UserCog,
            to: "/admin/pessoas",
            perm: { modulo: "admin.pessoas" },
          },
          {
            label: "Bancos",
            icon: Landmark,
            to: "/admin/bancos",
            perm: { modulo: "admin.integracoes" },
          },
          {
            label: "APIs de IA",
            icon: Cpu,
            to: "/admin/apis-ia",
            perm: { modulo: "admin.integracoes" },
          },
          {
            label: "SLA & Feriados",
            icon: Timer,
            to: "/admin/sla",
            perm: { modulo: "admin.sla" },
          },
          {
            label: "Backup",
            icon: DatabaseBackup,
            to: "/admin/backup",
            perm: { modulo: "admin.backup" },
          },
          {
            label: "Auditoria",
            icon: ShieldCheck,
            to: "/admin/auditoria",
            perm: { modulo: "admin.auditoria" },
          },
          {
            label: "Notificações",
            icon: Bell,
            to: "/admin/notificacoes",
            perm: { modulo: "admin.notificacoes" },
          },
        ],
      },


      {
        label: "Parâmetros",
        icon: Building2,
        to: "/admin/parametros",
        perm: { modulo: "admin.parametros" },
      },
    ],
  },

  {
    id: "diversos",
    label: "Diversos",
    items: [
      {
        label: "Compras",
        icon: ShoppingCart,
        to: "/admin/compras",
        perm: { modulo: "admin.compras" },
      },
    ],
  },



  {
    id: "conta",
    label: "Conta",
    items: [
      { label: "Meu perfil", icon: UserRound, to: "/conta/perfil" },
      { label: "Segurança", icon: Lock, to: "/conta/seguranca" },
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
