import { createFileRoute } from "@tanstack/react-router";
import {
  SiFacebook,
  SiGoogle,
  SiInstagram,
  SiTiktok,
  SiWhatsapp,
  SiYoutube,
} from "@icons-pack/react-simple-icons";
import { Workflow } from "lucide-react";
import type { ComponentType } from "react";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({ meta: [{ title: "Automações — Agilliza" }] }),
  component: Pagina,
});

/** LinkedIn saiu do pacote de marcas a pedido da própria marca: glifo oficial embutido. */
function SiLinkedIn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="LinkedIn" className={className}>
      <path
        fill="#0A66C2"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  );
}

type Marca = ComponentType<{ className?: string; color?: string; title?: string }>;

/** Marcas oficiais nas cores oficiais (`color="default"` = cor da própria marca). */
const REDES: { nome: string; Icone: Marca }[] = [
  { nome: "Instagram", Icone: SiInstagram as Marca },
  { nome: "Facebook", Icone: SiFacebook as Marca },
  { nome: "WhatsApp", Icone: SiWhatsapp as Marca },
  { nome: "TikTok", Icone: SiTiktok as Marca },
  { nome: "YouTube", Icone: SiYoutube as Marca },
  { nome: "LinkedIn", Icone: SiLinkedIn },
  { nome: "Google", Icone: SiGoogle as Marca },
];

/**
 * Automações de marketing nas redes sociais, anunciada no menu com "Em breve"
 * (pedido do dono, 21/10/2026). Só a prévia: nada conecta conta nem publica.
 */
function Pagina() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Workflow className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Automações</h1>
          <p className="text-sm text-muted-foreground">
            Divulgue nas redes sociais direto do Agilliza.
          </p>
        </div>
      </div>
      <section className="rounded-2xl border bg-card px-4 pb-6 pt-8 text-center shadow-sm sm:px-8 sm:pt-10">
        <span className="inline-flex h-[26px] items-center gap-[7px] rounded-full bg-[rgb(242_182_87/0.16)] pl-[9px] pr-[11px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9a5b00] shadow-[inset_0_0_0_1px_rgb(242_182_87/0.45)]">
          <span className="selo-em-breve-ponto" aria-hidden />
          Em breve
        </span>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          Suas redes, num lugar só
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Estamos preparando as automações de marketing: seus conteúdos viram posts prontos para as
          suas redes, sem sair da plataforma.
        </p>
        <ul
          aria-label="Redes previstas"
          className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2 sm:gap-3"
        >
          {REDES.map(({ nome, Icone }) => (
            <li
              key={nome}
              className="flex w-[calc((100%-24px)/4)] flex-col items-center gap-2 rounded-xl border bg-background px-1 pb-2.5 pt-3 shadow-[0_10px_24px_-20px_rgb(0_15_159/0.45)] sm:w-[96px] sm:px-2 sm:pb-3.5 sm:pt-4"
            >
              <span className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-muted/60 sm:h-12 sm:w-12">
                <Icone className="h-7 w-7" color="default" title={nome} />
              </span>
              <span className="text-[11.5px] font-medium text-foreground sm:text-[12.5px]">
                {nome}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
