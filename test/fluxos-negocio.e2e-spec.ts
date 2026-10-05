import { calcularScoreSessao } from '../src/common/utils/calcular-score';
import { AppTeste, criarAppTeste } from './helpers/app-teste';
import {
  bearer,
  criarAprendente,
  criarAtendimento,
  criarTerapeuta,
  horarioFuturo,
  Terapeuta,
} from './helpers/fabrica';

const MENSAGEM_CONFLITO = 'Já existe um atendimento agendado nesse horário.';

describe('C. Fluxos de negócio com persistência', () => {
  let ctx: AppTeste;

  beforeAll(async () => {
    ctx = await criarAppTeste();
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  describe('Aprendente → atendimento → atividade/checklist → score', () => {
    let t: Terapeuta;
    let aprendenteId: string;
    let atendimentoId: string;

    // Atividade 1: dificuldade 2, 2 de 5 tentativas certas (40%).
    // Atividade 2: dificuldade 5, 4 de 5 tentativas certas (80%).
    // Score ponderado = (40·2 + 80·5) / (2 + 5) = 480 / 7 = 68,57 → 69.
    const SCORE_ESPERADO = 69;

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
    });

    it('cadastra o aprendente e o devolve com fase inicial LINHA_BASE', async () => {
      const aprendente = await criarAprendente(ctx, t, {
        nomeCompleto: 'Bruno Score',
      });
      aprendenteId = aprendente.id;
      expect(aprendente.faseAtual).toBe('LINHA_BASE');

      const lista = await ctx.api
        .get('/aprendentes')
        .set(bearer(t.token))
        .expect(200);
      expect(lista.body.map((x: { id: string }) => x.id)).toEqual([
        aprendenteId,
      ]);
    });

    it('agenda o atendimento com status AGUARDANDO_CONFIRMACAO e a fase atual do aprendente', async () => {
      const atendimento = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(10, 13),
      });
      atendimentoId = atendimento.id;
      expect(atendimento.status).toBe('AGUARDANDO_CONFIRMACAO');
      expect(atendimento.fase).toBe('LINHA_BASE');
    });

    it('cria atividades com 5 tentativas de checklist cada', async () => {
      for (const [titulo, nivelDificuldade] of [
        ['Pinça fina', 2],
        ['Sequência numérica', 5],
      ] as const) {
        await ctx.api
          .post('/atividades')
          .set(bearer(t.token))
          .send({ atendimentoId, titulo, nivelDificuldade })
          .expect(201);
      }

      const sessao = await ctx.api
        .get(`/atendimentos/${atendimentoId}`)
        .set(bearer(t.token))
        .expect(200);
      expect(sessao.body.atividades).toHaveLength(2);
      for (const atividade of sessao.body.atividades) {
        expect(atividade.itensChecklist).toHaveLength(5);
        expect(
          atividade.itensChecklist.every(
            (i: { realizado: boolean }) => !i.realizado,
          ),
        ).toBe(true);
      }
    });

    it('marca o checklist e o score lido pela API bate com o calculado (69)', async () => {
      const sessao = await ctx.api
        .get(`/atendimentos/${atendimentoId}`)
        .set(bearer(t.token))
        .expect(200);
      const atividades: {
        nivelDificuldade: number;
        itensChecklist: { id: string }[];
      }[] = sessao.body.atividades;
      const facil = atividades.find((x) => x.nivelDificuldade === 2)!;
      const dificil = atividades.find((x) => x.nivelDificuldade === 5)!;

      const marcar = [
        ...facil.itensChecklist.slice(0, 2),
        ...dificil.itensChecklist.slice(0, 4),
      ];
      for (const item of marcar) {
        const res = await ctx.api
          .patch(`/atividades/checklist/${item.id}`)
          .set(bearer(t.token))
          .send({ realizado: true })
          .expect(200);
        expect(res.body.realizado).toBe(true);
      }

      // Persistência: o banco tem exatamente os 6 itens marcados.
      expect(
        await ctx.prisma.itemChecklist.count({
          where: { atividade: { atendimentoId }, realizado: true },
        }),
      ).toBe(6);

      // O cálculo de referência sobre os dados persistidos.
      const persistido = await ctx.prisma.atendimento.findUniqueOrThrow({
        where: { id: atendimentoId },
        include: { atividades: { include: { itensChecklist: true } } },
      });
      expect(calcularScoreSessao(persistido)).toBe(SCORE_ESPERADO);

      const graficos = await ctx.api
        .get(`/aprendentes/${aprendenteId}/graficos-acompanhamento`)
        .set(bearer(t.token))
        .expect(200);
      expect(graficos.body).toEqual([
        {
          id: atendimentoId,
          dataAtendimento: horarioFuturo(10, 13),
          score: SCORE_ESPERADO,
          fase: 'LINHA_BASE',
          status: 'AGUARDANDO_CONFIRMACAO',
        },
      ]);
    });

    it('desmarcar uma tentativa recalcula o score na leitura seguinte', async () => {
      const item = await ctx.prisma.itemChecklist.findFirstOrThrow({
        where: {
          atividade: { atendimentoId, nivelDificuldade: 5 },
          realizado: true,
        },
      });
      await ctx.api
        .patch(`/atividades/checklist/${item.id}`)
        .set(bearer(t.token))
        .send({ realizado: false })
        .expect(200);

      // (40·2 + 60·5) / 7 = 380 / 7 = 54,29 → 54
      const graficos = await ctx.api
        .get(`/aprendentes/${aprendenteId}/graficos-acompanhamento`)
        .set(bearer(t.token))
        .expect(200);
      expect(graficos.body[0].score).toBe(54);

      await ctx.api
        .patch(`/atividades/checklist/${item.id}`)
        .set(bearer(t.token))
        .send({ realizado: true })
        .expect(200);
    });

    it('com a sessão concluída, o relatório inteligente usa o mesmo score e o texto vem da heurística (IA desligada)', async () => {
      await ctx.api
        .patch(`/atendimentos/${atendimentoId}`)
        .set(bearer(t.token))
        .send({ concluido: true, status: 'CONCLUIDO' })
        .expect(200);

      const relatorio = await ctx.api
        .get(`/aprendentes/${aprendenteId}/relatorio-ia`)
        .query({ inicio: '2020-01-01', fim: '2099-12-31' })
        .set(bearer(t.token))
        .expect(200);
      expect(relatorio.body.dadosGrafico).toEqual([
        {
          data: expect.any(String),
          titulo: 'Sessão E2E',
          score: SCORE_ESPERADO,
        },
      ]);
      expect(relatorio.body.resumoIa).toMatch(/^Análise Sistêmica Automática:/);
      expect(relatorio.body.resumoIa).toContain(`${SCORE_ESPERADO}%`);

      const evolucao = await ctx.api
        .get(`/relatorios/evolucao/${aprendenteId}`)
        .set(bearer(t.token))
        .expect(200);
      expect(evolucao.body).toEqual([
        expect.objectContaining({ evolucao: SCORE_ESPERADO, precisao: 60 }),
      ]);
    });

    it('a análise textual de /ia/analise cai na heurística (fonte "heuristica") sem chaves de IA', async () => {
      const res = await ctx.api
        .get(`/ia/analise/${aprendenteId}`)
        .set(bearer(t.token))
        .expect(200);
      expect(res.body.fonte).toBe('heuristica');
      expect(res.body.secoes.length).toBeGreaterThan(0);
    });
  });

  describe('Conflito de horário', () => {
    let t: Terapeuta;
    let aprendenteId: string;
    let primeiroId: string;

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
      aprendenteId = (await criarAprendente(ctx, t)).id;
      // Ocupa 14:00–15:00 do dia 12.
      primeiroId = (
        await criarAtendimento(ctx, t, aprendenteId, {
          dataAtendimento: horarioFuturo(12, 14),
          duracaoMinutos: 60,
        })
      ).id;
    });

    it.each([
      ['começa no meio de outro', 14, 30, 60],
      ['começa antes e termina dentro de outro', 13, 30, 60],
      ['tem o mesmo horário exato', 14, 0, 30],
      ['engloba outro inteiro', 13, 0, 180],
    ])(
      'rejeita com 400 o agendamento que %s',
      async (_caso, hora, minuto, duracaoMinutos) => {
        const res = await ctx.api
          .post('/atendimentos')
          .set(bearer(t.token))
          .send({
            aprendenteId,
            dataAtendimento: horarioFuturo(12, hora, minuto),
            duracaoMinutos,
            tituloSessao: 'Conflitante',
          })
          .expect(400);
        expect(res.body.message).toBe(MENSAGEM_CONFLITO);
      },
    );

    it('aceita agendamento que começa exatamente quando o outro termina', async () => {
      await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(12, 15),
        duracaoMinutos: 60,
      });
    });

    it('o conflito é por terapeuta: vale também para outro aprendente do mesmo terapeuta', async () => {
      const outro = await criarAprendente(ctx, t, {
        nomeCompleto: 'Outro Aprendente',
      });
      await ctx.api
        .post('/atendimentos')
        .set(bearer(t.token))
        .send({
          aprendenteId: outro.id,
          dataAtendimento: horarioFuturo(12, 14, 15),
          tituloSessao: 'Conflitante',
        })
        .expect(400);
    });

    it('outro terapeuta pode agendar no mesmo horário', async () => {
      const t2 = await criarTerapeuta(ctx);
      const aprendente2 = await criarAprendente(ctx, t2);
      await criarAtendimento(ctx, t2, aprendente2.id, {
        dataAtendimento: horarioFuturo(12, 14),
      });
    });

    it('rejeita com 400 a edição que move um atendimento para cima de outro', async () => {
      const segundo = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(12, 18),
      });
      const res = await ctx.api
        .patch(`/atendimentos/${segundo.id}`)
        .set(bearer(t.token))
        .send({ dataAtendimento: horarioFuturo(12, 14, 30) })
        .expect(400);
      expect(res.body.message).toBe(MENSAGEM_CONFLITO);

      // Aumentar a duração até invadir o próximo também conflita.
      await ctx.api
        .patch(`/atendimentos/${primeiroId}`)
        .set(bearer(t.token))
        .send({ duracaoMinutos: 90 })
        .expect(400);

      const noBanco = await ctx.prisma.atendimento.findUniqueOrThrow({
        where: { id: segundo.id },
      });
      expect(noBanco.dataAtendimento.toISOString()).toBe(horarioFuturo(12, 18));
    });

    it('a edição não conflita com o próprio atendimento', async () => {
      await ctx.api
        .patch(`/atendimentos/${primeiroId}`)
        .set(bearer(t.token))
        .send({ dataAtendimento: horarioFuturo(12, 14), duracaoMinutos: 45 })
        .expect(200);
    });
  });

  describe('Mudança de status', () => {
    let t: Terapeuta;
    let aprendenteId: string;

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
      aprendenteId = (await criarAprendente(ctx, t)).id;
    });

    it('altera o status pela rota dedicada e persiste no banco', async () => {
      const atendimento = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(15, 9),
      });
      for (const status of [
        'CONFIRMADO',
        'EM_ANDAMENTO',
        'CONCLUIDO',
        'FALTA',
      ]) {
        const res = await ctx.api
          .patch(`/atendimentos/${atendimento.id}/status`)
          .set(bearer(t.token))
          .send({ status })
          .expect(200);
        expect(res.body.status).toBe(status);
      }
      const noBanco = await ctx.prisma.atendimento.findUniqueOrThrow({
        where: { id: atendimento.id },
      });
      expect(noBanco.status).toBe('FALTA');
    });

    it('rejeita status inexistente com 400', async () => {
      const atendimento = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(15, 11),
      });
      await ctx.api
        .patch(`/atendimentos/${atendimento.id}/status`)
        .set(bearer(t.token))
        .send({ status: 'ADIADO' })
        .expect(400);
    });

    it('FALTA continua ocupando o horário', async () => {
      // O atendimento das 09:00 do dia 15 ficou como FALTA no teste anterior.
      await ctx.api
        .post('/atendimentos')
        .set(bearer(t.token))
        .send({
          aprendenteId,
          dataAtendimento: horarioFuturo(15, 9),
          tituloSessao: 'x',
        })
        .expect(400);
    });

    it('CANCELADO libera o horário para um novo agendamento', async () => {
      const original = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(15, 16),
      });
      await ctx.api
        .post('/atendimentos')
        .set(bearer(t.token))
        .send({
          aprendenteId,
          dataAtendimento: horarioFuturo(15, 16),
          tituloSessao: 'x',
        })
        .expect(400);

      await ctx.api
        .patch(`/atendimentos/${original.id}/status`)
        .set(bearer(t.token))
        .send({ status: 'CANCELADO' })
        .expect(200);

      const novo = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(15, 16),
        tituloSessao: 'Remarcada',
      });
      expect(novo.status).toBe('AGUARDANDO_CONFIRMACAO');
    });

    it('um atendimento editado para CANCELADO não é barrado pelo conflito', async () => {
      const ocupante = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(16, 10),
      });
      const outro = await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(16, 12),
      });
      await ctx.api
        .patch(`/atendimentos/${outro.id}`)
        .set(bearer(t.token))
        .send({ dataAtendimento: horarioFuturo(16, 10), status: 'CANCELADO' })
        .expect(200);
      expect(ocupante.id).not.toBe(outro.id);
    });

    it('a fase do aprendente passa para o próximo atendimento e aparece por sessão nos gráficos', async () => {
      const aprendente = await criarAprendente(ctx, t, {
        nomeCompleto: 'Carla Fases',
      });
      const linhaBase = await criarAtendimento(ctx, t, aprendente.id, {
        dataAtendimento: horarioFuturo(20, 9),
      });
      const fase = await ctx.api
        .patch(`/aprendentes/${aprendente.id}/fase`)
        .set(bearer(t.token))
        .send({ fase: 'INTERVENCAO' })
        .expect(200);
      expect(fase.body.faseAtual).toBe('INTERVENCAO');
      const intervencao = await criarAtendimento(ctx, t, aprendente.id, {
        dataAtendimento: horarioFuturo(21, 9),
      });
      expect(intervencao.fase).toBe('INTERVENCAO');

      const graficos = await ctx.api
        .get(`/aprendentes/${aprendente.id}/graficos-acompanhamento`)
        .set(bearer(t.token))
        .expect(200);
      expect(graficos.body).toEqual([
        expect.objectContaining({
          id: linhaBase.id,
          fase: 'LINHA_BASE',
          score: 0,
        }),
        expect.objectContaining({
          id: intervencao.id,
          fase: 'INTERVENCAO',
          score: 0,
        }),
      ]);
    });

    it('rejeita agendamento em data passada com 400', async () => {
      await ctx.api
        .post('/atendimentos')
        .set(bearer(t.token))
        .send({
          aprendenteId,
          dataAtendimento: '2020-01-01T10:00:00.000Z',
          tituloSessao: 'x',
        })
        .expect(400);
    });
  });

  describe('PEI e PeiTemplate', () => {
    let t: Terapeuta;
    let aprendenteId: string;
    let templateId: string;
    let peiId: string;

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
      aprendenteId = (await criarAprendente(ctx, t)).id;
    });

    it('cria, lista e edita um molde de PEI', async () => {
      const criado = await ctx.api
        .post('/pei-templates')
        .set(bearer(t.token))
        .send({
          nome: 'Molde Dislexia',
          dificuldades: 'Leitura silabada',
          objetivos: 'Fluência',
          estrategias: 'Método fônico',
        })
        .expect(201);
      templateId = criado.body.id;

      const editado = await ctx.api
        .patch(`/pei-templates/${templateId}`)
        .set(bearer(t.token))
        .send({ objetivos: 'Fluência e compreensão' })
        .expect(200);
      expect(editado.body).toMatchObject({
        nome: 'Molde Dislexia',
        objetivos: 'Fluência e compreensão',
      });

      const lista = await ctx.api
        .get('/pei-templates')
        .set(bearer(t.token))
        .expect(200);
      expect(lista.body.map((x: { id: string }) => x.id)).toEqual([templateId]);
    });

    it('cria um PEI a partir do molde, lê e edita', async () => {
      const criado = await ctx.api
        .post('/peis')
        .set(bearer(t.token))
        .send({
          aprendenteId,
          dificuldades: 'Leitura silabada',
          objetivos: 'Fluência e compreensão',
          estrategias: 'Método fônico',
          dataInicio: '2026-03-01',
          templateOrigemId: templateId,
        })
        .expect(201);
      peiId = criado.body.id;
      expect(criado.body.templateOrigemId).toBe(templateId);

      const editado = await ctx.api
        .patch(`/peis/${peiId}`)
        .set(bearer(t.token))
        .send({ estrategias: 'Método fônico + jogos', dataFim: '2026-12-15' })
        .expect(200);
      expect(editado.body.estrategias).toBe('Método fônico + jogos');
      expect(editado.body.dataFim).toBe('2026-12-15T00:00:00.000Z');

      const lido = await ctx.api
        .get(`/peis/${peiId}`)
        .set(bearer(t.token))
        .expect(200);
      expect(lido.body.estrategias).toBe('Método fônico + jogos');

      const filtrados = await ctx.api
        .get('/peis')
        .query({ aprendenteId })
        .set(bearer(t.token))
        .expect(200);
      expect(filtrados.body.map((x: { id: string }) => x.id)).toEqual([peiId]);
    });

    it('rejeita PEI sem campos obrigatórios com 400', async () => {
      await ctx.api
        .post('/peis')
        .set(bearer(t.token))
        .send({ aprendenteId, dataInicio: '2026-03-01' })
        .expect(400);
    });

    it('exclui o PEI com soft delete: some da API mas continua no banco com deletedAt', async () => {
      await ctx.api.delete(`/peis/${peiId}`).set(bearer(t.token)).expect(204);

      await ctx.api.get(`/peis/${peiId}`).set(bearer(t.token)).expect(404);
      const lista = await ctx.api.get('/peis').set(bearer(t.token)).expect(200);
      expect(lista.body).toEqual([]);
      await ctx.api.delete(`/peis/${peiId}`).set(bearer(t.token)).expect(404);

      const noBanco = await ctx.prisma.pEI.findUnique({ where: { id: peiId } });
      expect(noBanco).not.toBeNull();
      expect(noBanco!.deletedAt).toBeInstanceOf(Date);
      expect(noBanco!.estrategias).toBe('Método fônico + jogos');
    });

    it('exclui o molde com soft delete: some da API mas continua no banco com deletedAt', async () => {
      await ctx.api
        .delete(`/pei-templates/${templateId}`)
        .set(bearer(t.token))
        .expect(204);

      await ctx.api
        .get(`/pei-templates/${templateId}`)
        .set(bearer(t.token))
        .expect(404);
      const lista = await ctx.api
        .get('/pei-templates')
        .set(bearer(t.token))
        .expect(200);
      expect(lista.body).toEqual([]);

      const noBanco = await ctx.prisma.peiTemplate.findUnique({
        where: { id: templateId },
      });
      expect(noBanco).not.toBeNull();
      expect(noBanco!.deletedAt).toBeInstanceOf(Date);

      // Molde excluído não pode mais originar PEI.
      await ctx.api
        .post('/peis')
        .set(bearer(t.token))
        .send({
          aprendenteId,
          dificuldades: 'x',
          objetivos: 'x',
          estrategias: 'x',
          dataInicio: '2026-03-01',
          templateOrigemId: templateId,
        })
        .expect(404);
    });
  });

  describe('Soft delete de aprendente e atendimento', () => {
    let t: Terapeuta;

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
    });

    it('exclui o atendimento com soft delete: some da API e do calendário mas continua no banco', async () => {
      const aprendente = await criarAprendente(ctx, t);
      const atendimento = await criarAtendimento(ctx, t, aprendente.id, {
        dataAtendimento: horarioFuturo(25, 9),
      });

      await ctx.api
        .delete(`/atendimentos/${atendimento.id}`)
        .set(bearer(t.token))
        .expect(204);
      await ctx.api
        .get(`/atendimentos/${atendimento.id}`)
        .set(bearer(t.token))
        .expect(404);

      const data = new Date(horarioFuturo(25, 9));
      const calendario = await ctx.api
        .get('/atendimentos/calendario')
        .query({ mes: data.getMonth() + 1, ano: data.getFullYear() })
        .set(bearer(t.token))
        .expect(200);
      expect(calendario.body.map((x: { id: string }) => x.id)).not.toContain(
        atendimento.id,
      );

      const noBanco = await ctx.prisma.atendimento.findUnique({
        where: { id: atendimento.id },
      });
      expect(noBanco!.deletedAt).toBeInstanceOf(Date);

      // O horário fica livre de novo.
      await criarAtendimento(ctx, t, aprendente.id, {
        dataAtendimento: horarioFuturo(25, 9),
      });
    });

    it('exclui o aprendente com soft delete, levando junto os atendimentos, sem apagar nada do banco', async () => {
      const aprendente = await criarAprendente(ctx, t, {
        nomeCompleto: 'Diego Excluído',
      });
      const atendimento = await criarAtendimento(ctx, t, aprendente.id, {
        dataAtendimento: horarioFuturo(26, 9),
      });

      await ctx.api
        .delete(`/aprendentes/${aprendente.id}`)
        .set(bearer(t.token))
        .expect(204);
      await ctx.api
        .get(`/aprendentes/${aprendente.id}`)
        .set(bearer(t.token))
        .expect(404);
      const lista = await ctx.api
        .get('/aprendentes')
        .set(bearer(t.token))
        .expect(200);
      expect(lista.body.map((x: { id: string }) => x.id)).not.toContain(
        aprendente.id,
      );

      const aprendenteNoBanco = await ctx.prisma.aprendente.findUnique({
        where: { id: aprendente.id },
      });
      expect(aprendenteNoBanco!.deletedAt).toBeInstanceOf(Date);
      const atendimentoNoBanco = await ctx.prisma.atendimento.findUnique({
        where: { id: atendimento.id },
      });
      expect(atendimentoNoBanco!.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('Tarefas', () => {
    let t: Terapeuta;
    let tarefaId: string;

    beforeAll(async () => {
      t = await criarTerapeuta(ctx);
    });

    it('cria uma tarefa com anotação e a lista', async () => {
      const criada = await ctx.api
        .post('/tarefas')
        .set(bearer(t.token))
        .send({
          texto: 'Ligar para a escola',
          notas: 'Falar com a coordenadora',
        })
        .expect(201);
      tarefaId = criada.body.id;
      expect(criada.body).toMatchObject({
        texto: 'Ligar para a escola',
        notas: 'Falar com a coordenadora',
        concluida: false,
      });

      const lista = await ctx.api
        .get('/tarefas')
        .set(bearer(t.token))
        .expect(200);
      expect(lista.body).toEqual([expect.objectContaining({ id: tarefaId })]);
    });

    it('edita a anotação e marca como concluída, persistindo no banco', async () => {
      await ctx.api
        .patch(`/tarefas/${tarefaId}`)
        .set(bearer(t.token))
        .send({ notas: 'Reunião marcada para sexta, 14h' })
        .expect(200);
      const concluida = await ctx.api
        .patch(`/tarefas/${tarefaId}`)
        .set(bearer(t.token))
        .send({ concluida: true })
        .expect(200);
      expect(concluida.body).toMatchObject({
        texto: 'Ligar para a escola',
        notas: 'Reunião marcada para sexta, 14h',
        concluida: true,
      });

      const noBanco = await ctx.prisma.tarefa.findUniqueOrThrow({
        where: { id: tarefaId },
      });
      expect(noBanco).toMatchObject({
        notas: 'Reunião marcada para sexta, 14h',
        concluida: true,
      });
    });

    it('rejeita tarefa sem texto e campos fora do DTO com 400', async () => {
      await ctx.api
        .post('/tarefas')
        .set(bearer(t.token))
        .send({ notas: 'só nota' })
        .expect(400);
      await ctx.api
        .post('/tarefas')
        .set(bearer(t.token))
        .send({ texto: 'x', usuarioId: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
    });

    it('exclui a tarefa com soft delete', async () => {
      await ctx.api
        .delete(`/tarefas/${tarefaId}`)
        .set(bearer(t.token))
        .expect(204);
      const lista = await ctx.api
        .get('/tarefas')
        .set(bearer(t.token))
        .expect(200);
      expect(lista.body).toEqual([]);
      await ctx.api
        .patch(`/tarefas/${tarefaId}`)
        .set(bearer(t.token))
        .send({ concluida: false })
        .expect(404);

      const noBanco = await ctx.prisma.tarefa.findUnique({
        where: { id: tarefaId },
      });
      expect(noBanco!.deletedAt).toBeInstanceOf(Date);
    });
  });
});
