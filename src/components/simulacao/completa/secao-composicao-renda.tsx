import { Plus, Trash2, UserPlus, Users, Info, AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRAZO_MAX, prazoMaximoParaProponentes, modoTetoIdade } from "@/lib/simulacao/prazo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { Campo } from "@/components/simulacao/completa/campo";
import { DateInput } from "@/components/shared/date-input";
import { maskCpfCnpj } from "@/lib/simulacao/format";
import { ESTADOS_CIVIS } from "@/lib/simulacao/schemas";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";


export function SecaoComposicaoRenda({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, set } = ctx;
  const participantes = f.participantes || [];

  const [confirmacaoReducao, setConfirmacaoReducao] = useState<{
    callback: () => void;
    prazoAntigo: number;
    prazoNovo: number;
    participanteNome: string;
    participanteIdade: number;
    rendaAntiga: number;
    rendaNova: number;
  } | null>(null);

  const addParticipante = () => {
    const novo = {
      id: crypto.randomUUID(),
      nome: "",
      cpf_cnpj: "",
      data_nascimento: "",
      renda: 0,
      vinculo: "",
      sexo: "",
      estado_civil: "",
      compoe_renda: true,
    };
    set("participantes", [...participantes, novo]);
  };

  const handleUpdateField = (id: string, field: string, value: any) => {
    const p = participantes.find((part: any) => part.id === id);
    if (!p) return;

    const proponenteSimulado = { ...p, [field]: value };
    
    // Se mudar nascimento ou composição, verifica impacto no prazo
    if ((field === "data_nascimento" || field === "compoe_renda") && proponenteSimulado.compoe_renda && proponenteSimulado.data_nascimento) {
      const proponentesAtuais = [
        { nome: f.nome_cliente || "Titular", vinculo: "Titular", dataNascimento: f.data_nascimento },
        // O cônjuge entra no teto de idade mesmo sem compor renda.
        ...(f.data_nascimento_conjuge ? [{ nome: f.nome_conjuge || "Cônjuge", vinculo: "cônjuge", dataNascimento: f.data_nascimento_conjuge }] : []),
        ...participantes.map((part: any) => part.id === id ? proponenteSimulado : part).filter((part: any) => part.compoe_renda)
      ];

      // Mesmo modo usado em `ctx.maxPrazoIdade`, senão a comparação
      // "prazo antes × prazo depois" compararia réguas diferentes.
      const resNovo = prazoMaximoParaProponentes(
        proponentesAtuais,
        new Date(),
        modoTetoIdade(Boolean(f.compoe_renda && f.compoe_renda_conjuge)),
      );
      const prazoNovo = resNovo?.prazo ?? PRAZO_MAX;
      const prazoAtual = ctx.maxPrazoIdade ?? PRAZO_MAX;

      if (prazoNovo < prazoAtual) {
        const nascimentoDate = new Date(proponenteSimulado.data_nascimento);
        const hoje = new Date();
        const idade = isNaN(nascimentoDate.getTime()) ? 0 : hoje.getFullYear() - nascimentoDate.getFullYear();

        setConfirmacaoReducao({
          callback: () => updateParticipanteExec(id, field, value),
          prazoAntigo: prazoAtual,
          prazoNovo: prazoNovo,
          participanteNome: proponenteSimulado.nome || "Novo Participante",
          participanteIdade: idade,
          rendaAntiga: ctx.rendaConsiderada,
          rendaNova: ctx.rendaConsiderada + (field === "compoe_renda" && value === true ? (p.renda || 0) : 0)
        });
        return;
      }
    }

    updateParticipanteExec(id, field, value);
  };

  const updateParticipanteExec = (id: string, field: string, value: any) => {
    const lista = participantes.map((p: any) =>
      p.id === id ? { ...p, [field]: value } : p,
    );
    set("participantes", lista);
  };

  const updateParticipante = handleUpdateField;

  const removeParticipante = (id: string) => {
    set("participantes", participantes.filter((p: any) => p.id !== id));
  };

  const totalConsiderado =
    (Number(f.renda_total) || 0) +
    (f.compoe_renda_conjuge ? Number(f.renda_conjuge) || 0 : 0) +
    (participantes || []).filter((p: any) => p.compoe_renda).reduce((acc: number, p: any) => acc + (Number(p.renda) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4 rounded-lg border bg-muted/20 p-4">
          <Label htmlFor="possui_participantes" className="flex-1 cursor-pointer">
            <div className="text-sm font-semibold">Adicionar terceiros</div>
            <div className="text-xs text-muted-foreground">Além do titular e cônjuge</div>
          </Label>
          <div className="flex bg-muted p-1 rounded-md">
            <Button
              type="button"
              variant={f.possui_participantes ? "ghost" : "secondary"}
              size="sm"
              className={cn("h-8 px-4 text-xs font-semibold", !f.possui_participantes && "bg-white shadow-sm hover:bg-white")}
              onClick={() => {
                set("possui_participantes", false);
                if (participantes.length > 0) {
                  set("participantes", []);
                }
              }}
            >
              Não
            </Button>
            <Button
              type="button"
              variant={!f.possui_participantes ? "ghost" : "secondary"}
              size="sm"
              className={cn("h-8 px-4 text-xs font-semibold", f.possui_participantes && "bg-white shadow-sm hover:bg-white")}
              onClick={() => set("possui_participantes", true)}
            >
              Sim
            </Button>
          </div>
        </div>

        {f.possui_participantes && (
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" />
              Participantes Adicionais
            </h3>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addParticipante}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
            >
              <Plus className="h-4 w-4" />
              Adicionar participante
            </Button>
          </div>
        )}
      </div>

      {f.possui_participantes && (
        <>
          {participantes.length > 0 ? (
            <div className="space-y-8">
              {participantes.map((p: any, index: number) => (
                <div key={p.id} className="relative p-5 border rounded-xl bg-card shadow-sm space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <div className="flex items-center gap-2 text-primary font-bold">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px]">
                          {index + 1}
                        </div>
                        Participante
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`compoe-${p.id}`}
                          checked={p.compoe_renda}
                          onCheckedChange={(v) => updateParticipante(p.id, "compoe_renda", v)}
                        />
                        <Label
                          htmlFor={`compoe-${p.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          Compõe renda
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeParticipante(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    <Campo label="Vínculo com o comprador *">
                      <Select
                        value={p.vinculo}
                        onValueChange={(v) => updateParticipante(p.id, "vinculo", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o vínculo" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Cônjuge/companheiro(a) não entra como terceiro:
                              tem seção própria, dirigida pelo estado civil. */}
                          <SelectItem value="pai">Pai</SelectItem>
                          <SelectItem value="mae">Mãe</SelectItem>
                          <SelectItem value="filho">Filho(a)</SelectItem>
                          <SelectItem value="irmao">Irmão(ã)</SelectItem>
                          <SelectItem value="socio">Sócio</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </Campo>

                    <Campo label="Nome completo *">
                      <Input 
                        value={p.nome} 
                        onChange={(e) => updateParticipante(p.id, "nome", e.target.value)}
                        placeholder="Nome conforme documento"
                      />
                    </Campo>

                    <Campo label="CPF *">
                      <Input 
                        value={p.cpf_cnpj} 
                        onChange={(e) => updateParticipante(p.id, "cpf_cnpj", maskCpfCnpj(e.target.value))}
                        placeholder="000.000.000-00"
                      />
                    </Campo>

                    <Campo label="Data de nascimento *">
                      <DateInput 
                        value={p.data_nascimento} 
                        onChange={(v) => updateParticipante(p.id, "data_nascimento", v)}
                      />
                    </Campo>

                    <Campo label="Sexo *">
                      <Select
                        value={p.sexo}
                        onValueChange={(v) => updateParticipante(p.id, "sexo", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </Campo>

                    <Campo label="Estado civil *">
                      <Select
                        value={p.estado_civil}
                        onValueChange={(v) => updateParticipante(p.id, "estado_civil", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS_CIVIS.map((ec) => (
                            <SelectItem key={ec.value} value={ec.value}>
                              {ec.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Campo>

                    <Campo label="Renda mensal (R$) *">
                      <CurrencyInput 
                        value={p.renda} 
                        onChange={(v) => updateParticipante(p.id, "renda", v)} 
                      />
                    </Campo>

                    <Campo label="Nome da Mãe">
                      <Input 
                        value={p.nome_mae || ""} 
                        onChange={(e) => updateParticipante(p.id, "nome_mae", e.target.value)}
                        placeholder="Nome completo da mãe"
                      />
                    </Campo>

                    <Campo label="E-mail">
                      <Input 
                        value={p.email || ""} 
                        onChange={(e) => updateParticipante(p.id, "email", e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </Campo>

                    <Campo label="Celular">
                      <Input 
                        value={p.celular || ""} 
                        onChange={(e) => updateParticipante(p.id, "celular", e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </Campo>

                  </div>

                  {p.compoe_renda && (
                    <div className="mt-4 pt-4 border-t border-dashed">
                      <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-3">Endereço Residencial (Obrigatório para Composição)</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                        <Campo label="CEP">
                          <Input 
                            value={p.cep || ""} 
                            onChange={(e) => updateParticipante(p.id, "cep", e.target.value)}
                            placeholder="00000-000"
                          />
                        </Campo>
                        <Campo label="Logradouro">
                          <Input 
                            value={p.logradouro || ""} 
                            onChange={(e) => updateParticipante(p.id, "logradouro", e.target.value)}
                            placeholder="Rua, Avenida, etc."
                          />
                        </Campo>
                        <Campo label="Número">
                          <Input 
                            value={p.numero || ""} 
                            onChange={(e) => updateParticipante(p.id, "numero", e.target.value)}
                            placeholder="Nº"
                          />
                        </Campo>
                        <Campo label="Bairro">
                          <Input 
                            value={p.bairro || ""} 
                            onChange={(e) => updateParticipante(p.id, "bairro", e.target.value)}
                            placeholder="Bairro"
                          />
                        </Campo>
                        <Campo label="Município">
                          <Input 
                            value={p.municipio || ""} 
                            onChange={(e) => updateParticipante(p.id, "municipio", e.target.value)}
                            placeholder="Cidade"
                          />
                        </Campo>
                        <Campo label="UF">
                          <Input 
                            value={p.uf || ""} 
                            onChange={(e) => updateParticipante(p.id, "uf", e.target.value?.toUpperCase())}
                            placeholder="UF"
                            maxLength={2}
                          />
                        </Campo>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground flex flex-col items-center gap-2">
              <UserPlus className="h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhum participante adicional cadastrado.</p>
              <Button 
                type="button" 
                variant="link" 
                size="sm" 
                onClick={addParticipante}
                className="text-primary font-semibold"
              >
                Clique aqui para adicionar o primeiro
              </Button>
            </div>
          )}
        </>
      )}


      {/* Teste automático de CPFs — só faz sentido havendo alguém para testar. */}
      {ctx.titularesTestaveis.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-0.5">
            <Label
              htmlFor="testar-cpfs"
              className="cursor-pointer text-sm font-semibold text-foreground"
            >
              Testar CPF de todos os proponentes
            </Label>
            <p className="text-xs text-muted-foreground">
              Repete a simulação com {ctx.titularesTestaveis.map((t: any) => t.nome).join(", ")}
              {" "}na posição de titular e compara as taxas ao final.
            </p>
            <p className="text-[11px] font-medium text-amber-600">
              Multiplica as consultas aos bancos por {ctx.titularesTestaveis.length + 1}.
            </p>
          </div>
          <Switch
            id="testar-cpfs"
            checked={Boolean(f.testar_cpfs)}
            onCheckedChange={(v) => set("testar_cpfs", v)}
          />
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Renda considerada
        </h4>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="truncate">Titular</dt>
            <dd className="shrink-0 tabular-nums">{formatBRL(f.renda_total)}</dd>
          </div>
          {f.compoe_renda_conjuge && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="truncate">Cônjuge</dt>
              <dd className="shrink-0 tabular-nums">{formatBRL(f.renda_conjuge)}</dd>
            </div>
          )}
          {/* Numera pela posição no formulário: sem nome preenchido, dois
              participantes gerariam linhas idênticas e indistinguíveis. */}
          {participantes.map((p: any, i: number) => (
            <div
              key={p.id}
              className={cn(
                "flex items-baseline justify-between gap-4",
                !p.compoe_renda && "text-muted-foreground",
              )}
            >
              <dt className="truncate">
                {p.nome?.trim() || `Participante ${i + 1}`}
                {!p.compoe_renda && " — não compõe"}
              </dt>
              <dd className="shrink-0 tabular-nums">{formatBRL(p.renda)}</dd>
            </div>
          ))}
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t pt-2 font-semibold text-primary">
            <dt>Total</dt>
            <dd className="shrink-0 tabular-nums">{formatBRL(ctx.rendaConsiderada)}</dd>
          </div>
        </dl>
      </div>

      <AlertDialog open={!!confirmacaoReducao} onOpenChange={(open) => !open && setConfirmacaoReducao(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Redução do Prazo Máximo
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="text-foreground">
                Adicionar <strong>{confirmacaoReducao?.participanteNome}</strong> ({confirmacaoReducao?.participanteIdade} anos) 
                reduz o prazo máximo de <strong>{confirmacaoReducao?.prazoAntigo}</strong> para <strong>{confirmacaoReducao?.prazoNovo} meses</strong>, 
                porque a regra de idade usa o proponente mais velho.
              </p>
              <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
                <p>Renda considerada: <span className="line-through opacity-50">{formatBRL(confirmacaoReducao?.rendaAntiga || 0)}</span> → <span className="font-bold text-primary">{formatBRL(confirmacaoReducao?.rendaNova || 0)}</span></p>
                <p>Prazo máximo: <span className="line-through opacity-50">{confirmacaoReducao?.prazoAntigo}</span> → <span className="font-bold text-amber-600">{confirmacaoReducao?.prazoNovo} meses</span></p>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Deseja continuar com a inclusão deste participante?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-primary hover:bg-primary/90"
              onClick={() => {
                confirmacaoReducao?.callback();
                setConfirmacaoReducao(null);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
