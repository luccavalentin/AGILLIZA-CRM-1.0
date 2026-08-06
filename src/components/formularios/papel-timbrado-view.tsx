import { useMemo, useState } from "react";
import { FileText, Download, FileDown, Eraser, Check, FileType } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OpHero } from "@/components/operacional/ui";
import { gerarPapelTimbradoPDF, gerarPapelTimbradoWord } from "@/lib/formularios/pdf-lazy";
import type { PapelTimbradoDados } from "@/lib/formularios/papel-timbrado-pdf";
import {
  PAPEL_TIMBRADO_MODELOS,
  getPapelTimbradoModelo,
  type PapelTimbradoModeloId,
  type PapelTimbradoModelo,
} from "@/lib/formularios/papel-timbrado-modelos";
import agillizaLogo from "@/assets/brand/agilliza-logo-oficial-light.png";
import agillizaLogoDark from "@/assets/brand/agilliza-logo-oficial.png";
import { cn } from "@/lib/utils";

const HOJE = new Date().toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

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
  modelo: "institucional",
};

export function PapelTimbradoView() {
  const [dados, setDados] = useState<PapelTimbradoDados>(INICIAL);
  const modelo = getPapelTimbradoModelo(dados.modelo);

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
    gerarPapelTimbradoPDF({ modelo: dados.modelo });
    toast.success("Papel timbrado em branco gerado.");
  }

  function baixarWord() {
    const preenchido =
      (dados.destinatario?.trim() || dados.mensagem?.trim() || dados.assinante?.trim()) ?? "";
    if (!preenchido) {
      toast.error("Preencha ao menos destinatário, mensagem ou assinante.");
      return;
    }
    gerarPapelTimbradoWord(dados);
    toast.success("Documento Word gerado.");
  }

  function limpar() {
    setDados({ ...INICIAL, modelo: dados.modelo });
  }

  const linhaCabecalho = useMemo(
    () => [dados.cidade?.trim(), dados.data?.trim()].filter(Boolean).join(", "),
    [dados.cidade, dados.data],
  );

  const paragrafos = useMemo(
    () =>
      (dados.mensagem ?? "")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    [dados.mensagem],
  );

  return (
    <div className="mx-auto w-full max-w-none space-y-5 p-4 md:p-6">
      <OpHero
        icon={<FileText className="h-5 w-5" />}
        eyebrow="Documentos · Formulários"
        titulo="PAPEL TIMBRADO PERMITA BAIXAR EM PDF E WORD, COM A MESMA FORMATAÇÃO E CONFIGURAÇÃO E ETC"
        descricao="Escolha entre 10 modelos e baixe em PDF ou WORD com marca d'água e formatação profissional."
        accent={modelo.primaria}
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
            <Button variant="outline" onClick={baixarWord}>
              <FileType className="mr-2 h-4 w-4" />
              Baixar Word
            </Button>
            <Button onClick={baixarPreenchido}>
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
          </div>
        }
      />

      {/* Seletor de modelos */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Modelos de papel timbrado
          </h2>
          <span className="text-[11px] text-muted-foreground">
            10 variações · marca d'água inclusa
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PAPEL_TIMBRADO_MODELOS.map((m) => (
            <ModeloCard
              key={m.id}
              modelo={m}
              selecionado={m.id === dados.modelo}
              onSelect={() => set("modelo", m.id)}
            />
          ))}
        </div>
      </section>

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
              <Input
                value={dados.saudacao ?? ""}
                onChange={(e) => set("saudacao", e.target.value)}
              />
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
              <Input
                value={dados.despedida ?? ""}
                onChange={(e) => set("despedida", e.target.value)}
              />
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
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Visualização
            </span>
            <span className="text-[11px] text-muted-foreground">{modelo.nome}</span>
          </div>
          <PreviewPagina modelo={modelo}>
            <div className="min-h-[560px] space-y-4 px-8 py-8 text-sm leading-relaxed text-foreground">
              {linhaCabecalho && (
                <p className="text-right text-foreground/80">{linhaCabecalho}</p>
              )}
              {dados.destinatario?.trim() && (
                <div>
                  <p className="whitespace-pre-line">{dados.destinatario}</p>
                </div>
              )}

              {dados.referencia?.trim() && (
                <p>
                  <span className="font-semibold" style={{ color: modelo.destaqueTexto }}>
                    Ref.:
                  </span>{" "}
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
                    <p
                      className="mt-1 font-semibold"
                      style={{ color: modelo.destaqueTexto }}
                    >
                      {dados.assinante}
                    </p>
                  )}
                  {dados.cargo?.trim() && (
                    <p className="text-xs text-muted-foreground">{dados.cargo}</p>
                  )}
                </div>
              )}
            </div>
          </PreviewPagina>
        </div>
      </div>
    </div>
  );
}

