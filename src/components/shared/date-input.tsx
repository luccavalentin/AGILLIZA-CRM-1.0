import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de data que aceita digitação OU colagem livre (dd/mm/aaaa, dd-mm-aaaa,
 * aaaa-mm-dd, dd.mm.aaaa etc.) e também um seletor de calendário nativo.
 * O valor externo (`value`/`onChange`) é sempre ISO `aaaa-mm-dd`.
 */
export interface DateInputProps {
  value: string; // ISO aaaa-mm-dd (ou "")
  onChange: (iso: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
}

/** ISO (aaaa-mm-dd) -> dd/mm/aaaa para exibição. */
function isoParaBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Tenta converter qualquer texto colado/digitado para ISO aaaa-mm-dd.
 * Aceita dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd e "1 de janeiro de 1990".
 * Retorna "" se ainda não formar uma data completa válida.
 */
function textoParaIso(texto: string): string | null {
  const t = texto.trim();
  if (!t) return "";

  // Já em ISO (aaaa-mm-dd) — exige ano com 4 dígitos
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return montar(m[1], m[2], m[3]);

  // dd/mm/aaaa — SÓ aceita ano com 4 dígitos (evita "22/11/19" virar 2019
  // enquanto o usuário ainda está digitando 22/11/1993).
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m) return montar(m[3], m[2], m[1]);

  return null;
}

function montar(ano: string, mes: string, dia: string): string | null {
  const y = Number(ano);
  const mo = Number(mes);
  const d = Number(dia);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  return `${ano}-${pad(mo)}-${pad(d)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function DateInput({
  value,
  onChange,
  id,
  className,
  placeholder = "dd/mm/aaaa",
  disabled,
  ...rest
}: DateInputProps) {
  const [texto, setTexto] = useState<string>(() => isoParaBR(value));
  const nativoRef = useRef<HTMLInputElement>(null);
  const nomeAntiAutofill = useRef(
    `dt_${id ?? "campo"}_${Math.random().toString(36).slice(2, 8)}`,
  );

  // Sincroniza quando o valor externo muda (ex.: reset do formulário).
  useEffect(() => {
    setTexto(isoParaBR(value));
  }, [value]);

  /** Aplica máscara dd/mm/aaaa enquanto digita (somente números, máx. 8 dígitos). */
  const mascarar = (raw: string) => {
    const dig = raw.replace(/\D/g, "").slice(0, 8);
    let out = dig.slice(0, 2);
    if (dig.length > 2) out += "/" + dig.slice(2, 4);
    if (dig.length > 4) out += "/" + dig.slice(4, 8);
    return out;
  };

  const aplicar = (mascarado: string) => {
    setTexto(mascarado);
    const iso = textoParaIso(mascarado);
    if (iso !== null) onChange(iso);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={texto}
        inputMode="numeric"
        maxLength={10}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        name={nomeAntiAutofill.current}
        data-lpignore="true"
        data-form-type="other"
        data-1p-ignore="true"
        disabled={disabled}
        aria-invalid={rest["aria-invalid"]}
        className={cn("pr-10", className)}
        onChange={(e) => aplicar(mascarar(e.target.value))}
        onPaste={(e) => {
          const colado = e.clipboardData.getData("text");
          if (colado) {
            e.preventDefault();
            // Colagem aceita formatos livres (ISO, por extenso etc.).
            const iso = textoParaIso(colado);
            if (iso) {
              setTexto(isoParaBR(iso));
              onChange(iso);
            } else {
              aplicar(mascarar(colado));
            }
          }
        }}
        onBlur={() => setTexto(isoParaBR(value))}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const el = nativoRef.current;
          if (!el) return;
          // showPicker quando suportado; senão foca o input nativo.
          if (typeof el.showPicker === "function") el.showPicker();
          else el.focus();
        }}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        aria-label="Abrir calendário"
        tabIndex={-1}
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={nativoRef}
        type="date"
        value={value || ""}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setTexto(isoParaBR(e.target.value));
        }}
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
