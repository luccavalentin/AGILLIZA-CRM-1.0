import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Phone, MessageSquare, Mail, Users2, MapPin, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarInteracoes, registrarInteracao } from "@/lib/crm/clientes.functions";

const CANAIS = [
  { v: "ligacao", l: "Ligação", icon: Phone },
  { v: "whatsapp", l: "WhatsApp", icon: MessageSquare },
  { v: "email", l: "E-mail", icon: Mail },
  { v: "reuniao", l: "Reunião", icon: Users2 },
  { v: "presencial", l: "Presencial", icon: MapPin },
  { v: "followup", l: "Follow-up", icon: Clock },
  { v: "outro", l: "Outro", icon: MessageSquare },
];

export function InteracoesTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarInteracoes);
  const registrar = useServerFn(registrarInteracao);
  const [aberto, setAberto] = useState(false);
  const [canal, setCanal] = useState("ligacao");
  const [resultado, setResultado] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["cliente-interacoes", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  async function salvar() {
    setSalvando(true);
    try {
      await registrar({
        data: { cliente_id: clienteId, canal: canal as any, resultado, observacao },
      });
      toast.success("Contato registrado.");
      setAberto(false);
      setResultado("");
      setObservacao("");
      qc.invalidateQueries({ queryKey: ["cliente-interacoes", clienteId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Registrar contato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar contato</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm">Canal</label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAIS.map((c) => (
                      <SelectItem key={c.v} value={c.v}>
                        {c.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm">Resultado</label>
                <Input
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  placeholder="Ex.: cliente retornará amanhã"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm">Observação</label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (itens?.length ?? 0) === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum contato registrado.</p>
      ) : (
        <div className="space-y-2">
          {itens!.map((i: any) => {
            const canalCfg = CANAIS.find((c) => c.v === i.canal);
            const Icon = canalCfg?.icon ?? MessageSquare;
            return (
              <Card key={i.id}>
                <CardContent className="flex gap-3 pt-4">
                  <Icon className="size-5 shrink-0 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{canalCfg?.l}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(i.ocorrido_em).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {i.resultado && <p className="text-sm text-foreground">{i.resultado}</p>}
                    {i.observacao && (
                      <p className="text-sm text-muted-foreground">{i.observacao}</p>
                    )}
                    {i.responsavel?.nome && (
                      <p className="mt-1 text-xs text-muted-foreground">por {i.responsavel.nome}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
