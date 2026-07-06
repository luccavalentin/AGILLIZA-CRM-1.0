import * as React from "react";
import { Input } from "@/components/ui/input";

export interface InputAutocompleteProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Input>, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Sugestões pré-cadastradas exibidas ao digitar/focar. */
  options: string[];
  /** Transforma o valor digitado antes de salvar (ex.: uppercase). */
  transform?: (raw: string) => string;
}

/**
 * Campo de texto livre com sugestões pré-cadastradas (datalist nativo).
 * O usuário pode digitar qualquer valor OU selecionar um já cadastrado.
 */
export const InputAutocomplete = React.forwardRef<HTMLInputElement, InputAutocompleteProps>(
  ({ value, onValueChange, options, transform, id, ...props }, ref) => {
    const listId = React.useId();
    const uniqueOptions = React.useMemo(
      () => Array.from(new Set(options.filter((o) => o && o.trim().length > 0))),
      [options],
    );

    return (
      <>
        <Input
          ref={ref}
          id={id}
          list={listId}
          value={value}
          onChange={(e) =>
            onValueChange(transform ? transform(e.target.value) : e.target.value)
          }
          autoComplete="off"
          {...props}
        />
        <datalist id={listId}>
          {uniqueOptions.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      </>
    );
  },
);
InputAutocomplete.displayName = "InputAutocomplete";
