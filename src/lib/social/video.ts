/*
 * Porte de `apps/web/src/lib/video.ts` do Agilliza Tech (Corretor): o tipo declarado do vídeo
 * precisa bater com os primeiros bytes, e a duração é lida do PRÓPRIO arquivo (a da tela pode
 * ser forjada). Usado no envio de vídeo das Automações. Ao mudar lá, mude aqui.
 */

export function confere(b: Buffer, mime: string): boolean {
  const ini = (bytes: number[]) => bytes.every((x, i) => b[i] === x);
  switch (mime) {
    case "image/jpeg":
      return ini([0xff, 0xd8, 0xff]);
    case "image/png":
      return ini([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";
    case "video/webm":
      return ini([0x1a, 0x45, 0xdf, 0xa3]);
    case "video/mp4":
    case "video/quicktime":
      // ISO BMFF: a caixa "ftyp" (ou "moov"/"wide"/"mdat" nos .mov antigos) nos 4 bytes depois do tamanho.
      return ["ftyp", "moov", "wide", "mdat", "free"].includes(b.toString("latin1", 4, 8));
    default:
      return false;
  }
}

/**
 * Duração do vídeo lida do PRÓPRIO arquivo (backteste 23/10: a duração vinha só da tela, e
 * quem mandava `duracao_ms=1000` subia um vídeo de 10 minutos). MP4/MOV: caixa `mvhd`
 * dentro de `moov` (no começo ou no fim do arquivo). WebM: `Duration` × `TimecodeScale`
 * no cabeçalho.
 *
 * C2 (0292): sem a duração no cabeçalho (MP4 fragmentado, WebM gravado ao vivo), ela é
 * MEDIDA pelo arquivo — MP4: `mehd` ou a soma das amostras dos fragmentos (`moof/traf`);
 * WebM: o último `Cluster` + o último bloco dele. Antes valia a duração da tela, que pode
 * ser forjada. Sem conseguir medir, devolve null — e a rota recusa o vídeo.
 *
 * D1 (reauditoria de 25/10/2026): o cabeçalho (`mvhd`, `mehd`, `Duration`) é escrito por quem
 * envia e vencia a medida — `mehd` = 1 s num arquivo com 600 s de fragmentos passava. Agora
 * vale a MAIOR entre o cabeçalho e a soma real: amostras de cada faixa (`stts`), fragmentos
 * (`moof/traf/trun`) e, no WebM, os clusters.
 */
export function duracaoDoVideo(b: Buffer, mime: string): number | null {
  try {
    if (mime === "video/webm") return maior(duracaoWebm(b), duracaoWebmPelosClusters(b));
    return maior(duracaoMp4(b), duracaoMp4PelasAmostras(b), duracaoMp4Fragmentado(b));
  } catch {
    return null;
  }
}

/** A maior das durações conhecidas (null se nenhuma). */
function maior(...ds: (number | null)[]): number | null {
  let m: number | null = null;
  for (const d of ds) if (d != null && Number.isFinite(d) && d > 0 && (m == null || d > m)) m = d;
  return m;
}

/** MP4 comum: a soma das durações das amostras (`stbl/stts`) de cada faixa, na escala do `mdhd`. */
function duracaoMp4PelasAmostras(b: Buffer): number | null {
  const moov = primeiraMp4(b, 0, b.length, "moov");
  if (!moov) return null;
  let ms = 0;
  for (const [t, i, f] of caixasMp4(b, moov[0], moov[1])) {
    if (t !== "trak") continue;
    const mdia = primeiraMp4(b, i, f, "mdia");
    const mdhd = mdia && primeiraMp4(b, mdia[0], mdia[1], "mdhd");
    const minf = mdia && primeiraMp4(b, mdia[0], mdia[1], "minf");
    const stbl = minf && primeiraMp4(b, minf[0], minf[1], "stbl");
    const st = stbl && primeiraMp4(b, stbl[0], stbl[1], "stts");
    if (!mdhd || !st) continue;
    const escala = campo(b, mdhd[0], 12, 20);
    if (!escala) continue;
    const n = b.readUInt32BE(st[0] + 4);
    let soma = 0;
    for (let k = 0, q = st[0] + 8; k < n && q + 8 <= st[1]; k++, q += 8)
      soma += b.readUInt32BE(q) * b.readUInt32BE(q + 4);
    if (soma > 0) ms = Math.max(ms, Math.round((soma / escala) * 1000));
  }
  return ms > 0 ? ms : null;
}

/** As caixas ISO BMFF entre `ini` e `fim`: [tipo, início do conteúdo, fim]. */
function* caixasMp4(b: Buffer, ini: number, fim: number): Generator<[string, number, number]> {
  let p = ini;
  while (p + 8 <= fim) {
    let tam = b.readUInt32BE(p);
    const tipo = b.toString("latin1", p + 4, p + 8);
    let cab = 8;
    if (tam === 1) {
      if (p + 16 > fim) return;
      tam = b.readUInt32BE(p + 8) * 2 ** 32 + b.readUInt32BE(p + 12);
      cab = 16;
    } else if (tam === 0) {
      tam = fim - p;
    }
    if (tam < cab) return;
    yield [tipo, p + cab, Math.min(p + tam, fim)];
    p += tam;
  }
}

function primeiraMp4(b: Buffer, ini: number, fim: number, alvo: string): [number, number] | null {
  for (const [t, i, f] of caixasMp4(b, ini, fim)) if (t === alvo) return [i, f];
  return null;
}

/** Campo de 32 bits de uma caixa "cheia" (versão 0) ou o equivalente da versão 1. */
const campo = (b: Buffer, i: number, v0: number, v1: number) =>
  b.readUInt32BE(i + (b[i] === 1 ? v1 : v0));

/** MP4 fragmentado: o maior entre `mvex/mehd` e a soma das durações das amostras de cada faixa. */
function duracaoMp4Fragmentado(b: Buffer): number | null {
  let cabecalho: number | null = null;
  const moov = primeiraMp4(b, 0, b.length, "moov");
  if (!moov) return null;
  const mvhd = primeiraMp4(b, moov[0], moov[1], "mvhd");
  const escalaFilme = mvhd ? campo(b, mvhd[0], 12, 20) : 0;
  const escalas = new Map<number, number>(); // faixa → escala (mdhd)
  const padrao = new Map<number, number>(); // faixa → duração padrão da amostra (trex)
  for (const [t, i, f] of caixasMp4(b, moov[0], moov[1])) {
    if (t === "trak") {
      const tkhd = primeiraMp4(b, i, f, "tkhd");
      const mdia = primeiraMp4(b, i, f, "mdia");
      const mdhd = mdia && primeiraMp4(b, mdia[0], mdia[1], "mdhd");
      if (!tkhd || !mdhd) continue;
      escalas.set(campo(b, tkhd[0], 12, 20), campo(b, mdhd[0], 12, 20));
    } else if (t === "mvex") {
      for (const [t2, i2] of caixasMp4(b, i, f)) {
        if (t2 === "mehd" && escalaFilme) {
          const d = b[i2] === 1 ? Number(b.readBigUInt64BE(i2 + 4)) : b.readUInt32BE(i2 + 4);
          // D1: o `mehd` é só um candidato; a soma dos fragmentos pode ser maior.
          if (d > 0 && d !== 0xffffffff) cabecalho = Math.round((d / escalaFilme) * 1000);
        }
        if (t2 === "trex") padrao.set(b.readUInt32BE(i2 + 4), b.readUInt32BE(i2 + 12));
      }
    }
  }
  const total = new Map<number, number>();
  for (const [t, i, f] of caixasMp4(b, 0, b.length)) {
    if (t !== "moof") continue;
    for (const [t2, i2, f2] of caixasMp4(b, i, f)) {
      if (t2 !== "traf") continue;
      let faixa = 0;
      let dPadrao = 0;
      for (const [t3, i3, f3] of caixasMp4(b, i2, f2)) {
        if (t3 === "tfhd") {
          const flags = b.readUInt32BE(i3) & 0xffffff;
          faixa = b.readUInt32BE(i3 + 4);
          let q = i3 + 8;
          if (flags & 0x01) q += 8;
          if (flags & 0x02) q += 4;
          dPadrao = flags & 0x08 && q + 4 <= f3 ? b.readUInt32BE(q) : (padrao.get(faixa) ?? 0);
        } else if (t3 === "trun") {
          const flags = b.readUInt32BE(i3) & 0xffffff;
          const n = b.readUInt32BE(i3 + 4);
          let q = i3 + 8;
          if (flags & 0x01) q += 4;
          if (flags & 0x04) q += 4;
          let soma = 0;
          if (flags & 0x100) {
            const passo =
              4 * (1 + (flags & 0x200 ? 1 : 0) + (flags & 0x400 ? 1 : 0) + (flags & 0x800 ? 1 : 0));
            for (let k = 0; k < n && q + 4 <= f3; k++, q += passo) soma += b.readUInt32BE(q);
          } else soma = n * dPadrao;
          total.set(faixa, (total.get(faixa) ?? 0) + soma);
        }
      }
    }
  }
  let ms = 0;
  for (const [faixa, d] of total) {
    const escala = escalas.get(faixa);
    if (escala && d > 0) ms = Math.max(ms, Math.round((d / escala) * 1000));
  }
  return maior(cabecalho, ms > 0 ? ms : null);
}

/** EBML: inteiro de tamanho variável em `p` → [valor, bytes] (valor -1 = tamanho desconhecido). */
function vintEbml(b: Buffer, p: number): [number, number] | null {
  const x = b[p];
  if (x === undefined || x === 0) return null;
  let n = 1;
  while (!(x & (0x80 >> (n - 1)))) n++;
  if (n > 8 || p + n > b.length) return null;
  let v = x & (0xff >> n);
  let tudoUm = v === 0xff >> n;
  for (let k = 1; k < n; k++) {
    v = v * 256 + b[p + k]!;
    if (b[p + k] !== 0xff) tudoUm = false;
  }
  return [tudoUm ? -1 : v, n];
}

/** WebM sem `Duration`: o maior `Cluster/Timecode` + o tempo do último bloco do cluster. */
function duracaoWebmPelosClusters(b: Buffer): number | null {
  let escalaNs = 1_000_000;
  for (let p = 0; p + 4 < Math.min(b.length, 256 * 1024); p++) {
    if (b[p] === 0x2a && b[p + 1] === 0xd7 && b[p + 2] === 0xb1) {
      const t = vintEbml(b, p + 3);
      if (t && t[0] > 0 && t[0] <= 8) {
        let v = 0;
        for (let k = 0; k < t[0]; k++) v = v * 256 + (b[p + 3 + t[1] + k] ?? 0);
        if (v > 0) escalaNs = v;
      }
      break;
    }
  }
  let maior = -1;
  for (let p = 0; p + 8 < b.length; p++) {
    if (b[p] !== 0x1f || b[p + 1] !== 0x43 || b[p + 2] !== 0xb6 || b[p + 3] !== 0x75) continue;
    const tamCluster = vintEbml(b, p + 4);
    if (!tamCluster) continue;
    let q = p + 4 + tamCluster[1];
    const fimCluster = tamCluster[0] < 0 ? b.length : Math.min(b.length, q + tamCluster[0]);
    // o primeiro filho do Cluster é o Timecode (E7)
    if (b[q] !== 0xe7) continue;
    const tamTc = vintEbml(b, q + 1);
    if (!tamTc || tamTc[0] < 1 || tamTc[0] > 8) continue;
    let tc = 0;
    for (let k = 0; k < tamTc[0]; k++) tc = tc * 256 + (b[q + 1 + tamTc[1] + k] ?? 0);
    // Cluster falso (os mesmos bytes por acaso dentro de um quadro): o tempo tem de andar para
    // a frente, sem saltos de mais de 10 minutos.
    const tcMs = (tc * escalaNs) / 1_000_000;
    if (maior >= 0 && (tcMs < maior - 60_000 || tcMs - maior > 600_000)) continue;
    let fimBloco = tcMs;
    q += 1 + tamTc[1] + tamTc[0];
    // os blocos do cluster: SimpleBlock (A3), com o tempo relativo (int16) depois da faixa
    while (q < fimCluster) {
      const id = b[q];
      const tam = vintEbml(b, q + 1);
      if (id === undefined || !tam || tam[0] < 0) break;
      const ini = q + 1 + tam[1];
      if (id === 0xa3) {
        const faixa = vintEbml(b, ini);
        if (faixa && ini + faixa[1] + 2 <= b.length)
          fimBloco = Math.max(
            fimBloco,
            tcMs + (b.readInt16BE(ini + faixa[1]) * escalaNs) / 1_000_000,
          );
      } else if (id !== 0xa0 && id !== 0xa7 && id !== 0xab) break;
      q = ini + tam[0];
    }
    maior = Math.max(maior, fimBloco);
    p = Math.max(p, Math.min(q, fimCluster) - 1);
  }
  return maior > 0 ? Math.round(maior) : null;
}

function duracaoMp4(b: Buffer): number | null {
  const caixa = (ini: number, fim: number, alvo: string): [number, number] | null => {
    let p = ini;
    while (p + 8 <= fim) {
      let tam = b.readUInt32BE(p);
      const tipo = b.toString("latin1", p + 4, p + 8);
      let cab = 8;
      if (tam === 1) {
        if (p + 16 > fim) return null;
        tam = b.readUInt32BE(p + 8) * 2 ** 32 + b.readUInt32BE(p + 12);
        cab = 16;
      } else if (tam === 0) {
        tam = fim - p;
      }
      if (tam < cab) return null;
      if (tipo === alvo) return [p + cab, Math.min(p + tam, fim)];
      p += tam;
    }
    return null;
  };
  const moov = caixa(0, b.length, "moov");
  if (!moov) return null;
  const mvhd = caixa(moov[0], moov[1], "mvhd");
  if (!mvhd) return null;
  const [i, f] = mvhd;
  const versao = b[i];
  let escala: number;
  let duracao: number;
  if (versao === 1) {
    if (i + 32 > f) return null;
    escala = b.readUInt32BE(i + 20);
    duracao = Number(b.readBigUInt64BE(i + 24));
  } else {
    if (i + 20 > f) return null;
    escala = b.readUInt32BE(i + 12);
    duracao = b.readUInt32BE(i + 16);
  }
  // 0xFFFFFFFF (ou tudo 1) = "desconhecida" nos fragmentados.
  if (!escala || !duracao || duracao === 0xffffffff || !Number.isFinite(duracao)) return null;
  return Math.round((duracao / escala) * 1000);
}

function duracaoWebm(b: Buffer): number | null {
  const fim = Math.min(b.length, 256 * 1024);
  let escalaNs = 1_000_000;
  let bruto: number | null = null;
  for (let p = 0; p + 4 < fim; p++) {
    // TimecodeScale (2A D7 B1) com tamanho de 1 byte (0x8n): inteiro sem sinal.
    if (b[p] === 0x2a && b[p + 1] === 0xd7 && b[p + 2] === 0xb1) {
      const n = (b[p + 3] ?? 0) & 0x0f;
      if ((b[p + 3] ?? 0) >= 0x81 && (b[p + 3] ?? 0) <= 0x88 && p + 4 + n <= fim) {
        let v = 0;
        for (let k = 0; k < n; k++) v = v * 256 + (b[p + 4 + k] ?? 0);
        if (v > 0) escalaNs = v;
      }
    }
    // Duration (44 89) como float de 4 (0x84) ou 8 (0x88) bytes.
    if (b[p] === 0x44 && b[p + 1] === 0x89) {
      if (b[p + 2] === 0x88 && p + 11 <= fim) bruto = b.readDoubleBE(p + 3);
      else if (b[p + 2] === 0x84 && p + 7 <= fim) bruto = b.readFloatBE(p + 3);
    }
  }
  if (bruto == null || !Number.isFinite(bruto) || bruto <= 0) return null;
  return Math.round((bruto * escalaNs) / 1_000_000);
}
