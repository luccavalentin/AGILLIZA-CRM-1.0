import { Plus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TIPOS_VINCULO,
  TIPO_VINCULO_PESSOA,
  parceiroAtendeTipos,
  type TipoVinculo,
} from "@/lib/crm/clientes.functions";

interface Parceiro {
  id: string;
  nome?: string | null;
  email?: string | null;
  tipo_pessoa?: string;
  tipos_pessoa?: string[] | null;
}

export function VinculosSection({
  parceiros,
  vinculos,
  vinculoSel,
  setVinculoSel,
  adicionarVinculo,
  removerVinculo,
  nomeParceiro,
  onCriarTipo,
}: {
  parceiros: Parceiro[];
  vinculos: Array<{ parceiro_id: string; tipo_vinculo: TipoVinculo }>;
  vinculoSel: Record<string, string>;
  setVinculoSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  adicionarVinculo: (tipo: TipoVinculo) => void;
  removerVinculo: (parceiro_id: string, tipo: TipoVinculo) => void;
  nomeParceiro: (id: string) => string;
  onCriarTipo: (tipo: TipoVinculo) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" /> Vínculos de atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Escolha os usuários responsáveis pelo atendimento deste cliente por tipo. Cada tipo
          aceita mais de um usuário e nenhum é obrigatório. Você poderá ajustar depois na ficha
          do cliente.
        </p>
        {TIPOS_VINCULO.map((tipo) => {
          const desteTipo = vinculos.filter((x) => x.tipo_vinculo === tipo.valor);
          const idsTipo = new Set(desteTipo.map((x) => x.parceiro_id));
          const tiposPessoa = TIPO_VINCULO_PESSOA[tipo.valor];
          const opcoesParceiros = parceiros.filter(
            (p) => !idsTipo.has(p.id) && parceiroAtendeTipos(p, tiposPessoa),
          );
          const sel = vinculoSel[tipo.valor] ?? "";
          return (
            <div key={tipo.valor} className="space-y-2">
              <Label className="block">{tipo.rotulo}</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Select
                    value={sel}
                    onValueChange={(val) => {
                      // Ao selecionar já vincula automaticamente, evita a dúvida
                      // sobre o botão-ícone. O select fica pronto para próximo vínculo.
                      setVinculoSel((prev) => ({ ...prev, [tipo.valor]: val }));
                      adicionarVinculo(tipo.valor);
                      setVinculoSel((prev) => ({ ...prev, [tipo.valor]: "" }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Buscar e selecionar um usuário…" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesParceiros.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nenhum usuário disponível
                        </div>
                      ) : (
                        opcoesParceiros.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome ?? p.email ?? p.id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => onCriarTipo(tipo.valor)}
                  title={`Cadastrar novo ${tipo.rotulo.toLowerCase()}`}
                >
                  <Plus className="size-4" /> Cadastrar novo
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Selecione na lista para vincular na hora, ou use{" "}
                <span className="font-medium text-foreground">Cadastrar novo</span> se a pessoa
                ainda não existir.
              </p>
              {desteTipo.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {desteTipo.map((vinc) => (
                    <span
                      key={vinc.parceiro_id}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-sm text-accent-foreground"
                    >
                      {nomeParceiro(vinc.parceiro_id)}
                      <button
                        type="button"
                        onClick={() => removerVinculo(vinc.parceiro_id, tipo.valor)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remover vínculo"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
