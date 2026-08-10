import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPCOES_UF, mascararCep, CLASSE_ERRO, type EnderecoValues } from "./constants";
import { cn } from "@/lib/utils";

export function EnderecoSection({
  end,
  setEnd,
  buscandoCep,
  buscarCep,
  erros,
}: {
  end: EnderecoValues;
  setEnd: React.Dispatch<React.SetStateAction<EnderecoValues>>;
  buscandoCep: boolean;
  buscarCep: (cepRaw: string) => void;
  erros?: Set<string>;
}) {
  const cls = (k: string) => (erros?.has(k) ? CLASSE_ERRO : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-primary" /> Endereço
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>CEP</Label>
          <div className="relative">
            <Input
              inputMode="numeric"
              value={end.cep}
              onChange={(e) => {
                const masked = mascararCep(e.target.value);
                setEnd((p) => ({ ...p, cep: masked }));
                if (masked.replace(/\D/g, "").length === 8) buscarCep(masked);
              }}
              onBlur={(e) => buscarCep(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              className={cls("cep")}
            />
            {buscandoCep && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Logradouro</Label>
          <Input
            value={end.logradouro}
            onChange={(e) => setEnd((p) => ({ ...p, logradouro: e.target.value }))}
            className={cls("logradouro")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Número</Label>
          <Input
            value={end.numero}
            onChange={(e) => setEnd((p) => ({ ...p, numero: e.target.value }))}
            className={cls("numero")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Bairro</Label>
          <Input
            value={end.bairro}
            onChange={(e) => setEnd((p) => ({ ...p, bairro: e.target.value }))}
            className={cls("bairro")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <Input
            value={end.cidade}
            onChange={(e) => setEnd((p) => ({ ...p, cidade: e.target.value }))}
            className={cls("cidade")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>UF</Label>
          <Select value={end.uf} onValueChange={(x) => setEnd((p) => ({ ...p, uf: x }))}>
            <SelectTrigger className={cls("uf")}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_UF.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
