import {
  Landmark,
  Scale,
  Building2,
  FileText,
  ShieldCheck,
  Wrench,
  Home,
  Map,
  Calculator,
  CreditCard,
  Users,
  Phone,
  GraduationCap,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";

/** Catálogo de ícones disponíveis para as categorias de links. */
export const ICONES_CATEGORIA: { valor: string; label: string; Icon: LucideIcon }[] = [
  { valor: "banco", label: "Bancos", Icon: Landmark },
  { valor: "cartorio", label: "Cartórios", Icon: Scale },
  { valor: "imobiliaria", label: "Imobiliárias", Icon: Building2 },
  { valor: "imovel", label: "Imóveis", Icon: Home },
  { valor: "documento", label: "Documentos", Icon: FileText },
  { valor: "seguro", label: "Seguros", Icon: ShieldCheck },
  { valor: "ferramenta", label: "Ferramentas", Icon: Wrench },
  { valor: "mapa", label: "Mapas / Prefeituras", Icon: Map },
  { valor: "calculadora", label: "Calculadoras", Icon: Calculator },
  { valor: "financeiro", label: "Financeiro", Icon: CreditCard },
  { valor: "parceiros", label: "Parceiros", Icon: Users },
  { valor: "contato", label: "Contatos", Icon: Phone },
  { valor: "treinamento", label: "Treinamentos", Icon: GraduationCap },
  { valor: "link", label: "Genérico", Icon: LinkIcon },
];

export function iconeCategoria(valor?: string | null): LucideIcon {
  return ICONES_CATEGORIA.find((i) => i.valor === valor)?.Icon ?? LinkIcon;
}

/** Paleta de cores (tokens semânticos) para as categorias. */
export const CORES_CATEGORIA: { valor: string; label: string; classe: string; dot: string }[] = [
  {
    valor: "azul",
    label: "Azul",
    classe: "bg-primary/10 text-primary ring-primary/20",
    dot: "bg-primary",
  },
  {
    valor: "verde",
    label: "Verde",
    classe: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  {
    valor: "ambar",
    label: "Âmbar",
    classe: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
    dot: "bg-amber-500",
  },
  {
    valor: "roxo",
    label: "Roxo",
    classe: "bg-violet-500/10 text-violet-600 ring-violet-500/20",
    dot: "bg-violet-500",
  },
  {
    valor: "vermelho",
    label: "Vermelho",
    classe: "bg-destructive/10 text-destructive ring-destructive/20",
    dot: "bg-destructive",
  },
  {
    valor: "ciano",
    label: "Ciano",
    classe: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20",
    dot: "bg-cyan-500",
  },
  {
    valor: "cinza",
    label: "Neutro",
    classe: "bg-muted text-muted-foreground ring-border",
    dot: "bg-muted-foreground",
  },
];

export function classeCategoria(valor?: string | null): string {
  return CORES_CATEGORIA.find((c) => c.valor === valor)?.classe ?? CORES_CATEGORIA[0].classe;
}

export function dotCategoria(valor?: string | null): string {
  return CORES_CATEGORIA.find((c) => c.valor === valor)?.dot ?? CORES_CATEGORIA[0].dot;
}
