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
  Percent,
  BarChart3,
  UserCog,
  SlidersHorizontal,
  Bell,
  ShieldCheck,
  ScanLine,
  DatabaseBackup,
  UserRound,
  Lock,
  LineChart,
  ArrowUpCircle,
  ArrowDownCircle,
  Inbox,
  Gauge,
  Plug,
  Settings2,
  ShoppingCart,
  MessagesSquare,
  Timer,
  Landmark,
  Sparkles,
  ClipboardList,
} from "lucide-react";

/** Permissão exigida por um item (chave = `${modulo}:view`). */
export interface NavPerm {
  modulo: string;
}

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to?: string;
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
            label: "Simulação rápida",
            icon: Gauge,
            to: "/operacional/simulacoes/nova",
            perm: { modulo: "operacional.simulacoes" },
          },
          {
            label: "Simulação completa",
            icon: FileText,
            to: "/operacional/simulacoes/completa",
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
      },
      {
        label: "Demandas",
        icon: Inbox,
        to: "/operacional/demandas",
        perm: { modulo: "operacional.demandas" },
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
        label: "Comissões",
        icon: Percent,
        to: "/financeiro/comissoes",
        perm: { modulo: "financeiro.comissoes" },
      },
      {
        label: "Fluxo de caixa",
        icon: Wallet,
        to: "/financeiro/fluxo-de-caixa",
        perm: { modulo: "financeiro.fluxo_caixa" },
      },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    items: [
      {
        label: "Relatórios",
        icon: BarChart3,
        to: "/relatorios/painel-geral",
        perm: { modulo: "relatorios.geral" },
        children: [
          { label: "Painel geral", icon: LayoutDashboard, to: "/relatorios/painel-geral" },
          { label: "Comercial", icon: LineChart, to: "/relatorios/comerciais" },
          { label: "Simulações", icon: Calculator, to: "/relatorios/simulacoes" },
          { label: "Propostas", icon: FileText, to: "/relatorios/propostas" },
          { label: "Clientes", icon: Users, to: "/relatorios/clientes" },
          { label: "Demandas", icon: Inbox, to: "/relatorios/demandas" },
          { label: "Tarefas", icon: ListChecks, to: "/relatorios/tarefas" },
          { label: "Financeiro", icon: Wallet, to: "/relatorios/financeiros" },
          { label: "Comissões", icon: Percent, to: "/relatorios/comissoes" },
          { label: "Personalizados", icon: SlidersHorizontal, to: "/relatorios/personalizados" },
          { label: "Exportações", icon: FolderOpen, to: "/relatorios/exportacoes" },
        ],
      },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { label: "Pessoas", icon: UserCog, to: "/admin/pessoas", perm: { modulo: "admin.pessoas" } },
      {
        label: "Integrações",
        icon: Plug,
        to: "/admin/integracoes",
        perm: { modulo: "admin.integracoes" },
      },
      {
        label: "Bancos",
        icon: Landmark,
        to: "/admin/bancos",
        perm: { modulo: "admin.integracoes" },
      },
      {
        label: "APIs de IA",
        icon: Sparkles,
        to: "/admin/apis-ia",
        perm: { modulo: "admin.integracoes" },
      },
      {
        label: "Parâmetros",
        icon: Settings2,
        to: "/admin/parametros",
        perm: { modulo: "admin.parametros" },
      },
      {
        label: "Compras",
        icon: ShoppingCart,
        to: "/admin/compras",
        perm: { modulo: "admin.compras" },
      },
      { label: "SLA & Feriados", icon: Timer, to: "/admin/sla", perm: { modulo: "admin.sla" } },
      {
        label: "Comissões",
        icon: Percent,
        to: "/admin/comissoes",
        perm: { modulo: "admin.comissoes" },
      },
      {
        label: "Notificações",
        icon: Bell,
        to: "/admin/notificacoes",
        perm: { modulo: "admin.notificacoes" },
      },
      {
        label: "Auditoria",
        icon: ShieldCheck,
        to: "/admin/auditoria",
        perm: { modulo: "admin.auditoria" },
      },
      {
        label: "Backup",
        icon: DatabaseBackup,
        to: "/admin/backup",
        perm: { modulo: "admin.backup" },
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
