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

      {/* Desktop: abas roláveis com dica visual de que há mais */}
      <div className="relative hidden sm:block">
        <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECOES_CLIENTE.map((s) => (
            <TabsTrigger
              key={s.v}
              value={s.v}
              className="shrink-0 gap-1.5 whitespace-nowrap rounded-lg transition-colors hover:bg-primary/10 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25"
            >
              <s.Icon className="size-4" />
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="pointer-events-none absolute inset-y-1 right-0 w-10 rounded-r-xl bg-gradient-to-l from-muted/90 to-transparent" />
      </div>
      <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:block">
        Deslize para ver mais seções · clique em uma aba para abrir.
      </p>
    </>
  );
}
