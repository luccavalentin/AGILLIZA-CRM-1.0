import type { CapacitorConfig } from "@capacitor/cli";

/**
 * O app das lojas é o próprio sistema, carregado do servidor.
 *
 * Não há uma segunda base de código para manter: a tela que o corretor abre
 * no celular é a mesma que roda no navegador, com as mesmas regras e a mesma
 * segurança no banco. Alterações no conteúdo remoto também devem obedecer
 * às políticas da loja; alterações nativas exigem novo pacote e revisão.
 *
 * A URL vem de `AGILLIZA_CRM_URL` na hora do `cap sync`. O padrão é o domínio de
 * produção e usa o mesmo host canônico durante toda a sessão.
 */
const url = process.env.AGILLIZA_CRM_URL ?? "https://crm.agillizatech.com.br/auth";
if (new URL(url).protocol !== "https:") throw new Error("O aplicativo exige uma URL HTTPS.");

const config: CapacitorConfig = {
  appId: "br.com.agillizatech.correspondente",
  appName: "Agilliza",
  webDir: "www",
  server: {
    url,
    // Só HTTPS: o app carrega dado financeiro e documento de cliente.
    cleartext: false,
    // Links para fora (WhatsApp, Instagram, mapa) abrem no app de cada um,
    // não dentro da casca. Dentro fica só o próprio sistema.
    allowNavigation: [new URL(url).host],
    errorPath: "offline.html",
  },
  android: {
    appendUserAgent: " AgillizaCorrespondente/1",
    adjustMarginsForEdgeToEdge: "force",
    allowMixedContent: false,
    // Gravar áudio no chat e fotografar a vistoria pedem a câmera e o
    // microfone; o WebView repassa o pedido para o sistema.
    captureInput: true,
  },
  ios: {
    contentInset: "automatic",
    // Mesma identificação do Android: o servidor bloqueia compra de serviço digital
    // dentro do app de loja (consulta paga, créditos, plano). A Apple exige compra
    // integrada para isso; vender pelo Asaas dentro do app seria motivo de recusa.
    appendUserAgent: " AgillizaCorrespondente/ios",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#000f9f",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000f9f",
    },
  },
};

export default config;
