/**
 * Marca de cada provedor nas telas de Configurações gerais e de Monitoramento.
 *
 * Só usa logo oficial quando o pacote de marcas do projeto (`@icons-pack/react-simple-icons`,
 * o mesmo de `components/tecnologia/marcas.tsx`) traz a marca. Os demais (integração bancária,
 * birôs, Asaas, SendPulse…) ficam com um ícone de traço fino que diz a CATEGORIA — nada de
 * logo desenhado à mão. A integração bancária nunca mostra o nome do fornecedor.
 */
import { SiGooglegemini, SiResend } from "@icons-pack/react-simple-icons";
import {
  Bot,
  Building2,
  Landmark,
  Mail,
  MapPin,
  Receipt,
  ScanSearch,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { IconeGestao, type Tom } from "@/components/plataforma/kit";

type Marca = ComponentType<{ className?: string; color?: string; title?: string }>;

interface InfoMarca {
  nome: string;
  oficial?: Marca;
  icone: ReactNode;
  tom: Tom;
}

const MARCAS: Record<string, InfoMarca> = {
  homefin: { nome: "Integração bancária", icone: <Landmark />, tom: "marca" },
  serasa: { nome: "Serasa Experian", icone: <ShieldCheck />, tom: "info" },
  spc: { nome: "SPC Brasil", icone: <ShieldCheck />, tom: "info" },
  boavista: { nome: "Boa Vista (SCPC)", icone: <ShieldCheck />, tom: "info" },
  apifull: { nome: "APIFull", icone: <ScanSearch />, tom: "info" },
  bigdatacorp: { nome: "BigDataCorp", icone: <ScanSearch />, tom: "info" },
  serpro: { nome: "Serpro", icone: <Building2 />, tom: "info" },
  asaas: { nome: "Asaas", icone: <Receipt />, tom: "sucesso" },
  email: { nome: "E-mail transacional", icone: <Mail />, tom: "marca" },
  sendpulse: { nome: "SendPulse", icone: <Mail />, tom: "marca" },
  resend: { nome: "Resend", oficial: SiResend as Marca, icone: <Mail />, tom: "neutro" },
  gemini: { nome: "Gemini", oficial: SiGooglegemini as Marca, icone: <Bot />, tom: "neutro" },
  openai: { nome: "OpenAI", icone: <Bot />, tom: "neutro" },
  viacep: { nome: "ViaCEP", icone: <MapPin />, tom: "neutro" },
};

/** Nome de exibição de um código de provedor (o banco grava em minúsculas). */
export function nomeDoProvedor(codigo: string): string {
  const m = MARCAS[codigo];
  if (m) return m.nome;
  return codigo ? codigo.charAt(0).toUpperCase() + codigo.slice(1).replace(/_/g, " ") : "—";
}

export function MarcaProvedor({
  codigo,
  tamanho = "md",
}: {
  codigo: string;
  tamanho?: "sm" | "md" | "lg";
}) {
  const m = MARCAS[codigo];
  if (m?.oficial) {
    const Oficial = m.oficial;
    return <IconeGestao tom="neutro" tamanho={tamanho} icone={<Oficial color="default" title={m.nome} />} />;
  }
  return <IconeGestao tom={m?.tom ?? "neutro"} tamanho={tamanho} icone={m?.icone ?? <Webhook />} />;
}
