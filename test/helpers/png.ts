import * as zlib from 'zlib';

// Gera um PNG válido (RGB, 8 bits) de cor sólida, sem dependências: faz o
// papel do gráfico que o frontend captura da tela.
export function gerarPng(
  largura: number,
  altura: number,
  rgb: [number, number, number],
): Buffer {
  const linha = Buffer.alloc(1 + largura * 3);
  for (let x = 0; x < largura; x++) linha.set(rgb, 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: altura }, () => linha));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const tipoEDados = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(tipoEDados));
  return Buffer.concat([tamanho, tipoEDados, crc]);
}