/** Miniatura clicável de cada modelo. */
function ModeloCard({
  modelo,
  selecionado,
  onSelect,
}: {
  modelo: PapelTimbradoModelo;
  selecionado: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card text-left transition-all",
        "shadow-[inset_0_1px_0_color-mix(in_oklab,#fff_45%,transparent),0_1px_2px_-1px_rgba(0,0,0,0.06),0_10px_24px_-18px_rgba(0,0,0,0.15)]",
        "hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_color-mix(in_oklab,#fff_55%,transparent),0_18px_36px_-20px_rgba(0,0,0,0.25)]",
        selecionado
          ? "border-transparent ring-2 ring-offset-2 ring-offset-background"
          : "border-border/70 hover:border-foreground/20",
      )}
      style={
        selecionado
          ? ({ ["--tw-ring-color" as string]: modelo.primaria } as React.CSSProperties)
          : undefined
      }
      aria-pressed={selecionado}
    >
      {/* Miniatura A4 */}
      <div
        className="relative aspect-[1/1.15] w-full overflow-hidden"
        style={{ background: modelo.estilo === "real" ? (modelo.fundo ?? "#FBF7EE") : "#ffffff" }}
      >
        {/* Watermark */}
        {modelo.estilo === "real" ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
            <span className="relative grid size-[74%] place-items-center">
              <span
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: modelo.marcaDagua, opacity: 0.1 }}
              />
              <span
                className="absolute inset-[10%] rounded-full border"
                style={{ borderColor: modelo.marcaDagua, opacity: 0.1 }}
              />
              <span
                className="font-serif text-[56px] font-bold leading-none"
                style={{ color: modelo.marcaDagua, opacity: 0.09 }}
              >
                A
              </span>
            </span>
          </span>
        ) : (
          <span
            className="pointer-events-none absolute inset-0 grid place-items-center"
            aria-hidden
          >
            <span
              className="rotate-[-24deg] text-[42px] font-black tracking-wider"
              style={{ color: modelo.marcaDagua, opacity: 0.05 }}
            >
              AGILLIZA
            </span>
          </span>
        )}

        {/* Moldura ornamental (linha Real) */}
        {modelo.estilo === "real" && (
          <span className="pointer-events-none absolute inset-0" aria-hidden>
            <span
              className="absolute inset-[6px] border"
              style={{ borderColor: modelo.primaria }}
            />
            <span
              className="absolute inset-[9px] border"
              style={{ borderColor: modelo.metalico ?? modelo.destaque, opacity: 0.8 }}
            />
          </span>
        )}

        {/* Cabeçalho conforme estilo */}
        {modelo.estilo === "real" && (
          <div className="relative flex h-[34%] flex-col items-center justify-end pb-1">
            <img src={agillizaLogoDark} alt="" className="h-3 w-auto" />
            <span
              className="mt-1 font-serif text-[8px] font-bold tracking-[0.25em]"
              style={{ color: modelo.primaria }}
            >
              AGILLIZA
            </span>
            <span
              className="mt-1 block h-px w-[62%]"
              style={{ background: modelo.metalico ?? modelo.destaque }}
            />
          </div>
        )}
        {modelo.estilo === "faixa" && (
          <>
            <div
              className="relative flex h-[26%] items-center gap-1.5 px-3"
              style={{
                background: `linear-gradient(90deg, ${modelo.primaria} 0%, ${modelo.primaria} 55%, ${modelo.primariaEscura} 100%)`,
              }}
            >
              <img src={agillizaLogo} alt="" className="h-3.5 w-auto opacity-95" />
              <div className="h-2.5 w-px bg-white/30" />
              <span className="text-[7px] font-semibold uppercase tracking-wide text-white/95">
                Agilliza
              </span>
              <span
                className="absolute inset-x-0 bottom-0 h-[2px]"
                style={{ background: modelo.destaque }}
              />
            </div>
          </>
        )}

        {modelo.estilo === "hairline" && (
          <div className="relative flex h-[26%] items-end justify-between px-3 pb-1.5">
            <img src={agillizaLogoDark} alt="" className="h-3 w-auto" />
            <span
              className="text-[7px] font-bold uppercase tracking-widest"
              style={{ color: modelo.primaria }}
            >
              Agilliza
            </span>
            <span
              className="absolute inset-x-3 bottom-0 h-px"
              style={{ background: modelo.primaria }}
            />
            <span
              className="absolute inset-x-3 bottom-[3px] h-px opacity-40"
              style={{ background: modelo.primaria }}
            />
          </div>
        )}
        {modelo.estilo === "borda-lateral" && (
          <>
            <span
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ background: modelo.primaria }}
            />
            <span
              className="absolute left-0 top-[26%] h-1.5 w-1.5"
              style={{ background: modelo.destaque }}
            />
            <div className="relative flex h-[26%] items-end justify-between pl-4 pr-3 pb-1.5">
              <img src={agillizaLogoDark} alt="" className="h-3 w-auto" />
              <span
                className="text-[7px] font-bold uppercase tracking-widest"
                style={{ color: modelo.primaria }}
              >
                Agilliza
              </span>
            </div>
          </>
        )}

        {/* Linhas simulando texto */}
        <div className="space-y-1.5 px-4 pt-3">
          <span className="ml-auto block h-1 w-16 rounded-full bg-foreground/15" />
          <span className="block h-1 w-10 rounded-full bg-foreground/25" />
          <span className="block h-1 w-full rounded-full bg-foreground/10" />
          <span className="block h-1 w-11/12 rounded-full bg-foreground/10" />
          <span className="block h-1 w-4/5 rounded-full bg-foreground/10" />
          <span className="block h-1 w-full rounded-full bg-foreground/10" />
          <span className="block h-1 w-3/4 rounded-full bg-foreground/10" />
          <span className="mt-2 block h-1 w-24 rounded-full bg-foreground/15" />
          <span
            className="mt-3 block h-1 w-20 rounded-full"
            style={{ background: modelo.destaqueTexto, opacity: 0.7 }}
          />
        </div>

        {/* Check quando selecionado */}
        {selecionado && (
          <span
            className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-white shadow-md"
            style={{ background: modelo.primaria }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Rótulo */}
      <div className="space-y-0.5 border-t border-border/60 bg-card px-3 py-2">
        <p className="truncate text-[12px] font-semibold text-foreground">{modelo.nome}</p>
        <p className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">
          {modelo.descricao}
        </p>
        <div className="mt-1 flex items-center gap-1">
          <span
            className="size-2 rounded-full ring-1 ring-border"
            style={{ background: modelo.primaria }}
          />
          <span
            className="size-2 rounded-full ring-1 ring-border"
            style={{ background: modelo.destaque }}
          />
          <span
            className="size-2 rounded-full ring-1 ring-border"
            style={{ background: modelo.primariaEscura }}
          />
        </div>
      </div>
    </button>
  );
}

