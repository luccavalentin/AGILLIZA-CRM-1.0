/**
 * Marcas oficiais dos serviços e navegadores que aparecem na Gestão de Tecnologia
 * (mesmo pacote das marcas das redes, `@icons-pack/react-simple-icons`). Marca que o
 * pacote não traz (Edge, Windows, APIFull, PgBouncer) cai num ícone neutro de traço fino.
 */
import {
  SiAndroid,
  SiApple,
  SiCaddy,
  SiCloudflare,
  SiDocker,
  SiFirefoxbrowser,
  SiGooglechrome,
  SiLetsencrypt,
  SiLinux,
  SiNodedotjs,
  SiOpera,
  SiPostgresql,
  SiSafari,
  SiSamsung,
} from "@icons-pack/react-simple-icons";
import { Box, Cpu, Globe, Monitor, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import logoSimbolo from "@/assets/brand/agilliza-symbol-oficial.png";

type Marca = ComponentType<{ className?: string; color?: string; title?: string }>;

export type Servico =
  | "postgres"
  | "docker"
  | "letsencrypt"
  | "cloudflare"
  | "node"
  | "caddy"
  | "apifull"
  | "agilliza"
  | "corretor";

const SERVICOS: Partial<Record<Servico, Marca>> = {
  postgres: SiPostgresql as Marca,
  docker: SiDocker as Marca,
  letsencrypt: SiLetsencrypt as Marca,
  cloudflare: SiCloudflare as Marca,
  node: SiNodedotjs as Marca,
  caddy: SiCaddy as Marca,
};

/**
 * Símbolo oficial da Agilliza (versão azul). A área de conteúdo do Agilliza é sempre clara —
 * no "modo escuro" só o menu escurece (styles.css) —, então nunca a versão branca aqui.
 */
export function SimboloAgilliza({ className }: { className?: string }) {
  return <img src={logoSimbolo} alt="Agilliza" className={className} />;
}

export function MarcaServico({
  servico,
  className = "size-5",
}: {
  servico: Servico;
  className?: string;
}) {
  if (servico === "agilliza" || servico === "corretor") {
    // Fundo branco: o símbolo azul some sobre o tema escuro da central.
    return (
      <span
        className={cn("grid shrink-0 place-items-center rounded-[5px] bg-white p-[2px]", className)}
      >
        <SimboloAgilliza className="size-full object-contain" />
      </span>
    );
  }
  if (servico === "apifull")
    return <Wallet className={cn(className, "text-muted-foreground")} aria-label="APIFull" />;
  const M = SERVICOS[servico];
  if (!M) return <Box className={cn(className, "text-muted-foreground")} />;
  return <M className={className} color="default" title={servico} />;
}

const NAVEGADORES: [RegExp, Marca][] = [
  [/^Chrome/, SiGooglechrome as Marca],
  [/^Safari/, SiSafari as Marca],
  [/^Firefox/, SiFirefoxbrowser as Marca],
  [/^Opera/, SiOpera as Marca],
  [/^Samsung/, SiSamsung as Marca],
];

export function MarcaNavegador({
  nome,
  className = "size-3.5",
}: {
  nome: string | null;
  className?: string;
}) {
  const M = nome ? NAVEGADORES.find(([re]) => re.test(nome))?.[1] : undefined;
  if (!M) return <Globe className={cn(className, "text-muted-foreground")} aria-hidden />;
  return <M className={className} color="default" title={nome ?? undefined} />;
}

export function MarcaSistemaOp({
  nome,
  className = "size-3.5",
}: {
  nome: string | null;
  className?: string;
}) {
  if (nome === "Android")
    return <SiAndroid className={className} color="default" title="Android" />;
  if (nome === "iOS" || nome === "macOS")
    return <SiApple className={cn(className, "text-foreground")} title={nome} />;
  if (nome === "Linux")
    return <SiLinux className={cn(className, "text-foreground")} title="Linux" />;
  if (nome === "Windows")
    return <Monitor className={cn(className, "text-muted-foreground")} aria-label="Windows" />;
  return <Cpu className={cn(className, "text-muted-foreground")} aria-hidden />;
}
