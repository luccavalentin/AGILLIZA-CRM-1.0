import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Handshake,
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
  UserRound,
  Lock,
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
    items: [{ label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" }],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { label: "Clientes", icon: Users, to: "/crm/clientes", perm: { modulo: "crm.clientes" } },
      { label: "Painel", icon: KanbanSquare, to: "/crm/painel", perm: { modulo: "crm.clientes" } },
      { label: "Parceiros", icon: Handshake, to: "/crm/parceiros", perm: { modulo: "crm.parceiros" } },
    ],
  },
  {
    id: "operacional",
    label: "Operacional",
    items: [
      { label: "Simulações", icon: Calculator, to: "/operacional/simulacoes", perm: { modulo: "operacional.simulacoes" } },
      { label: "Propostas", icon: FileText, to: "/operacional/propostas", perm: { modulo: "operacional.propostas" } },
      { label: "Contratos", icon: FileSignature, to: "/operacional/contratos", perm: { modulo: "operacional.contratos" } },
      { label: "Tarefas", icon: ListChecks, to: "/operacional/tarefas", perm: { modulo: "operacional.tarefas" } },
    ],
  },
  {
    id: "documentos",
    label: "Documentos",
    items: [
      { label: "Arquivos", icon: FolderOpen, to: "/documentos", perm: { modulo: "documentos.arquivos" } },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { label: "Recebíveis", icon: Wallet, to: "/financeiro/recebiveis", perm: { modulo: "financeiro.recebiveis" } },
      { label: "Comissões", icon: Percent, to: "/financeiro/comissoes", perm: { modulo: "financeiro.comissoes" } },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    items: [
      { label: "Relatórios", icon: BarChart3, to: "/relatorios", perm: { modulo: "relatorios.geral" } },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { label: "Pessoas", icon: UserCog, to: "/admin/pessoas", perm: { modulo: "admin.pessoas" } },
      { label: "Regras & Módulos", icon: SlidersHorizontal, to: "/admin/regras-modulos", perm: { modulo: "admin.regras" } },
      { label: "Notificações", icon: Bell, to: "/admin/notificacoes", perm: { modulo: "admin.notificacoes" } },
      { label: "Auditoria", icon: ShieldCheck, to: "/admin/auditoria", perm: { modulo: "admin.auditoria" } },
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
