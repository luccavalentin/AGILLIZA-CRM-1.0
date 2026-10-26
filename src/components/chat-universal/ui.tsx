"use client";

/**
 * Peças de interface do chat universal, próprias da pasta (portável entre o Agilliza Tech
 * e o Agilliza correspondente): janela, botão, aviso e estado vazio, no traço fino do
 * padrão Agilliza (borda de 1 px, raio até 14 px, azul #000F9F só no que é ação).
 */
import clsx from "clsx";
import { useEffect, useRef, type ReactNode } from "react";
import { Loader2, MessageCircle, X } from "lucide-react";

export function Botao({
  children,
  variante = "primario",
  carregando,
  className,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "perigo" | "fantasma";
  carregando?: boolean;
}) {
  return (
    <button
      type="button"
      {...resto}
      disabled={resto.disabled || carregando}
      className={clsx("cu-botao", `cu-botao-${variante}`, className)}
    >
      {carregando && <Loader2 className="cu-girar" aria-hidden size={16} />}
      {children}
    </button>
  );
}

export function Aviso({
  tom = "info",
  children,
}: {
  tom?: "info" | "perigo" | "sucesso";
  children: ReactNode;
}) {
  return (
    <div
      className={clsx("cu-aviso", `cu-aviso-${tom}`)}
      role={tom === "perigo" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function Vazio({
  titulo,
  texto,
  icone,
}: {
  titulo: string;
  texto?: string;
  icone?: ReactNode;
}) {
  return (
    <div className="cu-vazio">
      {icone ? (
        <span className="cu-vazio-3d" aria-hidden>
          {icone}
        </span>
      ) : (
        <span className="cu-vazio-icone" aria-hidden>
          <MessageCircle size={22} />
        </span>
      )}
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
    </div>
  );
}

/** Janela sobre a tela (folha de baixo no celular). Esc e clique fora fecham. */
export function Modal({
  titulo,
  descricao,
  children,
  rodape,
  onFechar,
  largura = "md",
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
  onFechar: () => void;
  largura?: "sm" | "md" | "lg";
}) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    return () => {
      document.removeEventListener("keydown", esc);
      anterior?.focus?.();
    };
  }, [onFechar]);
  return (
    <div className="cu-modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={clsx("cu-modal", `cu-modal-${largura}`)}
      >
        <header className="cu-modal-topo">
          <div className="cu-modal-titulos">
            <b>{titulo}</b>
            {descricao && <small>{descricao}</small>}
          </div>
          <button
            type="button"
            className="ec-icone sem-toque"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="cu-modal-corpo">{children}</div>
        {rodape && <footer className="cu-modal-rodape">{rodape}</footer>}
      </div>
    </div>
  );
}

/** Avatar: foto (quando há) ou iniciais na cor da marca, com o ponto de online. */
export function Avatar({
  nome,
  url,
  online,
  tamanho = 44,
  grupo,
}: {
  nome: string;
  url?: string | null;
  online?: boolean;
  tamanho?: number;
  grupo?: boolean;
}) {
  const ini =
    nome
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((p) => p.length > 1)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      className={clsx("ec-foto cu-avatar", grupo && "cu-avatar-grupo")}
      style={{ width: tamanho, height: tamanho }}
    >
      {url ? <img src={url} alt="" loading="lazy" /> : <span aria-hidden>{ini}</span>}
      {online && <span className="ec-online" aria-label="online" />}
    </span>
  );
}