/** Página A4 estilizada segundo o modelo escolhido. */
function PreviewPagina({
  modelo,
  children,
}: {
  modelo: PapelTimbradoModelo;
  children: React.ReactNode;
}) {
  const ehReal = modelo.estilo === "real";
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border"
      style={{
        background: ehReal ? (modelo.fundo ?? "#FBF7EE") : "#ffffff",
        boxShadow: `0 20px 48px -24px ${modelo.primaria}55, 0 2px 6px -2px rgba(0,0,0,0.08)`,
        padding: ehReal ? 14 : undefined,
      }}
    >
      {/* Moldura ornamental (linha Real) */}
      {ehReal && (
        <span className="pointer-events-none absolute inset-0" aria-hidden>
          <span
            className="absolute inset-[10px] border-[1.5px]"
            style={{ borderColor: modelo.primaria }}
          />
          <span
            className="absolute inset-[15px] border"
            style={{ borderColor: modelo.metalico ?? modelo.destaque, opacity: 0.9 }}
          />
          <span
            className="absolute inset-[19px] border"
            style={{ borderColor: modelo.metalico ?? modelo.destaque, opacity: 0.45 }}
          />
          {[
            "left-[8px] top-[8px]",
            "right-[8px] top-[8px]",
            "left-[8px] bottom-[8px]",
            "right-[8px] bottom-[8px]",
          ].map((pos) => (
            <span
              key={pos}
              className={cn("absolute size-2 rotate-45", pos)}
              style={{ background: modelo.metalico ?? modelo.destaque }}
            />
          ))}
        </span>
      )}

      {/* Marca d'água central */}
      {ehReal ? (
        <span
          className="pointer-events-none absolute inset-0 grid select-none place-items-center overflow-hidden"
          aria-hidden
        >
          <span className="relative grid size-[300px] place-items-center">
            <span
              className="absolute inset-0 rounded-full border-[3px]"
              style={{ borderColor: modelo.marcaDagua, opacity: 0.08 }}
            />
            <span
              className="absolute inset-[10px] rounded-full border"
              style={{ borderColor: modelo.marcaDagua, opacity: 0.08 }}
            />
            <span
              className="absolute inset-[38px] rounded-full border"
              style={{ borderColor: modelo.marcaDagua, opacity: 0.08 }}
            />
            <span
              className="font-serif text-[170px] font-bold leading-none"
              style={{ color: modelo.marcaDagua, opacity: 0.07 }}
            >
              A
            </span>
            <span
              className="absolute bottom-6 font-serif text-[11px] tracking-[0.34em]"
              style={{ color: modelo.marcaDagua, opacity: 0.1 }}
            >
              AGILLIZA
            </span>
          </span>
        </span>
      ) : (
        <span className="pointer-events-none absolute inset-0 grid select-none place-items-center overflow-hidden">
          <span
            className="rotate-[-24deg] whitespace-nowrap text-[120px] font-black tracking-[0.05em]"
            style={{ color: modelo.marcaDagua, opacity: 0.05 }}
          >
            AGILLIZA
          </span>
        </span>
      )}


      {/* Cabeçalho conforme estilo */}
      {modelo.estilo === "faixa" && (
        <div
          className="relative flex items-center gap-4 px-6 py-5 text-white"
          style={{
            background: `linear-gradient(90deg, ${modelo.primaria} 0%, ${modelo.primaria} 55%, ${modelo.primariaEscura} 100%)`,
          }}
        >
          <img src={agillizaLogo} alt="Agilliza" className="h-9 w-auto" />
          <div className="h-8 w-px bg-white/25" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold sm:text-base">
              Agilliza · Crédito Imobiliário
            </div>
            <div className="truncate text-[11px] opacity-80">Documento Oficial</div>
          </div>
          <span
            className="absolute inset-x-0 bottom-0 h-[3px]"
            style={{ background: modelo.destaque }}
          />
        </div>
      )}
      {modelo.estilo === "hairline" && (
        <div className="relative flex items-end justify-between px-6 pb-3 pt-6">
          <img src={agillizaLogoDark} alt="Agilliza" className="h-7 w-auto" />
          <div className="text-right">
            <div
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: modelo.primaria }}
            >
              Agilliza
            </div>
            <div className="text-[9px] text-muted-foreground">
              Correspondente · Crédito Imobiliário
            </div>
          </div>
          <span
            className="absolute inset-x-6 bottom-0 h-[1.5px]"
            style={{ background: modelo.primaria }}
          />
          <span
            className="absolute inset-x-6 -bottom-[4px] h-px opacity-45"
            style={{ background: modelo.primaria }}
          />
        </div>
      )}
      {modelo.estilo === "borda-lateral" && (
        <>
          <span
            className="absolute inset-y-0 left-0 w-2.5"
            style={{ background: modelo.primaria }}
          />
          <span
            className="absolute left-0 top-[92px] h-3 w-2.5"
            style={{ background: modelo.destaque }}
          />
          <div className="relative flex items-end justify-between pl-8 pr-6 pb-3 pt-6">
            <img src={agillizaLogoDark} alt="Agilliza" className="h-7 w-auto" />
            <div className="text-right">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: modelo.primaria }}
              >
                Agilliza · Crédito Imobiliário
              </div>
              <div className="text-[9px] text-muted-foreground">Documento Oficial</div>
            </div>
          </div>
          <div className="relative mx-6 h-px bg-border" />
        </>
      )}
      {modelo.estilo === "real" && (
        <div className="relative flex flex-col items-center px-6 pb-4 pt-12">
          <img src={agillizaLogoDark} alt="Agilliza" className="h-8 w-auto" />
          <div
            className="mt-3 font-serif text-2xl font-bold tracking-[0.3em]"
            style={{ color: modelo.primaria }}
          >
            AGILLIZA
          </div>
          <div
            className="mt-1 font-serif text-[10px] tracking-[0.32em]"
            style={{ color: modelo.metalico ?? modelo.destaque }}
          >
            CRÉDITO IMOBILIÁRIO
          </div>
          <div className="mt-4 flex w-full items-center gap-3">
            <span
              className="h-px flex-1"
              style={{ background: modelo.metalico ?? modelo.destaque }}
            />
            <span
              className="grid size-3.5 rotate-45 place-items-center border"
              style={{
                borderColor: modelo.primaria,
                background: modelo.metalico ?? modelo.destaque,
              }}
            />
            <span
              className="h-px flex-1"
              style={{ background: modelo.metalico ?? modelo.destaque }}
            />
          </div>
          {modelo.lema && (
            <div className="mt-2 font-serif text-[9px] italic tracking-[0.14em] text-muted-foreground">
              {modelo.lema}
            </div>
          )}
        </div>
      )}


      {/* Corpo */}
      <div className="relative">{children}</div>

      {/* Rodapé */}
      <div className="relative border-t border-border px-6 py-3 text-[10px] text-muted-foreground">
        {modelo.rodape}
      </div>
    </div>
  );
}
