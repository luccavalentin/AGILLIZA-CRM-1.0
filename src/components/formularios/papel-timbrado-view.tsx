import { useMemo, useState } from "react";
import { FileText, Download, FileDown, Eraser } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OpHero } from "@/components/operacional/ui";
import { gerarPapelTimbradoPDF, type PapelTimbradoDados } from "@/lib/formularios/papel-timbrado-pdf";
import agillizaLogo from "@/assets/brand/agilliza-logo-oficial-light.png";

const HOJE = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

const INICIAL: PapelTimbradoDados = {
  destinatario: "",
  referencia: "",
  cidade: "São Paulo",
  data: HOJE,
  saudacao: "Prezados(as) Senhores(as),",
  mensagem: "",
  despedida: "Atenciosamente,",
  assinante: "",
  cargo: "",
};

export function PapelTimbradoView() {
  const [dados, setDados] = useState<PapelTimbradoDados>(INICIAL);

  function set<K extends keyof PapelTimbradoDados>(k: K, v: PapelTimbradoDados[K]) {
    setDados((d) => ({ ...d, [k]: v }));
  }

  function baixarPreenchido() {
    const preenchido =
      (dados.destinatario?.trim() || dados.mensagem?.trim() || dados.assinante?.trim()) ?? "";
    if (!preenchido) {
      toast.error("Preencha ao menos destinatário, mensagem ou assinante.");
      return;
    }
    gerarPapelTimbradoPDF(dados);
    toast.success("Papel timbrado gerado.");
  }

  function baixarEmBranco() {
    gerarPapelTimbradoPDF({});
    toast.success("Papel timbrado em branco gerado.");
  }

  function limpar() {
    setDados(INICIAL);
  }

  const linhaCabecalho = useMemo(
    () => [dados.cidade?.trim(), dados.data?.trim()].filter(Boolean).join(", "),
    [dados.cidade, dados.data],
  );

  const paragrafos = useMemo(
    () => (dados.mensagem ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [dados.mensagem],
  );

  return (
    <div className="mx-auto w-full max-w-none space-y-5 p-4 md:p-6">
      <OpHero
        icon={<FileText className="h-5 w-5" />}
        eyebrow="Documentos · Formulários"
        titulo="Papel Timbrado"
        descricao="Redija cartas e comunicados oficiais com a identidade visual Agilliza. Baixe preenchido ou em branco."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={limpar}>
              <Eraser className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button variant="outline" onClick={baixarEmBranco}>
              <FileDown className="mr-2 h-4 w-4" />
              Baixar em branco
            </Button>
            <Button onClick={baixarPreenchido}>
              <Download className="mr-2 h-4 w-4" />
              Baixar preenchido
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Formulário */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={dados.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input value={dados.data ?? ""} onChange={(e) => set("data", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Destinatário</Label>
              <Textarea
                rows={3}
                value={dados.destinatario ?? ""}
                onChange={(e) => set("destinatario", e.target.value)}
                placeholder={"Nome / Razão Social\nEndereço\nCidade / UF"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Referência (opcional)</Label>
              <Input
                value={dados.referencia ?? ""}
                onChange={(e) => set("referencia", e.target.value)}
                placeholder="Ex.: Proposta PRO-000068"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Saudação</Label>
              <Input value={dados.saudacao ?? ""} onChange={(e) => set("saudacao", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                rows={10}
                value={dados.mensagem ?? ""}
                onChange={(e) => set("mensagem", e.target.value)}
                placeholder="Escreva aqui o conteúdo da carta. Use uma linha em branco para separar parágrafos."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Despedida</Label>
              <Input value={dados.despedida ?? ""} onChange={(e) => set("despedida", e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Assinante</Label>
                <Input
                  value={dados.assinante ?? ""}
                  onChange={(e) => set("assinante", e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input
                  value={dados.cargo ?? ""}
                  onChange={(e) => set("cargo", e.target.value)}
                  placeholder="Ex.: Diretor Comercial"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Visualização
          </div>
          <div className="overflow-hidden rounded-xl border border-border shadow-[0_10px_30px_-15px_hsl(var(--primary)/0.35)]">
            {/* Página do papel timbrado — cores acompanham o tema */}
            <div className="bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]">
              {/* Cabeçalho azul institucional */}
              <div className="relative flex items-center gap-4 bg-[hsl(var(--primary))] px-6 py-5 text-[hsl(var(--primary-foreground))]">
                <img src={agillizaLogo} alt="Agilliza" className="h-9 w-auto" />
                <div className="h-8 w-px bg-white/25" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold sm:text-base">
                    Agilliza · Crédito Imobiliário
                  </div>
                  <div className="truncate text-[11px] opacity-80">Documento Oficial</div>
                </div>
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[hsl(var(--destructive,0_84%_60%))]" />
              </div>

              {/* Corpo */}
              <div className="min-h-[560px] space-y-4 px-6 py-8 text-sm leading-relaxed">
                {linhaCabecalho && (
                  <p className="text-right text-foreground/80">{linhaCabecalho}</p>
                )}
                {dados.destinatario?.trim() && (
                  <div>
                    <p className="font-semibold text-[hsl(var(--primary))]">Ao(À):</p>
                    <p className="whitespace-pre-line">{dados.destinatario}</p>
                  </div>
                )}
                {dados.referencia?.trim() && (
                  <p>
                    <span className="font-semibold text-[hsl(var(--primary))]">Ref.:</span>{" "}
                    {dados.referencia}
                  </p>
                )}
                {dados.saudacao?.trim() && <p>{dados.saudacao}</p>}
                {paragrafos.length > 0 ? (
                  paragrafos.map((p, i) => (
                    <p key={i} className="whitespace-pre-line text-justify">
                      {p}
                    </p>
                  ))
                ) : (
                  <p className="italic text-muted-foreground">
                    O conteúdo da mensagem aparecerá aqui…
                  </p>
                )}
                {dados.despedida?.trim() && <p className="pt-2">{dados.despedida}</p>}
                {(dados.assinante?.trim() || dados.cargo?.trim()) && (
                  <div className="pt-8">
                    <div className="h-px w-56 bg-border" />
                    {dados.assinante?.trim() && (
                      <p className="mt-1 font-semibold text-[hsl(var(--primary))]">
                        {dados.assinante}
                      </p>
                    )}
                    {dados.cargo?.trim() && (
                      <p className="text-xs text-muted-foreground">{dados.cargo}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Rodapé */}
              <div className="border-t border-border px-6 py-3 text-[10px] text-muted-foreground">
                Agilliza · Crédito Imobiliário — Documento oficial
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
