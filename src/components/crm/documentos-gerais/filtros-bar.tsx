import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiltroPesquisa } from "./filtro-pesquisa";
import { SEM_IMOB } from "./helpers";

type Opcao = { id: string; nome: string };

export function FiltrosBar({
  busca,
  onBusca,
  filtroComercial,
  setFiltroComercial,
  filtroImob,
  setFiltroImob,
  filtroCorr,
  setFiltroCorr,
  filtroAnalista,
  setFiltroAnalista,
  comerciais,
  imobiliarias,
  corretores,
  analistas,
  filtrando,
  onLimpar,
  onAbrirSheet,
  onPagina,
}: {
  busca: string;
  onBusca: (v: string) => void;
  filtroComercial: string;
  setFiltroComercial: (v: string) => void;
  filtroImob: string;
  setFiltroImob: (v: string) => void;
  filtroCorr: string;
  setFiltroCorr: (v: string) => void;
  filtroAnalista: string;
  setFiltroAnalista: (v: string) => void;
  comerciais: Opcao[];
  imobiliarias: Opcao[];
  corretores: Opcao[];
  analistas: Opcao[];
  filtrando: boolean;
  onLimpar: () => void;
  onAbrirSheet: () => void;
  onPagina: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nome, documento ou e-mail…"
          value={busca}
          onChange={(e) => {
            onBusca(e.target.value);
            onPagina(1);
          }}
          className="h-10 pl-9 pr-9"
        />
        {busca && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              onBusca("");
              onPagina(1);
            }}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <FiltroPesquisa
        label="Comercial"
        value={filtroComercial}
        todosValue="todos"
        todosLabel="Todos os comerciais"
        placeholder="Pesquisar comercial..."
        opcoes={comerciais}
        onChange={(v) => {
          setFiltroComercial(v);
          onPagina(1);
        }}
      />
      <FiltroPesquisa
        label="Imobiliária"
        value={filtroImob}
        todosValue="todas"
        todosLabel="Todas as imobiliárias"
        placeholder="Pesquisar imobiliária..."
        opcoes={imobiliarias}
        opcoesFixas={[{ id: "comercial", nome: SEM_IMOB }]}
        onChange={(v) => {
          setFiltroImob(v);
          onPagina(1);
        }}
      />
      <FiltroPesquisa
        label="Corretor"
        value={filtroCorr}
        todosValue="todos"
        todosLabel="Todos os corretores"
        placeholder="Pesquisar corretor..."
        opcoes={corretores}
        onChange={(v) => {
          setFiltroCorr(v);
          onPagina(1);
        }}
      />
      <FiltroPesquisa
        label="Analista"
        value={filtroAnalista}
        todosValue="todos"
        todosLabel="Todos os analistas"
        placeholder="Pesquisar analista..."
        opcoes={analistas}
        onChange={(v) => {
          setFiltroAnalista(v);
          onPagina(1);
        }}
      />
      {filtrando && (
        <Button
          variant="ghost"
          className="h-10 gap-2 text-muted-foreground hover:text-foreground"
          onClick={onLimpar}
        >
          <X className="h-4 w-4" /> Limpar
        </Button>
      )}
      <Button variant="outline" className="h-10 gap-2" onClick={onAbrirSheet}>
        <SlidersHorizontal className="h-4 w-4" /> Filtros
      </Button>
    </div>
  );
}
