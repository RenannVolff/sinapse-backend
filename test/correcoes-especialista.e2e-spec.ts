import { AppTeste, criarAppTeste } from './helpers/app-teste';
import {
  bearer,
  criarAprendente,
  criarAtendimento,
  criarTerapeuta,
  horarioFuturo,
  Terapeuta,
} from './helpers/fabrica';
import { camposDe, errosDe, esperarErroValidacao } from './helpers/erros';

// Rodada de correções após o teste com especialista: limites de entrada,
// formato único de erro, edição de aprendente e sessão, listagem de tarefas
// e período invertido. Cada bloco também confere o isolamento por terapeuta.

describe('G. Correções pós-teste com especialista', () => {
  let ctx: AppTeste;
  let a: Terapeuta;
  let b: Terapeuta;
  let aprendenteId: string;

  beforeAll(async () => {
    ctx = await criarAppTeste();
    a = await criarTerapeuta(ctx, { nome: 'Terapeuta Alfa' });
    b = await criarTerapeuta(ctx, { nome: 'Terapeuta Beta' });
    aprendenteId = (await criarAprendente(ctx, a)).id;
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  describe('Formato único de erro, sem vazar detalhes', () => {
    it.each([
      ['401 sem token', () => ctx.api.get('/aprendentes'), 401],
      [
        '404 de registro inexistente',
        () =>
          ctx.api
            .get('/aprendentes/00000000-0000-4000-8000-000000000000')
            .set(bearer(a.token)),
        404,
      ],
      [
        '403 ao editar a conta de outro terapeuta',
        () =>
          ctx.api
            .patch(`/usuarios/${a.id}`)
            .set(bearer(b.token))
            .send({ nome: 'Invasor' }),
        403,
      ],
      [
        '409 de e-mail já cadastrado',
        () =>
          ctx.api
            .post('/usuarios')
            .send({ nome: 'Copia', email: a.email, senha: 'SenhaForte@123' }),
        409,
      ],
    ])('%s: só statusCode, code e message', async (_caso, req, status) => {
      const res = await req().expect(status);
      expect(Object.keys(res.body).sort()).toEqual([
        'code',
        'message',
        'statusCode',
      ]);
      expect(typeof (res.body as { message: unknown }).message).toBe('string');
      expect(JSON.stringify(res.body)).not.toMatch(
        /stack|prisma|node_modules|[A-Z]:\\|\/src\/|SELECT|usuarios"|aprendentes"/i,
      );
    });
  });

  describe('Limites e valores absurdos', () => {
    it('recusa duração negativa e texto acima do limite com erro por campo', async () => {
      const res = await ctx.api
        .post('/atendimentos')
        .set(bearer(a.token))
        .send({
          aprendenteId,
          dataAtendimento: horarioFuturo(3, 9),
          duracaoMinutos: -5,
          tituloSessao: 'T'.repeat(51),
          observacoes: 'o'.repeat(2001),
        })
        .expect(400);
      esperarErroValidacao(res.body);
      expect(camposDe(res.body).sort()).toEqual([
        'duracaoMinutos',
        'observacoes',
        'tituloSessao',
      ]);
    });

    it('recusa PEI com data de fim anterior ao início, apontando o campo', async () => {
      const res = await ctx.api
        .post('/peis')
        .set(bearer(a.token))
        .send({
          aprendenteId,
          dificuldades: 'Leitura',
          objetivos: 'Fluência',
          estrategias: 'Jogos',
          dataInicio: '2026-08-01',
          dataFim: '2026-07-01',
        })
        .expect(400);
      expect(errosDe(res.body)).toEqual([
        {
          field: 'dataFim',
          message: 'Data de fim: deve ser igual ou posterior à data de início.',
        },
      ]);
      expect(await ctx.prisma.pEI.count({ where: { aprendenteId } })).toBe(0);
    });

    it('remove HTML/script do texto antes de gravar', async () => {
      const res = await ctx.api
        .post('/tarefas')
        .set(bearer(a.token))
        .send({ texto: '<script>alert(1)</script>Ligar para a escola' })
        .expect(201);
      const tarefa = res.body as { id: string; texto: string };
      expect(tarefa.texto).toBe('Ligar para a escola');
      await ctx.api
        .delete(`/tarefas/${tarefa.id}`)
        .set(bearer(a.token))
        .expect(204);
    });
  });

  describe('PATCH /aprendentes/:id', () => {
    it('edita parcialmente, sem mudar a data para o dia anterior', async () => {
      const res = await ctx.api
        .patch(`/aprendentes/${aprendenteId}`)
        .set(bearer(a.token))
        .send({ contato: '(47) 3333-4444', dataNascimento: '2016-03-10' })
        .expect(200);
      expect(res.body).toMatchObject({
        contato: '(47) 3333-4444',
        nomeCompleto: 'Aprendente Teste',
        dataNascimento: '2016-03-10T12:00:00.000Z',
      });
    });

    it('registra a edição na trilha de auditoria como UPDATE', async () => {
      const registro = await ctx.prisma.auditLog.findFirst({
        where: {
          userId: a.id,
          action: 'UPDATE',
          resource: 'APRENDENTE',
          resourceId: aprendenteId,
        },
      });
      expect(registro).not.toBeNull();
    });

    it('recusa campo enviado vazio ou fora do limite', async () => {
      const res = await ctx.api
        .patch(`/aprendentes/${aprendenteId}`)
        .set(bearer(a.token))
        .send({ nomeCompleto: '', dataNascimento: '2999-01-01' })
        .expect(400);
      expect(camposDe(res.body).sort()).toEqual([
        'dataNascimento',
        'nomeCompleto',
      ]);
    });

    it('aceita ponto no nome do aprendente e do responsável', async () => {
      const outro = await criarAprendente(ctx, a, {
        nomeCompleto: 'Pedro Alves Jr.',
      });
      const res = await ctx.api
        .patch(`/aprendentes/${outro.id}`)
        .set(bearer(a.token))
        .send({ responsavel: 'Dr. João Alves' })
        .expect(200);
      expect(res.body).toMatchObject({
        nomeCompleto: 'Pedro Alves Jr.',
        responsavel: 'Dr. João Alves',
      });
    });

    it('outro terapeuta recebe 404 e nada muda', async () => {
      await ctx.api
        .patch(`/aprendentes/${aprendenteId}`)
        .set(bearer(b.token))
        .send({ nomeCompleto: 'Invadido' })
        .expect(404);
      const atual = await ctx.prisma.aprendente.findUniqueOrThrow({
        where: { id: aprendenteId },
      });
      expect(atual.nomeCompleto).toBe('Aprendente Teste');
    });

    it('aprendente excluído (soft delete) não pode ser editado', async () => {
      const outro = await criarAprendente(ctx, a, {
        nomeCompleto: 'Aprendente Excluído',
      });
      await ctx.api
        .delete(`/aprendentes/${outro.id}`)
        .set(bearer(a.token))
        .expect(204);
      await ctx.api
        .patch(`/aprendentes/${outro.id}`)
        .set(bearer(a.token))
        .send({ contato: '(47) 3333-4444' })
        .expect(404);
    });
  });

  describe('PATCH /atendimentos/:id (editar sessão)', () => {
    let sessaoId: string;

    beforeAll(async () => {
      sessaoId = (
        await criarAtendimento(ctx, a, aprendenteId, {
          dataAtendimento: horarioFuturo(5, 9),
        })
      ).id;
      // Sessão já realizada no passado e concluída (não dá para criar assim
      // pela API, que recusa data passada)
      await ctx.prisma.atendimento.update({
        where: { id: sessaoId },
        data: {
          dataAtendimento: new Date('2025-05-05T13:00:00.000Z'),
          status: 'CONCLUIDO',
          concluido: true,
        },
      });
    });

    it('corrige a observação de uma sessão passada reenviando a data original', async () => {
      const res = await ctx.api
        .patch(`/atendimentos/${sessaoId}`)
        .set(bearer(a.token))
        .send({
          dataAtendimento: '2025-05-05T13:00:00.000Z',
          observacoes: 'Observação corrigida',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        observacoes: 'Observação corrigida',
        concluido: true,
        status: 'CONCLUIDO',
      });
    });

    it('não deixa mover a sessão para outra data no passado', async () => {
      const res = await ctx.api
        .patch(`/atendimentos/${sessaoId}`)
        .set(bearer(a.token))
        .send({ dataAtendimento: '2025-01-01T13:00:00.000Z' })
        .expect(400);
      expect(camposDe(res.body)).toEqual(['dataAtendimento']);
    });

    it('FALTA desmarca concluido, e a sessão sai do relatório', async () => {
      const antes = await ctx.api
        .get(`/aprendentes/${aprendenteId}/relatorio-ia`)
        .query({ inicio: '2025-01-01', fim: '2025-12-31' })
        .set(bearer(a.token))
        .expect(200);
      expect(
        (antes.body as { dadosGrafico: unknown[] }).dadosGrafico,
      ).toHaveLength(1);

      const res = await ctx.api
        .patch(`/atendimentos/${sessaoId}`)
        .set(bearer(a.token))
        .send({ status: 'FALTA' })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'FALTA', concluido: false });

      const depois = await ctx.api
        .get(`/aprendentes/${aprendenteId}/relatorio-ia`)
        .query({ inicio: '2025-01-01', fim: '2025-12-31' })
        .set(bearer(a.token))
        .expect(200);
      expect(
        (depois.body as { dadosGrafico: unknown[] }).dadosGrafico,
      ).toHaveLength(0);
    });

    it('recusa FALTA junto com concluido=true (FALTA ≠ sessão realizada)', async () => {
      const res = await ctx.api
        .patch(`/atendimentos/${sessaoId}`)
        .set(bearer(a.token))
        .send({ status: 'FALTA', concluido: true })
        .expect(400);
      expect(camposDe(res.body)).toEqual(['concluido']);
    });

    it('outro terapeuta recebe 404', async () => {
      await ctx.api
        .patch(`/atendimentos/${sessaoId}`)
        .set(bearer(b.token))
        .send({ observacoes: 'Invadido' })
        .expect(404);
    });
  });

  describe('GET /tarefas — listagem completa e ordenada', () => {
    beforeAll(async () => {
      for (let i = 1; i <= 25; i++) {
        const res = await ctx.api
          .post('/tarefas')
          .set(bearer(a.token))
          .send({ texto: `Tarefa ${i}` })
          .expect(201);
        if (i % 5 === 0) {
          await ctx.api
            .patch(`/tarefas/${(res.body as { id: string }).id}`)
            .set(bearer(a.token))
            .send({ concluida: true })
            .expect(200);
        }
      }
      await ctx.api
        .post('/tarefas')
        .set(bearer(b.token))
        .send({ texto: 'Tarefa do Beta' })
        .expect(201);
    });

    it('sem paginação devolve todas, pendentes primeiro, com o total no cabeçalho', async () => {
      const res = await ctx.api
        .get('/tarefas')
        .set(bearer(a.token))
        .expect(200);
      const lista = res.body as { texto: string; concluida: boolean }[];
      expect(lista).toHaveLength(25);
      expect(res.headers['x-total-count']).toBe('25');
      const primeiraConcluida = lista.findIndex((t) => t.concluida);
      expect(primeiraConcluida).toBe(20);
      expect(lista.slice(primeiraConcluida).every((t) => t.concluida)).toBe(
        true,
      );
      expect(lista.some((t) => t.texto === 'Tarefa do Beta')).toBe(false);
    });

    it('com paginação devolve { itens, total, pagina, porPagina } sem repetir itens', async () => {
      const p1 = await ctx.api
        .get('/tarefas')
        .query({ pagina: 1, porPagina: 20 })
        .set(bearer(a.token))
        .expect(200);
      const p2 = await ctx.api
        .get('/tarefas')
        .query({ pagina: 2, porPagina: 20 })
        .set(bearer(a.token))
        .expect(200);
      type Pagina = { itens: { id: string }[] };
      const [pagina1, pagina2] = [p1.body as Pagina, p2.body as Pagina];
      expect(p1.body).toMatchObject({ total: 25, pagina: 1, porPagina: 20 });
      expect(pagina1.itens).toHaveLength(20);
      expect(pagina2.itens).toHaveLength(5);
      const ids = [...pagina1.itens, ...pagina2.itens].map((t) => t.id);
      expect(new Set(ids).size).toBe(25);
    });

    it('recusa paginação fora da faixa', async () => {
      const res = await ctx.api
        .get('/tarefas')
        .query({ pagina: 0, porPagina: 1000 })
        .set(bearer(a.token))
        .expect(400);
      expect(camposDe(res.body).sort()).toEqual(['pagina', 'porPagina']);
    });
  });

  describe('Período invertido', () => {
    it('relatório inteligente troca as datas e devolve o período usado', async () => {
      const res = await ctx.api
        .get(`/aprendentes/${aprendenteId}/relatorio-ia`)
        .query({ inicio: '2025-12-31', fim: '2025-01-01' })
        .set(bearer(a.token))
        .expect(200);
      expect((res.body as { periodo: unknown }).periodo).toEqual({
        inicio: '2025-01-01',
        fim: '2025-12-31',
        invertido: true,
      });
    });

    it('gráfico de evolução troca as datas e informa nos cabeçalhos', async () => {
      const res = await ctx.api
        .get(`/relatorios/evolucao/${aprendenteId}`)
        .query({ inicio: '2025-12-31', fim: '2025-01-01' })
        .set(bearer(a.token))
        .expect(200);
      expect(res.headers['x-periodo-inicio']).toBe('2025-01-01');
      expect(res.headers['x-periodo-fim']).toBe('2025-12-31');
      expect(res.headers['x-periodo-invertido']).toBe('true');
    });

    it('exportação recusa data de emissão futura', async () => {
      const res = await ctx.api
        .post(`/aprendentes/${aprendenteId}/exportar-docx`)
        .set(bearer(a.token))
        .send({
          nomeAprendente: 'Aprendente Teste',
          resumoIa: 'Texto',
          graficos: [],
          dataEmissao: '2999-01-01',
        })
        .expect(400);
      expect(errosDe(res.body)).toEqual([
        {
          field: 'dataEmissao',
          message: 'Data de emissão: não pode ser uma data futura.',
        },
      ]);
    });
  });
});
