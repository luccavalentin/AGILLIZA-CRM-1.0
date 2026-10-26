import { CalendarClock, Star, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PUBLICOS_NEWS, type PublicoNews } from "@/lib/plataforma/news.functions";

/** Agenda, público e destaque de um item da News (post, matéria apontada, artigo da base). */
export interface AgendaNews {
  publico: PublicoNews;
  destaque: boolean;
  inicio: string; // datetime-local ("" = agora)
  modoFim: "sem" | "dias" | "data";
  dias: string;
  fim: string; // datetime-local
}

export const AGENDA_PADRAO: AgendaNews = {
  publico: "todos",
  destaque: false,
  inicio: "",
  modoFim: "dias",
  dias: "30",
  fim: "",
};

/** "2026-10-26T14:30" (hora local) → ISO com fuso; "" → null. */
const paraIso = (local: string) => (local ? new Date(local).toISOString() : null);

/** ISO → valor do campo datetime-local (hora local). */
export function paraCampoLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** O que vai para o servidor. */
export function agendaParaEnvio(a: AgendaNews) {
  return {
    publico: a.publico,
    inicio_em: paraIso(a.inicio),
    fim_em: a.modoFim === "data" ? paraIso(a.fim) : null,
    dias: a.modoFim === "dias" ? Math.max(1, Math.min(365, Math.round(Number(a.dias) || 0))) : null,
  };
}

export function agendaDe(item: {
  publico?: string | null;
  fixado?: boolean;
  inicio_em?: string | null;
  fim_em?: string | null;
}): AgendaNews {
  return {
    publico: (item.publico as PublicoNews) ?? "todos",
    destaque: !!item.fixado,
    inicio: paraCampoLocal(item.inicio_em),
    modoFim: item.fim_em ? "data" : "sem",
    dias: "30",
    fim: paraCampoLocal(item.fim_em),
  };
}

export function CamposAgendaNews({
  valor,
  onChange,
  idBase,
  semDestaque,
}: {
  valor: AgendaNews;
  onChange: (v: AgendaNews) => void;
  idBase: string;
  semDestaque?: boolean;
}) {
  const set = (p: Partial<AgendaNews>) => onChange({ ...valor, ...p });
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${idBase}-publico`} className="flex items-center gap-1.5">
          <Users className="size-3.5 text-primary" /> Quem vê
        </Label>
        <Select value={valor.publico} onValueChange={(v) => set({ publico: v as PublicoNews })}>
          <SelectTrigger id={`${idBase}-publico`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PUBLICOS_NEWS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-inicio`} className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-primary" /> Entra no ar
        </Label>
        <Input
          id={`${idBase}-inicio`}
          type="datetime-local"
          value={valor.inicio}
          onChange={(e) => set({ inicio: e.target.value })}
        />
        <p className="text-[11px] text-muted-foreground">Em branco: agora.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-fim`}>Sai do ar</Label>
        <div className="flex gap-2">
          <Select
            value={valor.modoFim}
            onValueChange={(v) => set({ modoFim: v as AgendaNews["modoFim"] })}
          >
            <SelectTrigger className="w-[130px] shrink-0" aria-label="Como sai do ar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dias">Após dias</SelectItem>
              <SelectItem value="data">Em data</SelectItem>
              <SelectItem value="sem">Sem prazo</SelectItem>
            </SelectContent>
          </Select>
          {valor.modoFim === "dias" && (
            <Input
              id={`${idBase}-fim`}
              type="number"
              min={1}
              max={365}
              inputMode="numeric"
              className="w-24"
              value={valor.dias}
              onChange={(e) => set({ dias: e.target.value })}
              aria-label="Dias no ar"
            />
          )}
          {valor.modoFim === "data" && (
            <Input
              id={`${idBase}-fim`}
              type="datetime-local"
              value={valor.fim}
              onChange={(e) => set({ fim: e.target.value })}
            />
          )}
        </div>
      </div>
      {!semDestaque && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Switch
            checked={valor.destaque}
            onCheckedChange={(v) => set({ destaque: v })}
            aria-label="Destacar no topo"
          />
          <Star className="size-3.5 text-amber-500" /> Destacar no topo da News
        </label>
      )}
    </div>
  );
}
