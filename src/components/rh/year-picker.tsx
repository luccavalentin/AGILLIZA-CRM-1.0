/**
 * YearPicker — input numérico de ano com popover de calendário para seleção rápida.
 * Permite digitar o ano livremente ou escolher visualmente em uma grade.
 */
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface YearPickerProps {
  value: number;
  onChange: (year: number) => void;
  min?: number;
  max?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function YearPicker({
  value,
  onChange,
  min = 1970,
  max = 2100,
  className,
  disabled,
  id,
}: YearPickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>(String(value));
  const [pageStart, setPageStart] = useState<number>(() => Math.floor(value / 12) * 12);

  // Mantém o texto sincronizado quando o valor externo muda.
  useMemo(() => setText(String(value)), [value]);

  function commit(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setText(String(clamped));
    setPageStart(Math.floor(clamped / 12) * 12);
  }

  const anos = useMemo(() => Array.from({ length: 12 }, (_, i) => pageStart + i), [pageStart]);

  return (
    <div className={cn("relative inline-block w-32", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
            aria-label="Selecionar ano"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 pointer-events-auto" align="end">
          <div className="mb-2 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPageStart((p) => Math.max(min, p - 12))}
              aria-label="Anos anteriores"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              {anos[0]} – {anos[anos.length - 1]}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPageStart((p) => Math.min(max - 11, p + 12))}
              aria-label="Próximos anos"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {anos.map((a) => {
              const disabledYear = a < min || a > max;
              const selected = a === value;
              return (
                <Button
                  key={a}
                  type="button"
                  variant={selected ? "default" : "ghost"}
                  size="sm"
                  disabled={disabledYear}
                  onClick={() => {
                    onChange(a);
                    setText(String(a));
                    setOpen(false);
                  }}
                  className="h-8"
                >
                  {a}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
