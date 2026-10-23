/**
 * Escuro/Claro da Gestão de Tecnologia. Escuro é o padrão; a escolha fica neste navegador.
 * `useClasseTema()` devolve as classes para as camadas que abrem fora do contêiner da
 * seção (gaveta de filtros, menus e listas), que senão sairiam no tema claro.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import "./tema.css";

export type Tema = "escuro" | "claro";
const CHAVE = "agilliza:tecnologia-tema";

const Ctx = createContext<{ tema: Tema; trocar: (t: Tema) => void }>({
  tema: "escuro",
  trocar: () => {},
});

function lerSalvo(): Tema {
  try {
    return localStorage.getItem(CHAVE) === "claro" ? "claro" : "escuro";
  } catch {
    return "escuro";
  }
}

export function classeDoTema(tema: Tema) {
  return tema === "escuro" ? "tec-tema tec-escuro" : "tec-tema";
}

export function ProvedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("escuro");
  useEffect(() => setTema(lerSalvo()), []);
  const trocar = useCallback((t: Tema) => {
    setTema(t);
    try {
      localStorage.setItem(CHAVE, t);
    } catch {
      /* navegação privada: vale só nesta visita */
    }
  }, []);
  return <Ctx.Provider value={{ tema, trocar }}>{children}</Ctx.Provider>;
}

export function useTema() {
  return useContext(Ctx);
}

export function useClasseTema() {
  return classeDoTema(useContext(Ctx).tema);
}

/** Alternância Escuro/Claro (44 px de toque). */
export function TrocaTema() {
  const { tema, trocar } = useTema();
  const opcoes: { valor: Tema; rotulo: string; Icone: typeof Moon }[] = [
    { valor: "escuro", rotulo: "Escuro", Icone: Moon },
    { valor: "claro", rotulo: "Claro", Icone: Sun },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Tema da Gestão de Tecnologia"
      className="inline-flex shrink-0 rounded-full border border-border bg-card p-1"
    >
      {opcoes.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          onClick={() => trocar(valor)}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8",
            tema === valor
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icone className="size-3.5" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}
