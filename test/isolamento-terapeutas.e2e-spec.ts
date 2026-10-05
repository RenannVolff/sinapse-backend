import { AppTeste, criarAppTeste } from './helpers/app-teste';
import {
  bearer,
  criarAprendente,
  criarAtendimento,
  criarTerapeuta,
  horarioFuturo,
  Terapeuta,
} from './helpers/fabrica';

// O terapeuta A cadastra um conjunto completo de dados; o terapeuta B, com
// um JWT válido, tenta ler, alterar e excluir cada um deles pelo ID.
describe('B. Isolamento entre terapeutas (multi-tenancy)', () => {
  let ctx: AppTeste;
  let a: Terapeuta;
  let b: Terapeuta;

  const dadosA = {
    aprendenteId: '',
    atendimentoId: '',
    atividadeId: '',
    itemChecklistId: '',
    peiId: '',
    templateId: '',
    tarefaId: '',
  };

  beforeAll(async () => {
    ctx = await criarAppTeste();
    a = await criarTerapeuta(ctx, { nome: 'Terapeuta A' });
    b = await criarTerapeuta(ctx, { nome: 'Terapeuta B' });

    const aprendente = await criarAprendente(ctx, a, {
      nomeCompleto: 'Aprendente Sigiloso do A',
    });
    dadosA.aprendenteId = aprendente.id;

    const atendimento = await criarAtendimento(ctx, a, aprendente.id, {
      dataAtendimento: horarioFuturo(5, 14),
      tituloSessao: 'Sessão sigilosa do A',
    });
    dadosA.atendimentoId = atendimento.id;

    const atividade = await ctx.api
      .post('/atividades')
      .set(bearer(a.token))
      .send({
        atendimentoId: atendimento.id,
        titulo: 'Atividade do A',
        nivelDificuldade: 2,
      })
      .expect(201);
    dadosA.atividadeId = atividade.body.id;
    const sessao = await ctx.api
      .get(`/atendimentos/${atendimento.id}`)
      .set(bearer(a.token))
      .expect(200);
    dadosA.itemChecklistId = sessao.body.atividades[0].itensChecklist[0].id;

    // Sessão concluída: assim ela apareceria nos gráficos e relatórios de
    // B caso o filtro por terapeuta falhasse.
    await ctx.api
      .patch(`/atendimentos/${atendimento.id}`)
      .set(bearer(a.token))
      .send({ concluido: true })
      .expect(200);

    const template = await ctx.api
      .post('/pei-templates')
      .set(bearer(a.token))
      .send({
        nome: 'Molde do A',
        dificuldades: 'd',
        objetivos: 'o',
        estrategias: 'e',
      })
      .expect(201);
    dadosA.templateId = template.body.id;

    const pei = await ctx.api
      .post('/peis')
      .set(bearer(a.token))
      .send({
        aprendenteId: aprendente.id,
        dificuldades: 'Dificuldades sigilosas',
        objetivos: 'Objetivos',
        estrategias: 'Estratégias',
        dataInicio: '2026-02-01',
        templateOrigemId: template.body.id,
      })
      .expect(201);
    dadosA.peiId = pei.body.id;

    const tarefa = await ctx.api
      .post('/tarefas')
      .set(bearer(a.token))
      .send({ texto: 'Tarefa do A', notas: 'Anotação privada' })
      .expect(201);
    dadosA.tarefaId = tarefa.body.id;
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  describe('Aprendente', () => {
    it('B não vê o aprendente de A na listagem', async () => {
      const res = await ctx.api
        .get('/aprendentes')
        .set(bearer(b.token))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('B recebe 404 ao buscar o aprendente de A pelo ID', async () => {
      const res = await ctx.api
        .get(`/aprendentes/${dadosA.aprendenteId}`)
        .set(bearer(b.token))
        .expect(404);
      expect(JSON.stringify(res.body)).not.toContain('Sigiloso');
    });

    it('B recebe 404 ao alterar a fase do aprendente de A', async () => {
      await ctx.api
        .patch(`/aprendentes/${dadosA.aprendenteId}/fase`)
        .set(bearer(b.token))
        .send({ fase: 'INTERVENCAO' })
        .expect(404);
    });

    it('B recebe 404 ao excluir o aprendente de A', async () => {
      await ctx.api
        .delete(`/aprendentes/${dadosA.aprendenteId}`)
        .set(bearer(b.token))
        .expect(404);
    });

    // As três rotas de gráfico/relatório abaixo respondem 200 com lista
    // vazia (e não 404) para aprendente alheio: o filtro por terapeuta está
    // na consulta das sessões. O que importa é que nada de A é devolvido.
    it('B recebe lista vazia em graficos-acompanhamento do aprendente de A', async () => {
      const res = await ctx.api
        .get(`/aprendentes/${dadosA.aprendenteId}/graficos-acompanhamento`)
        .set(bearer(b.token))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('B não obtém nenhuma sessão de A no relatório inteligente (relatorio-ia)', async () => {
      const res = await ctx.api
        .get(`/aprendentes/${dadosA.aprendenteId}/relatorio-ia`)
        .query({ inicio: '2020-01-01', fim: '2099-12-31' })
        .set(bearer(b.token))
        .expect(200);
      expect(res.body.dadosGrafico).toEqual([]);
      expect(JSON.stringify(res.body)).not.toContain('Sigiloso');
    });

    it('B recebe 404 nos relatórios de frequência e na análise de IA do aprendente de A', async () => {
      await ctx.api
        .get(`/relatorios/aprendente/${dadosA.aprendenteId}/frequencia`)
        .set(bearer(b.token))
        .expect(404);
      await ctx.api
        .get(`/ia/analise/${dadosA.aprendenteId}`)
        .set(bearer(b.token))
        .expect(404);
    });

    it('B recebe lista vazia no gráfico de evolução do aprendente de A', async () => {
      const res = await ctx.api
        .get(`/relatorios/evolucao/${dadosA.aprendenteId}`)
        .set(bearer(b.token))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('A, dono dos dados, enxerga a sessão concluída nessas mesmas rotas (controle)', async () => {
      const graficos = await ctx.api
        .get(`/aprendentes/${dadosA.aprendenteId}/graficos-acompanhamento`)
        .set(bearer(a.token))
        .expect(200);
      expect(graficos.body).toHaveLength(1);
      const evolucao = await ctx.api
        .get(`/relatorios/evolucao/${dadosA.aprendenteId}`)
        .set(bearer(a.token))
        .expect(200);
      expect(evolucao.body).toHaveLength(1);
      const relatorio = await ctx.api
        .get(`/aprendentes/${dadosA.aprendenteId}/relatorio-ia`)
        .query({ inicio: '2020-01-01', fim: '2099-12-31' })
        .set(bearer(a.token))
        .expect(200);
      expect(relatorio.body.dadosGrafico).toHaveLength(1);
    });

    it('B recebe 404 ao exportar o .docx do aprendente de A', async () => {
      await ctx.api
        .post(`/aprendentes/${dadosA.aprendenteId}/exportar-docx`)
        .set(bearer(b.token))
        .send({ nomeAprendente: 'x', resumoIa: 'x', graficos: [] })
        .expect(404);
    });
  });

  describe('Atendimento, atividade e checklist', () => {
    it('B recebe 404 ao buscar, editar, mudar status ou excluir o atendimento de A', async () => {
      const url = `/atendimentos/${dadosA.atendimentoId}`;
      await ctx.api.get(url).set(bearer(b.token)).expect(404);
      await ctx.api
        .patch(url)
        .set(bearer(b.token))
        .send({ tituloSessao: 'Invadido' })
        .expect(404);
      await ctx.api
        .patch(`${url}/status`)
        .set(bearer(b.token))
        .send({ status: 'CANCELADO' })
        .expect(404);
      await ctx.api.delete(url).set(bearer(b.token)).expect(404);
    });

    it('B recebe 404 ao agendar atendimento para o aprendente de A', async () => {
      await ctx.api
        .post('/atendimentos')
        .set(bearer(b.token))
        .send({
          aprendenteId: dadosA.aprendenteId,
          dataAtendimento: horarioFuturo(6, 10),
          tituloSessao: 'Intrusa',
        })
        .expect(404);
    });

    it('B não vê o atendimento de A no próprio calendário', async () => {
      const data = new Date(horarioFuturo(5, 14));
      const res = await ctx.api
        .get('/atendimentos/calendario')
        .query({ mes: data.getMonth() + 1, ano: data.getFullYear() })
        .set(bearer(b.token))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('B recebe 404 ao criar atividade no atendimento de A e ao marcar o checklist de A', async () => {
      await ctx.api
        .post('/atividades')
        .set(bearer(b.token))
        .send({
          atendimentoId: dadosA.atendimentoId,
          titulo: 'Intrusa',
          nivelDificuldade: 1,
        })
        .expect(404);
      await ctx.api
        .patch(`/atividades/checklist/${dadosA.itemChecklistId}`)
        .set(bearer(b.token))
        .send({ realizado: true })
        .expect(404);
    });
  });

  describe('PEI e PeiTemplate', () => {
    it('B recebe 404 ao buscar, editar ou excluir o PEI de A, e não o vê na listagem', async () => {
      const url = `/peis/${dadosA.peiId}`;
      await ctx.api.get(url).set(bearer(b.token)).expect(404);
      await ctx.api
        .patch(url)
        .set(bearer(b.token))
        .send({ objetivos: 'Invadido' })
        .expect(404);
      await ctx.api.delete(url).set(bearer(b.token)).expect(404);

      const lista = await ctx.api.get('/peis').set(bearer(b.token)).expect(200);
      expect(lista.body).toEqual([]);
      const filtrada = await ctx.api
        .get('/peis')
        .query({ aprendenteId: dadosA.aprendenteId })
        .set(bearer(b.token))
        .expect(200);
      expect(filtrada.body).toEqual([]);
    });

    it('B recebe 404 ao criar PEI para o aprendente de A', async () => {
      await ctx.api
        .post('/peis')
        .set(bearer(b.token))
        .send({
          aprendenteId: dadosA.aprendenteId,
          dificuldades: 'x',
          objetivos: 'x',
          estrategias: 'x',
          dataInicio: '2026-02-01',
        })
        .expect(404);
    });

    it('B recebe 404 ao buscar, editar ou excluir o molde de PEI de A, e não o vê na listagem', async () => {
      const url = `/pei-templates/${dadosA.templateId}`;
      await ctx.api.get(url).set(bearer(b.token)).expect(404);
      await ctx.api
        .patch(url)
        .set(bearer(b.token))
        .send({ nome: 'Invadido' })
        .expect(404);
      await ctx.api.delete(url).set(bearer(b.token)).expect(404);

      const lista = await ctx.api
        .get('/pei-templates')
        .set(bearer(b.token))
        .expect(200);
      expect(lista.body).toEqual([]);
    });

    it('B recebe 404 ao criar um PEI próprio a partir do molde de A', async () => {
      const proprio = await criarAprendente(ctx, b);
      await ctx.api
        .post('/peis')
        .set(bearer(b.token))
        .send({
          aprendenteId: proprio.id,
          dificuldades: 'x',
          objetivos: 'x',
          estrategias: 'x',
          dataInicio: '2026-02-01',
          templateOrigemId: dadosA.templateId,
        })
        .expect(404);
    });
  });

  describe('Tarefas', () => {
    it('B recebe 404 ao editar ou excluir a tarefa de A, e não a vê na listagem', async () => {
      const url = `/tarefas/${dadosA.tarefaId}`;
      await ctx.api
        .patch(url)
        .set(bearer(b.token))
        .send({ notas: 'Invadido', concluida: true })
        .expect(404);
      await ctx.api.delete(url).set(bearer(b.token)).expect(404);

      const lista = await ctx.api
        .get('/tarefas')
        .set(bearer(b.token))
        .expect(200);
      expect(lista.body).toEqual([]);
    });
  });

  describe('Conta do usuário', () => {
    it('B recebe 403 ao alterar a conta de A via PATCH /usuarios/:id', async () => {
      await ctx.api
        .patch(`/usuarios/${a.id}`)
        .set(bearer(b.token))
        .send({
          nome: 'Invadido',
          email: 'invasor@e2e.test',
          senha: 'Invasor@123',
        })
        .expect(403);

      // A senha original de A continua valendo.
      await ctx.api
        .post('/auth/login')
        .send({ email: a.email, senha: a.senha })
        .expect(200);
    });

    it('cada terapeuta consegue alterar a própria conta (controle)', async () => {
      const res = await ctx.api
        .patch(`/usuarios/${b.id}`)
        .set(bearer(b.token))
        .send({ nome: 'Terapeuta B Renomeado' })
        .expect(200);
      expect(res.body).toEqual({
        id: b.id,
        nome: 'Terapeuta B Renomeado',
        email: b.email,
      });
    });
  });

  describe('Verificação final no banco', () => {
    it('nenhuma das tentativas de B alterou os dados de A no banco', async () => {
      const usuarioA = await ctx.prisma.usuario.findUniqueOrThrow({
        where: { id: a.id },
      });
      expect(usuarioA).toMatchObject({ nome: 'Terapeuta A', email: a.email });

      const aprendente = await ctx.prisma.aprendente.findUniqueOrThrow({
        where: { id: dadosA.aprendenteId },
      });
      expect(aprendente).toMatchObject({
        usuarioId: a.id,
        faseAtual: 'LINHA_BASE',
        deletedAt: null,
      });

      const atendimento = await ctx.prisma.atendimento.findUniqueOrThrow({
        where: { id: dadosA.atendimentoId },
        include: { atividades: { include: { itensChecklist: true } } },
      });
      expect(atendimento).toMatchObject({
        tituloSessao: 'Sessão sigilosa do A',
        status: 'AGUARDANDO_CONFIRMACAO',
        concluido: true,
        deletedAt: null,
      });
      expect(atendimento.atividades).toHaveLength(1);
      expect(
        atendimento.atividades[0].itensChecklist.every((i) => !i.realizado),
      ).toBe(true);

      expect(
        await ctx.prisma.pEI.findUniqueOrThrow({ where: { id: dadosA.peiId } }),
      ).toMatchObject({ objetivos: 'Objetivos', deletedAt: null });
      expect(
        await ctx.prisma.peiTemplate.findUniqueOrThrow({
          where: { id: dadosA.templateId },
        }),
      ).toMatchObject({ nome: 'Molde do A', deletedAt: null });
      expect(
        await ctx.prisma.tarefa.findUniqueOrThrow({
          where: { id: dadosA.tarefaId },
        }),
      ).toMatchObject({
        notas: 'Anotação privada',
        concluida: false,
        deletedAt: null,
      });

      // B não conseguiu gravar nada vinculado ao aprendente de A.
      expect(
        await ctx.prisma.atendimento.count({
          where: { aprendenteId: dadosA.aprendenteId },
        }),
      ).toBe(1);
      expect(
        await ctx.prisma.pEI.count({
          where: { aprendenteId: dadosA.aprendenteId },
        }),
      ).toBe(1);
    });
  });
});
