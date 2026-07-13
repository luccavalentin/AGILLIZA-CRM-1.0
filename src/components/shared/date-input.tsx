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

  // Já em ISO
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (m) return montar(m[1], m[2], m[3]);

  // dd/mm/aaaa (ou separadores - . )
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(t);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return montar(ano, m[2], m[1]);
  }

  // Fallback: Date.parse (ex.: datas por extenso de outros sistemas)
  const d = new Date(t);
  if (!Number.isNaN(d.getTime()) && /\d{4}/.test(t)) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
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

  // Sincroniza quando o valor externo muda (ex.: reset do formulário).
  useEffect(() => {
    setTexto(isoParaBR(value));
  }, [value]);

  const aplicar = (raw: string) => {
    setTexto(raw);
    const iso = textoParaIso(raw);
    if (iso !== null) onChange(iso);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        value={texto}
        inputMode="numeric"
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={rest["aria-invalid"]}
        className="pr-10"
        onChange={(e) => aplicar(e.target.value)}
        onPaste={(e) => {
          const colado = e.clipboardData.getData("text");
          if (colado) {
            e.preventDefault();
            aplicar(colado);
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
