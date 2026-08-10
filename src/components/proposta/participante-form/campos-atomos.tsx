import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UFS } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { CLASSE_ERRO } from "./types";

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {titulo}
      </p>
      {children}
    </div>
  );
}

export function Campo({
  label,
  className,
  obrigatorio,
  erro,
  children,
}: {
  label: string;
  className?: string;
  obrigatorio?: boolean;
  erro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className={cn("mb-1 block text-xs transition-colors", erro && "text-destructive font-bold")}>
        {label}
        {obrigatorio && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export function SelSelect({
  label,
  value,
  options,
  onChange,
  className,
  obrigatorio,
  erro,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  className?: string;
  obrigatorio?: boolean;
  erro?: boolean;
}) {
  return (
    <Campo label={label} className={className} obrigatorio={obrigatorio} erro={erro}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={erro ? CLASSE_ERRO : undefined}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );
}

export function SelUf({
  label,
  value,
  onChange,
  obrigatorio,
  erro,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  obrigatorio?: boolean;
  erro?: boolean;
}) {
  return (
    <Campo label={label} obrigatorio={obrigatorio} erro={erro}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={erro ? CLASSE_ERRO : undefined}>
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          {UFS.map((uf) => (
            <SelectItem key={uf} value={uf}>
              {uf}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );
}
