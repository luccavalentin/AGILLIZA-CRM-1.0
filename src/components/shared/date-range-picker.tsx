import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Converte "yyyy-mm-dd" em Date local (sem deslocamento de fuso). */
function parseISO(v: string): Date | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** Converte Date em "yyyy-mm-dd" local. */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fmt(v: string): string {
  const d = parseISO(v);
  return d ? d.toLocaleDateString("pt-BR") : "";
}

/**
 * Seletor de intervalo de datas com calendário.
 * Recebe/emite datas no formato ISO "yyyy-mm-dd".
 */
export function DateRangePicker({
  de,
  ate,
  onChange,
  className,
  triggerClassName,
  placeholder = "Selecione o período",
  numberOfMonths = 2,
}: {
  de: string;
  ate: string;
  onChange: (de: string, ate: string) => void;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  numberOfMonths?: number;
}) {
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined = de
    ? { from: parseISO(de), to: parseISO(ate) || undefined }
    : undefined;

  const rotulo =
    de && ate ? `${fmt(de)} — ${fmt(ate)}` : de ? `${fmt(de)} — …` : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "justify-start gap-2 font-normal",
            !de && "text-muted-foreground",
            className,
            triggerClassName,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{rotulo}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={parseISO(de) ?? (numberOfMonths > 1 ? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) : undefined)}
          numberOfMonths={numberOfMonths}
          onSelect={(r) => {
            const novoDe = r?.from ? toISO(r.from) : "";
            const novoAte = r?.to ? toISO(r.to) : "";
            onChange(novoDe, novoAte);
            if (r?.from && r?.to) setOpen(false);
          }}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

