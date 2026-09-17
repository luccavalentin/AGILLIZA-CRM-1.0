import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { maskBRLInput } from "@/lib/simulacao/format";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
  /** Mostra "0,00" em vez de vazio quando o valor é zero (zero é uma resposta válida). */
  mostrarZero?: boolean;
}

/** Input de moeda BRL com prefixo R$. Mantém número no estado. */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder, id, className, mostrarZero, ...rest }, ref) => {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          ref={ref}
          id={id}
          inputMode="decimal"
          className={`pl-9 tabular-nums ${className ?? ""}`}
          placeholder={placeholder}
          value={value || (mostrarZero && value === 0) ? maskBRLInput(value) : ""}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, "");
            onChange(digitos ? Number(digitos) / 100 : 0);
          }}
          {...rest}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
