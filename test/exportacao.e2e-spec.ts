import JSZip from 'jszip';
import request from 'supertest';
import { AVISO_REVISAO_PADRAO } from '../src/modules/ia/ia.service';
import { AppTeste, criarAppTeste } from './helpers/app-teste';
import {
  bearer,
  criarAprendente,
  criarTerapeuta,
  Terapeuta,
} from './helpers/fabrica';
import { gerarPng } from './helpers/png';

const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MENSAGEM_413 = 'O conteúdo enviado excede o tamanho máximo permitido.';

// Lê o corpo binário inteiro como Buffer (o supertest não faz isso para .docx).
function lerBinario(
  res: request.Response,
  cb: (err: Error | null, body: Buffer) => void,
) {
  const partes: Buffer[] = [];
  res.on('data', (parte: Buffer) => partes.push(parte));
  res.on('end', () => cb(null, Buffer.concat(partes)));
}

describe('D. Exportação', () => {
  let ctx: AppTeste;
  let t: Terapeuta;
  let aprendenteId: string;

  beforeAll(async () => {
    ctx = await criarAppTeste();
    t = await criarTerapeuta(ctx);
    aprendenteId = (
      await criarAprendente(ctx, t, { nomeCompleto: 'Júlia Exportação' })
    ).id;
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  describe('POST /aprendentes/:id/exportar-docx', () => {
    it('gera um .docx que, aberto como zip, contém o título, o texto do relatório e as 3 imagens PNG enviadas', async () => {
      const graficos = [
        { titulo: 'Evolução do score', png: gerarPng(800, 400, [37, 99, 235]) },
        { titulo: 'Frequência mensal', png: gerarPng(600, 300, [22, 163, 74]) },
        {
          titulo: 'Linha de base x intervenção',
          png: gerarPng(400, 400, [220, 38, 38]),
        },
      ];
      const paragrafo1 =
        'Primeiro parágrafo do relatório: evolução consistente na leitura.';
      const paragrafo2 =
        'Segundo parágrafo: recomenda-se manter o nível de dificuldade.';

      const res = await ctx.api
        .post(`/aprendentes/${aprendenteId}/exportar-docx`)
        .set(bearer(t.token))
        .send({
          nomeAprendente: 'Júlia Exportação',
          resumoIa: `${paragrafo1}\n\n${paragrafo2}`,
          graficos: graficos.map((g) => ({
            titulo: g.titulo,
            imagemBase64: g.png.toString('base64'),
          })),
        })
        .buffer(true)
        .parse(lerBinario)
        .expect(201);

      expect(res.headers['content-type']).toContain(MIME_DOCX);
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="relatorio-julia-exportacao.docx"',
      );

      const docx = await JSZip.loadAsync(res.body as Buffer);
      const documentXml = await docx.file('word/document.xml')!.async('string');
      expect(documentXml).toContain(
        'Relatório de Acompanhamento — Júlia Exportação',
      );
      expect(documentXml).toContain(paragrafo1);
      expect(documentXml).toContain(paragrafo2);
      for (const g of graficos) expect(documentXml).toContain(g.titulo);
      // Aviso de revisão profissional padrão no fim do relatório.
      expect(documentXml).toContain(AVISO_REVISAO_PADRAO);

      const imagens = docx.file(/^word\/media\/.+\.png$/);
      expect(imagens).toHaveLength(3);
      const conteudos = await Promise.all(
        imagens.map((f) => f.async('nodebuffer')),
      );
      for (const g of graficos) {
        expect(conteudos.some((c) => c.equals(g.png))).toBe(true);
      }
      expect((documentXml.match(/<pic:pic\b/g) ?? []).length).toBe(3);
    });

    it('aceita nesta rota um corpo acima de 100kb (limite próprio de 15mb)', async () => {
      const resumoGrande = Array.from(
        { length: 2000 },
        (_, i) =>
          `Parágrafo ${i} do relatório com conteúdo suficiente para crescer.`,
      ).join('\n\n');
      expect(Buffer.byteLength(resumoGrande)).toBeGreaterThan(100 * 1024);

      await ctx.api
        .post(`/aprendentes/${aprendenteId}/exportar-docx`)
        .set(bearer(t.token))
        .send({ nomeAprendente: 'Júlia', resumoIa: resumoGrande, graficos: [] })
        .buffer(true)
        .parse(lerBinario)
        .expect(201);
    });

    it('rejeita com 400 uma imagem que não é PNG', async () => {
      const res = await ctx.api
        .post(`/aprendentes/${aprendenteId}/exportar-docx`)
        .set(bearer(t.token))
        .send({
          nomeAprendente: 'Júlia',
          resumoIa: 'Texto',
          graficos: [
            {
              titulo: 'Falso',
              imagemBase64: Buffer.from('GIF89a-nao-e-png-de-verdade').toString(
                'base64',
              ),
            },
          ],
        })
        .expect(400);
      expect(res.body.message).toMatch(/PNG/);
    });

    it('rejeita com 413 um corpo acima de 15mb, sem expor detalhes internos', async () => {
      const res = await ctx.api
        .post(`/aprendentes/${aprendenteId}/exportar-docx`)
        .set(bearer(t.token))
        .set('Content-Type', 'application/json')
        .send(
          JSON.stringify({
            nomeAprendente: 'Júlia',
            resumoIa: 'a'.repeat(15 * 1024 * 1024 + 1024),
            graficos: [],
          }),
        )
        .expect(413);
      expect(res.body.message).toBe(MENSAGEM_413);
      expect(JSON.stringify(res.body)).not.toMatch(
        /stack|PayloadTooLargeError|node_modules/,
      );
    });
  });

  describe('Limite de 100kb nas demais rotas', () => {
    const corpoAcimaDe100kb = () =>
      JSON.stringify({
        nomeCompleto: 'x'.repeat(101 * 1024),
        dataNascimento: '2016-01-01',
        responsavel: 'r',
        contato: 'c',
      });

    it.each([
      ['POST /aprendentes', '/aprendentes'],
      ['POST /tarefas', '/tarefas'],
      ['POST /auth/login', '/auth/login'],
      ['POST /usuarios', '/usuarios'],
    ])('rejeita com 413 um corpo acima de 100kb em %s', async (_rota, url) => {
      const res = await ctx.api
        .post(url)
        .set(bearer(t.token))
        .set('Content-Type', 'application/json')
        .send(corpoAcimaDe100kb())
        .expect(413);
      expect(res.body.message).toBe(MENSAGEM_413);
    });

    it('rejeita com 413 também no PATCH (PATCH /tarefas/:id)', async () => {
      await ctx.api
        .patch('/tarefas/00000000-0000-0000-0000-000000000000')
        .set(bearer(t.token))
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ notas: 'n'.repeat(101 * 1024) }))
        .expect(413);
    });

    it('aceita um corpo logo abaixo de 100kb (controle)', async () => {
      await ctx.api
        .post('/tarefas')
        .set(bearer(t.token))
        .send({ texto: 'Tarefa longa', notas: 'n'.repeat(90 * 1024) })
        .expect(201);
    });

    it('nenhum dado foi gravado pelas requisições rejeitadas com 413', async () => {
      expect(await ctx.prisma.aprendente.count()).toBe(1);
      expect(await ctx.prisma.tarefa.count()).toBe(1);
    });
  });
});
