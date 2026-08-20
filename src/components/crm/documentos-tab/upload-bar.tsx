import { FolderPlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPO_OUTRO } from "@/lib/crm/documento-tipos";
import { CATEGORIA_LABEL, type Categoria } from "./types";

export function UploadBar({
  categoriasPasta,
  categoria,
  setCategoria,
  tipo,
  setTipo,
  tipoOutro,
  setTipoOutro,
  tiposCategoria,
  enviando,
  onFile,
  onFolder,
}: {
  categoriasPasta: Categoria[];
  categoria: Categoria;
  setCategoria: (c: Categoria) => void;
  tipo: string;
  setTipo: (t: string) => void;
  tipoOutro: boolean;
  setTipoOutro: (v: boolean) => void;
  tiposCategoria: string[];
  enviando: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 pt-6">
        {categoriasPasta.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Titular do documento</label>
            <Select
              value={categoria}
              onValueChange={(v) => {
                setCategoria(v as Categoria);
                setTipo("");
                setTipoOutro(false);
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoriasPasta.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORIA_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tipo de documento</label>
          <Select
            value={tiposCategoria.includes(tipo) || tipo === "" ? tipo : TIPO_OUTRO}
            onValueChange={(v) => {
              if (v === TIPO_OUTRO) {
                setTipoOutro(true);
                setTipo("");
              } else {
                setTipoOutro(false);
                setTipo(v);
              }
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {tiposCategoria.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
              <SelectItem value={TIPO_OUTRO}>Outro (especificar)…</SelectItem>
            </SelectContent>
          </Select>
          {(tipoOutro || tiposCategoria.length === 0) && (
            <Input
              className="mt-1.5 w-64"
              placeholder="Descreva o tipo do documento"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            />
          )}
        </div>
        <Button asChild disabled={enviando} className="relative">
          <label>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Enviar arquivos
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="sr-only"
              onChange={onFile}
              disabled={enviando}
            />
          </label>
        </Button>
        <Button asChild variant="outline" disabled={enviando} className="relative">
          <label>
            <FolderPlus className="size-4" />
            Enviar pasta
            <input
              type="file"
              className="sr-only"
              // @ts-expect-error atributos não-padrão para upload de pasta
              webkitdirectory=""
              directory=""
              multiple
              onChange={onFolder}
              disabled={enviando}
            />
          </label>
        </Button>
      </CardContent>
    </Card>
  );
}
