import { AppTeste, criarAppTeste } from './helpers/app-teste';
import {
  bearer,
  criarAprendente,
  criarTerapeuta,
  Terapeuta,
} from './helpers/fabrica';
import { camposDe, esperarErroValidacao } from './helpers/erros';

// O audit log é gravado em fire-and-forget após a resposta: espera um pouco
// até o registro aparecer, em vez de depender da ordem de execução.
async function esperarAuditoria(
  ctx: AppTeste,
  filtro: { userId: string; action: string; resourceId?: string },
) {
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    const registro = await ctx.prisma.auditLog.findFirst({
      where: {
        ...filtro,
        action: filtro.action as 'CREATE' | 'UPDATE' | 'DELETE',
        resource: 'PEI_TEMPLATE',
      },
    });
    if (registro) return registro;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

describe('F. Ordenação de aprendentes e CRUD de modelos de PEI', () => {
  let ctx: AppTeste;

  beforeAll(async () => {
    ctx = await criarAppTeste();
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  describe('GET /aprendentes com ordenação', () => {
    let t: Terapeuta;
    let outro: Terapeuta;

    const nomes = (body: unknown) =>
      (body as { nomeCompleto: string }[]).map((a) => a.nomeCompleto);

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
      outro = await criarTerapeuta(ctx);

      // Criados fora de ordem, com maiúsculas/minúsculas e acentos misturados.
      await criarAprendente(ctx, t, {
        nomeCompleto: 'beatriz Lima',
        responsavel: 'Carlos Lima',
        contato: '(47) 3333-0000',
      });
      await criarAprendente(ctx, t, {
        nomeCompleto: 'Zélia Souza',
        responsavel: 'ana Souza',
        contato: '11 98888-7777',
      });
      await criarAprendente(ctx, t, {
        nomeCompleto: 'Álvaro Dias',
        responsavel: 'Bruno Dias',
        contato: '+5521912345678',
      });
      await criarAprendente(ctx, t, {
        nomeCompleto: 'Ana Prado',
        responsavel: 'Élio Prado',
        contato: '(11) 2222-1111',
      });

      // Excluído: não pode aparecer em nenhuma ordenação.
      const excluido = await criarAprendente(ctx, t, {
        nomeCompleto: 'Aaron Excluído',
      });
      await ctx.api
        .delete(`/aprendentes/${excluido.id}`)
        .set(bearer(t.token))
        .expect(204);

      // De outro terapeuta: também não pode aparecer.
      await criarAprendente(ctx, outro, { nomeCompleto: 'Abel Alheio' });
    });

    it('sem parâmetros ordena pelo nome, A→Z, sem diferenciar acento e maiúsculas', async () => {
      const res = await ctx.api
        .get('/aprendentes')
        .set(bearer(t.token))
        .expect(200);
      expect(nomes(res.body)).toEqual([
        'Álvaro Dias',
        'Ana Prado',
        'beatriz Lima',
        'Zélia Souza',
      ]);
    });

    it('sortBy=name&order=desc inverte a ordem', async () => {
      const res = await ctx.api
        .get('/aprendentes')
        .query({ sortBy: 'name', order: 'desc' })
        .set(bearer(t.token))
        .expect(200);
      expect(nomes(res.body)).toEqual([
        'Zélia Souza',
        'beatriz Lima',
        'Ana Prado',
        'Álvaro Dias',
      ]);
    });

    it('sortBy=guardianName ordena pelo responsável (asc e desc)', async () => {
      const asc = await ctx.api
        .get('/aprendentes')
        .query({ sortBy: 'guardianName' })
        .set(bearer(t.token))
        .expect(200);
      // ana Souza, Bruno Dias, Carlos Lima, Élio Prado
      expect(nomes(asc.body)).toEqual([
        'Zélia Souza',
        'Álvaro Dias',
        'beatriz Lima',
        'Ana Prado',
      ]);

      const desc = await ctx.api
        .get('/aprendentes')
        .query({ sortBy: 'guardianName', order: 'desc' })
        .set(bearer(t.token))
        .expect(200);
      expect(nomes(desc.body)).toEqual([
        'Ana Prado',
        'beatriz Lima',
        'Álvaro Dias',
        'Zélia Souza',
      ]);
    });

    it('sortBy=contact ordena pelos dígitos do telefone, ignorando a máscara', async () => {
      const res = await ctx.api
        .get('/aprendentes')
        .query({ sortBy: 'contact' })
        .set(bearer(t.token))
        .expect(200);
      // Dígitos: 1122221111, 11988887777, 4733330000, 5521912345678
      expect(nomes(res.body)).toEqual([
        'Ana Prado',
        'Zélia Souza',
        'beatriz Lima',
        'Álvaro Dias',
      ]);
      // A máscara volta intacta na resposta
      const [primeiro] = res.body as { contato: string }[];
      expect(primeiro.contato).toBe('(11) 2222-1111');
    });

    it('sortBy fora da whitelist responde 400', async () => {
      for (const sortBy of ['criadoEm', 'nomeCompleto', 'id; DROP TABLE x']) {
        const res = await ctx.api
          .get('/aprendentes')
          .query({ sortBy })
          .set(bearer(t.token))
          .expect(400);
        esperarErroValidacao(res.body);
        expect(camposDe(res.body)).toEqual(['sortBy']);
      }
    });

    it('order diferente de asc/desc responde 400', async () => {
      const res = await ctx.api
        .get('/aprendentes')
        .query({ order: 'ASC' })
        .set(bearer(t.token))
        .expect(400);
      expect(camposDe(res.body)).toEqual(['order']);
    });

    it('o outro terapeuta só vê os próprios aprendentes', async () => {
      const res = await ctx.api
        .get('/aprendentes')
        .query({ sortBy: 'name', order: 'desc' })
        .set(bearer(outro.token))
        .expect(200);
      expect(nomes(res.body)).toEqual(['Abel Alheio']);
    });
  });

  describe('CRUD de modelos de PEI (/pei-templates)', () => {
    let t: Terapeuta;
    let outro: Terapeuta;
    const ids: Record<string, string> = {};

    const titulos = (body: unknown) =>
      (body as { nome: string }[]).map((x) => x.nome);

    const criarModelo = async (nome: string, dono: Terapeuta = t) => {
      const res = await ctx.api
        .post('/pei-templates')
        .set(bearer(dono.token))
        .send({
          nome,
          dificuldades: `Dificuldades de ${nome}`,
          objetivos: `Objetivos de ${nome}`,
          estrategias: `Estratégias de ${nome}`,
        })
        .expect(201);
      return res.body as { id: string; nome: string };
    };

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
      outro = await criarTerapeuta(ctx);
      for (const nome of ['TDAH', 'discalculia', 'Ênfase leitura', 'Autismo']) {
        ids[nome] = (await criarModelo(nome)).id;
      }
      ids.alheio = (await criarModelo('Alheio', outro)).id;
    });

    it('registra a criação na auditoria', async () => {
      const registro = await esperarAuditoria(ctx, {
        userId: t.id,
        action: 'CREATE',
      });
      expect(registro).not.toBeNull();
    });

    it('lista em ordem alfabética pelo título por padrão, só do próprio terapeuta', async () => {
      const res = await ctx.api
        .get('/pei-templates')
        .set(bearer(t.token))
        .expect(200);
      expect(titulos(res.body)).toEqual([
        'Autismo',
        'discalculia',
        'Ênfase leitura',
        'TDAH',
      ]);
    });

    it('sortBy=title&order=desc inverte a ordem', async () => {
      const res = await ctx.api
        .get('/pei-templates')
        .query({ sortBy: 'title', order: 'desc' })
        .set(bearer(t.token))
        .expect(200);
      expect(titulos(res.body)).toEqual([
        'TDAH',
        'Ênfase leitura',
        'discalculia',
        'Autismo',
      ]);
    });

    it('sortBy fora da whitelist responde 400', async () => {
      const res = await ctx.api
        .get('/pei-templates')
        .query({ sortBy: 'nome' })
        .set(bearer(t.token))
        .expect(400);
      expect(camposDe(res.body)).toEqual(['sortBy']);
    });

    it('GET por id devolve o molde; de outro terapeuta ou inexistente é 404', async () => {
      const res = await ctx.api
        .get(`/pei-templates/${ids.TDAH}`)
        .set(bearer(t.token))
        .expect(200);
      expect(res.body).toMatchObject({ id: ids.TDAH, nome: 'TDAH' });

      await ctx.api
        .get(`/pei-templates/${ids.alheio}`)
        .set(bearer(t.token))
        .expect(404);
      await ctx.api
        .get('/pei-templates/00000000-0000-0000-0000-000000000000')
        .set(bearer(t.token))
        .expect(404);
    });

    it('PATCH edita parcialmente, valida o corpo e registra UPDATE na auditoria', async () => {
      const res = await ctx.api
        .patch(`/pei-templates/${ids.TDAH}`)
        .set(bearer(t.token))
        .send({ nome: 'TDAH revisado', objetivos: 'Atenção sustentada' })
        .expect(200);
      expect(res.body).toMatchObject({
        nome: 'TDAH revisado',
        objetivos: 'Atenção sustentada',
        estrategias: 'Estratégias de TDAH',
      });

      const invalido = await ctx.api
        .patch(`/pei-templates/${ids.TDAH}`)
        .set(bearer(t.token))
        .send({ nome: '', campoInventado: 'x' })
        .expect(400);
      expect(camposDe(invalido.body).sort()).toEqual([
        'campoInventado',
        'nome',
      ]);

      await ctx.api
        .patch(`/pei-templates/${ids.alheio}`)
        .set(bearer(t.token))
        .send({ nome: 'Invasão' })
        .expect(404);

      const registro = await esperarAuditoria(ctx, {
        userId: t.id,
        action: 'UPDATE',
        resourceId: ids.TDAH,
      });
      expect(registro).not.toBeNull();
    });

    it('DELETE faz soft delete, some da listagem e registra DELETE na auditoria', async () => {
      await ctx.api
        .delete(`/pei-templates/${ids.discalculia}`)
        .set(bearer(t.token))
        .expect(204);

      const lista = await ctx.api
        .get('/pei-templates')
        .set(bearer(t.token))
        .expect(200);
      expect(titulos(lista.body)).not.toContain('discalculia');
      await ctx.api
        .get(`/pei-templates/${ids.discalculia}`)
        .set(bearer(t.token))
        .expect(404);

      const noBanco = await ctx.prisma.peiTemplate.findUnique({
        where: { id: ids.discalculia },
      });
      expect(noBanco).not.toBeNull();
      expect(noBanco!.deletedAt).toBeInstanceOf(Date);

      const registro = await esperarAuditoria(ctx, {
        userId: t.id,
        action: 'DELETE',
        resourceId: ids.discalculia,
      });
      expect(registro).not.toBeNull();
    });

    it('excluir de novo responde 404 sem alterar a data original de exclusão', async () => {
      const antes = await ctx.prisma.peiTemplate.findUnique({
        where: { id: ids.discalculia },
      });
      await ctx.api
        .delete(`/pei-templates/${ids.discalculia}`)
        .set(bearer(t.token))
        .expect(404);
      const depois = await ctx.prisma.peiTemplate.findUnique({
        where: { id: ids.discalculia },
      });
      expect(depois!.deletedAt).toEqual(antes!.deletedAt);
    });

    it('DELETE de molde de outro terapeuta ou inexistente responde 404 e não exclui', async () => {
      await ctx.api
        .delete(`/pei-templates/${ids.alheio}`)
        .set(bearer(t.token))
        .expect(404);
      await ctx.api
        .delete('/pei-templates/00000000-0000-0000-0000-000000000000')
        .set(bearer(t.token))
        .expect(404);

      const alheio = await ctx.prisma.peiTemplate.findUnique({
        where: { id: ids.alheio },
      });
      expect(alheio!.deletedAt).toBeNull();
    });

    it('PEI criado a partir de um molde continua intacto depois que o molde é excluído', async () => {
      const aprendente = await criarAprendente(ctx, t);
      const pei = await ctx.api
        .post('/peis')
        .set(bearer(t.token))
        .send({
          aprendenteId: aprendente.id,
          dificuldades: 'Dificuldades de Autismo',
          objetivos: 'Objetivos de Autismo',
          estrategias: 'Estratégias de Autismo',
          dataInicio: '2026-03-01',
          templateOrigemId: ids.Autismo,
        })
        .expect(201);

      await ctx.api
        .delete(`/pei-templates/${ids.Autismo}`)
        .set(bearer(t.token))
        .expect(204);

      const { id: peiId } = pei.body as { id: string };
      const lido = await ctx.api
        .get(`/peis/${peiId}`)
        .set(bearer(t.token))
        .expect(200);
      expect(lido.body).toMatchObject({
        id: peiId,
        templateOrigemId: ids.Autismo,
        objetivos: 'Objetivos de Autismo',
      });
    });
  });
});
