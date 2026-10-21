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
  MessageCircle,
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

type IconType = ComponentType<{ className?: string }>;

export const SECOES_CLIENTE: ReadonlyArray<{ v: string; label: string; Icon: IconType }> = [
  { v: "resumo", label: "Resumo", Icon: LayoutDashboard },
  { v: "vinculo", label: "Vínculo de atendimento", Icon: UserCog },
  { v: "dados", label: "Dados do comprador", Icon: ContactRound },
  { v: "vendedores", label: "Vendedores", Icon: Users },
  { v: "imovel", label: "Imóvel", Icon: Home },
  { v: "iq", label: "IQ", Icon: ClipboardCheck },
  { v: "documentos", label: "Documentos", Icon: FileText },
  { v: "negocios", label: "Negócios", Icon: Handshake },
  { v: "mensagens", label: "App cliente", Icon: MessageCircle },
  { v: "atividades", label: "Demandas & Tarefas", Icon: Activity },
  { v: "interacoes", label: "Registro de interações", Icon: History },
  { v: "historico", label: "Histórico", Icon: History },
];

export function TabsNav({ aba, setAba }: { aba: string; setAba: (v: string) => void }) {
  const atual = SECOES_CLIENTE.find((s) => s.v === aba) ?? SECOES_CLIENTE[0]!;
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

      {/* Monitor e tablet: as 12 seções à vista, quebrando em linhas — sem trilho que
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
