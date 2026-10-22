// Tipos mínimos do `mailparser` (o pacote não traz os próprios). Só o que o leitor
// de códigos usa: `simpleParser` sobre o e-mail bruto.
declare module "mailparser" {
  export interface EnderecoMail {
    address?: string;
    name?: string;
  }
  export interface EmailLido {
    subject?: string;
    text?: string;
    html?: string | false;
    date?: Date;
    messageId?: string;
    from?: { value?: EnderecoMail[]; text?: string };
  }
  export function simpleParser(fonte: Buffer | string): Promise<EmailLido>;
}
