import { Checkbox } from "@/components/ui/checkbox";
import { Erro } from "@/components/simulacao/completa/campo";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoConsentimentos({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, set, erros } = ctx;

  return (
    <section className="space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={f.consentimento_lgpd}
          onCheckedChange={(c) => set("consentimento_lgpd", Boolean(c))}
        />
        <span>
          Autorizo o tratamento dos meus dados pessoais conforme a LGPD para fins desta simulação e
          proposta.
        </span>
      </label>
      <Erro erros={erros} campo="consentimento_lgpd" />
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={f.consentimento_scr}
          onCheckedChange={(c) => set("consentimento_scr", Boolean(c))}
        />
        <span>
          Autorizo a consulta ao SCR/Bacen e o compartilhamento de dados com os bancos selecionados.
        </span>
      </label>
      <Erro erros={erros} campo="consentimento_scr" />
    </section>
  );
}
