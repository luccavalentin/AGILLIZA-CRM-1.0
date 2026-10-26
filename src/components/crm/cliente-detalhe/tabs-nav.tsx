import type { ComponentType } from "react";
import {
  Activity,
  ClipboardCheck,
  ContactRound,
  FileText,
  Handshake,
  History,
  Home,
  LayoutDashboard,
  UserCog,
  Users,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ABAS_CLIENTE, ABA_CLIENTE_PADRAO, type AbaCliente } from "./abas-cliente";

type IconType = ComponentType<{ className?: string }>;

const ICONE: Record<AbaCliente, IconType> = {
  vinculo: UserCog,
  dados: ContactRound,
  vendedores: Users,
  imovel: Home,
  iq: ClipboardCheck,
  documentos: FileText,
  negocios: Handshake,
  atividades: Activity,
  historico: History,
  resumo: LayoutDashboard,
};

/** Ordem e nomes em `abas-cliente.ts` (item C09); aqui só o ícone de cada seção. */
export const SECOES_CLIENTE: ReadonlyArray<{ v: AbaCliente; label: string; Icon: IconType }> =
  ABAS_CLIENTE.map((a) => ({ ...a, Icon: ICONE[a.v] }));

export function TabsNav({ aba, setAba }: { aba: string; setAba: (v: string) => void }) {
  const atual =
    SECOES_CLIENTE.find((s) => s.v === aba) ??
    SECOES_CLIENTE.find((s) => s.v === ABA_CLIENTE_PADRAO)!;
  return (
    <>
      {/* Mobile: seletor explícito de seção */}
      <div className="sm:hidden">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Seção do cliente</p>
        <Select value={aba} onValueChange={setAba}>
          <SelectTrigger className="w-full">
            <span className="flex items-center gap-2">
              <atual.Icon className="size-4 text-primary" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {SECOES_CLIENTE.map((s) => (
              <SelectItem key={s.v} value={s.v}>
                <span className="flex items-center gap-2">
                  <s.Icon className="size-4" /> {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Monitor e tablet: as 10 seções à vista, quebrando em linhas — sem trilho que
          rola escondido (pedido do dono, 21/10/2026: "achatada e sem responsividade"). */}
      <TabsList className="hidden h-auto w-full flex-wrap justify-start gap-1.5 rounded-xl border border-border/60 bg-card p-1.5 shadow-sm sm:flex">
        {SECOES_CLIENTE.map((s) => (
          <TabsTrigger
            key={s.v}
            value={s.v}
            className="crm-focus-ring h-9 flex-none gap-2 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-primary/[0.06] hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <s.Icon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">{s.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </>
  );
}
