import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

/**
 * Política de Privacidade pública (LGPD - Lei 13.709/2018).
 *
 * IMPORTANTE: os campos entre colchetes [ ... ] devem ser preenchidos com os
 * dados reais do controlador (razão social, CNPJ, endereço e contato do
 * Encarregado/DPO). Não substitua por dados fictícios.
 */
export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Agilliza" },
      {
        name: "description",
        content:
          "Política de Privacidade e tratamento de dados pessoais em conformidade com a LGPD (Lei 13.709/2018).",
      },
      { name: "theme-color", content: "#000f9f" },
    ],
  }),
  component: PoliticaPrivacidade,
});

const CONTROLADOR = "[Razão Social do Controlador]";
const CNPJ = "[CNPJ]";
const ENDERECO = "[Endereço completo do controlador]";
const DPO_NOME = "[Nome do Encarregado (DPO)]";
const DPO_EMAIL = "[e-mail do Encarregado (DPO)]";
const ATUALIZADO_EM = "[data da última atualização]";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PoliticaPrivacidade() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="bg-primary px-4 py-6 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <ShieldCheck className="h-7 w-7 shrink-0" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold leading-tight">Política de Privacidade</h1>
            <p className="text-sm opacity-90">
              Tratamento de dados pessoais conforme a LGPD (Lei nº 13.709/2018)
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Última atualização: {ATUALIZADO_EM}
        </p>

        <Secao titulo="1. Controlador dos dados">
          <p>
            O controlador dos dados pessoais tratados nesta plataforma é{" "}
            <strong className="text-foreground">{CONTROLADOR}</strong>, inscrito no CNPJ{" "}
            {CNPJ}, com sede em {ENDERECO}.
          </p>
        </Secao>

        <Secao titulo="2. Encarregado (DPO)">
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento dos seus dados,
            entre em contato com o Encarregado pela Proteção de Dados:{" "}
            <strong className="text-foreground">{DPO_NOME}</strong> — {DPO_EMAIL}.
          </p>
        </Secao>

        <Secao titulo="3. Dados pessoais que tratamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>Dados de identificação: nome, CPF/CNPJ, RG, data de nascimento, filiação.</li>
            <li>Dados de contato: e-mail, telefone, endereço.</li>
            <li>Dados financeiros: renda declarada, dados bancários, informações da operação.</li>
            <li>Dados do imóvel e da operação de crédito.</li>
            <li>Dados do cônjuge/compositor de renda, quando aplicável.</li>
            <li>Documentos enviados (comprovantes, matrícula, contratos).</li>
            <li>Dados de navegação e cookies essenciais ao funcionamento.</li>
          </ul>
        </Secao>

        <Secao titulo="4. Finalidades do tratamento">
          <ul className="list-disc space-y-1 pl-5">
            <li>Realizar simulações e propostas de crédito imobiliário e home equity.</li>
            <li>Encaminhar a operação às instituições financeiras parceiras.</li>
            <li>Consultar o SCR/Bacen mediante consentimento.</li>
            <li>Cumprir obrigações legais, regulatórias e contratuais.</li>
            <li>Prevenir fraudes e garantir a segurança das operações.</li>
          </ul>
        </Secao>

        <Secao titulo="5. Bases legais">
          <p>
            O tratamento se fundamenta no consentimento do titular, na execução de contrato, no
            cumprimento de obrigação legal/regulatória e no legítimo interesse, conforme os artigos
            7º e 11 da LGPD.
          </p>
        </Secao>

        <Secao titulo="6. Compartilhamento de dados">
          <p>
            Seus dados podem ser compartilhados com instituições financeiras parceiras para
            viabilizar a operação de crédito, com o Bacen (SCR) mediante consentimento e com
            autoridades públicas quando exigido por lei. Não vendemos dados pessoais.
          </p>
        </Secao>

        <Secao titulo="7. Retenção e eliminação">
          <p>
            Os dados são mantidos pelo período necessário às finalidades e às obrigações legais e
            regulatórias aplicáveis. Encerrado esse período, são eliminados ou anonimizados.
          </p>
        </Secao>

        <Secao titulo="8. Direitos do titular">
          <p>
            Nos termos do art. 18 da LGPD, você pode solicitar: confirmação e acesso aos dados,
            correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento e
            revogação do consentimento. Clientes cadastrados podem exercer esses direitos
            diretamente no portal, em <em>Perfil → Privacidade</em>, ou pelo contato do Encarregado
            acima.
          </p>
        </Secao>

        <Secao titulo="9. Segurança">
          <p>
            Adotamos medidas técnicas e administrativas para proteger os dados contra acessos não
            autorizados e situações acidentais ou ilícitas, incluindo controle de acesso por perfil,
            registro de auditoria e restrição de visualização de dados sensíveis.
          </p>
        </Secao>

        <Secao titulo="10. Cookies">
          <p>
            Utilizamos cookies essenciais ao funcionamento da plataforma e, mediante consentimento,
            cookies para melhoria da experiência. Você pode gerenciar sua escolha a qualquer momento
            no aviso exibido ao acessar a plataforma.
          </p>
        </Secao>

        <Secao titulo="11. Alterações desta política">
          <p>
            Esta política pode ser atualizada. A data da última atualização é indicada no topo desta
            página.
          </p>
        </Secao>

        <div className="pt-4">
          <Link to="/" className="text-sm font-medium text-primary underline underline-offset-2">
            ← Voltar
          </Link>
        </div>
      </main>
    </div>
  );
}
