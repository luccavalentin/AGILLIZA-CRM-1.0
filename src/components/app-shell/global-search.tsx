import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { buscaGlobal, type ResultadoBusca } from "@/lib/busca.functions";

const ROTULO_TIPO: Record<ResultadoBusca["tipo"], string> = {
  cliente: "Clientes",
  simulacao: "Simulações",
  proposta: "Propostas",
  tarefa: "Tarefas",
};

/** Busca global acionada por ⌘K / Ctrl+K. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const buscar = useServerFn(buscaGlobal);
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = termo.trim();
    if (t.length === 0) {
      setResultados([]);
      return;
    }
    let ativo = true;
    setCarregando(true);
    const timer = setTimeout(async () => {
      try {
        const r = await buscar({ data: { termo: t } });
        if (ativo) setResultados(r.resultados);
      } finally {
        if (ativo) setCarregando(false);
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [termo, buscar]);

  const grupos = (Object.keys(ROTULO_TIPO) as ResultadoBusca["tipo"][])
    .map((tipo) => ({ tipo, itens: resultados.filter((r) => r.tipo === tipo) }))
    .filter((g) => g.itens.length > 0);

  return (
    <>
      <Button
        variant="outline"
        className="h-10 w-10 shrink-0 justify-center gap-2 px-0 text-muted-foreground sm:h-9 sm:w-64 sm:max-w-xs sm:justify-start sm:px-3"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="pointer-events-none ml-auto hidden select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Buscar clientes, simulações, propostas, tarefas…"
          value={termo}
          onValueChange={setTermo}
        />
        <CommandList>
          <CommandEmpty>
            {termo.trim().length === 0
              ? "Digite para buscar."
              : carregando
                ? "Buscando…"
                : "Nenhum resultado encontrado."}
          </CommandEmpty>
          {grupos.map((g) => (
            <CommandGroup key={g.tipo} heading={ROTULO_TIPO[g.tipo]}>
              {g.itens.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    setOpen(false);
                    navigate({ to: item.link as string });
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{item.titulo}</span>
                    {item.subtitulo && (
                      <span className="text-xs text-muted-foreground">{item.subtitulo}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
